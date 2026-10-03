import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  BRANCH_ACCESS_ALL_BRANCHES_PERMISSION,
  BRANCH_ACCESS_ERROR,
  BRANCH_ACCESS_GRANT_PERMISSION,
  BRANCH_ACCESS_RESOURCE_TYPE,
} from '@/lib/constants/branch-access';

/**
 * Which branches an actor may operate on: every branch, or an explicit list.
 * `all` is derived from the actor's permissions, never from request input.
 */
export interface BranchScope {
  /** True for actors who may operate on every branch (`branchIds` is then empty and irrelevant). */
  all: boolean;
  branchIds: readonly string[];
}

export interface BranchAccessActor {
  tenantId: string;
  userId: string;
}

/** Thrown when an actor addresses a branch outside their scope; routes map it to HTTP 403. */
export class BranchAccessError extends Error {
  readonly code = BRANCH_ACCESS_ERROR;
  readonly httpStatus = 403;

  constructor(readonly branchId: string | null) {
    super('You do not have access to this branch.');
    this.name = 'BranchAccessError';
  }
}

/**
 * Resolves the branches an actor may work on for cash-drawer and POS-session operations.
 *
 * Holders of `cash_drawer:view_all_branches` get every branch (management / finance oversight —
 * the role defaults decide who that is). Everyone else gets their home branch
 * (`org_users_mst.main_branch_id`) plus any branch granted to them as a resource permission
 * (`org_auth_user_resource_permissions`, resource_type `branch`, permission `cash_drawer:view`,
 * `allow = true`). An actor with neither gets an empty scope, which denies everything (fail closed).
 *
 * @param actor tenant and user taken from the authenticated session
 * @returns the actor's branch scope
 * @example
 * const scope = await resolveBranchScope({ tenantId, userId });
 * if (!canAccessBranch(scope, drawer.branch_id)) throw new BranchAccessError(drawer.branch_id);
 */
export async function resolveBranchScope(actor: BranchAccessActor): Promise<BranchScope> {
  if (await hasPermissionServer(BRANCH_ACCESS_ALL_BRANCHES_PERMISSION)) {
    return { all: true, branchIds: [] };
  }

  const { home, grants } = await withTenantContext(actor.tenantId, async (tenantId) => {
    const [user, resourceGrants] = await Promise.all([
      prisma.org_users_mst.findFirst({
        where: { tenant_org_id: tenantId, user_id: actor.userId, is_active: true },
        select: { main_branch_id: true },
      }),
      prisma.org_auth_user_resource_permissions.findMany({
        where: {
          tenant_org_id: tenantId,
          user_id: actor.userId,
          resource_type: BRANCH_ACCESS_RESOURCE_TYPE,
          permission_code: BRANCH_ACCESS_GRANT_PERMISSION,
          allow: true,
          rec_status: 1,
        },
        select: { resource_id: true },
      }),
    ]);
    return { home: user?.main_branch_id ?? null, grants: resourceGrants.map((g) => g.resource_id) };
  });

  const branchIds = new Set<string>(grants);
  if (home) branchIds.add(home);
  return { all: false, branchIds: [...branchIds] };
}

/** Pure check of one branch against a scope. */
export function canAccessBranch(scope: BranchScope, branchId: string | null | undefined): boolean {
  if (scope.all) return true;
  return !!branchId && scope.branchIds.includes(branchId);
}

/**
 * Restricts an optional caller-supplied branch filter to the actor's scope.
 * - all-branch actors: the filter passes through unchanged (`undefined` = no filter);
 * - scoped actors with no filter: their full branch list;
 * - scoped actors with a filter outside their scope: an empty list (matches nothing, never leaks).
 *
 * @returns `undefined` for "no branch restriction", otherwise the allowed branch ids (may be empty)
 */
export function narrowBranchFilter(scope: BranchScope, requested?: string | null): string[] | undefined {
  if (scope.all) return requested ? [requested] : undefined;
  if (!requested) return [...scope.branchIds];
  return scope.branchIds.includes(requested) ? [requested] : [];
}

/**
 * Throws {@link BranchAccessError} unless the actor may operate on the branch.
 * @throws BranchAccessError when the branch is outside the actor's scope
 */
export async function assertBranchAccess(actor: BranchAccessActor, branchId: string | null): Promise<void> {
  const scope = await resolveBranchScope(actor);
  if (!canAccessBranch(scope, branchId)) throw new BranchAccessError(branchId);
}
