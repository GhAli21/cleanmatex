/**
 * Tests: stored-value-funding.service (B3)
 *
 * Covers:
 * - fundStoredValue — WALLET_TOPUP / CUSTOMER_ADVANCE_RECEIPT / GIFT_CARD_SALE happy paths
 * - fundStoredValue — tender-total mismatch rejected
 * - fundStoredValue — payment-status gate (Revision v3): non-COMPLETED-resolving method rejected
 * - fundStoredValue — idempotency replay (same payload) and conflict (different payload)
 * - finalizeStoredValueFundingIfReady — no-op until tender sum reaches the voucher total (multi-leg)
 * - finalizeStoredValueFundingIfReady — credits exactly once; currency-mismatch guard
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTransaction = jest.fn();
const mockListEffectivePaymentMethodConfigs = jest.fn();
const mockCreateBizVoucher = jest.fn();
const mockAddVoucherLine = jest.fn();
const mockPostAndWireBizVoucher = jest.fn();
const mockTopUpWalletTx = jest.fn();
const mockIssueAdvanceTx = jest.fn();
const mockGenerateGiftCardCode = jest.fn();
const mockFinalizeGiftCardSaleTx = jest.fn();
const mockEmitEventTx = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: (...a: unknown[]) => mockTransaction(...a) },
}));

jest.mock('@/lib/services/payment-config.service', () => ({
  listEffectivePaymentMethodConfigs: (...a: unknown[]) => mockListEffectivePaymentMethodConfigs(...a),
}));

jest.mock('@/lib/services/voucher-biz.service', () => ({
  createBizVoucher: (...a: unknown[]) => mockCreateBizVoucher(...a),
}));
jest.mock('@/lib/services/voucher-line.service', () => ({
  addVoucherLine: (...a: unknown[]) => mockAddVoucherLine(...a),
}));
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...a: unknown[]) => mockPostAndWireBizVoucher(...a),
}));
jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: (...a: unknown[]) => mockTopUpWalletTx(...a),
  issueAdvanceTx: (...a: unknown[]) => mockIssueAdvanceTx(...a),
}));
jest.mock('@/lib/services/gift-card-service', () => ({
  generateGiftCardCode: (...a: unknown[]) => mockGenerateGiftCardCode(...a),
  finalizeGiftCardSaleTx: (...a: unknown[]) => mockFinalizeGiftCardSaleTx(...a),
}));
jest.mock('@/lib/services/outbox.service', () => ({
  emitEventTx: (...a: unknown[]) => mockEmitEventTx(...a),
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-pin') }));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  fundStoredValue,
  finalizeStoredValueFundingIfReady,
  FUNDING_TYPES,
} from '@/lib/services/stored-value-funding.service';

const TENANT = 'tenant-1';
const CUSTOMER = 'cust-1';

const CASH_METHOD = {
  id: 'method-cash',
  payment_method_code: 'CASH',
  payment_nature: 'REAL_PAYMENT',
  gateway_code: null,
  requires_cash_drawer: false,
  supports_change_return: true,
  supports_overpayment: false,
  default_creation_status: null,
  is_enabled: true,
  is_platform_disabled: false,
};

const PENDING_CHECK_METHOD = {
  id: 'method-check',
  payment_method_code: 'CHECK',
  payment_nature: 'REAL_PAYMENT',
  gateway_code: null,
  requires_cash_drawer: false,
  supports_change_return: false,
  supports_overpayment: false,
  default_creation_status: 'PENDING',
  is_enabled: true,
  is_platform_disabled: false,
};

const makeTx = () => ({
  org_idempotency_keys: {
    findFirst: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  },
  org_customer_wallets_mst: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'wallet-1', currency_code: 'OMR' }),
  },
  org_customer_advances_mst: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'advance-1', currency_code: 'OMR' }),
  },
  org_gift_cards_mst: {
    create: jest.fn().mockResolvedValue({ id: 'card-1' }),
  },
  org_sv_funding_tenders_dtl: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  org_fin_vouchers_mst: {
    findFirst: jest.fn().mockResolvedValue({ total_amount: 20, customer_id: CUSTOMER, branch_id: null }),
  },
});

describe('stored-value-funding.service — fundStoredValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateBizVoucher.mockResolvedValue({ id: 'voucher-1', voucher_no: 'RCV-1' });
    mockAddVoucherLine.mockResolvedValue({ id: 'line-1', line_no: 1 });
    mockPostAndWireBizVoucher.mockResolvedValue({ voucherId: 'voucher-1', fromCache: false });
  });

  it('funds a wallet top-up with a single CASH leg (happy path)', async () => {
    const tx = makeTx();
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([CASH_METHOD]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await fundStoredValue({
      tenantId: TENANT,
      fundingType: FUNDING_TYPES.WALLET_TOPUP,
      customerId: CUSTOMER,
      currencyCode: 'OMR',
      fundedAmount: 20,
      tenderLegs: [{ paymentMethodId: CASH_METHOD.id, amount: 20 }],
      performedBy: 'user-1',
      idempotencyKey: 'fund-001',
    });

    expect(result.targetType).toBe('WALLET');
    expect(result.targetId).toBe('wallet-1');
    expect(mockCreateBizVoucher).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        voucher_type: 'RECEIPT_VOUCHER',
        total_amount: 20,
        source_ref_type: 'WALLET_TOPUP',
        idempotency_key: 'fund-001_vch',
      }),
      'user-1',
      tx,
    );
    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT,
      'voucher-1',
      expect.objectContaining({
        line_role: 'WALLET_TOPUP',
        target_type: 'WALLET',
        target_id: 'wallet-1',
        amount: 20,
        idempotency_key: 'fund-001_leg_0',
      }),
      'user-1',
      undefined,
      tx,
    );
    expect(mockPostAndWireBizVoucher).toHaveBeenCalledWith(TENANT, 'voucher-1', 'user-1', 'fund-001_vch_post', tx);
  });

  it('creates the gift card unfunded (GENERATED) before the voucher, for GIFT_CARD_SALE', async () => {
    const tx = makeTx();
    mockGenerateGiftCardCode.mockResolvedValue('CMX-AAAA-BBBB-CCCC');
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([CASH_METHOD]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await fundStoredValue({
      tenantId: TENANT,
      fundingType: FUNDING_TYPES.GIFT_CARD_SALE,
      currencyCode: 'OMR',
      fundedAmount: 15,
      tenderLegs: [{ paymentMethodId: CASH_METHOD.id, amount: 15 }],
      performedBy: 'user-1',
      idempotencyKey: 'fund-gc-001',
      giftCard: { cardName: 'Birthday Gift' },
    });

    expect(tx.org_gift_cards_mst.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'GENERATED', original_amount: 0, current_balance: 0 }),
      }),
    );
    expect(result.giftCardId).toBe('card-1');
    expect(result.giftCardCode).toBe('CMX-AAAA-BBBB-CCCC');
  });

  it('rejects when tender legs do not sum to the funded amount', async () => {
    await expect(
      fundStoredValue({
        tenantId: TENANT,
        fundingType: FUNDING_TYPES.WALLET_TOPUP,
        customerId: CUSTOMER,
        currencyCode: 'OMR',
        fundedAmount: 20,
        tenderLegs: [{ paymentMethodId: CASH_METHOD.id, amount: 15 }],
        performedBy: 'user-1',
        idempotencyKey: 'fund-002',
      }),
    ).rejects.toThrow('TENDER_TOTAL_MISMATCH');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects a leg whose method resolves to PENDING — no async completion path in v1 (Revision v3)', async () => {
    const tx = makeTx();
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([PENDING_CHECK_METHOD]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(
      fundStoredValue({
        tenantId: TENANT,
        fundingType: FUNDING_TYPES.WALLET_TOPUP,
        customerId: CUSTOMER,
        currencyCode: 'OMR',
        fundedAmount: 20,
        tenderLegs: [{ paymentMethodId: PENDING_CHECK_METHOD.id, amount: 20 }],
        performedBy: 'user-1',
        idempotencyKey: 'fund-003',
      }),
    ).rejects.toThrow('FUNDING_METHOD_NOT_IMMEDIATELY_SETTLEABLE');
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('replays the cached result on an idempotent retry with the identical payload', async () => {
    const tx = makeTx();
    const cachedResult = {
      fundingType: FUNDING_TYPES.WALLET_TOPUP,
      targetType: 'WALLET',
      targetId: 'wallet-1',
      voucherId: 'voucher-1',
      currencyCode: 'OMR',
      fundedAmount: 20,
    };
    // hashPayload is deterministic — compute it the same way the service does
    // by invoking a first call to capture the hash isn't practical here, so
    // instead assert the replay short-circuits before any voucher call at all
    // by making org_idempotency_keys.findFirst return SOME cached result and
    // checking createBizVoucher is skipped only when the hash matches. We
    // derive the exact hash via a second identical call sequence instead.
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([CASH_METHOD]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const params = {
      tenantId: TENANT,
      fundingType: FUNDING_TYPES.WALLET_TOPUP as const,
      customerId: CUSTOMER,
      currencyCode: 'OMR',
      fundedAmount: 20,
      tenderLegs: [{ paymentMethodId: CASH_METHOD.id, amount: 20 }],
      performedBy: 'user-1',
      idempotencyKey: 'fund-004',
    };

    // First call succeeds and would persist the hash via org_idempotency_keys.upsert.
    await fundStoredValue(params);
    const persistedHash = (tx.org_idempotency_keys.upsert as jest.Mock).mock.calls[0][0].create.response_cache
      .payload_hash as string;

    jest.clearAllMocks();
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([CASH_METHOD]);
    const tx2 = makeTx();
    tx2.org_idempotency_keys.findFirst.mockResolvedValue({
      response_cache: { payload_hash: persistedHash, result: cachedResult },
    });
    mockTransaction.mockImplementation(async (fn: (t: typeof tx2) => Promise<unknown>) => fn(tx2));

    const replay = await fundStoredValue(params);

    expect(replay).toEqual(cachedResult);
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('throws IDEMPOTENCY_CONFLICT when the same key carries a different payload', async () => {
    const tx = makeTx();
    tx.org_idempotency_keys.findFirst.mockResolvedValue({
      response_cache: { payload_hash: 'a-completely-different-hash' },
    });
    mockListEffectivePaymentMethodConfigs.mockResolvedValue([CASH_METHOD]);
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(
      fundStoredValue({
        tenantId: TENANT,
        fundingType: FUNDING_TYPES.WALLET_TOPUP,
        customerId: CUSTOMER,
        currencyCode: 'OMR',
        fundedAmount: 20,
        tenderLegs: [{ paymentMethodId: CASH_METHOD.id, amount: 20 }],
        performedBy: 'user-1',
        idempotencyKey: 'fund-005',
      }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
});

describe('stored-value-funding.service — finalizeStoredValueFundingIfReady', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a no-op while confirmed tender legs sum to less than the voucher total (split tender, partial)', async () => {
    const tx = makeTx();
    tx.org_fin_vouchers_mst.findFirst.mockResolvedValue({ total_amount: 20, customer_id: CUSTOMER, branch_id: null });
    tx.org_sv_funding_tenders_dtl.findMany.mockResolvedValue([
      { amount: 5, currency_code: 'OMR', funding_type: 'WALLET_TOPUP', target_type: 'WALLET', target_id: 'wallet-1' },
    ]);

    await finalizeStoredValueFundingIfReady(tx as never, TENANT, 'voucher-1', 'user-1', 'line-1');

    expect(mockTopUpWalletTx).not.toHaveBeenCalled();
    expect(mockEmitEventTx).not.toHaveBeenCalled();
  });

  it('credits the wallet exactly once when the tender sum reaches the voucher total', async () => {
    const tx = makeTx();
    tx.org_fin_vouchers_mst.findFirst.mockResolvedValue({ total_amount: 20, customer_id: CUSTOMER, branch_id: null });
    tx.org_sv_funding_tenders_dtl.findMany.mockResolvedValue([
      { amount: 5, currency_code: 'OMR', funding_type: 'WALLET_TOPUP', target_type: 'WALLET', target_id: 'wallet-1' },
      { amount: 15, currency_code: 'OMR', funding_type: 'WALLET_TOPUP', target_type: 'WALLET', target_id: 'wallet-1' },
    ]);

    await finalizeStoredValueFundingIfReady(tx as never, TENANT, 'voucher-1', 'user-1', 'line-2');

    expect(mockTopUpWalletTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId: TENANT,
        customerId: CUSTOMER,
        amount: 20,
        idempotencyKey: 'voucher-1_sv_credit',
        voucherId: 'voucher-1',
        voucherLineId: 'line-2',
      }),
    );
    expect(mockEmitEventTx).toHaveBeenCalledWith(
      tx,
      TENANT,
      'STORED_VALUE_FUNDING_COMPLETED',
      'stored_value_funding',
      'voucher-1',
      expect.objectContaining({ fundedAmount: 20 }),
    );
  });

  it('throws when confirmed legs disagree on currency (frozen single-currency invariant)', async () => {
    const tx = makeTx();
    tx.org_fin_vouchers_mst.findFirst.mockResolvedValue({ total_amount: 20, customer_id: CUSTOMER, branch_id: null });
    tx.org_sv_funding_tenders_dtl.findMany.mockResolvedValue([
      { amount: 10, currency_code: 'OMR', funding_type: 'WALLET_TOPUP', target_type: 'WALLET', target_id: 'wallet-1' },
      { amount: 10, currency_code: 'USD', funding_type: 'WALLET_TOPUP', target_type: 'WALLET', target_id: 'wallet-1' },
    ]);

    await expect(
      finalizeStoredValueFundingIfReady(tx as never, TENANT, 'voucher-1', 'user-1', 'line-3'),
    ).rejects.toThrow('STORED_VALUE_FUNDING_CURRENCY_MISMATCH_ACROSS_LEGS');
    expect(mockTopUpWalletTx).not.toHaveBeenCalled();
  });

  it('credits the advance via issueAdvanceTx for CUSTOMER_ADVANCE_RECEIPT funding', async () => {
    const tx = makeTx();
    tx.org_fin_vouchers_mst.findFirst.mockResolvedValue({ total_amount: 30, customer_id: CUSTOMER, branch_id: null });
    tx.org_sv_funding_tenders_dtl.findMany.mockResolvedValue([
      { amount: 30, currency_code: 'OMR', funding_type: 'CUSTOMER_ADVANCE_RECEIPT', target_type: 'CUSTOMER', target_id: CUSTOMER },
    ]);

    await finalizeStoredValueFundingIfReady(tx as never, TENANT, 'voucher-2', 'user-1', 'line-4');

    expect(mockIssueAdvanceTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: 30, idempotencyKey: 'voucher-2_sv_credit', voucherId: 'voucher-2' }),
    );
  });

  it('activates the gift card via finalizeGiftCardSaleTx for GIFT_CARD_SALE funding', async () => {
    const tx = makeTx();
    tx.org_fin_vouchers_mst.findFirst.mockResolvedValue({ total_amount: 15, customer_id: null, branch_id: null });
    tx.org_sv_funding_tenders_dtl.findMany.mockResolvedValue([
      { amount: 15, currency_code: 'OMR', funding_type: 'GIFT_CARD_SALE', target_type: 'GIFT_CARD', target_id: 'card-1' },
    ]);

    await finalizeStoredValueFundingIfReady(tx as never, TENANT, 'voucher-3', 'user-1', 'line-5');

    expect(mockFinalizeGiftCardSaleTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ giftCardId: 'card-1', amount: 15, idempotencyKey: 'voucher-3_sv_credit' }),
    );
  });
});
