import { prisma } from '@/lib/db/prisma';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  assertOpenPosSessionForFinanceTx,
  autoLinkDrawerTx,
  closePosSession,
  getMyActivePosSession,
  getPosSessionSummary,
  listPosSessionFilterOptions,
  listPosSessions,
  PosSessionError,
  resolvePosSessionForFinanceTx,
  resumePosSession,
} from '@/lib/services/pos-session.service';
import type { PosSessionRow, PosSessionWithContext } from '@/lib/types/pos-session';

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@prisma/client', () => ({
  Prisma: {
    empty: { kind: 'empty' },
    join: (values: unknown[]) => ({ kind: 'join', values }),
    raw: (value: string) => ({ kind: 'raw', value }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      kind: 'sql',
      strings: Array.from(strings),
      values,
    }),
  },
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: (() => {
    const tx = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      org_idempotency_keys: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    };

    return {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
      org_idempotency_keys: tx.org_idempotency_keys,
      __tx: tx,
    };
  })(),
}));

const mockCashControlSettings = jest.fn();
jest.mock('@/lib/services/cash-control-settings.service', () => ({
  getCashControlSettings: (...args: unknown[]) => mockCashControlSettings(...args),
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, callback: () => unknown) => callback(),
}));

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const branchA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const branchB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const drawerSessionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const otherDrawerSessionId = '11111111-2222-4333-8444-555555555555';

type MockedPrisma = {
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  __tx: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    org_idempotency_keys: {
      findFirst: jest.Mock;
      upsert: jest.Mock;
    };
  };
};

const db = prisma as unknown as MockedPrisma;
const mockTx = db.__tx;

function posSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  return {
    id: sessionId,
    tenant_org_id: tenantId,
    branch_id: branchA,
    user_id: userId,
    terminal_id: null,
    cash_drawer_id: null,
    cash_drawer_session_id: null,
    session_no: 'POS-20260704-ABC12345',
    business_date: new Date('2026-07-04T00:00:00.000Z') as unknown as string,
    business_timezone: 'Asia/Muscat',
    status: POS_SESSION_STATUS.OPEN,
    opened_at: new Date('2026-07-04T07:00:00.000Z') as unknown as string,
    opened_by: userId,
    paused_at: null,
    paused_by: null,
    pause_reason: null,
    closed_at: null,
    closed_by: null,
    close_reason: null,
    force_closed_at: null,
    force_closed_by: null,
    force_close_reason: null,
    metadata: {},
    is_active: true,
    rec_status: 1,
    rec_order: 0,
    rec_notes: null,
    created_at: new Date('2026-07-04T07:00:00.000Z') as unknown as string,
    created_by: userId,
    created_info: null,
    updated_at: null,
    updated_by: null,
    updated_info: null,
    ...overrides,
  };
}

function posSessionWithContext(overrides: Partial<PosSessionWithContext> = {}): PosSessionWithContext {
  return {
    ...posSession(),
    branch_name: 'Main Branch',
    branch_name2: 'الفرع الرئيسي',
    terminal_name: 'Front terminal',
    terminal_code: 'TERM-01',
    cash_drawer_name: 'Main Cash Drawer',
    cash_drawer_session_no: 'CDS-001',
    cash_drawer_session_status: 'OPEN',
    ...overrides,
  };
}

describe('pos-session.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.$queryRaw.mockReset();
    db.$transaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) => callback(mockTx));
    mockTx.$queryRaw.mockReset();
    mockTx.$executeRaw.mockReset();
    mockTx.org_idempotency_keys.findFirst.mockReset();
    mockTx.org_idempotency_keys.upsert.mockReset();
    mockTx.org_idempotency_keys.findFirst.mockResolvedValue(null);
    // E2-2: linking consults the drawer's sharing policy; SHARED (the default) never blocks.
    mockCashControlSettings.mockReset();
    mockCashControlSettings.mockResolvedValue({ sharedSessionMode: 'SHARED' });
  });

  it('returns branch conflict instead of silently switching branches', async () => {
    db.$queryRaw.mockResolvedValueOnce([posSession()]);

    const result = await getMyActivePosSession({
      tenantId,
      userId,
      branchId: branchB,
    });

    expect(result).toMatchObject({
      type: 'BRANCH_CONFLICT',
      requestedBranchId: branchB,
      activeBranchId: branchA,
    });
    expect(result.type === 'BRANCH_CONFLICT' ? result.activeSession.opened_at : null)
      .toBe('2026-07-04T07:00:00.000Z');
  });

  it('returns optional presentation context for the active POS session', async () => {
    db.$queryRaw.mockResolvedValueOnce([posSessionWithContext()]);

    const result = await getMyActivePosSession({
      tenantId,
      userId,
      branchId: branchA,
      includeContext: true,
      includeDrawerContext: true,
    });

    expect(result).toMatchObject({
      type: 'ACTIVE',
      session: {
        id: sessionId,
        branch_name: 'Main Branch',
        terminal_name: 'Front terminal',
        cash_drawer_name: 'Main Cash Drawer',
        cash_drawer_session_status: 'OPEN',
      },
    });
  });

  it('resuming an already-open session is an idempotent no-op', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([posSession({ status: POS_SESSION_STATUS.OPEN })]);

    const result = await resumePosSession({
      tenantId,
      userId,
      idempotencyKey: 'resume-key',
      sourceChannel: 'test',
    });

    expect(result).toMatchObject({
      type: 'NOOP',
      session: { id: sessionId, status: POS_SESSION_STATUS.OPEN },
    });
    expect(mockTx.org_idempotency_keys.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'resume-key',
          resource_id: sessionId,
        }),
      })
    );
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects closed-session resume attempts through the status transition matrix', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([posSession({ status: POS_SESSION_STATUS.CLOSED })]);

    await expect(resumePosSession({ tenantId, userId })).rejects.toMatchObject({
      code: 'POS_SESSION_INVALID_STATUS',
      httpStatus: 409,
    });
  });

  describe('closePosSession — linked drawer guard (CLF-4-5 allow-list)', () => {
    it.each(['OPEN', 'CLOSING'])('blocks the POS close while the linked drawer session is %s', async (drawerStatus) => {
      mockTx.$queryRaw
        .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
        .mockResolvedValueOnce([{ status: drawerStatus }]);

      await expect(closePosSession({ tenantId, userId })).rejects.toMatchObject({
        code: 'POS_SESSION_DRAWER_STILL_OPEN',
        httpStatus: 409,
      });
    });

    it.each(['CLOSED', 'FORCE_CLOSED'])('does not block on a terminal drawer status (%s)', async (drawerStatus) => {
      mockTx.$queryRaw
        .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
        .mockResolvedValueOnce([{ status: drawerStatus }]);

      // Whatever happens next (the UPDATE is not stubbed), it must not be the drawer guard.
      await closePosSession({ tenantId, userId }).catch((error: { code?: string }) => {
        expect(error.code).not.toBe('POS_SESSION_DRAWER_STILL_OPEN');
      });
    });
  });

  it('enforces branch match before finance rows can use a POS session', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([posSession({ branch_id: branchA })]);

    await expect(
      assertOpenPosSessionForFinanceTx(mockTx as never, {
        tenantId,
        userId,
        posSessionId: sessionId,
        branchId: branchB,
      })
    ).rejects.toMatchObject({
      code: 'POS_SESSION_BRANCH_CONFLICT',
      httpStatus: 409,
    });
  });

  it('auto-link drawer is idempotent when the same drawer is already linked', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
      .mockResolvedValueOnce([{ id: drawerSessionId, cash_drawer_id: 'drawer-1', branch_id: branchA }]);

    const result = await autoLinkDrawerTx(mockTx as never, {
      tenantId,
      userId,
      posSessionId: sessionId,
      branchId: branchA,
      cashDrawerSessionId: drawerSessionId,
      idempotencyKey: 'cash-payment-key',
    });

    expect(result).toMatchObject({
      type: 'NOOP',
      session: { id: sessionId, cash_drawer_session_id: drawerSessionId },
    });
    expect(mockTx.org_idempotency_keys.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: `cash-payment-key:drawer:${drawerSessionId}`,
          resource_id: sessionId,
        }),
      })
    );
  });

  it('auto-link drawer rejects a different drawer that is still genuinely open', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
      .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }])
      .mockResolvedValueOnce([{ status: 'OPEN' }]);

    await expect(
      autoLinkDrawerTx(mockTx as never, {
        tenantId,
        userId,
        posSessionId: sessionId,
        branchId: branchA,
        cashDrawerSessionId: otherDrawerSessionId,
      })
    ).rejects.toMatchObject({
      code: 'POS_SESSION_DRAWER_ALREADY_LINKED',
      httpStatus: 409,
    });
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('auto-link drawer replaces a prior link once that drawer session is closed', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
      .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }])
      .mockResolvedValueOnce([{ status: 'CLOSED' }])
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: otherDrawerSessionId, cash_drawer_id: 'drawer-2' })]);

    const result = await autoLinkDrawerTx(mockTx as never, {
      tenantId,
      userId,
      posSessionId: sessionId,
      branchId: branchA,
      cashDrawerSessionId: otherDrawerSessionId,
    });

    expect(result).toMatchObject({
      type: 'UPDATED',
      session: { cash_drawer_session_id: otherDrawerSessionId },
    });
  });

  describe('auto-link drawer under shared_session_mode = EXCLUSIVE (E2-2)', () => {
    const link = () =>
      autoLinkDrawerTx(mockTx as never, {
        tenantId,
        userId,
        posSessionId: sessionId,
        branchId: branchA,
        cashDrawerSessionId: otherDrawerSessionId,
      });

    it('refuses a second live POS session on the drawer session and says which one holds it', async () => {
      mockCashControlSettings.mockResolvedValue({ sharedSessionMode: 'EXCLUSIVE' });
      mockTx.$queryRaw
        .mockResolvedValueOnce([posSession()])
        .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }])
        .mockResolvedValueOnce([{ id: 'holder-pos-session', session_no: 'POS-HOLDER-1' }]);

      await expect(link()).rejects.toMatchObject({
        code: 'DRAWER_SESSION_EXCLUSIVE',
        httpStatus: 409,
        details: { otherPosSessionId: 'holder-pos-session', otherSessionNo: 'POS-HOLDER-1' },
      });
      // The policy is read for THIS drawer, so a drawer-scope override applies.
      expect(mockCashControlSettings).toHaveBeenCalledWith(expect.objectContaining({ tenantId, drawerId: 'drawer-2' }));
    });

    it('links when nobody else holds the drawer session', async () => {
      mockCashControlSettings.mockResolvedValue({ sharedSessionMode: 'EXCLUSIVE' });
      mockTx.$queryRaw
        .mockResolvedValueOnce([posSession()])
        .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }])
        .mockResolvedValueOnce([]) // no other live POS session
        .mockResolvedValueOnce([posSession({ cash_drawer_session_id: otherDrawerSessionId, cash_drawer_id: 'drawer-2' })]);

      expect((await link()).type).toBe('UPDATED');
    });

    it('never asks the question under SHARED, so shared drawers cost no extra query', async () => {
      mockTx.$queryRaw
        .mockResolvedValueOnce([posSession()])
        .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }])
        .mockResolvedValueOnce([posSession({ cash_drawer_session_id: otherDrawerSessionId, cash_drawer_id: 'drawer-2' })]);

      expect((await link()).type).toBe('UPDATED');
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
    });
  });

  it('auto-link drawer replaces a prior link once that drawer session is force-closed', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
      .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }])
      .mockResolvedValueOnce([{ status: 'FORCE_CLOSED' }])
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: otherDrawerSessionId, cash_drawer_id: 'drawer-2' })]);

    const result = await autoLinkDrawerTx(mockTx as never, {
      tenantId,
      userId,
      posSessionId: sessionId,
      branchId: branchA,
      cashDrawerSessionId: otherDrawerSessionId,
    });

    expect(result.type).toBe('UPDATED');
  });

  it('summarizes POS session finance facts from active finance tables', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([posSession()])
      .mockResolvedValueOnce([{ currency_code: 'OMR', amount: 25, count: 2 }])
      .mockResolvedValueOnce([
        { payment_method_code: 'CASH', payment_status: 'COMPLETED', currency_code: 'OMR', amount: 15, count: 1 },
        { payment_method_code: 'CARD', payment_status: 'COMPLETED', currency_code: 'OMR', amount: 10, count: 1 },
      ])
      .mockResolvedValueOnce([{ currency_code: 'OMR', amount: 3, count: 1 }])
      .mockResolvedValueOnce([
        { refund_method_code: 'CASH', refund_status: 'PROCESSED', currency_code: 'OMR', amount: 3, count: 1 },
      ])
      .mockResolvedValueOnce([{ currency_code: 'OMR', amount: 25, count: 2 }])
      .mockResolvedValueOnce([
        { line_role: 'ORDER_PAYMENT', payment_method_code: 'CASH', direction: 'DEBIT', currency_code: 'OMR', amount: 15, count: 1 },
      ]);

    const summary = await getPosSessionSummary({
      tenantId,
      userId,
      posSessionId: sessionId,
    });

    // A4-1 — one row per currency, not a single ambiguous total (updated
    // deliberately: the old GROUP BY ... LIMIT 1 query this replaces would
    // have silently dropped every currency but one on a mixed-currency
    // session).
    // A3-4 — money crosses the API as an exact fixed-point string, never a
    // JS number.
    expect(summary.payments.totals).toEqual([{ currencyCode: 'OMR', amount: '25.0000', count: 2 }]);
    expect(summary.payments.byMethod).toEqual([
      { groupCode: 'CASH', status: 'COMPLETED', currencyCode: 'OMR', amount: '15.0000', count: 1 },
      { groupCode: 'CARD', status: 'COMPLETED', currencyCode: 'OMR', amount: '10.0000', count: 1 },
    ]);
    expect(summary.refunds.totals).toEqual([{ currencyCode: 'OMR', amount: '3.0000', count: 1 }]);
    expect(summary.voucherLines.byRole).toEqual([
      {
        lineRole: 'ORDER_PAYMENT',
        paymentMethodCode: 'CASH',
        direction: 'DEBIT',
        currencyCode: 'OMR',
        amount: '15.0000',
        count: 1,
      },
    ]);
  });

  it('A4-1: a mixed-currency session returns one total row per currency, not just the first', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([posSession()])
      // Two currencies collected in the same POS session — the old
      // `GROUP BY currency_code ... LIMIT 1` query would have silently kept
      // only OMR (alphabetically first) and dropped the USD row entirely.
      .mockResolvedValueOnce([
        { currency_code: 'OMR', amount: '25.5000', count: 2 },
        { currency_code: 'USD', amount: '10.0000', count: 1 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const summary = await getPosSessionSummary({ tenantId, userId, posSessionId: sessionId });

    expect(summary.payments.totals).toEqual([
      { currencyCode: 'OMR', amount: '25.5000', count: 2 },
      { currencyCode: 'USD', amount: '10.0000', count: 1 },
    ]);
    expect(summary.refunds.totals).toEqual([]);
    expect(summary.voucherLines.totals).toEqual([]);
  });

  it('throws a typed not-found error when a session summary is outside the user scope', async () => {
    db.$queryRaw.mockResolvedValueOnce([]);

    try {
      await getPosSessionSummary({ tenantId, userId, posSessionId: sessionId });
      throw new Error('Expected getPosSessionSummary to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(PosSessionError);
      expect(error).toMatchObject({ code: 'POS_SESSION_NOT_FOUND', httpStatus: 404 });
    }
  });

  describe('listPosSessions actor vs filter user', () => {
    const otherUserId = '99999999-9999-4999-8999-999999999999';

    /** Flattens every bound value from the mocked Prisma.sql tree of one $queryRaw call. */
    const boundValues = (node: unknown): unknown[] => {
      if (!node || typeof node !== 'object') return [node];
      const sqlNode = node as { kind?: string; values?: unknown[] };
      if (sqlNode.kind === 'sql' || sqlNode.kind === 'join') {
        return (sqlNode.values ?? []).flatMap(boundValues);
      }
      return [];
    };

    const listBaseInput = { tenantId, userId, page: 1, pageSize: 20 };

    beforeEach(() => {
      db.$queryRaw.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    });

    it('own scope always binds the actor userId, even when no filter user is given', async () => {
      await listPosSessions({ ...listBaseInput, canViewAll: false, scope: 'own' });

      for (const call of db.$queryRaw.mock.calls) {
        const values = boundValues(call[0]);
        expect(values).toContain(userId);
        expect(values).not.toContain(undefined);
      }
    });

    it('own scope keeps the actor restriction when a different filter user is requested', async () => {
      await listPosSessions({ ...listBaseInput, canViewAll: false, scope: 'own', filterUserId: otherUserId });

      for (const call of db.$queryRaw.mock.calls) {
        const values = boundValues(call[0]);
        expect(values).toContain(userId);
        expect(values).toContain(otherUserId);
      }
    });

    it('all scope with view_all binds only the filter user, not the actor', async () => {
      await listPosSessions({ ...listBaseInput, canViewAll: true, scope: 'all', filterUserId: otherUserId });

      for (const call of db.$queryRaw.mock.calls) {
        const values = boundValues(call[0]);
        expect(values).toContain(otherUserId);
        expect(values).not.toContain(userId);
      }
    });

    it('uses active records by default but includes soft-deactivated records when requested', async () => {
      await listPosSessions({ ...listBaseInput, canViewAll: false, scope: 'own' });
      expect(JSON.stringify(db.$queryRaw.mock.calls)).toContain('AND ps.is_active = TRUE');

      db.$queryRaw.mockReset();
      db.$queryRaw.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      await listPosSessions({ ...listBaseInput, canViewAll: false, scope: 'own', recordState: 'all' });
      expect(JSON.stringify(db.$queryRaw.mock.calls)).not.toContain('AND ps.is_active = TRUE');
    });
  });

  describe('listPosSessionFilterOptions visibility', () => {
    /** Flattens every bound value from the mocked Prisma.sql tree. */
    const boundValues = (node: unknown): unknown[] => {
      if (!node || typeof node !== 'object') return [node];
      const sqlNode = node as { kind?: string; values?: unknown[] };
      if (sqlNode.kind === 'sql' || sqlNode.kind === 'join') {
        return (sqlNode.values ?? []).flatMap(boundValues);
      }
      return [];
    };

    it('derives own-scope options from only the authenticated operator sessions', async () => {
      db.$queryRaw.mockResolvedValueOnce([
        {
          id: branchA,
          label: 'Main Branch',
          label2: 'الفرع الرئيسي',
          secondary_label: null,
          total: 1,
        },
      ]);

      const result = await listPosSessionFilterOptions({
        tenantId,
        userId,
        canViewAll: false,
        type: 'branch',
        page: 1,
        pageSize: 25,
        scope: 'own',
      });

      const values = boundValues(db.$queryRaw.mock.calls[0]?.[0]);
      expect(values).toContain(tenantId);
      expect(values).toContain(userId);
      expect(result).toEqual({
        type: 'branch',
        items: [{ id: branchA, label: 'Main Branch', label2: 'الفرع الرئيسي', secondaryLabel: null }],
        total: 1,
        page: 1,
        pageSize: 25,
      });
    });

    it('permits all-scope lookups only after view-all is granted', async () => {
      db.$queryRaw.mockResolvedValueOnce([]);

      await listPosSessionFilterOptions({
        tenantId,
        userId,
        canViewAll: true,
        type: 'cashDrawerSession',
        page: 1,
        pageSize: 25,
        scope: 'all',
      });

      const values = boundValues(db.$queryRaw.mock.calls[0]?.[0]);
      expect(values).toContain(tenantId);
      expect(values).not.toContain(userId);
    });

    it('uses active records by default but permits audit lookups across all record states', async () => {
      db.$queryRaw.mockResolvedValueOnce([]);
      await listPosSessionFilterOptions({
        tenantId,
        userId,
        canViewAll: false,
        type: 'operator',
        page: 1,
        pageSize: 25,
        scope: 'own',
      });
      expect(JSON.stringify(db.$queryRaw.mock.calls[0])).toContain('AND ps.is_active = TRUE');

      db.$queryRaw.mockReset();
      db.$queryRaw.mockResolvedValueOnce([]);
      await listPosSessionFilterOptions({
        tenantId,
        userId,
        canViewAll: false,
        type: 'operator',
        page: 1,
        pageSize: 25,
        scope: 'own',
        recordState: 'all',
      });
      expect(JSON.stringify(db.$queryRaw.mock.calls[0])).not.toContain('AND ps.is_active = TRUE');
    });
  });

  describe('resolvePosSessionForFinanceTx (B1 — server-resolved session)', () => {
    const base = { tenantId, userId, branchId: branchA, surface: 'ORDER_ENTRY' as const };
    const modes = (overrides: Record<string, string> = {}) => ({
      posSessionModeOrderEntry: 'REQUIRED_FOR_CASH',
      posSessionModeLaterColl: 'OPTIONAL',
      posSessionModeStoredVal: 'OPTIONAL',
      posSessionModeCashRefd: 'OPTIONAL',
      ...overrides,
    });

    beforeEach(() => {
      mockTx.$queryRaw.mockReset();
      mockCashControlSettings.mockReset();
      mockCashControlSettings.mockResolvedValue(modes());
    });

    it("uses the actor's own open session when the request names none", async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([posSession()]);
      const session = await resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' });
      expect(session?.id).toBe(sessionId);
      expect(mockCashControlSettings).not.toHaveBeenCalled();
    });

    it("refuses a client-sent session that is not the actor's active one (cross-check only)", async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([posSession()]);
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, {
          ...base,
          posSessionId: '99999999-9999-4999-8999-999999999999',
          tenderScope: 'CASH',
        })
      ).rejects.toMatchObject({ code: 'POS_SESSION_MISMATCH', httpStatus: 409 });
    });

    it('accepts a client-sent session that matches the active one', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([posSession()]).mockResolvedValueOnce([posSession()]);
      const session = await resolvePosSessionForFinanceTx(mockTx as never, {
        ...base,
        posSessionId: sessionId,
        tenderScope: 'CASH',
      });
      expect(session?.id).toBe(sessionId);
    });

    it('requires a session for cash when the setting says so, with an actionable payload', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([]);
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' })
      ).rejects.toMatchObject({
        code: 'POS_SESSION_REQUIRED',
        httpStatus: 409,
        details: { reason: 'NONE', canOpenInline: true },
      });
      expect(mockCashControlSettings).toHaveBeenCalledWith({ tenantId, branchId: branchA, userId });
    });

    it('reports a paused session as the reason, with its id', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([posSession({ status: POS_SESSION_STATUS.PAUSED })]);
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' })
      ).rejects.toMatchObject({
        code: 'POS_SESSION_REQUIRED',
        details: { reason: 'PAUSED', pausedSessionId: sessionId },
      });
    });

    it('lets a non-cash tender through unlinked unless the surface requires a session for every tender', async () => {
      mockTx.$queryRaw.mockResolvedValue([]);
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'NON_CASH' })
      ).resolves.toBeNull();

      mockCashControlSettings.mockResolvedValue(modes({ posSessionModeOrderEntry: 'REQUIRED' }));
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'NON_CASH' })
      ).rejects.toMatchObject({ code: 'POS_SESSION_REQUIRED' });
    });

    it('proceeds unlinked when cash does not need a session (surface set to optional)', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([]);
      mockCashControlSettings.mockResolvedValue(modes({ posSessionModeOrderEntry: 'OPTIONAL' }));
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' })
      ).resolves.toBeNull();
    });

    it('applies the policy of the screen doing the write, not a global one', async () => {
      mockTx.$queryRaw.mockResolvedValue([]);
      mockCashControlSettings.mockResolvedValue(
        modes({ posSessionModeOrderEntry: 'REQUIRED', posSessionModeLaterColl: 'OPTIONAL' })
      );

      // POS order entry is strict ...
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' })
      ).rejects.toMatchObject({ code: 'POS_SESSION_REQUIRED', details: { surface: 'ORDER_ENTRY' } });

      // ... while the same cashier-less user can still collect a later payment, take a wallet
      // top-up and pay out a cash refund: those screens are optional here.
      for (const surface of ['LATER_COLLECTION', 'STORED_VALUE_SALE', 'CASH_REFUND'] as const) {
        await expect(
          resolvePosSessionForFinanceTx(mockTx as never, { ...base, surface, tenderScope: 'CASH' })
        ).resolves.toBeNull();
      }
    });

    it('can require a session on a later-collection screen without touching order entry', async () => {
      mockTx.$queryRaw.mockResolvedValue([]);
      mockCashControlSettings.mockResolvedValue(
        modes({ posSessionModeOrderEntry: 'OPTIONAL', posSessionModeLaterColl: 'REQUIRED_FOR_CASH' })
      );
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, surface: 'LATER_COLLECTION', tenderScope: 'CASH' })
      ).rejects.toMatchObject({ code: 'POS_SESSION_REQUIRED', details: { surface: 'LATER_COLLECTION' } });
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, surface: 'LATER_COLLECTION', tenderScope: 'NON_CASH' })
      ).resolves.toBeNull();
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' })
      ).resolves.toBeNull();
    });

    it('never requires a session when there is no tender', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([]);
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'NONE' })
      ).resolves.toBeNull();
      expect(mockCashControlSettings).not.toHaveBeenCalled();
    });

    it('refuses an active session that belongs to another branch than the write', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([posSession({ branch_id: branchB })]);
      await expect(
        resolvePosSessionForFinanceTx(mockTx as never, { ...base, tenderScope: 'CASH' })
      ).rejects.toMatchObject({ code: 'POS_SESSION_BRANCH_CONFLICT' });
    });
  });
});
