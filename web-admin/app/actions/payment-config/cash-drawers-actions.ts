'use server';
/* eslint-disable jsdoc/require-param */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import { CASH_DRAWER_SESSION_STATUSES, DRAWER_TYPES } from '@/lib/constants/payment';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { PAYMENT_CONFIG_PERMISSIONS } from '@features/payment-config/access/payment-config-access';
import type {
  OrgCashDrawer,
  OrgCashDrawerSession,
  CreateCashDrawerInput,
  UpdateCashDrawerInput,
} from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

/*
 * Drawer configuration actions for Settings → Payments → Cash drawers.
 * CLF W12: the four legacy session/movement actions that used to live here
 * (getActiveDrawerSession, openDrawerSession, closeDrawerSession,
 * getDrawerMovements) had no callers and bypassed the drawer ledger — deleted.
 * Session lifecycle lives in app/actions/billing/cash-drawer-actions.ts and the
 * /api/v1/cash-drawers routes. Every action here checks its permission.
 */

const FORBIDDEN = 'Insufficient permissions';

async function resolveTenantCurrencyCode(tenantId: string, userId?: string | null): Promise<string> {
  const config = await getCurrencyConfigAction(tenantId, undefined, userId ?? undefined);
  return config.currencyCode;
}

/** List cash drawers, optionally filtered by branch. Includes current open session if any. */
export async function getCashDrawers(
  branchId?: string
): Promise<{
  success: boolean;
  data?: Array<OrgCashDrawer & { currentSession: OrgCashDrawerSession | null }>;
  error?: string;
}> {
  try {
    if (!(await hasPermissionServer(PAYMENT_CONFIG_PERMISSIONS.VIEW))) {
      return { success: false, error: FORBIDDEN };
    }
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const drawers = await prisma.org_cash_drawers_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          is_active: true,
          rec_status: 1,
          ...(branchId ? { branch_id: branchId } : {}),
        },
        orderBy: [{ drawer_name: 'asc' }],
      });

      const sessions = await prisma.org_cash_drawer_sessions_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_id: { in: drawers.map((d) => d.id) },
          status: 'OPEN',
          is_active: true,
        },
      });
      const sessionMap = new Map(sessions.map((s) => [s.cash_drawer_id, s]));

      return {
        success: true,
        data: drawers.map((d) => ({
          ...(d as unknown as OrgCashDrawer),
          currentSession: (sessionMap.get(d.id) as unknown as OrgCashDrawerSession) ?? null,
        })),
      };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch cash drawers' };
  }
}

/** Create a new cash drawer */
export async function createCashDrawer(
  input: CreateCashDrawerInput
): Promise<{ success: boolean; data?: OrgCashDrawer; error?: string }> {
  try {
    if (!(await hasPermissionServer(PAYMENT_CONFIG_PERMISSIONS.MANAGE))) {
      return { success: false, error: FORBIDDEN };
    }
    const { tenantId, userId } = await getAuthContext();
    if (input.drawer_type === DRAWER_TYPES.PENDING_DEPOSIT) {
      return { success: false, error: 'Pending-deposit drawers are created by the system, one per branch.' };
    }
    const tenantCurrencyCode = await resolveTenantCurrencyCode(tenantId, userId);
    return withTenantContext(tenantId, async () => {
      const row = await prisma.org_cash_drawers_mst.create({
        data: {
          tenant_org_id: tenantId,
          branch_id: input.branch_id,
          drawer_code: input.drawer_code,
          drawer_name: input.drawer_name,
          drawer_name2: input.drawer_name2 ?? null,
          drawer_type: input.drawer_type,
          currency_code: tenantCurrencyCode,
          requires_session: input.requires_session ?? true,
          opening_float_required: input.opening_float_required ?? true,
          max_cash_limit: input.max_cash_limit ?? null,
          variance_approval_threshold: input.variance_approval_threshold ?? null,
          assigned_terminal_id: input.assigned_terminal_id ?? null,
          created_by: userId,
          created_at: new Date(),
          rec_status: 1,
          is_active: true,
          metadata: {},
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: row as unknown as OrgCashDrawer };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create cash drawer' };
  }
}

/** Update a cash drawer — rejects currency_code change if sessions exist */
export async function updateCashDrawer(
  id: string,
  input: UpdateCashDrawerInput
): Promise<{ success: boolean; data?: OrgCashDrawer; error?: string }> {
  try {
    if (!(await hasPermissionServer(PAYMENT_CONFIG_PERMISSIONS.MANAGE))) {
      return { success: false, error: FORBIDDEN };
    }
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_cash_drawers_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Cash drawer not found' };
      // The branch pending-deposit drawer is system-provisioned (ensure_branch_pd_drawer); its identity is fixed.
      if (existing.drawer_type === DRAWER_TYPES.PENDING_DEPOSIT) {
        return { success: false, error: 'The pending-deposit drawer is managed by the system and cannot be edited.' };
      }
      if (input.drawer_type === DRAWER_TYPES.PENDING_DEPOSIT) {
        return { success: false, error: 'A drawer cannot be changed into a pending-deposit drawer.' };
      }

      const sessionCount = await prisma.org_cash_drawer_sessions_mst.count({
        where: { cash_drawer_id: id, tenant_org_id: tenantId },
      });
      if (sessionCount > 0 && 'currency_code' in input) {
        return { success: false, error: 'Cannot change currency_code: drawer already has sessions.' };
      }

      const row = await prisma.org_cash_drawers_mst.update({
        where: { id, tenant_org_id: tenantId },
        data: {
          ...(input.branch_id !== undefined && { branch_id: input.branch_id }),
          ...(input.drawer_name !== undefined && { drawer_name: input.drawer_name }),
          ...(input.drawer_name2 !== undefined && { drawer_name2: input.drawer_name2 }),
          ...(input.drawer_type !== undefined && { drawer_type: input.drawer_type }),
          ...(input.requires_session !== undefined && { requires_session: input.requires_session }),
          ...(input.opening_float_required !== undefined && { opening_float_required: input.opening_float_required }),
          ...(input.max_cash_limit !== undefined && { max_cash_limit: input.max_cash_limit }),
          ...(input.variance_approval_threshold !== undefined && {
            variance_approval_threshold: input.variance_approval_threshold,
          }),
          ...(input.assigned_terminal_id !== undefined && { assigned_terminal_id: input.assigned_terminal_id }),
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: row as unknown as OrgCashDrawer };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update cash drawer' };
  }
}

/** Soft-deactivate a drawer — rejects if an open session exists */
export async function toggleCashDrawerActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await hasPermissionServer(PAYMENT_CONFIG_PERMISSIONS.MANAGE))) {
      return { success: false, error: FORBIDDEN };
    }
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_cash_drawers_mst.findFirst({
        where: { id, tenant_org_id: tenantId },
      });
      if (!existing) return { success: false, error: 'Cash drawer not found' };
      if (existing.drawer_type === DRAWER_TYPES.PENDING_DEPOSIT) {
        return { success: false, error: 'The pending-deposit drawer is managed by the system and cannot be deactivated.' };
      }

      if (!isActive) {
        const openSession = await prisma.org_cash_drawer_sessions_mst.findFirst({
          where: {
            cash_drawer_id: id,
            tenant_org_id: tenantId,
            status: { in: [CASH_DRAWER_SESSION_STATUSES.OPEN, CASH_DRAWER_SESSION_STATUSES.CLOSING] },
            is_active: true,
          },
        });
        if (openSession) {
          return { success: false, error: 'Cannot deactivate: drawer has an open session. Close it first.' };
        }
      }

      await prisma.org_cash_drawers_mst.update({
        where: { id, tenant_org_id: tenantId },
        data: {
          is_active: isActive,
          rec_status: isActive ? 1 : 0,
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle cash drawer' };
  }
}
