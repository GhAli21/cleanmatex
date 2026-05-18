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
const mockSessionFindFirstOrThrow = jest.fn();
const mockSessionCreate           = jest.fn();
const mockSessionUpdate           = jest.fn();
const mockSessionCount            = jest.fn();
const mockMovementCreate          = jest.fn();
const mockPaymentAggregate        = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_cash_drawers_mst: {
      findMany:         (...a: unknown[]) => mockDrawerFindMany(...a),
      findFirstOrThrow: (...a: unknown[]) => mockDrawerFindFirstOrThrow(...a),
    },
    org_cash_drawer_sessions_mst: {
      findFirst:         (...a: unknown[]) => mockSessionFindFirst(...a),
      findFirstOrThrow:  (...a: unknown[]) => mockSessionFindFirstOrThrow(...a),
      create:            (...a: unknown[]) => mockSessionCreate(...a),
      update:            (...a: unknown[]) => mockSessionUpdate(...a),
      count:             (...a: unknown[]) => mockSessionCount(...a),
    },
    org_cash_drawer_movements_dtl: {
      create: (...a: unknown[]) => mockMovementCreate(...a),
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

import { getDrawers, openSession, closeSession, recordMovement } from '@/lib/services/cash-drawer.service';
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
  beforeEach(() => jest.clearAllMocks());

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
