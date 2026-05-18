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

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
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

import { settleOrder } from '@/lib/services/order-settlement.service';
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
  org_order_credit_apps_dtl:{ create: jest.fn().mockResolvedValue({}) },
  org_orders_mst: {
    update:            (...a: unknown[]) => mockOrderUpdate(...a),
    findFirstOrThrow:  jest.fn().mockResolvedValue({ customer_id: 'cust-1' }),
    findFirst:         jest.fn().mockResolvedValue({ customer_id: 'cust-1' }),
  },
  org_domain_events_outbox: { create: (...a: unknown[]) => mockOutboxCreate(...a) },
  org_loyalty_txn_dtl:      { create: jest.fn() },
  org_loyalty_accounts_mst: { update: jest.fn() },
  $queryRaw: jest.fn().mockResolvedValue([]),
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
