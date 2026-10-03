import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { BRANCH_ACCESS_ERROR } from '@/lib/constants/branch-access';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  BranchAccessError,
  canAccessBranch,
  resolveBranchScope,
  type BranchAccessActor,
  type BranchScope,
} from '@/lib/services/branch-access.service';

/** The standard 403 body for an out-of-scope branch. */
export function branchAccessDeniedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      // `code` is the cash-drawer envelope key (useCashDrawerErrorMessage); `errorCode` the POS one.
      code: BRANCH_ACCESS_ERROR,
      errorCode: BRANCH_ACCESS_ERROR,
      error: 'You do not have access to this branch.',
    },
    { status: 403 }
  );
}

/** Maps a thrown {@link BranchAccessError} to its response; `null` for any other error. */
export function branchAccessErrorResponse(error: unknown): NextResponse | null {
  return error instanceof BranchAccessError ? branchAccessDeniedResponse() : null;
}

/**
 * Route guard: refuses (403) when the drawer belongs to a branch outside the actor's scope.
 * A drawer that does not exist (or is not this tenant's) is left to the route's own not-found
 * handling, so existing 404 contracts are unchanged.
 *
 * @param actor tenant and user from the authenticated request
 * @param drawerId the drawer addressed by the route
 * @returns a 403 response to return immediately, or `null` to continue
 * @example
 * const denied = await guardDrawerBranch(auth, drawerId);
 * if (denied) return denied;
 */
export async function guardDrawerBranch(actor: BranchAccessActor, drawerId: string): Promise<NextResponse | null> {
  const drawer = await withTenantContext(actor.tenantId, (tenantId) =>
    prisma.org_cash_drawers_mst.findFirst({
      where: { id: drawerId, tenant_org_id: tenantId },
      select: { branch_id: true },
    })
  );
  if (!drawer) return null;
  const scope = await resolveBranchScope(actor);
  return canAccessBranch(scope, drawer.branch_id) ? null : branchAccessDeniedResponse();
}

/**
 * Route guard for POS-session routes addressed by session id: refuses (403) when the session's
 * branch is outside the actor's scope. The actor's own session is always reachable (a cashier
 * must be able to see and close their own session even after a home-branch change). An unknown
 * session is left to the route's own handling.
 */
export async function guardPosSessionBranch(actor: BranchAccessActor, sessionId: string): Promise<NextResponse | null> {
  const session = await withTenantContext(actor.tenantId, (tenantId) =>
    prisma.org_pos_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantId },
      select: { branch_id: true, user_id: true },
    })
  );
  if (!session) return null;
  if (session.user_id === actor.userId) return null;
  // Product decision (migration 0552): `pos_session:full_manage_others` is a tenant-wide override.
  if (await hasPermissionServer(POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS)) return null;
  const scope = await resolveBranchScope(actor);
  return canAccessBranch(scope, session.branch_id) ? null : branchAccessDeniedResponse();
}

/**
 * Like {@link guardBranchIds} for POS-session writes on behalf of another user (open-others):
 * holders of the tenant-wide `pos_session:full_manage_others` override pass; everyone else must
 * have the branch in scope.
 */
export async function guardPosBranchIds(
  actor: BranchAccessActor,
  branchIds: readonly (string | null | undefined)[]
): Promise<NextResponse | null> {
  if (await hasPermissionServer(POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS)) return null;
  return guardBranchIds(actor, branchIds);
}

/** Re-export so list routes need one import. */
export { resolveBranchScope };
export type { BranchScope };

/**
 * Route guard for cash-drawer session routes: refuses (403) when the session's branch is outside
 * the actor's scope. Checked on the session itself, not only the drawer in the URL, so a session
 * can never be reached through a drawer id from another branch. An unknown session is left to the
 * route's own handling.
 */
export async function guardCashDrawerSessionBranch(
  actor: BranchAccessActor,
  sessionId: string
): Promise<NextResponse | null> {
  const session = await withTenantContext(actor.tenantId, (tenantId) =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantId },
      select: { branch_id: true },
    })
  );
  if (!session) return null;
  const scope = await resolveBranchScope(actor);
  return canAccessBranch(scope, session.branch_id) ? null : branchAccessDeniedResponse();
}

/**
 * Route guard for writes that name branches directly (a body `branchId`, a pending-deposit
 * ensure target): refuses (403) when any of them is outside the actor's scope.
 */
export async function guardBranchIds(
  actor: BranchAccessActor,
  branchIds: readonly (string | null | undefined)[]
): Promise<NextResponse | null> {
  const scope = await resolveBranchScope(actor);
  return branchIds.every((id) => canAccessBranch(scope, id)) ? null : branchAccessDeniedResponse();
}

/**
 * Route guard for writes that name several drawers (custody transactions): refuses (403) when any
 * existing drawer belongs to a branch outside the actor's scope. Unknown drawers are left to the
 * service's own validation.
 */
export async function guardDrawersBranch(
  actor: BranchAccessActor,
  drawerIds: readonly string[]
): Promise<NextResponse | null> {
  const ids = [...new Set(drawerIds)];
  if (ids.length === 0) return null;
  const drawers = await withTenantContext(actor.tenantId, (tenantId) =>
    prisma.org_cash_drawers_mst.findMany({
      where: { tenant_org_id: tenantId, id: { in: ids } },
      select: { branch_id: true },
    })
  );
  return guardBranchIds(actor, drawers.map((d) => d.branch_id));
}

/** Route guard for a custody transaction addressed by id (reverse). Unknown ids pass through. */
export async function guardDrawerTrxBranch(actor: BranchAccessActor, trxId: string): Promise<NextResponse | null> {
  const trx = await withTenantContext(actor.tenantId, (tenantId) =>
    prisma.org_cash_drawer_trx_mst.findFirst({
      where: { id: trxId, tenant_org_id: tenantId },
      select: { branch_id: true },
    })
  );
  if (!trx) return null;
  return guardBranchIds(actor, [trx.branch_id]);
}
