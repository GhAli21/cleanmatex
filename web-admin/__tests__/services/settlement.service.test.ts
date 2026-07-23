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
const mockValidateOverpaymentResolution = jest.fn();
const mockExecuteOverpaymentDispositionTx = jest.fn();
const mockExecuteAllocationPreviewTx = jest.fn();

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

jest.mock('@/lib/services/overpayment-resolution-validator.service', () => ({
  validateOverpaymentResolution: (...a: unknown[]) => mockValidateOverpaymentResolution(...a),
}));

jest.mock('@/lib/services/overpayment-disposition.service', () => ({
  executeOverpaymentDispositionTx: (...a: unknown[]) => mockExecuteOverpaymentDispositionTx(...a),
}));

jest.mock('@/lib/services/customer-receipt-excess-executor.service', () => {
  const actual = jest.requireActual('@/lib/services/customer-receipt-excess-executor.service');
  return {
    ...actual,
    executeAllocationPreviewTx: (...a: unknown[]) => mockExecuteAllocationPreviewTx(...a),
  };
});

// B4/B31: collect now resolves methods through the shared D9-aware config
// reader instead of raw org_payment_methods_cf/org_branch_payment_methods_cf
// tx queries.
const mockListEffectivePaymentMethodConfigs = jest.fn();
jest.mock('@/lib/services/payment-config.service', () => ({
  listEffectivePaymentMethodConfigs: (...a: unknown[]) => mockListEffectivePaymentMethodConfigs(...a),
}));

// B4: collect now wires real-payment legs through the same BVM voucher path
// submit-order uses instead of writing org_order_payments_dtl /
// org_cash_drawer_movements_dtl directly.
const mockCreateBizVoucher = jest.fn();
jest.mock('@/lib/services/voucher-biz.service', () => ({
  createBizVoucher: (...a: unknown[]) => mockCreateBizVoucher(...a),
}));
const mockAddVoucherLine = jest.fn();
jest.mock('@/lib/services/voucher-line.service', () => ({
  addVoucherLine: (...a: unknown[]) => mockAddVoucherLine(...a),
}));
const mockPostAndWireBizVoucher = jest.fn();
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...a: unknown[]) => mockPostAndWireBizVoucher(...a),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { collectPaymentTx, settleOrder, settleOrderTx } from '@/lib/services/order-settlement.service';
import { hashPayload } from '@/lib/utils/idempotency';
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
  org_idempotency_keys: {
    findFirst: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
});

describe('order-settlement.service — collectPaymentTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wires a CASH leg through the BVM voucher path (B4) using the branch-merged drawer requirement', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([
      {
        id: ORDER,
        outstanding_amount: 50,
        currency_code: 'OMR',
        branch_id: 'branch-1',
        customer_id: 'cust-1',
      },
    ]);
    // requires_cash_drawer: true simulates the branch override already merged
    // in by listEffectivePaymentMethodConfigs — collect no longer re-derives it.
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([
      {
        id: 'method-cash',
        payment_method_code: 'CASH',
        payment_nature: 'REAL_PAYMENT',
        gateway_code: null,
        requires_cash_drawer: true,
        supports_change_return: true,
        supports_overpayment: false,
        default_creation_status: null,
        is_enabled: true,
        is_platform_disabled: false,
      },
    ]);
    mockCreateBizVoucher.mockResolvedValue({ id: 'voucher-1', voucher_no: 'RCV-1' });
    mockAddVoucherLine.mockResolvedValue({ id: 'line-1', line_no: 1 });
    mockPostAndWireBizVoucher.mockResolvedValue({ voucherId: 'voucher-1', fromCache: false });
    mockOutboxCreate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await collectPaymentTx({
      orderId: ORDER,
      tenantId: TENANT,
      paymentLegs: [{ paymentMethodId: 'method-cash', amount: 50, cashTendered: 51 }],
      cashDrawerSessionId: 'session-1',
      collectedBy: 'user-1',
      idempotencyKey: 'collect-cash-001',
    });

    expect(mockCreateBizVoucher).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        voucher_type: 'RECEIPT_VOUCHER',
        order_id: ORDER,
        source_module: 'ORDERS',
        source_ref_id: ORDER,
        total_amount: 50,
        idempotency_key: 'collect-cash-001_vch',
      }),
      'user-1',
      tx,
    );
    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT,
      'voucher-1',
      expect.objectContaining({
        line_role: 'ORDER_PAYMENT',
        payment_method_code: 'CASH',
        // No D9 override configured → falls back to resolveDefaultStatus('CASH') = COMPLETED.
        payment_status: 'COMPLETED',
        amount: 50,
        tendered_amount: 51,
        cash_drawer_session_id: 'session-1',
        idempotency_key: 'collect-cash-001_leg_0',
      }),
      'user-1',
      undefined,
      tx,
    );
    expect(mockPostAndWireBizVoucher).toHaveBeenCalledWith(
      TENANT, 'voucher-1', 'user-1', 'collect-cash-001_vch_post', tx,
    );
    // The old direct-write path must be fully retired — wiring now owns these tables.
    expect(mockPaymentCreate).not.toHaveBeenCalled();
    expect(mockCashDrawerMovementCreate).not.toHaveBeenCalled();
  });

  it('resolves PENDING from the D9 config instead of hardcoding gateway ? PENDING : COMPLETED (B31)', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([
      { id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null, customer_id: 'cust-1' },
    ]);
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([
      {
        id: 'method-check',
        payment_method_code: 'CHECK',
        payment_nature: 'REAL_PAYMENT',
        gateway_code: null,
        requires_cash_drawer: false,
        supports_change_return: false,
        supports_overpayment: false,
        // Tenant explicitly configured CHECK to land PENDING until back-office clears it.
        default_creation_status: 'PENDING',
        is_enabled: true,
        is_platform_disabled: false,
      },
    ]);
    mockCreateBizVoucher.mockResolvedValue({ id: 'voucher-2', voucher_no: 'RCV-2' });
    mockAddVoucherLine.mockResolvedValue({ id: 'line-2', line_no: 1 });
    mockPostAndWireBizVoucher.mockResolvedValue({ voucherId: 'voucher-2', fromCache: false });
    mockOutboxCreate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await collectPaymentTx({
      orderId: ORDER,
      tenantId: TENANT,
      paymentLegs: [{ paymentMethodId: 'method-check', amount: 50, checkNumber: 'CHK-1' }],
      collectedBy: 'user-1',
      idempotencyKey: 'collect-check-001',
    });

    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT, 'voucher-2',
      expect.objectContaining({ payment_status: 'PENDING', check_number: 'CHK-1' }),
      'user-1', undefined, tx,
    );
  });

  // B32 (M8) investigation: allow_status_override is captured on the
  // effective config but deliberately NOT enforced against this explicit
  // per-leg override — doing so would regress the already-shipped/tested B31
  // "explicit PENDING always honored" behavior (see the CHECK test above).
  // This test pins that decision so it cannot silently regress later.
  it('honors an explicit PENDING leg override even when allow_status_override=false (B32 investigation)', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([
      { id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null, customer_id: 'cust-1' },
    ]);
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([
      {
        id: 'method-cash-locked',
        payment_method_code: 'CASH',
        payment_nature: 'REAL_PAYMENT',
        gateway_code: null,
        requires_cash_drawer: false,
        supports_change_return: true,
        supports_overpayment: false,
        default_creation_status: 'COMPLETED',
        allow_status_override: false,
        is_enabled: true,
        is_platform_disabled: false,
      },
    ]);
    mockCreateBizVoucher.mockResolvedValue({ id: 'voucher-override', voucher_no: 'RCV-OV' });
    mockAddVoucherLine.mockResolvedValue({ id: 'line-override', line_no: 1 });
    mockPostAndWireBizVoucher.mockResolvedValue({ voucherId: 'voucher-override', fromCache: false });
    mockOutboxCreate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await collectPaymentTx({
      orderId: ORDER,
      tenantId: TENANT,
      paymentLegs: [{ paymentMethodId: 'method-cash-locked', amount: 50, paymentStatus: 'PENDING' }],
      collectedBy: 'user-1',
      idempotencyKey: 'collect-override-honored',
    });

    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT,
      'voucher-override',
      expect.objectContaining({ payment_status: 'PENDING' }),
      'user-1',
      undefined,
      tx,
    );
  });

  it('rejects a CREDIT_APPLICATION-natured method — later collection only ever records real money', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([
      { id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null, customer_id: 'cust-1' },
    ]);
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([
      {
        id: 'method-wallet',
        payment_method_code: 'WALLET',
        payment_nature: 'CREDIT_APPLICATION',
        gateway_code: null,
        requires_cash_drawer: false,
        supports_change_return: false,
        supports_overpayment: false,
        default_creation_status: null,
        is_enabled: true,
        is_platform_disabled: false,
      },
    ]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(
      collectPaymentTx({
        orderId: ORDER,
        tenantId: TENANT,
        paymentLegs: [{ paymentMethodId: 'method-wallet', amount: 50 }],
        collectedBy: 'user-1',
        idempotencyKey: 'collect-wallet-001',
      })
    ).rejects.toThrow('INVALID_PAYMENT_NATURE_FOR_COLLECTION');
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('requires overpayment resolution when collection exceeds outstanding without retention policy', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([
      { id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null, customer_id: 'cust-1' },
    ]);
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([
      {
        id: 'method-card',
        payment_method_code: 'CARD',
        payment_nature: 'REAL_PAYMENT',
        gateway_code: null,
        requires_cash_drawer: false,
        supports_change_return: false,
        supports_overpayment: false,
        default_creation_status: null,
        is_enabled: true,
        is_platform_disabled: false,
      },
    ]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(
      collectPaymentTx({
        orderId: ORDER,
        tenantId: TENANT,
        paymentLegs: [{ paymentMethodId: 'method-card', amount: 51 }],
        collectedBy: 'user-1',
        idempotencyKey: 'collect-card-001',
      })
    ).rejects.toThrow('OVERPAYMENT_RESOLUTION_REQUIRED');
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('executes overpayment disposition linked to the settlement voucher when collection includes valid resolution (D007)', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([
      { id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null, customer_id: 'cust-1' },
    ]);
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([
      {
        id: 'method-card',
        payment_method_code: 'CARD',
        payment_nature: 'REAL_PAYMENT',
        gateway_code: null,
        requires_cash_drawer: false,
        supports_change_return: false,
        supports_overpayment: false,
        default_creation_status: null,
        is_enabled: true,
        is_platform_disabled: false,
      },
    ]);
    mockCreateBizVoucher.mockResolvedValue({ id: 'voucher-3', voucher_no: 'RCV-3' });
    mockAddVoucherLine.mockResolvedValue({ id: 'line-3', line_no: 1 });
    mockPostAndWireBizVoucher.mockResolvedValue({ voucherId: 'voucher-3', fromCache: false });
    mockOutboxCreate.mockResolvedValue({});
    mockValidateOverpaymentResolution.mockResolvedValue(undefined);
    mockExecuteOverpaymentDispositionTx.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const overpaymentResolution = {
      excessAmount: 5,
      lines: [{ resolutionCode: 'SAVE_AS_CUSTOMER_ADVANCE' as const, amount: 5 }],
    };

    await collectPaymentTx({
      orderId: ORDER,
      tenantId: TENANT,
      paymentLegs: [{ paymentMethodId: 'method-card', amount: 55 }],
      collectedBy: 'user-1',
      overpaymentResolution,
      idempotencyKey: 'collect-advance-001',
    });

    expect(mockValidateOverpaymentResolution).toHaveBeenCalled();
    expect(mockExecuteOverpaymentDispositionTx).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        orderId: ORDER,
        customerId: 'cust-1',
        resolution: overpaymentResolution,
        idempotencyKey: 'collect-advance-001',
        voucherId: 'voucher-3',
      })
    );
    expect(mockCreateBizVoucher).toHaveBeenCalled();
  });

  describe('idempotency (B5/D010)', () => {
    const baseParams = {
      orderId: ORDER,
      tenantId: TENANT,
      paymentLegs: [{ paymentMethodId: 'method-cash', amount: 50, cashTendered: 50 }],
      cashDrawerSessionId: undefined,
      posSessionId: undefined,
      customerId: undefined,
      overpaymentResolution: undefined,
    };

    it('returns the cached result on an identical-payload replay without creating a new voucher', async () => {
      const tx = makeTx();
      tx.$queryRaw.mockResolvedValue([
        { id: ORDER, outstanding_amount: 50, currency_code: 'OMR', branch_id: null, customer_id: 'cust-1' },
      ]);
      const cachedResult = {
        orderId: ORDER,
        paymentStatus: 'PAID',
        totalPaid: 100,
        outstanding: 0,
        changeReturned: 0,
      };
      const matchingHash = hashPayload({
        orderId: baseParams.orderId,
        paymentLegs: baseParams.paymentLegs,
        cashDrawerSessionId: baseParams.cashDrawerSessionId,
        posSessionId: baseParams.posSessionId,
        customerId: baseParams.customerId,
        overpaymentResolution: baseParams.overpaymentResolution,
      });
      tx.org_idempotency_keys.findFirst.mockResolvedValue({
        response_cache: { payload_hash: matchingHash, result: cachedResult },
      });
      mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

      const result = await collectPaymentTx({ ...baseParams, collectedBy: 'user-1', idempotencyKey: 'replay-key' });

      expect(result).toEqual(cachedResult);
      expect(mockCreateBizVoucher).not.toHaveBeenCalled();
      // The replay short-circuits before the order lock re-validates a
      // (possibly now-different) outstanding balance.
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('throws IDEMPOTENCY_CONFLICT when the same key carries a different payload', async () => {
      const tx = makeTx();
      tx.org_idempotency_keys.findFirst.mockResolvedValue({
        response_cache: { payload_hash: 'a-completely-different-hash', result: {} },
      });
      mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

      await expect(
        collectPaymentTx({ ...baseParams, collectedBy: 'user-1', idempotencyKey: 'conflict-key' })
      ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
      expect(mockCreateBizVoucher).not.toHaveBeenCalled();
    });
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

  it('settleOrderTx joins the caller transaction without opening a nested transaction', async () => {
    const tx = makeTx();
    mockOutboxCreate.mockResolvedValue({});
    mockPaymentCreate.mockResolvedValue({ id: 'pay-1' });

    const result = await settleOrderTx(tx, {
      orderId: ORDER,
      tenantId: TENANT,
      breakdown: makeBreakdown(),
      chargeLines: [],
      taxLines: [],
      discountLines: [],
      settlementLegs: [makeCashLeg()],
    });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockPaymentCreate).toHaveBeenCalled();
    expect(result.orderId).toBe(ORDER);
  });
});
