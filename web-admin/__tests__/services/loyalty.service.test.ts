/**
 * Tests: loyalty.service
 *
 * Covers:
 * - getLoyaltyConfig — returns active program with tiers
 * - getLoyaltyAccount — returns active account or null
 * - getCustomerTier — returns highest qualifying tier
 * - redeemPointsTx — deducts points, writes ledger row, FIFO-consumes lots (B19)
 * - redeemPointsTx — throws when account not found
 * - redeemPointsTx — throws INSUFFICIENT when balance < requested
 * - queueEarnPoints — emits LOYALTY_EARN outbox event
 * - processEarnPoints — sets remaining_points on the new EARN lot (B19)
 * - adjustPointsTx — positive delta opens a new lot; negative delta consumes FIFO (B19)
 * - expireLoyaltyPointsForAccount / expireLoyaltyPoints — B19 expiry sweep
 * - getLoyaltyTransactions / getLoyaltyExpirySummary — B19 read helpers
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
const mockLoyaltyTxnFindMany        = jest.fn();
const mockLoyaltyTxnUpdate          = jest.fn();
const mockAllocCreate               = jest.fn();
const mockOutboxCreate              = jest.fn();

// tx-scoped reads used by processEarnPoints (it reads program + account off `tx`)
const mockTxProgramFindFirst        = jest.fn();
const mockTxAccountFindFirst        = jest.fn();
const mockTxAccountCreate           = jest.fn();

// $queryRaw is called for two distinct purposes inside a debit path:
// (1) lock + read the account row, (2) lock + read open lots for FIFO
// consumption. Distinguish by inspecting the SQL text instead of relying on
// call order, so tests stay readable regardless of how many debit helpers
// run in one transaction.
let queuedAccountRows: unknown[] = [];
let queuedLotRows: unknown[] = [];
let queuedExpiredLotRows: unknown[] = [];
const mockTxQueryRaw = jest.fn((strings: TemplateStringsArray) => {
  const sql = Array.isArray(strings) ? strings.join('') : String(strings);
  if (sql.includes('remaining_points') && sql.includes('FOR UPDATE')) {
    if (sql.includes('created_at <')) {
      return Promise.resolve(queuedExpiredLotRows);
    }
    return Promise.resolve(queuedLotRows);
  }
  return Promise.resolve(queuedAccountRows);
});

const mockTx = {
  $queryRaw:                   (...a: unknown[]) => mockTxQueryRaw(...(a as [TemplateStringsArray])),
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
    update:    (...a: unknown[]) => mockLoyaltyTxnUpdate(...a),
  },
  org_loyalty_txn_allocs_dtl: { create: (...a: unknown[]) => mockAllocCreate(...a) },
  org_domain_events_outbox:   { create: (...a: unknown[]) => mockOutboxCreate(...a) },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_loyalty_programs_cf:  { findFirst: (...a: unknown[]) => mockLoyaltyProgramFindFirst(...a) },
    org_loyalty_accounts_mst: { findFirst: (...a: unknown[]) => mockLoyaltyAccountFindFirst(...a) },
    org_loyalty_tiers_cf:     { findFirst: (...a: unknown[]) => mockLoyaltyTierFindFirst(...a) },
    org_loyalty_txn_dtl:      { findMany: (...a: unknown[]) => mockLoyaltyTxnFindMany(...a) },
    $transaction: (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...(a as [TemplateStringsArray])),
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
  adjustPointsTx,
  expireLoyaltyPointsForAccount,
  expireLoyaltyPoints,
  getLoyaltyTransactions,
  getLoyaltyExpirySummary,
  getSpendableLoyaltyPoints,
  syncAvailableLoyaltyPoints,
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
  beforeEach(() => {
    jest.clearAllMocks();
    queuedAccountRows = [];
    queuedLotRows = [];
    queuedExpiredLotRows = [];
  });

  const baseParams = {
    tenantId:       TENANT,
    customerId:     CUST,
    pointsToRedeem: 100,
    monetaryAmount: 1,
    orderId:        ORDER,
    idempotencyKey: IDEM_KEY,
  };

  it('deducts points, creates ledger row, and FIFO-consumes the oldest open lot', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 500 }];
    queuedLotRows = [{ id: 'lot-earn-1', remaining_points: 500 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'txn-1' });
    mockAllocCreate.mockResolvedValue({});

    await redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], baseParams);

    expect(mockLoyaltyAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acct-1' }, data: expect.objectContaining({ points_balance: 400 }) })
    );
    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: -100, points_before: 500, points_after: 400 }),
      })
    );
    // B19 FIFO — drew 100 off the single open lot and recorded the allocation.
    expect(mockLoyaltyTxnUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-earn-1' },
      data: { remaining_points: { decrement: 100 } },
    });
    expect(mockAllocCreate).toHaveBeenCalledWith({
      data: {
        tenant_org_id: TENANT,
        account_id: 'acct-1',
        consuming_txn_id: 'txn-1',
        source_txn_id: 'lot-earn-1',
        applied_points: 100,
      },
    });
  });

  it('spans multiple lots oldest-first when one lot cannot cover the whole redemption', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 500 }];
    queuedLotRows = [
      { id: 'lot-old', remaining_points: 30 },
      { id: 'lot-new', remaining_points: 470 },
    ];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'txn-2' });
    mockAllocCreate.mockResolvedValue({});

    await redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], { ...baseParams, pointsToRedeem: 100 });

    expect(mockAllocCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ source_txn_id: 'lot-old', applied_points: 30 }),
    });
    expect(mockAllocCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ source_txn_id: 'lot-new', applied_points: 70 }),
    });
  });

  it('throws LOYALTY_LOT_ALLOCATION_SHORTFALL when open lots cannot cover the redemption (ledger drift)', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 500 }];
    // Balance says 500, but lots only account for 60 — real drift.
    queuedLotRows = [{ id: 'lot-1', remaining_points: 60 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'txn-3' });
    mockAllocCreate.mockResolvedValue({});

    await expect(
      redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], { ...baseParams, pointsToRedeem: 100 }),
    ).rejects.toThrow('LOYALTY_LOT_ALLOCATION_SHORTFALL');
  });

  it('throws when loyalty account not found', async () => {
    queuedAccountRows = [];

    await expect(
      redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], baseParams)
    ).rejects.toThrow('Loyalty account not found');
  });

  it('throws INSUFFICIENT when balance is too low', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 50 }];

    await expect(
      redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], { ...baseParams, pointsToRedeem: 100 })
    ).rejects.toThrow('Insufficient loyalty points');
  });

  it('expires stale lots before debiting so expired points cannot be spent', async () => {
    mockTxProgramFindFirst.mockResolvedValue({ points_expiry_days: 30 });
    queuedAccountRows = [{ id: 'acct-1', points_balance: 56, customer_id: CUST }];
    queuedExpiredLotRows = [{ id: 'lot-stale', remaining_points: 2 }];
    queuedLotRows = [{ id: 'lot-fresh', remaining_points: 54 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate
      .mockResolvedValueOnce({ id: 'expire-1' })
      .mockResolvedValueOnce({ id: 'redeem-1' });
    mockAllocCreate.mockResolvedValue({});

    await redeemPointsTx(mockTx as Parameters<typeof redeemPointsTx>[0], {
      ...baseParams,
      pointsToRedeem: 10,
    });

    expect(mockLoyaltyTxnCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ txn_type: 'EXPIRE', points: -2 }),
      }),
    );
    expect(mockLoyaltyTxnCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ points: -10, points_before: 54, points_after: 44 }),
      }),
    );
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
    queuedAccountRows = [{ id: 'acct-1', points_balance: 500 }];
    queuedLotRows = [{ id: 'lot-1', remaining_points: 500 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'loy-txn-new' });
    mockAllocCreate.mockResolvedValue({});

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

describe('loyalty.service — processEarnPoints (LOY-1 idempotency-skip; B19 FIFO lot open)', () => {
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

  it('credits points, writes an EARN ledger row, and opens a fully-unconsumed lot', async () => {
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
        data: expect.objectContaining({
          txn_type: 'EARN', points: 50, points_before: 100, points_after: 150,
          remaining_points: 50,
        }),
      })
    );
  });
});

describe('loyalty.service — adjustPointsTx (B19 FIFO)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queuedAccountRows = [];
    queuedLotRows = [];
  });

  it('a positive adjustment opens a new lot (remaining_points = delta)', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 100 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'adj-1' });

    await adjustPointsTx(mockTx as Parameters<typeof adjustPointsTx>[0], {
      tenantId: TENANT, customerId: CUST, delta: 25, adjustedBy: 'user-1',
    });

    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 25, remaining_points: 25 }) }),
    );
    expect(mockTxQueryRaw).toHaveBeenCalledTimes(1); // no lot-consumption query for a credit
  });

  it('a negative adjustment consumes open lots FIFO like a redemption', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 100 }];
    queuedLotRows = [{ id: 'lot-1', remaining_points: 40 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'adj-2' });
    mockAllocCreate.mockResolvedValue({});

    await adjustPointsTx(mockTx as Parameters<typeof adjustPointsTx>[0], {
      tenantId: TENANT, customerId: CUST, delta: -40, adjustedBy: 'user-1',
    });

    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: -40, remaining_points: null }) }),
    );
    expect(mockAllocCreate).toHaveBeenCalledWith({
      data: {
        tenant_org_id: TENANT,
        account_id: 'acct-1',
        consuming_txn_id: 'adj-2',
        source_txn_id: 'lot-1',
        applied_points: 40,
      },
    });
  });

  it('throws when the adjustment would go negative', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 10 }];

    await expect(
      adjustPointsTx(mockTx as Parameters<typeof adjustPointsTx>[0], {
        tenantId: TENANT, customerId: CUST, delta: -20, adjustedBy: 'user-1',
      }),
    ).rejects.toThrow('Adjustment would result in negative balance');
  });
});

describe('loyalty.service — expireLoyaltyPointsForAccount (B19)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queuedAccountRows = [];
    queuedLotRows = [];
    queuedExpiredLotRows = [];
  });

  const cutoff = new Date('2026-01-01T00:00:00.000Z');

  it('expires every open lot older than cutoff into one aggregated EXPIRE row', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 300, customer_id: CUST }];
    queuedExpiredLotRows = [
      { id: 'lot-a', remaining_points: 100 },
      { id: 'lot-b', remaining_points: 50 },
    ];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'expire-1' });
    mockAllocCreate.mockResolvedValue({});

    const result = await expireLoyaltyPointsForAccount(TENANT, 'acct-1', cutoff);

    expect(result).toEqual({ success: true, expiredPoints: 150 });
    expect(mockLoyaltyAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acct-1' },
      data: { points_balance: 150 },
    });
    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ txn_type: 'EXPIRE', points: -150, points_before: 300, points_after: 150 }),
      }),
    );
    expect(mockAllocCreate).toHaveBeenCalledTimes(2);
  });

  it('is a no-op (success, 0 expired) when no lots are old enough', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 300, customer_id: CUST }];
    queuedExpiredLotRows = [];

    const result = await expireLoyaltyPointsForAccount(TENANT, 'acct-1', cutoff);

    expect(result).toEqual({ success: true, expiredPoints: 0 });
    expect(mockLoyaltyAccountUpdate).not.toHaveBeenCalled();
    expect(mockLoyaltyTxnCreate).not.toHaveBeenCalled();
  });

  it('is a no-op replay when remaining expired lots were already zeroed', async () => {
    queuedAccountRows = [{ id: 'acct-1', points_balance: 54, customer_id: CUST }];
    queuedExpiredLotRows = [];

    const result = await expireLoyaltyPointsForAccount(TENANT, 'acct-1', cutoff);

    expect(result).toEqual({ success: true, expiredPoints: 0 });
    expect(mockLoyaltyAccountUpdate).not.toHaveBeenCalled();
    expect(mockLoyaltyTxnCreate).not.toHaveBeenCalled();
  });

  it('returns a failure result (not a throw) when the account is not found', async () => {
    queuedAccountRows = [];

    const result = await expireLoyaltyPointsForAccount(TENANT, 'missing-acct', cutoff);

    expect(result).toEqual({ success: false, expiredPoints: 0, error: 'LOYALTY_ACCOUNT_NOT_FOUND' });
  });
});

describe('loyalty.service — expireLoyaltyPoints (B19 tenant sweep entry point)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queuedAccountRows = [];
    queuedLotRows = [];
    queuedExpiredLotRows = [];
  });

  it('no-ops immediately when the tenant has no active program', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue(null);

    const result = await expireLoyaltyPoints(TENANT);

    expect(result).toEqual({ expiredCount: 0, failedCount: 0 });
  });

  it('no-ops immediately when points_expiry_days is not configured', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: null });

    const result = await expireLoyaltyPoints(TENANT);

    expect(result).toEqual({ expiredCount: 0, failedCount: 0 });
  });

  it('sweeps every eligible account and counts successes', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: 365 });
    // First $queryRaw call from expireLoyaltyPoints itself: eligible accounts.
    mockTxQueryRaw.mockImplementationOnce(() =>
      Promise.resolve([{ account_id: 'acct-1' }, { account_id: 'acct-2' }]),
    );
    queuedAccountRows = [{ id: 'acct-1', points_balance: 100, customer_id: CUST }];
    queuedExpiredLotRows = [{ id: 'lot-1', remaining_points: 100 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'expire-x' });
    mockAllocCreate.mockResolvedValue({});

    const result = await expireLoyaltyPoints(TENANT);

    expect(result.expiredCount).toBe(2);
    expect(result.failedCount).toBe(0);
  });
});

describe('loyalty.service — getLoyaltyTransactions (B19)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps recent ledger rows newest-first', async () => {
    mockLoyaltyTxnFindMany.mockResolvedValue([
      {
        id: 'txn-1', txn_type: 'REDEEM', points: -50, points_before: 150, points_after: 100,
        order_id: ORDER, notes: null, created_at: new Date('2026-02-01T00:00:00Z'),
      },
    ]);

    const rows = await getLoyaltyTransactions(TENANT, 'acct-1');

    expect(rows).toEqual([
      {
        id: 'txn-1', txnType: 'REDEEM', points: -50, pointsBefore: 150, pointsAfter: 100,
        orderId: ORDER, notes: null, createdAt: new Date('2026-02-01T00:00:00Z'),
      },
    ]);
    expect(mockLoyaltyTxnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_org_id: TENANT, account_id: 'acct-1' }, orderBy: { created_at: 'desc' } }),
    );
  });
});

describe('loyalty.service — getLoyaltyExpirySummary (B19)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an all-null summary when the tenant has no expiry policy', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: null });

    const summary = await getLoyaltyExpirySummary(TENANT, 'acct-1');

    expect(summary).toEqual({
      pointsExpiryDays: null,
      nextExpiry: null,
      expiringWithin30Days: 0,
      expiredUnappliedPoints: 0,
    });
    expect(mockLoyaltyTxnFindMany).not.toHaveBeenCalled();
  });

  it('resolves the soonest-expiring lot and the 30-day exposure total', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: 30 });
    const earnedAt = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000); // expires in ~5 days
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { remaining_points: 40, created_at: earnedAt },
    ]);

    const summary = await getLoyaltyExpirySummary(TENANT, 'acct-1');

    expect(summary.pointsExpiryDays).toBe(30);
    expect(summary.nextExpiry?.points).toBe(40);
    expect(summary.expiringWithin30Days).toBe(40);
    expect(summary.expiredUnappliedPoints).toBe(0);
  });

  it('does not treat already-expired lots as upcoming expiry', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: 30 });
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { remaining_points: 2, created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000) },
      { remaining_points: 54, created_at: new Date() },
    ]);

    const summary = await getLoyaltyExpirySummary(TENANT, 'acct-1');

    expect(summary.expiredUnappliedPoints).toBe(2);
    expect(summary.nextExpiry?.points).toBe(54);
    expect(summary.expiringWithin30Days).toBe(54);
  });
});

describe('loyalty.service — getSpendableLoyaltyPoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the full open-lot sum when the tenant has no expiry policy', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: null });
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { remaining_points: 20, created_at: new Date('2020-01-01T00:00:00Z') },
      { remaining_points: 36, created_at: new Date() },
    ]);

    await expect(getSpendableLoyaltyPoints(TENANT, 'acct-1')).resolves.toEqual({
      spendablePoints: 56,
      expiredUnappliedPoints: 0,
    });
  });

  it('excludes lots older than points_expiry_days from spendable (stale ledger case)', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: 30 });
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { remaining_points: 2, created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000) },
      { remaining_points: 54, created_at: new Date() },
    ]);

    await expect(getSpendableLoyaltyPoints(TENANT, 'acct-1')).resolves.toEqual({
      spendablePoints: 54,
      expiredUnappliedPoints: 2,
    });
  });

  it('falls back to the ledger balance when the account has no open lots', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: 30 });
    mockLoyaltyTxnFindMany.mockResolvedValue([]);

    await expect(getSpendableLoyaltyPoints(TENANT, 'acct-1', 56)).resolves.toEqual({
      spendablePoints: 56,
      expiredUnappliedPoints: 0,
    });
  });
});

describe('loyalty.service — syncAvailableLoyaltyPoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queuedAccountRows = [];
    queuedExpiredLotRows = [];
  });

  it('expires due lots then returns live spendable points', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: 30 });
    queuedAccountRows = [{ id: 'acct-1', points_balance: 56, customer_id: CUST }];
    queuedExpiredLotRows = [{ id: 'lot-stale', remaining_points: 2 }];
    mockLoyaltyAccountUpdate.mockResolvedValue({});
    mockLoyaltyTxnCreate.mockResolvedValue({ id: 'expire-live' });
    mockAllocCreate.mockResolvedValue({});
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { remaining_points: 54, created_at: new Date() },
    ]);

    const result = await syncAvailableLoyaltyPoints(TENANT, 'acct-1', 56);

    expect(result).toEqual({
      spendablePoints: 54,
      expiredUnappliedPoints: 0,
      expiredNow: 2,
    });
    expect(mockLoyaltyTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ txn_type: 'EXPIRE', points: -2 }),
      }),
    );
  });

  it('skips the write when the tenant has no expiry policy', async () => {
    mockLoyaltyProgramFindFirst.mockResolvedValue({ points_expiry_days: null });
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { remaining_points: 56, created_at: new Date('2020-01-01T00:00:00Z') },
    ]);

    const result = await syncAvailableLoyaltyPoints(TENANT, 'acct-1', 56);

    expect(result).toEqual({
      spendablePoints: 56,
      expiredUnappliedPoints: 0,
      expiredNow: 0,
    });
    expect(mockLoyaltyAccountUpdate).not.toHaveBeenCalled();
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
    await expect(resolveLoyaltyRedemptionPoints(TENANT, 0.5)).rejects.toMatchObject({
      details: {
        minRedeemPoints: 100,
        pointsToRedeem: 50,
        monetaryAmount: 0.5,
        redeemRatePerPoint: 0.01,
      },
    });
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
