/**
 * Tests: order-settlement.service
 *
 * Covers:
 * - settleOrder — writes charge, tax, discount fact rows within transaction
 * - settleOrder — processes CASH leg (payment + order update)
 * - settleOrder — processes WALLET leg via redeemWalletTx
 * - settleOrder — emits ORDER_COMPLETED outbox event
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockChargeCreate   = jest.fn();
const mockTaxCreate      = jest.fn();
const mockDiscountCreate = jest.fn();
const mockPaymentCreate  = jest.fn();
const mockOrderUpdate    = jest.fn();
const mockOutboxCreate   = jest.fn();
const mockTransaction    = jest.fn();
const mockRedeemWallet   = jest.fn();
const mockCashDrawerMovementCreate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

// tenant-settings.service exports a module-level instance that calls the
// browser createClient() at import time — mock before imports resolve.
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  })),
}));

// recalculateOrderFinancialSnapshotTx queries many Prisma models not under test here.
// Mock the entire module so settlement tests stay focused on settleOrder logic.
jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: jest.fn().mockResolvedValue({
    paymentStatus: 'PAID',
    outstandingAmount: 0,
    totalPaidAmount: 100,
    totalCreditAppliedAmount: 0,
  }),
}));

// pricing-mode-resolver is also called deep in recalculate — mocked transitively above.
jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: jest.fn().mockResolvedValue('TAX_EXCLUSIVE'),
}));

jest.mock('@/lib/services/outbox.service', () => ({
  emitEventTx: (...a: unknown[]) => mockOutboxCreate(...a),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  redeemWalletTx:     (...a: unknown[]) => mockRedeemWallet(...a),
  redeemAdvanceTx:    jest.fn(),
  redeemCreditNoteTx: jest.fn(),
}));

jest.mock('@/lib/services/loyalty.service', () => ({
  redeemPointsTx:  jest.fn(),
  queueEarnPoints: jest.fn(),
}));

jest.mock('@/lib/services/gift-card-service', () => ({
  validateGiftCardByIdForCalculation: jest.fn().mockResolvedValue({ isValid: true }),
  redeemGiftCardTx: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { collectPaymentTx, settleOrder } from '@/lib/services/order-settlement.service';
import type { FinancialBreakdownSnapshot, ResolvedSettlementLeg } from '@/lib/types/order-financial';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT  = 'tenant-settle-001';
const ORDER   = 'order-settle-001';

const makeBreakdown = (overrides: Partial<FinancialBreakdownSnapshot> = {}): FinancialBreakdownSnapshot => ({
  subtotal:         100,
  chargesTotal:     0,
  grossTotal:       100,
  discountTotal:    0,
  netBeforeTax:     100,
  taxBreakdown:     [],
  taxTotal:         0,
  grandTotal:       100,
  creditsTotal:     0,
  netReceivable:    100,
  paymentLegsTotal: 100,
  changeReturned:   0,
  outstanding:      0,
  currencyCode:     'OMR',
  decimalPlaces:    3,
  ...overrides,
});

const makeCashLeg = (amount = 100): ResolvedSettlementLeg => ({
  settlementOption: {
    id:                    'opt-cash',
    paymentMethodCode:     'CASH',
    paymentNature:         'REAL_PAYMENT',
    gatewayCode:           null,
    displayName:           'Cash',
    displayName2:          null,
    settlementTypeCode:    null,
    creditApplicationType: null,
    requiresCashDrawer:    false,
    requiresTerminal:      false,
    supportsOverpayment:   false,
    supportsChangeReturn:  true,
    minAmount:             null,
    maxAmount:             null,
    minOrderAmount:        null,
    maxOrderAmount:        null,
    isPlatformDisabled:    false,
    isGloballyDisabled:    false,
  },
  amount,
  cashTendered: amount,
});

const makeWalletLeg = (amount = 100): ResolvedSettlementLeg => ({
  settlementOption: {
    id:                    'opt-wallet',
    paymentMethodCode:     'WALLET',
    paymentNature:         'CREDIT_APPLICATION',
    gatewayCode:           null,
    displayName:           'Wallet',
    displayName2:          null,
    settlementTypeCode:    null,
    creditApplicationType: 'WALLET',
    requiresCashDrawer:    false,
    requiresTerminal:      false,
    supportsOverpayment:   false,
    supportsChangeReturn:  false,
    minAmount:             null,
    maxAmount:             null,
    minOrderAmount:        null,
    maxOrderAmount:        null,
    isPlatformDisabled:    false,
    isGloballyDisabled:    false,
  },
  amount,
  creditReferenceId: 'cust-1',
});

const makeTx = () => ({
  org_order_charges_dtl:    { create: (...a: unknown[]) => mockChargeCreate(...a) },
  org_order_taxes_dtl:      { create: (...a: unknown[]) => mockTaxCreate(...a) },
  org_order_discounts_dtl:  { create: (...a: unknown[]) => mockDiscountCreate(...a) },
  org_order_payments_dtl:   { create: (...a: unknown[]) => mockPaymentCreate(...a) },
  org_payment_methods_cf:   { findFirst: jest.fn() },
  org_branch_payment_methods_cf: { findFirst: jest.fn() },
  org_cash_drawer_sessions_mst: { findFirst: jest.fn() },
  org_cash_drawer_movements_dtl: { create: (...a: unknown[]) => mockCashDrawerMovementCreate(...a) },
  org_order_credit_apps_dtl:{ create: jest.fn().mockResolvedValue({}) },
  org_orders_mst: {
    update:            (...a: unknown[]) => mockOrderUpdate(...a),
    findFirstOrThrow:  jest.fn().mockResolvedValue({ customer_id: 'cust-1' }),
    findFirst:         jest.fn().mockResolvedValue({ customer_id: 'cust-1' }),
  },
  // pricing-mode-resolver.service reads tax_pricing_mode from org_tenants_mst inside the tx
  org_tenants_mst: {
    findFirst: jest.fn().mockResolvedValue({ tax_pricing_mode: 'TAX_EXCLUSIVE' }),
  },
  org_domain_events_outbox: { create: (...a: unknown[]) => mockOutboxCreate(...a) },
  org_loyalty_txn_dtl:      { create: jest.fn() },
  org_loyalty_accounts_mst: { update: jest.fn() },
  $queryRaw: jest.fn().mockResolvedValue([]),
});

describe('order-settlement.service — collectPaymentTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses branch cash drawer override when collecting later cash payment', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: 'branch-1' }]);
    tx.org_payment_methods_cf.findFirst.mockResolvedValue({
      payment_method_code: 'CASH',
      gateway_code: null,
      requires_cash_drawer: false,
      supports_change_return: true,
      supports_overpayment: false,
    });
    tx.org_branch_payment_methods_cf.findFirst.mockResolvedValue({ cash_drawer_required: true });
    tx.org_cash_drawer_sessions_mst.findFirst.mockResolvedValue({
      id: 'session-1',
      cash_drawer_id: 'drawer-1',
      branch_id: 'branch-1',
      currency_code: 'OMR',
    });
    mockPaymentCreate.mockResolvedValue({ id: 'payment-1' });
    mockCashDrawerMovementCreate.mockResolvedValue({ id: 'movement-1' });
    mockOutboxCreate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await collectPaymentTx({
      orderId: ORDER,
      tenantId: TENANT,
      paymentLegs: [{ paymentMethodId: 'method-cash', amount: 50, cashTendered: 51 }],
      cashDrawerSessionId: 'session-1',
      collectedBy: 'user-1',
    });

    expect(mockCashDrawerMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 50,
          cash_drawer_session_id: 'session-1',
          order_payment_id: 'payment-1',
        }),
      })
    );
  });

  it('blocks overpayment introduced by a later collection leg without overpayment policy', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null }]);
    tx.org_payment_methods_cf.findFirst.mockResolvedValue({
      payment_method_code: 'CARD',
      gateway_code: null,
      requires_cash_drawer: false,
      supports_change_return: false,
      supports_overpayment: false,
    });
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(
      collectPaymentTx({
        orderId: ORDER,
        tenantId: TENANT,
        paymentLegs: [{ paymentMethodId: 'method-card', amount: 51 }],
        collectedBy: 'user-1',
      })
    ).rejects.toThrow('METHOD_OVERPAYMENT_NOT_ALLOWED');
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('order-settlement.service — settleOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes charge, tax, and discount fact rows within transaction', async () => {
    const tx = makeTx();
    mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
    mockOutboxCreate.mockResolvedValue({});
    mockPaymentCreate.mockResolvedValue({});
    mockOrderUpdate.mockResolvedValue({});

    await settleOrder({
      orderId:    ORDER,
      tenantId:   TENANT,
      breakdown:  makeBreakdown(),
      chargeLines: [{ chargeType: 'EXPRESS', label: 'Express', amount: 5, sourceId: null, label2: null }],
      taxLines:   [{ taxType: 'VAT', label: 'VAT', label2: null, rate: 5, baseAmount: 100, taxAmount: 5 }],
      discountLines: [{
        sourceType: 'MANUAL', discountType: 'PERCENTAGE', discountRate: 5,
        discountAmount: 5, sourceName: 'Manual', sourceId: null, sourceName2: null,
      }],
      settlementLegs: [makeCashLeg()],
    });

    expect(mockChargeCreate).toHaveBeenCalled();
    expect(mockTaxCreate).toHaveBeenCalled();
    expect(mockDiscountCreate).toHaveBeenCalled();
  });

  it('creates a payment row for CASH leg', async () => {
    const tx = makeTx();
    mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
    mockOutboxCreate.mockResolvedValue({});
    mockPaymentCreate.mockResolvedValue({ id: 'pay-1' });
    mockOrderUpdate.mockResolvedValue({});

    const result = await settleOrder({
      orderId: ORDER, tenantId: TENANT,
      breakdown: makeBreakdown({ grandTotal: 100, netReceivable: 100 }),
      chargeLines: [], taxLines: [], discountLines: [],
      settlementLegs: [makeCashLeg(100)],
    });

    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant_org_id: TENANT, order_id: ORDER }),
      })
    );
    expect(result.paymentStatus).toBeDefined();
  });

  it('emits ORDER_COMPLETED outbox event', async () => {
    const tx = makeTx();
    mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
    mockOutboxCreate.mockResolvedValue({});
    mockPaymentCreate.mockResolvedValue({});
    mockOrderUpdate.mockResolvedValue({});

    await settleOrder({
      orderId: ORDER, tenantId: TENANT,
      breakdown: makeBreakdown(), chargeLines: [], taxLines: [], discountLines: [],
      settlementLegs: [makeCashLeg()],
    });

    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.anything(), TENANT, 'ORDER_COMPLETED',
      expect.any(String), ORDER, expect.any(Object)
    );
  });

  it('routes WALLET leg to redeemWalletTx', async () => {
    const tx = makeTx();
    mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
    mockRedeemWallet.mockResolvedValue({});
    mockOutboxCreate.mockResolvedValue({});
    mockPaymentCreate.mockResolvedValue({});
    mockOrderUpdate.mockResolvedValue({});

    await settleOrder({
      orderId: ORDER, tenantId: TENANT,
      breakdown: makeBreakdown(),
      chargeLines: [], taxLines: [], discountLines: [],
      settlementLegs: [makeWalletLeg()],
    });

    expect(mockRedeemWallet).toHaveBeenCalled();
  });
});
