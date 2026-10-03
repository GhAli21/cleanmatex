import 'server-only';

import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { CASH_CONTROL_ASSIGNMENT_MODE } from '@/lib/constants/cash-control';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import { FINANCE_PERMISSIONS } from '@/lib/constants/permissions/finance-perm';
import type { DrawerAssignmentFacts } from '@/lib/types/cash-drawer-ledger';
import { CashDrawerLedgerError } from './cash-drawer-errors';

/** What the assignment rule needs to know about a drawer (a subset of the locked drawer row). */
export interface AssignableDrawer {
  id: string;
  branch_id: string;
  assigned_user_id: string | null;
}

/**
 * Resolves the assignment facts for one drawer and the acting user (B3-1): the resolved
 * `drawer_assignment_mode` (drawer → user → branch → tenant) and whether the actor may override
 * the assignment. The permission is only looked up when it can matter (ASSIGNED_ONLY and the
 * actor is not the assignee), so the common OPEN-drawer path costs nothing extra.
 *
 * @param input tenant, actor and the locked drawer row
 * @returns facts for the pure gate decision / {@link assertDrawerAssignment}
 */
export async function resolveDrawerAssignment(input: {
  tenantOrgId: string;
  userId: string;
  drawer: AssignableDrawer;
}): Promise<DrawerAssignmentFacts> {
  const settings = await getCashControlSettings({
    tenantId: input.tenantOrgId,
    branchId: input.drawer.branch_id,
    userId: input.userId,
    drawerId: input.drawer.id,
  });
  const needsOverride =
    settings.drawerAssignmentMode === CASH_CONTROL_ASSIGNMENT_MODE.ASSIGNED_ONLY &&
    input.drawer.assigned_user_id !== input.userId;
  return {
    mode: settings.drawerAssignmentMode,
    assignedUserId: input.drawer.assigned_user_id,
    actorUserId: input.userId,
    actorCanOperateAny: needsOverride
      ? await hasPermissionServer(FINANCE_PERMISSIONS.CASH_DRAWER_OPERATE_ANY)
      : false,
  };
}

/**
 * Refuses (`DRAWER_NOT_ASSIGNED_TO_USER`) an interactive operation on an ASSIGNED_ONLY drawer by
 * anyone but its assignee or a holder of `cash_drawer:operate_any`. Used by the session lifecycle
 * (open, count/close); cash lines are covered by the central ledger gate with the same facts.
 *
 * @throws CashDrawerLedgerError DRAWER_NOT_ASSIGNED_TO_USER
 * @example await assertDrawerAssignment({ tenantOrgId, userId, drawer });
 */
export async function assertDrawerAssignment(input: {
  tenantOrgId: string;
  userId: string;
  drawer: AssignableDrawer;
}): Promise<void> {
  const facts = await resolveDrawerAssignment(input);
  if (
    facts.mode === CASH_CONTROL_ASSIGNMENT_MODE.ASSIGNED_ONLY &&
    facts.assignedUserId !== facts.actorUserId &&
    !facts.actorCanOperateAny
  ) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.DRAWER_NOT_ASSIGNED_TO_USER,
      'This drawer is assigned to another user.',
      { drawerId: input.drawer.id }
    );
  }
}
