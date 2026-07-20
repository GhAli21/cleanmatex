/**
 * Tests: cash-drawer.service
 *
 * Covers:
 * - openSession   — creates session, prevents duplicate OPEN sessions
 * - closeSession  — variance calculation, marks session CLOSED
 * - closeSession  — throws via findFirstOrThrow when no OPEN session exists
 * - recordMovement — appends movement row scoped to open session
 * - getDrawers    — returns active drawers filtered by tenant
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDrawerFindMany          = jest.fn();
const mockDrawerFindFirstOrThrow  = jest.fn();
const mockSessionFindFirst        = jest.fn();
const mockSessionFindMany         = jest.fn();
const mockSessionFindFirstOrThrow = jest.fn();
const mockSessionCreate           = jest.fn();
const mockSessionUpdate           = jest.fn();
const mockSessionCount            = jest.fn();
const mockMovementCreate          = jest.fn();
const mockMovementFindMany        = jest.fn();
const mockPaymentAggregate        = jest.fn();
const mockDrawerFindFirst         = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_cash_drawers_mst: {
      findMany:         (...a: unknown[]) => mockDrawerFindMany(...a),
      findFirst:        (...a: unknown[]) => mockDrawerFindFirst(...a),
      findFirstOrThrow: (...a: unknown[]) => mockDrawerFindFirstOrThrow(...a),
    },
    org_cash_drawer_sessions_mst: {
      findFirst:         (...a: unknown[]) => mockSessionFindFirst(...a),
      findMany:          (...a: unknown[]) => mockSessionFindMany(...a),
      findFirstOrThrow:  (...a: unknown[]) => mockSessionFindFirstOrThrow(...a),
      create:            (...a: unknown[]) => mockSessionCreate(...a),
      update:            (...a: unknown[]) => mockSessionUpdate(...a),
      count:             (...a: unknown[]) => mockSessionCount(...a),
    },
    org_cash_drawer_movements_dtl: {
      create:   (...a: unknown[]) => mockMovementCreate(...a),
      findMany: (...a: unknown[]) => mockMovementFindMany(...a),
    },
    org_order_payments_dtl: {
      aggregate: (...a: unknown[]) => mockPaymentAggregate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  getDrawers,
  getDrawersWithCurrentSession,
  openSession,
  closeSession,
  recordMovement,
  resolveCashDrawerSessionId,
  approveSessionVariance,
  VarianceApprovalError,
  VARIANCE_APPROVAL_ERRORS,
} from '@/lib/services/cash-drawer.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT  = 'tenant-cd-001';
const DRAWER  = 'drawer-001';
const SESSION = 'session-001';
const USER    = 'user-001';

const makeDrawer = () => ({
  id: DRAWER, tenant_org_id: TENANT, branch_id: 'branch-1',
  currency_code: 'OMR', is_active: true, rec_status: 1,
});

const makeSession = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION, tenant_org_id: TENANT, cash_drawer_id: DRAWER,
  status: 'OPEN', opening_float_amount: new Decimal('100'), currency_code: 'OMR',
  branch_id: 'branch-1',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cash-drawer.service — getDrawers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns active drawers filtered by tenant', async () => {
    const drawers = [makeDrawer()];
    mockDrawerFindMany.mockResolvedValue(drawers);

    const result = await getDrawers(TENANT);
    expect(result).toBe(drawers);
    expect(mockDrawerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_org_id: TENANT }) })
    );
  });

  it('passes branchId filter when provided', async () => {
    mockDrawerFindMany.mockResolvedValue([]);
    await getDrawers(TENANT, 'branch-99');
    expect(mockDrawerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-99' }) })
    );
  });
});

describe('cash-drawer.service — getDrawersWithCurrentSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches the current OPEN session snapshot to matching drawers', async () => {
    mockDrawerFindMany.mockResolvedValue([makeDrawer()]);
    mockSessionFindMany.mockResolvedValue([
      {
        id: SESSION,
        cash_drawer_id: DRAWER,
        session_no: 'SES-000001',
        opened_at: new Date('2026-05-29T10:00:00.000Z'),
        opening_float_amount: new Decimal('25'),
      },
    ]);

    const result = await getDrawersWithCurrentSession(TENANT, 'branch-1');

    expect(result).toHaveLength(1);
    expect(result[0].currentSession).toEqual({
      id: SESSION,
      session_no: 'SES-000001',
      opened_at: '2026-05-29T10:00:00.000Z',
      opening_float_amount: 25,
    });
  });
});

describe('cash-drawer.service — openSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a new OPEN session', async () => {
    mockDrawerFindFirstOrThrow.mockResolvedValue(makeDrawer());
    mockSessionFindFirst.mockResolvedValue(null);
    mockSessionCount.mockResolvedValue(0);
    mockSessionCreate.mockResolvedValue(makeSession());

    const result = await openSession(TENANT, DRAWER, { openingBalance: 100, openedBy: USER });
    expect(result).toMatchObject({ status: 'OPEN' });
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OPEN',
          opening_float_amount: 100,
          opened_by: USER,
        }),
      })
    );
  });

  it('throws when an OPEN session already exists', async () => {
    mockDrawerFindFirstOrThrow.mockResolvedValue(makeDrawer());
    mockSessionFindFirst.mockResolvedValue(makeSession());

    await expect(openSession(TENANT, DRAWER, { openingBalance: 50, openedBy: USER }))
      .rejects.toThrow(/already open/i);
  });
});

describe('cash-drawer.service — closeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Defaults: no drawer movements; no per-drawer variance threshold configured.
    mockMovementFindMany.mockResolvedValue([]);
    mockDrawerFindFirst.mockResolvedValue({ variance_approval_threshold: null });
  });

  it('closes the session and computes variance correctly', async () => {
    const session = makeSession({ opening_float_amount: new Decimal('100') });
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('50') } });
    mockSessionUpdate.mockResolvedValue({
      ...session, status: 'CLOSED', counted_cash_amount: new Decimal('145'),
    });

    const result = await closeSession(TENANT, SESSION, { physicalCount: 145, closedBy: USER });
    // expectedCash = 100 + 50 = 150; variance = 145 - 150 = -5
    expect(result.variance).toBeCloseTo(-5);
    expect(result.isBalanced).toBe(false);
  });

  it('sets isBalanced true when variance is < 0.01', async () => {
    const session = makeSession({ opening_float_amount: new Decimal('100') });
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: null } }); // no payments
    mockSessionUpdate.mockResolvedValue({ ...session, status: 'CLOSED' });

    const result = await closeSession(TENANT, SESSION, { physicalCount: 100, closedBy: USER });
    expect(result.isBalanced).toBe(true);
  });

  it('throws when session not found (status OPEN not matched)', async () => {
    mockSessionFindFirstOrThrow.mockRejectedValue(new Error('No cash_drawer_session found'));

    await expect(closeSession(TENANT, 'bad-session', { physicalCount: 0, closedBy: USER }))
      .rejects.toThrow();
  });

  // B16 M2 fix — expected-cash payment filter is unconditional (no flag)
  it('restricts the payment aggregate to active + COMPLETED-set + cash-family', async () => {
    const session = makeSession();
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('50') } });
    mockSessionUpdate.mockResolvedValue({ ...session, status: 'CLOSED' });

    await closeSession(TENANT, SESSION, { physicalCount: 150, closedBy: USER });

    const where = mockPaymentAggregate.mock.calls[0][0].where;
    expect(where.tenant_org_id).toBe(TENANT);
    expect(where.cash_drawer_session_id).toBe(SESSION);
    expect(where.is_active).toBe(true);
    expect([...where.payment_status.in].sort()).toEqual(['CAPTURED', 'COMPLETED', 'SETTLED']);
    expect(where.payment_method_code.in).toContain('CASH');
  });

  // Addendum A2 fix — sale-mirror movements are excluded from expected cash
  it('excludes sale-mirror movements (order_payment_id set) from the expected-cash movement term', async () => {
    const session = makeSession();
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('50') } });
    mockSessionUpdate.mockResolvedValue({ ...session, status: 'CLOSED' });

    await closeSession(TENANT, SESSION, { physicalCount: 150, closedBy: USER });

    const movementWhere = mockMovementFindMany.mock.calls[0][0].where;
    // order_payment_id: null keeps only MANUAL movements; CASH_SALE/change
    // (order_payment_id set) are already counted via the payment total.
    expect(movementWhere.order_payment_id).toBeNull();
    expect(movementWhere.is_active).toBe(true);
  });

  // B16 — OPTIONAL deferred variance-approval gating (opt-in per drawer)
  it('does not flag pending approval when the drawer has no threshold configured (default)', async () => {
    const session = makeSession();
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('50') } });
    // beforeEach default: variance_approval_threshold null
    mockSessionUpdate.mockImplementation(({ data }) => Promise.resolve({ ...session, ...data }));

    // expected = 100 + 50 = 150; counted = 200 -> variance 50, but no threshold set
    const result = await closeSession(TENANT, SESSION, { physicalCount: 200, closedBy: USER });

    expect(result.varianceApprovalPending).toBe(false);
    expect(result.varianceThreshold).toBeNull();
    expect(mockSessionUpdate.mock.calls[0][0].data.variance_threshold_snapshot).toBeNull();
  });

  it('flags pending approval when a threshold is configured and |variance| exceeds it', async () => {
    const session = makeSession();
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('50') } });
    mockDrawerFindFirst.mockResolvedValue({ variance_approval_threshold: new Decimal('1') });
    mockSessionUpdate.mockImplementation(({ data }) => Promise.resolve({ ...session, ...data }));

    const result = await closeSession(TENANT, SESSION, { physicalCount: 200, closedBy: USER });

    expect(result.varianceApprovalPending).toBe(true);
    expect(result.varianceThreshold).toBe(1);
    expect(mockSessionUpdate.mock.calls[0][0].data.variance_threshold_snapshot).toBe(1);
  });

  it('does not flag pending approval when |variance| is within the configured threshold', async () => {
    const session = makeSession();
    mockSessionFindFirstOrThrow.mockResolvedValue(session);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('50') } });
    mockDrawerFindFirst.mockResolvedValue({ variance_approval_threshold: new Decimal('10') });
    mockSessionUpdate.mockImplementation(({ data }) => Promise.resolve({ ...session, ...data }));

    // expected = 150; counted = 155 -> variance 5, within threshold 10
    const result = await closeSession(TENANT, SESSION, { physicalCount: 155, closedBy: USER });

    expect(result.varianceApprovalPending).toBe(false);
    expect(mockSessionUpdate.mock.calls[0][0].data.variance_threshold_snapshot).toBeNull();
  });
});

describe('cash-drawer.service — approveSessionVariance (B16)', () => {
  const closedSession = (over: Record<string, unknown> = {}) => ({
    id: SESSION,
    tenant_org_id: TENANT,
    status: 'CLOSED',
    closed_by: 'closer-001',
    variance_threshold_snapshot: new Decimal('10'),
    variance_approved_by: null,
    variance_approval_reason: null,
    ...over,
  });

  beforeEach(() => jest.clearAllMocks());

  it('approves when the approver differs from the closer and a reason is given', async () => {
    mockSessionFindFirstOrThrow.mockResolvedValue(closedSession());
    mockSessionUpdate.mockImplementation(({ data }) => Promise.resolve({ ...closedSession(), ...data }));

    const result = await approveSessionVariance(TENANT, SESSION, {
      approvedBy: 'supervisor-001',
      reason: 'Verified physical count with cashier',
    });

    expect(result.variance_approved_by).toBe('supervisor-001');
    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION },
        data: expect.objectContaining({
          variance_approved_by: 'supervisor-001',
          variance_approval_reason: 'Verified physical count with cashier',
        }),
      }),
    );
  });

  it('rejects self-approval (approver === closer)', async () => {
    mockSessionFindFirstOrThrow.mockResolvedValue(closedSession({ closed_by: 'user-001' }));

    await expect(
      approveSessionVariance(TENANT, SESSION, { approvedBy: 'user-001', reason: 'ok' }),
    ).rejects.toMatchObject({ code: VARIANCE_APPROVAL_ERRORS.SELF_APPROVAL_BLOCKED });
  });

  it('rejects a blank reason', async () => {
    mockSessionFindFirstOrThrow.mockResolvedValue(closedSession());

    await expect(
      approveSessionVariance(TENANT, SESSION, { approvedBy: 'supervisor-001', reason: '   ' }),
    ).rejects.toMatchObject({ code: VARIANCE_APPROVAL_ERRORS.REASON_REQUIRED });
    expect(mockSessionFindFirstOrThrow).not.toHaveBeenCalled();
  });

  it('rejects when the session has no pending approval (no threshold snapshot)', async () => {
    mockSessionFindFirstOrThrow.mockResolvedValue(closedSession({ variance_threshold_snapshot: null }));

    await expect(
      approveSessionVariance(TENANT, SESSION, { approvedBy: 'supervisor-001', reason: 'ok' }),
    ).rejects.toMatchObject({ code: VARIANCE_APPROVAL_ERRORS.NOT_PENDING_APPROVAL });
  });

  it('rejects a second approval attempt (single-shot)', async () => {
    mockSessionFindFirstOrThrow.mockResolvedValue(
      closedSession({ variance_approved_by: 'supervisor-001' }),
    );

    await expect(
      approveSessionVariance(TENANT, SESSION, { approvedBy: 'supervisor-002', reason: 'ok' }),
    ).rejects.toMatchObject({ code: VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED });
  });

  it('VarianceApprovalError instances carry the expected error code', async () => {
    mockSessionFindFirstOrThrow.mockResolvedValue(closedSession({ closed_by: 'user-001' }));

    try {
      await approveSessionVariance(TENANT, SESSION, { approvedBy: 'user-001', reason: 'ok' });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(VarianceApprovalError);
      expect((error as VarianceApprovalError).code).toBe(VARIANCE_APPROVAL_ERRORS.SELF_APPROVAL_BLOCKED);
    }
  });
});

describe('cash-drawer.service — recordMovement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a movement record for the active session', async () => {
    mockSessionFindFirst.mockResolvedValue(makeSession());
    mockMovementCreate.mockResolvedValue({ id: 'mov-1' });

    await recordMovement(TENANT, DRAWER, {
      movementType: 'CASH_IN',
      amount: 50,
      reason: 'Change fund',
      performedBy: USER,
    });

    expect(mockMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id:  TENANT,
          cash_drawer_id: DRAWER,
          movement_type:  'CASH_IN',
          direction:      'IN',
          amount:         50,
        }),
      })
    );
  });

  it('throws when no open session found for the drawer', async () => {
    mockSessionFindFirst.mockResolvedValue(null);

    await expect(
      recordMovement(TENANT, DRAWER, { movementType: 'CASH_OUT', amount: 10, reason: 'x', performedBy: USER })
    ).rejects.toThrow(/No open session/i);
  });
});

describe('cash-drawer.service — resolveCashDrawerSessionId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the explicitly requested session unchanged', async () => {
    await expect(resolveCashDrawerSessionId(TENANT, 'branch-1', SESSION)).resolves.toBe(SESSION);
    expect(mockSessionFindMany).not.toHaveBeenCalled();
  });

  it('auto-resolves when exactly one OPEN session exists in scope', async () => {
    mockSessionFindMany.mockResolvedValue([{ id: SESSION }]);

    await expect(resolveCashDrawerSessionId(TENANT, 'branch-1')).resolves.toBe(SESSION);
    expect(mockSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_org_id: TENANT,
          branch_id: 'branch-1',
          status: 'OPEN',
        }),
      })
    );
  });

  it('throws when no OPEN session exists in scope', async () => {
    mockSessionFindMany.mockResolvedValue([]);

    await expect(resolveCashDrawerSessionId(TENANT, 'branch-1'))
      .rejects
      .toThrow('CASH_DRAWER_SESSION_REQUIRED');
  });

  it('throws when multiple OPEN sessions require cashier selection', async () => {
    mockSessionFindMany.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);

    await expect(resolveCashDrawerSessionId(TENANT, 'branch-1'))
      .rejects
      .toThrow('CASH_DRAWER_SESSION_SELECTION_REQUIRED');
  });
});
