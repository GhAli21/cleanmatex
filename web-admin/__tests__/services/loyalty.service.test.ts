/**
 * Tests: loyalty.service
 *
 * Covers:
 * - getLoyaltyConfig — returns active program with tiers
 * - getLoyaltyAccount — returns active account or null
 * - getCustomerTier — returns highest qualifying tier
 * - redeemPointsTx — deducts points, writes ledger row
 * - redeemPointsTx — throws when account not found
 * - redeemPointsTx — throws INSUFFICIENT when balance < requested
 * - queueEarnPoints — emits LOYALTY_EARN outbox event
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLoyaltyProgramFindFirst   = jest.fn();
const mockLoyaltyAccountFindFirst   = jest.fn();
const mockLoyaltyTierFindFirst      = jest.fn();
const mockLoyaltyAccountUpdate      = jest.fn();
const mockLoyaltyTxnCreate          = jest.fn();
const mockLoyaltyTxnFindFirst       = jest.fn();
const mockOutboxCreate              = jest.fn();

// tx-scoped reads used by processEarnPoints (it reads program + account off `tx`)
const mockTxProgramFindFirst        = jest.fn();
const mockTxAccountFindFirst        = jest.fn();
const mockTxAccountCreate           = jest.fn();

const mockTxQueryRaw = jest.fn();

const mockTx = {
  $queryRaw:                   (...a: unknown[]) => mockTxQueryRaw(...a),
  org_loyalty_programs_cf:    { findFirst: (...a: unknown[]) => mockTxProgramFindFirst(...a) },
  org_loyalty_accounts_mst:   {
    update:    (...a: unknown[]) => mockLoyaltyAccountUpdate(...a),
    findFirst: (...a: unknown[]) => mockTxAccountFindFirst(...a),
    create:    (...a: unknown[]) => mockTxAccountCreate(...a),
  },
  org_loyalty_txn_dtl:        {
    // Phase 2 BVM Wiring: redeemPointsTx calls findFirst first for the
    // idempotency-skip check. Default returns null (no cached row) so
    // existing test cases stay green; specific tests override below.
    findFirst: (...a: unknown[]) => mockLoyaltyTxnFindFirst(...a),
    create:    (...a: unknown[]) => mockLoyaltyTxnCreate(...a),
  },
  org_domain_events_outbox:   { create: (...a: unknown[]) => mockOutboxCreate(...a) },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_loyalty_programs_cf:  { findFirst: (...a: unknown[]) => mockLoyaltyProgramFindFirst(...a) },
    org_loyalty_accounts_mst: { findFirst: (...a: unknown[]) => mockLoyaltyAccountFindFirst(...a) },
    org_loyalty_tiers_cf:     { findFirst: (...a: unknown[]) => mockLoyaltyTierFindFirst(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  getLoyaltyConfig,
  getLoyaltyAccount,
  getCustomerTier,
  redeemPointsTx,
  queueEarnPoints,
  processEarnPoints,
  resolveLoyaltyRedemptionPoints,
  roundLoyaltyPoints,
} from '@/lib/services/loyalty.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT    = 'tenant-loy-001';
const CUST      = 'cust-001';
const ORDER     = 'order-001';
const IDEM_KEY  = 'idem-001';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loyalty.service — getLoyaltyConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the active loyalty program', async () => {
    const prog = { id: 'prog-1', earn_rate: 1, redeem_rate: 0.01 };
    mockLoyaltyProgramFindFirst.mockResolvedValue(prog);

    const result = await getLoyaltyConfig(TENANT);
    expect(result).toBe(prog);
  });

  it('returns null when no program is configured', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue(null);
    expect(await getLoyaltyConfig(TENANT)).toBeNull();
  });
});

describe('loyalty.service — getLoyaltyAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns active account for customer', async () => {
    const acct = { id: 'acct-1', points_balance: 500 };
    mockLoyaltyAccountFindFirst.mockResolvedValue(acct);

    const result = await getLoyaltyAccount(TENANT, CUST);
    expect(result).toBe(acct);
  });

  it('returns null when customer has no account', async () => {
    mockLoyaltyAccountFindFirst.mockResolvedValue(null);
    expect(await getLoyaltyAccount(TENANT, CUST)).toBeNull();
  });
});

describe('loyalty.service — getCustomerTier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns highest qualifying tier', async () => {
    const tier = { id: 'tier-gold', name: 'Gold', min_points: 1000 };
    mockLoyaltyTierFindFirst.mockResolvedValue(tier);

    const result = await getCustomerTier(TENANT, 1500);
    expect(result).toBe(tier);
  });

  it('returns null when points below any tier', async () => {
    mockLoyaltyTierFindFirst.mockResolvedValue(null);
    expect(await getCustomerTier(TENANT, 0)).toBeNull();
  });
});

describe('loyalty.service — redeemPointsTx', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseParams = {
    tenantId:       TENANT,
    customerId:     CUST,
    pointsToRedeem: 100,
    monetaryAmount: 1,
    orderId:        ORDER,
    idempotencyKey: IDEM_KEY,
  };

  it('deducts points and creates ledger row', async () => {
    mockTxQueryRaw.mockResolvedValue([{ id: 'acct-1', points_balance: 500 }]);
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'txn-1' });

    await redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], baseParams);

    expect(mockLoyaltyAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acct-1' }, data: expect.objectContaining({ points_balance: 400 }) })
    );
    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: -100, points_before: 500, points_after: 400 }),
      })
    );
  });

  it('throws when loyalty account not found', async () => {
    mockTxQueryRaw.mockResolvedValue([]);

    await expect(
      redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], baseParams)
    ).rejects.toThrow('Loyalty account not found');
  });

  it('throws INSUFFICIENT when balance is too low', async () => {
    mockTxQueryRaw.mockResolvedValue([{ id: 'acct-1', points_balance: 50 }]);

    await expect(
      redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], { ...baseParams, pointsToRedeem: 100 })
    ).rejects.toThrow('Insufficient loyalty points');
  });

  // Phase 2 BVM Wiring — standardised contract
  it('Phase 2: returns cached row when idempotency_key already produced a ledger entry', async () => {
    const cached = { id: 'loy-txn-existing' };
    mockLoyaltyTxnFindFirst.mockResolvedValueOnce(cached);

    const result = await redeemPointsTx(
      mockTx as Parameters<typeof redeemPointsTx>[0],
      baseParams,
    );

    expect(result).toBe(cached);
    expect(mockTxQueryRaw).not.toHaveBeenCalled();
    expect(mockLoyaltyAccountUpdate).not.toHaveBeenCalled();
    expect(mockLoyaltyTxnCreate).not.toHaveBeenCalled();
  });

  it('Phase 2: persists fin_voucher_id + fin_voucher_trx_line_id on the new ledger row', async () => {
    mockLoyaltyTxnFindFirst.mockResolvedValueOnce(null);
    mockTxQueryRaw.mockResolvedValue([{ id: 'acct-1', points_balance: 500 }]);
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'loy-txn-new' });

    await redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], {
      ...baseParams,
      voucherId:     'vch-5',
      voucherLineId: 'vch-line-5',
    });

    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fin_voucher_id:          'vch-5',
          fin_voucher_trx_line_id: 'vch-line-5',
        }),
      }),
    );
  });
});

describe('loyalty.service — processEarnPoints (LOY-1 idempotency-skip)', () => {
  beforeEach(() => jest.clearAllMocks());

  const earnParams = {
    tenantId:       TENANT,
    customerId:     CUST,
    orderId:        ORDER,
    earnPoints:     50,
    monetaryValue:  10,
    idempotencyKey: IDEM_KEY,
  };

  it('returns the cached row and does NOT re-credit when the key already earned', async () => {
    const cached = { id: 'loy-earn-existing', points: 50 };
    mockLoyaltyTxnFindFirst.mockResolvedValueOnce(cached);

    const result = await processEarnPoints(
      mockTx as Parameters<typeof processEarnPoints>[0],
      earnParams,
    );

    expect(result).toBe(cached);
    // No program lookup, no account mutation, no second ledger row.
    expect(mockTxProgramFindFirst).not.toHaveBeenCalled();
    expect(mockLoyaltyAccountUpdate).not.toHaveBeenCalled();
    expect(mockTxAccountCreate).not.toHaveBeenCalled();
    expect(mockLoyaltyTxnCreate).not.toHaveBeenCalled();
  });

  it('credits points and writes an EARN ledger row on first delivery', async () => {
    mockLoyaltyTxnFindFirst.mockResolvedValueOnce(null);
    mockTxProgramFindFirst.mockResolvedValue({ id: 'prog-1' });
    mockTxAccountFindFirst.mockResolvedValue({ id: 'acct-1', points_balance: 100 });
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'loy-earn-new' });

    await processEarnPoints(mockTx as Parameters<typeof processEarnPoints>[0], earnParams);

    expect(mockLoyaltyAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acct-1' }, data: expect.objectContaining({ points_balance: 150 }) })
    );
    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ txn_type: 'EARN', points: 50, points_before: 100, points_after: 150 }),
      })
    );
  });
});

describe('loyalty.service — queueEarnPoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emits LOYALTY_EARN event via outbox', async () => {
    mockOutboxCreate.mockResolvedValue({});

    await queueEarnPoints(mockTx as Parameters<typeof queueEarnPoints>[0], {
      tenantId: TENANT, customerId: CUST, orderId: ORDER, orderAmount: 50,
    });

    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'LOYALTY_EARN',
          aggregate_type: 'order',
          aggregate_id: ORDER,
        }),
      })
    );
  });
});

describe('loyalty.service — roundLoyaltyPoints (B21)', () => {
  it('CEIL rounds up (pre-B21 hardcoded behavior)', () => {
    expect(roundLoyaltyPoints(10.1, 'CEIL')).toBe(11);
    expect(roundLoyaltyPoints(10.0, 'CEIL')).toBe(10);
  });
  it('FLOOR rounds down', () => {
    expect(roundLoyaltyPoints(10.9, 'FLOOR')).toBe(10);
  });
  it('HALF_UP rounds 0.5 up', () => {
    expect(roundLoyaltyPoints(10.5, 'HALF_UP')).toBe(11);
    expect(roundLoyaltyPoints(10.4, 'HALF_UP')).toBe(10);
  });
  it('HALF_DOWN rounds 0.5 down', () => {
    expect(roundLoyaltyPoints(10.5, 'HALF_DOWN')).toBe(10);
    expect(roundLoyaltyPoints(10.6, 'HALF_DOWN')).toBe(11);
  });
});

describe('loyalty.service — resolveLoyaltyRedemptionPoints (B21)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves points from the tenant-configured rate and rounding rule — never option.minAmount', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({
      redeem_rate_per_point: 0.01,
      min_redeem_points: 100,
      rounding_rule: 'CEIL',
    });

    const points = await resolveLoyaltyRedemptionPoints(TENANT, 5.001);

    // 5.001 / 0.01 = 500.1 -> CEIL -> 501
    expect(points).toBe(501);
  });

  it('throws LOYALTY_NOT_CONFIGURED when no active program exists', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue(null);

    await expect(resolveLoyaltyRedemptionPoints(TENANT, 5)).rejects.toThrow('LOYALTY_NOT_CONFIGURED');
  });

  it('throws LOYALTY_NOT_CONFIGURED when redeem_rate_per_point is 0 (never divides by zero)', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({
      redeem_rate_per_point: 0,
      min_redeem_points: 100,
      rounding_rule: 'CEIL',
    });

    await expect(resolveLoyaltyRedemptionPoints(TENANT, 5)).rejects.toThrow('LOYALTY_NOT_CONFIGURED');
  });

  it('throws LOYALTY_BELOW_MIN_REDEEM when the computed points fall below the configured floor', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({
      redeem_rate_per_point: 0.01,
      min_redeem_points: 100,
      rounding_rule: 'CEIL',
    });

    // 0.50 / 0.01 = 50 points, below the 100-point floor
    await expect(resolveLoyaltyRedemptionPoints(TENANT, 0.5)).rejects.toThrow('LOYALTY_BELOW_MIN_REDEEM');
  });

  it('defaults to CEIL when rounding_rule is missing on an older row', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({
      redeem_rate_per_point: 0.01,
      min_redeem_points: 0,
      rounding_rule: null,
    });

    const points = await resolveLoyaltyRedemptionPoints(TENANT, 1.001);
    expect(points).toBe(101); // 100.1 -> CEIL -> 101
  });
});
