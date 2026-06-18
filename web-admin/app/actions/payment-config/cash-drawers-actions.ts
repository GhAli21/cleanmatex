'use server';
/* eslint-disable jsdoc/require-param */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import type {
  OrgCashDrawer,
  OrgCashDrawerSession,
  OrgCashDrawerMovement,
  CreateCashDrawerInput,
  UpdateCashDrawerInput,
  OpenDrawerSessionInput,
  CloseDrawerSessionInput,
} from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

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
    const { tenantId, userId } = await getAuthContext();
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
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_cash_drawers_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Cash drawer not found' };

      const sessionCount = await prisma.org_cash_drawer_sessions_mst.count({
        where: { cash_drawer_id: id, tenant_org_id: tenantId },
      });
      if (sessionCount > 0 && 'currency_code' in input) {
        return { success: false, error: 'Cannot change currency_code: drawer already has sessions.' };
      }

      const row = await prisma.org_cash_drawers_mst.update({
        where: { id },
        data: {
          ...(input.branch_id !== undefined && { branch_id: input.branch_id }),
          ...(input.drawer_name !== undefined && { drawer_name: input.drawer_name }),
          ...(input.drawer_name2 !== undefined && { drawer_name2: input.drawer_name2 }),
          ...(input.drawer_type !== undefined && { drawer_type: input.drawer_type }),
          ...(input.requires_session !== undefined && { requires_session: input.requires_session }),
          ...(input.opening_float_required !== undefined && { opening_float_required: input.opening_float_required }),
          ...(input.max_cash_limit !== undefined && { max_cash_limit: input.max_cash_limit }),
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
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_cash_drawers_mst.findFirst({
        where: { id, tenant_org_id: tenantId },
      });
      if (!existing) return { success: false, error: 'Cash drawer not found' };

      if (!isActive) {
        const openSession = await prisma.org_cash_drawer_sessions_mst.findFirst({
          where: { cash_drawer_id: id, tenant_org_id: tenantId, status: 'OPEN', is_active: true },
        });
        if (openSession) {
          return { success: false, error: 'Cannot deactivate: drawer has an open session. Close it first.' };
        }
      }

      await prisma.org_cash_drawers_mst.update({
        where: { id },
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

/** Get the active (OPEN) session for a drawer, or null */
export async function getActiveDrawerSession(
  drawerId: string
): Promise<{ success: boolean; data?: OrgCashDrawerSession | null; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const session = await prisma.org_cash_drawer_sessions_mst.findFirst({
        where: { cash_drawer_id: drawerId, tenant_org_id: tenantId, status: 'OPEN', is_active: true },
      });
      return { success: true, data: (session as unknown as OrgCashDrawerSession) ?? null };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch active session' };
  }
}

/** Open a cash drawer session — validates no open session exists, then creates atomically */
export async function openDrawerSession(
  input: OpenDrawerSessionInput
): Promise<{ success: boolean; data?: OrgCashDrawerSession; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const drawer = await prisma.org_cash_drawers_mst.findFirst({
        where: { id: input.cash_drawer_id, tenant_org_id: tenantId, is_active: true },
      });
      if (!drawer) return { success: false, error: 'Cash drawer not found or inactive' };

      const existingOpen = await prisma.org_cash_drawer_sessions_mst.findFirst({
        where: { cash_drawer_id: input.cash_drawer_id, tenant_org_id: tenantId, status: 'OPEN', is_active: true },
      });
      if (existingOpen) return { success: false, error: 'Drawer already has an open session' };

      if (input.opening_float_amount < 0) {
        return { success: false, error: 'Opening float cannot be negative' };
      }

      const [sessionResult] = await prisma.$queryRaw<Array<{ session_no: string }>>`
        SELECT public.generate_session_no(${tenantId}::uuid) AS session_no
      `;
      const sessionNo = sessionResult.session_no;

      const session = await prisma.$transaction(async (tx) => {
        const newSession = await tx.org_cash_drawer_sessions_mst.create({
          data: {
            tenant_org_id: tenantId,
            branch_id: input.branch_id,
            cash_drawer_id: input.cash_drawer_id,
            session_no: sessionNo,
            opened_by: userId,
            opened_at: new Date(),
            opening_float_amount: input.opening_float_amount,
            currency_code: input.currency_code,
            status: 'OPEN',
            expected_cash_amount: input.opening_float_amount,
            created_by: userId,
            created_at: new Date(),
            rec_status: 1,
            is_active: true,
            metadata: {},
          },
        });

        await tx.org_cash_drawer_movements_dtl.create({
          data: {
            tenant_org_id: tenantId,
            branch_id: input.branch_id,
            cash_drawer_id: input.cash_drawer_id,
            cash_drawer_session_id: newSession.id,
            movement_type: 'OPENING_FLOAT',
            direction: 'IN',
            amount: input.opening_float_amount,
            currency_code: input.currency_code,
            performed_by: userId,
            performed_at: new Date(),
            created_by: userId,
            created_at: new Date(),
            rec_status: 1,
            is_active: true,
            metadata: {},
          },
        });

        return newSession;
      });

      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: session as unknown as OrgCashDrawerSession };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to open drawer session' };
  }
}

/** Close a cash drawer session — calculates diff, records CLOSING_COUNT + variance movements */
export async function closeDrawerSession(
  input: CloseDrawerSessionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const session = await prisma.org_cash_drawer_sessions_mst.findFirst({
        where: { id: input.session_id, tenant_org_id: tenantId, status: 'OPEN', is_active: true },
      });
      if (!session) return { success: false, error: 'Open session not found' };

      const counted = input.counted_cash_amount;
      const expected = Number(session.expected_cash_amount);
      const diff = counted - expected;

      await prisma.$transaction(async (tx) => {
        await tx.org_cash_drawer_movements_dtl.create({
          data: {
            tenant_org_id: tenantId,
            branch_id: session.branch_id,
            cash_drawer_id: session.cash_drawer_id,
            cash_drawer_session_id: session.id,
            movement_type: 'CLOSING_COUNT',
            direction: 'NONE',
            amount: counted,
            currency_code: session.currency_code,
            reason: input.close_notes ?? null,
            performed_by: userId,
            performed_at: new Date(),
            created_by: userId,
            created_at: new Date(),
            rec_status: 1,
            is_active: true,
            metadata: {},
          },
        });

        if (diff !== 0) {
          await tx.org_cash_drawer_movements_dtl.create({
            data: {
              tenant_org_id: tenantId,
              branch_id: session.branch_id,
              cash_drawer_id: session.cash_drawer_id,
              cash_drawer_session_id: session.id,
              movement_type: diff < 0 ? 'SHORTAGE' : 'OVERAGE',
              direction: diff < 0 ? 'OUT' : 'IN',
              amount: Math.abs(diff),
              currency_code: session.currency_code,
              performed_by: userId,
              performed_at: new Date(),
              created_by: userId,
              created_at: new Date(),
              rec_status: 1,
              is_active: true,
              metadata: {},
            },
          });
        }

        await tx.org_cash_drawer_sessions_mst.update({
          where: { id: session.id },
          data: {
            status: 'CLOSED',
            counted_cash_amount: counted,
            difference_amount: diff,
            closed_by: userId,
            closed_at: new Date(),
            close_notes: input.close_notes ?? null,
            updated_by: userId,
            updated_at: new Date(),
          },
        });
      });

      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to close drawer session' };
  }
}

/** Get drawer movements for a session, paginated */
export async function getDrawerMovements(
  sessionId: string,
  page = 1,
  pageSize = 20
): Promise<{ success: boolean; data?: OrgCashDrawerMovement[]; total?: number; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const [rows, total] = await prisma.$transaction([
        prisma.org_cash_drawer_movements_dtl.findMany({
          where: { cash_drawer_session_id: sessionId, tenant_org_id: tenantId, is_active: true },
          orderBy: { performed_at: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.org_cash_drawer_movements_dtl.count({
          where: { cash_drawer_session_id: sessionId, tenant_org_id: tenantId, is_active: true },
        }),
      ]);
      return { success: true, data: rows as unknown as OrgCashDrawerMovement[], total };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch drawer movements' };
  }
}
