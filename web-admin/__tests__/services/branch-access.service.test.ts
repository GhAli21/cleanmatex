/**
 * @jest-environment node
 *
 * Tests: branch scoping of cash-drawer / POS-session access (B3).
 * Covers scope resolution (all-branch permission, home branch, resource grants, fail-closed),
 * the pure checks, the list-filter narrowing and the route guards (drawer / session / trx / ids).
 */
jest.mock('server-only', () => ({}), { virtual: true });

const mockHasPermission = jest.fn();
const mockUserFindFirst = jest.fn();
const mockGrantFindMany = jest.fn();
const mockDrawerFindFirst = jest.fn();
const mockDrawerFindMany = jest.fn();
const mockDrawerSessionFindFirst = jest.fn();
const mockPosSessionFindFirst = jest.fn();
const mockTrxFindFirst = jest.fn();

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermission(...a),
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (tenantId: string, fn: (tenantId: string) => unknown) => fn(tenantId),
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_users_mst: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
    org_auth_user_resource_permissions: { findMany: (...a: unknown[]) => mockGrantFindMany(...a) },
    org_cash_drawers_mst: {
      findFirst: (...a: unknown[]) => mockDrawerFindFirst(...a),
      findMany: (...a: unknown[]) => mockDrawerFindMany(...a),
    },
    org_cash_drawer_sessions_mst: { findFirst: (...a: unknown[]) => mockDrawerSessionFindFirst(...a) },
    org_pos_sessions_mst: { findFirst: (...a: unknown[]) => mockPosSessionFindFirst(...a) },
    org_cash_drawer_trx_mst: { findFirst: (...a: unknown[]) => mockTrxFindFirst(...a) },
  },
}));

import {
  assertBranchAccess,
  BranchAccessError,
  canAccessBranch,
  narrowBranchFilter,
  resolveBranchScope,
} from '@/lib/services/branch-access.service';
import {
  guardBranchIds,
  guardCashDrawerSessionBranch,
  guardDrawerBranch,
  guardDrawersBranch,
  guardDrawerTrxBranch,
  guardPosSessionBranch,
} from '@/lib/api/branch-access-guard';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const home = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const extra = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actor = { tenantId, userId };

beforeEach(() => {
  jest.resetAllMocks();
  mockHasPermission.mockResolvedValue(false);
  mockUserFindFirst.mockResolvedValue({ main_branch_id: home });
  mockGrantFindMany.mockResolvedValue([]);
});

describe('resolveBranchScope', () => {
  it('gives every branch to a view_all_branches holder without touching the DB', async () => {
    mockHasPermission.mockResolvedValue(true);
    await expect(resolveBranchScope(actor)).resolves.toMatchObject({ all: true });
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it('gives a cashier their home branch only', async () => {
    await expect(resolveBranchScope(actor)).resolves.toEqual({ all: false, branchIds: [home] });
  });

  it('adds branches granted as resource permissions', async () => {
    mockGrantFindMany.mockResolvedValue([{ resource_id: extra }, { resource_id: home }]);
    const scope = await resolveBranchScope(actor);
    expect([...scope.branchIds].sort()).toEqual([home, extra].sort());
  });

  it('reads both sources scoped by tenant and user, with the documented grant filter', async () => {
    await resolveBranchScope(actor);
    expect(mockUserFindFirst.mock.calls[0][0].where).toMatchObject({ tenant_org_id: tenantId, user_id: userId });
    expect(mockGrantFindMany.mock.calls[0][0].where).toMatchObject({
      tenant_org_id: tenantId,
      user_id: userId,
      resource_type: 'branch',
      permission_code: 'cash_drawer:view',
      allow: true,
    });
  });

  it('fails closed: no home branch and no grants means no branches', async () => {
    mockUserFindFirst.mockResolvedValue({ main_branch_id: null });
    await expect(resolveBranchScope(actor)).resolves.toEqual({ all: false, branchIds: [] });
    mockUserFindFirst.mockResolvedValue(null);
    await expect(resolveBranchScope(actor)).resolves.toEqual({ all: false, branchIds: [] });
  });
});

describe('canAccessBranch / narrowBranchFilter', () => {
  const scoped = { all: false, branchIds: [home, extra] };
  const everything = { all: true, branchIds: [] };

  it('checks one branch against the scope', () => {
    expect(canAccessBranch(scoped, home)).toBe(true);
    expect(canAccessBranch(scoped, other)).toBe(false);
    expect(canAccessBranch(scoped, null)).toBe(false);
    expect(canAccessBranch(everything, other)).toBe(true);
  });

  it('passes the filter through for all-branch actors', () => {
    expect(narrowBranchFilter(everything)).toBeUndefined();
    expect(narrowBranchFilter(everything, other)).toEqual([other]);
  });

  it('limits scoped actors to their branches and never leaks a foreign one', () => {
    expect(narrowBranchFilter(scoped)).toEqual([home, extra]);
    expect(narrowBranchFilter(scoped, extra)).toEqual([extra]);
    expect(narrowBranchFilter(scoped, other)).toEqual([]);
  });

  it('assertBranchAccess throws a typed 403 for a foreign branch', async () => {
    await expect(assertBranchAccess(actor, other)).rejects.toMatchObject({
      code: 'DRAWER_BRANCH_FORBIDDEN',
      httpStatus: 403,
    });
    await expect(assertBranchAccess(actor, other)).rejects.toBeInstanceOf(BranchAccessError);
    await expect(assertBranchAccess(actor, home)).resolves.toBeUndefined();
  });
});

describe('route guards', () => {
  it('guardDrawerBranch: allows own branch, refuses a foreign one with a stable 403', async () => {
    mockDrawerFindFirst.mockResolvedValueOnce({ branch_id: home });
    await expect(guardDrawerBranch(actor, 'd1')).resolves.toBeNull();

    mockDrawerFindFirst.mockResolvedValueOnce({ branch_id: other });
    const denied = await guardDrawerBranch(actor, 'd2');
    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toMatchObject({ success: false, errorCode: 'DRAWER_BRANCH_FORBIDDEN' });
  });

  it('guardDrawerBranch: scopes the lookup by tenant and leaves an unknown drawer to the route', async () => {
    mockDrawerFindFirst.mockResolvedValueOnce(null);
    await expect(guardDrawerBranch(actor, 'missing')).resolves.toBeNull();
    expect(mockDrawerFindFirst.mock.calls[0][0].where).toEqual({ id: 'missing', tenant_org_id: tenantId });
  });

  it('guardCashDrawerSessionBranch: checks the session itself, not just the drawer in the URL', async () => {
    mockDrawerSessionFindFirst.mockResolvedValueOnce({ branch_id: other });
    expect((await guardCashDrawerSessionBranch(actor, 's1'))?.status).toBe(403);
    mockDrawerSessionFindFirst.mockResolvedValueOnce({ branch_id: home });
    await expect(guardCashDrawerSessionBranch(actor, 's2')).resolves.toBeNull();
    expect(mockDrawerSessionFindFirst.mock.calls[0][0].where.tenant_org_id).toBe(tenantId);
  });

  it('guardPosSessionBranch: always lets the owner reach their own session, scopes everyone else', async () => {
    mockPosSessionFindFirst.mockResolvedValueOnce({ branch_id: other, user_id: userId });
    await expect(guardPosSessionBranch(actor, 'p1')).resolves.toBeNull();

    mockPosSessionFindFirst.mockResolvedValueOnce({ branch_id: other, user_id: 'someone-else' });
    expect((await guardPosSessionBranch(actor, 'p2'))?.status).toBe(403);

    mockPosSessionFindFirst.mockResolvedValueOnce({ branch_id: home, user_id: 'someone-else' });
    await expect(guardPosSessionBranch(actor, 'p3')).resolves.toBeNull();
  });

  it('guardBranchIds / guardDrawersBranch: every named branch must be in scope', async () => {
    await expect(guardBranchIds(actor, [home])).resolves.toBeNull();
    expect((await guardBranchIds(actor, [home, other]))?.status).toBe(403);
    expect((await guardBranchIds(actor, [null]))?.status).toBe(403);

    mockDrawerFindMany.mockResolvedValueOnce([{ branch_id: home }, { branch_id: other }]);
    expect((await guardDrawersBranch(actor, ['d1', 'd2']))?.status).toBe(403);
    expect(mockDrawerFindMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: tenantId });
    await expect(guardDrawersBranch(actor, [])).resolves.toBeNull();
  });

  it('guardDrawerTrxBranch: refuses reversing a custody transaction of another branch', async () => {
    mockTrxFindFirst.mockResolvedValueOnce({ branch_id: other });
    expect((await guardDrawerTrxBranch(actor, 't1'))?.status).toBe(403);
    mockTrxFindFirst.mockResolvedValueOnce(null);
    await expect(guardDrawerTrxBranch(actor, 'missing')).resolves.toBeNull();
  });

  it('an all-branch actor passes every guard', async () => {
    mockHasPermission.mockResolvedValue(true);
    mockDrawerFindFirst.mockResolvedValue({ branch_id: other });
    await expect(guardDrawerBranch(actor, 'd1')).resolves.toBeNull();
  });
});

describe('POS-session tenant-wide override (migration 0552 product decision)', () => {
  it('lets a full_manage_others holder reach another branch\'s session and open-others target', async () => {
    mockHasPermission.mockImplementation(async (code: string) => code === 'pos_session:full_manage_others');
    mockPosSessionFindFirst.mockResolvedValueOnce({ branch_id: other, user_id: 'someone-else' });
    await expect(guardPosSessionBranch(actor, 'p9')).resolves.toBeNull();
    const { guardPosBranchIds } = await import('@/lib/api/branch-access-guard');
    await expect(guardPosBranchIds(actor, [other])).resolves.toBeNull();
  });

  it('keeps an open_others-only actor inside their branches', async () => {
    mockHasPermission.mockResolvedValue(false);
    const { guardPosBranchIds } = await import('@/lib/api/branch-access-guard');
    expect((await guardPosBranchIds(actor, [other]))?.status).toBe(403);
    await expect(guardPosBranchIds(actor, [home])).resolves.toBeNull();
  });
});
