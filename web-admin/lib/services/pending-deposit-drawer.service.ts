import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Stable codes this service can throw (§4B.2a-B). */
export const PENDING_DEPOSIT_ERRORS = {
  BRANCH_NOT_FOUND: 'PENDING_DEPOSIT_BRANCH_NOT_FOUND',
  CURRENCY_NOT_CONFIGURED: 'CASH_DRAWER_CURRENCY_NOT_CONFIGURED',
} as const;

export interface EnsureBranchPendingDepositDrawerResult {
  drawerId: string;
  created: boolean;
}

/**
 * Idempotently ensures the branch's system PENDING_DEPOSIT drawer exists (CLF
 * §4B.2a-B) — thin wrapper around the DB function `ensure_branch_pd_drawer`
 * (migration 0523), which does the actual INSERT ... ON CONFLICT DO NOTHING
 * under the branch's own unique-per-type index (safe under concurrency). A
 * second call is a no-op, never a duplicate.
 * @param tenantId tenant from the authenticated session
 * @param branchId branch to provision
 * @param actor acting user (audit `created_by` on the new drawer row, if any)
 * @throws Error with PENDING_DEPOSIT_ERRORS.BRANCH_NOT_FOUND
 * @throws Error with PENDING_DEPOSIT_ERRORS.CURRENCY_NOT_CONFIGURED (SQLSTATE CMX01)
 */
export async function ensureBranchPendingDepositDrawer(
  tenantId: string,
  branchId: string,
  actor: string,
): Promise<EnsureBranchPendingDepositDrawerResult> {
  return withTenantContext(tenantId, async () => {
    try {
      const rows = await prisma.$queryRaw<Array<{ drawer_id: string; created: boolean }>>(Prisma.sql`
        SELECT drawer_id, created
          FROM public.ensure_branch_pd_drawer(${tenantId}::uuid, ${branchId}::uuid, NULL, ${actor})
      `);
      const row = rows[0];
      if (!row) {
        throw new Error(PENDING_DEPOSIT_ERRORS.BRANCH_NOT_FOUND);
      }
      return { drawerId: row.drawer_id, created: row.created };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('CMX01') || message.includes(PENDING_DEPOSIT_ERRORS.CURRENCY_NOT_CONFIGURED)) {
        throw new Error(PENDING_DEPOSIT_ERRORS.CURRENCY_NOT_CONFIGURED);
      }
      if (message.includes('branch') && message.includes('not found')) {
        throw new Error(PENDING_DEPOSIT_ERRORS.BRANCH_NOT_FOUND);
      }
      throw error;
    }
  });
}

export interface BranchPendingDepositStatusRow {
  branchId: string;
  branchName: string | null;
  hasPendingDepositDrawer: boolean;
  drawerId: string | null;
}

/**
 * Per-branch present/missing status of the system PENDING_DEPOSIT drawer —
 * feeds the "Create pending-deposit drawer" button on the three tenant
 * screens (§4B.2a-B).
 * @param tenantId tenant from the authenticated session
 */
export async function getBranchPendingDepositStatus(
  tenantId: string,
): Promise<BranchPendingDepositStatusRow[]> {
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<
      Array<{ branch_id: string; branch_name: string | null; drawer_id: string | null }>
    >(Prisma.sql`
      SELECT b.id AS branch_id,
             COALESCE(b.name, b.branch_name) AS branch_name,
             d.id AS drawer_id
        FROM org_branches_mst b
        LEFT JOIN org_cash_drawers_mst d
          ON d.tenant_org_id = b.tenant_org_id
         AND d.branch_id = b.id
         AND d.drawer_type = 'PENDING_DEPOSIT'
         AND d.is_active
       WHERE b.tenant_org_id = ${tenantId}::uuid
         AND b.is_active
       ORDER BY COALESCE(b.name, b.branch_name)
    `);

    return rows.map((row) => ({
      branchId: row.branch_id,
      branchName: row.branch_name,
      hasPendingDepositDrawer: row.drawer_id != null,
      drawerId: row.drawer_id,
    }));
  });
}
