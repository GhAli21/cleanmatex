import { prisma } from '@/lib/db/prisma';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  assertOpenPosSessionForFinanceTx,
  autoLinkDrawerTx,
  getMyActivePosSession,
  getPosSessionSummary,
  PosSessionError,
  resumePosSession,
} from '@/lib/services/pos-session.service';
import type { PosSessionRow } from '@/lib/types/pos-session';

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
    created_by_info: null,
    updated_at: null,
    updated_by: null,
    updated_by_info: null,
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

  it('auto-link drawer rejects a different drawer after locking the POS session row', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([posSession({ cash_drawer_session_id: drawerSessionId })])
      .mockResolvedValueOnce([{ id: otherDrawerSessionId, cash_drawer_id: 'drawer-2', branch_id: branchA }]);

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
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
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

    expect(summary.payments.total).toEqual({ currencyCode: 'OMR', amount: 25, count: 2 });
    expect(summary.payments.byMethod).toEqual([
      { groupCode: 'CASH', status: 'COMPLETED', currencyCode: 'OMR', amount: 15, count: 1 },
      { groupCode: 'CARD', status: 'COMPLETED', currencyCode: 'OMR', amount: 10, count: 1 },
    ]);
    expect(summary.refunds.total).toEqual({ currencyCode: 'OMR', amount: 3, count: 1 });
    expect(summary.voucherLines.byRole).toEqual([
      {
        lineRole: 'ORDER_PAYMENT',
        paymentMethodCode: 'CASH',
        direction: 'DEBIT',
        currencyCode: 'OMR',
        amount: 15,
        count: 1,
      },
    ]);
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
});
