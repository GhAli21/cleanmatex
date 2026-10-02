/**
 * Tests: cash-drawer.service
 *
 * Covers:
 * - openSession   — creates session, prevents duplicate OPEN sessions
 * - closeSession  — variance calculation, marks session CLOSED
 * - closeSession  — throws via findFirstOrThrow when no OPEN session exists
 * - getDrawers    — returns active drawers filtered by tenant
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// A1/A2 — the service imports `Prisma` for `Prisma.sql`,
// `Prisma.TransactionIsolationLevel`, and the two error classes used to
// detect a double-open unique violation / a SERIALIZABLE conflict. The real
// @prisma/client resolves to its browser stub under Jest, so all of these
// must be mocked here (matches pos-session.service.test.ts for `sql`).
// Classes are defined inline in the factory — jest.mock() factories may not
// reference out-of-scope variables unless they are `mock`-prefixed.
jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(message: string, opts: { code: string; meta?: Record<string, unknown> }) {
      super(message);
      this.code = opts.code;
      this.meta = opts.meta;
    }
  }
  class PrismaClientUnknownRequestError extends Error {}

  return {
    Prisma: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        kind: 'sql',
        strings: Array.from(strings),
        values,
      }),
      TransactionIsolationLevel: { Serializable: 'Serializable' },
      PrismaClientKnownRequestError,
      PrismaClientUnknownRequestError,
    },
  };
});

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
// A2 — openSession, closeSession and approveSessionVariance
// all now run inside prisma.$transaction and take an advisory lock via
// tx.$executeRaw (lockDrawerScope) and/or call generate_cash_drawer_sess_no()
// via tx.$queryRaw. The tx client below reuses the SAME mock functions as
// the top-level prisma client, so existing assertions against e.g.
// mockSessionUpdate still see calls made through `tx`.
const mockQueryRaw                = jest.fn();
const mockExecuteRaw              = jest.fn().mockResolvedValue(undefined);
// A3-3 — closeSession looks up sys_currency_cd.decimal_places for the
// session's own currency to compute a currency-aware variance tolerance.
// Defaults to OMR's real 3 decimal places, matching makeDrawer()/
// makeSession()'s currency_code below.
const mockCurrencyFindUnique       = jest.fn().mockResolvedValue({ decimal_places: 3 });

jest.mock('@/lib/db/prisma', () => {
  const txClient = {
    org_cash_drawers_mst: {
      findFirst: (...a: unknown[]) => mockDrawerFindFirst(...a),
    },
    org_cash_drawer_sessions_mst: {
      findFirst:        (...a: unknown[]) => mockSessionFindFirst(...a),
      findFirstOrThrow: (...a: unknown[]) => mockSessionFindFirstOrThrow(...a),
      create:           (...a: unknown[]) => mockSessionCreate(...a),
      update:           (...a: unknown[]) => mockSessionUpdate(...a),
    },
    org_cash_drawer_movements_dtl: {
      create:   (...a: unknown[]) => mockMovementCreate(...a),
      findMany: (...a: unknown[]) => mockMovementFindMany(...a),
    },
    org_order_payments_dtl: {
      aggregate: (...a: unknown[]) => mockPaymentAggregate(...a),
    },
    sys_currency_cd: {
      findUnique: (...a: unknown[]) => mockCurrencyFindUnique(...a),
    },
    $queryRaw:   (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  };

  return {
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
      $transaction: (fn: (tx: typeof txClient) => unknown) => fn(txClient),
    },
  };
});

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
  resolveCashDrawerSessionId,
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
