/**
 * Cash Up / Reconciliation Service for CleanMateX
 *
 * Handles end-of-day reconciliation: expected amounts by payment method from
 * org_payments_dtl_tr (completed only), actual counted amounts, and persistence
 * to org_payment_reconciliation_log.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type {
  CashUpReconciliationEntry,
  CashUpReconciliationStatus,
  CashUpSubmitEntry,
} from '@/lib/types/payment';

// ============================================================================
// Helpers
// ============================================================================

function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ============================================================================
// Expected amounts by date (completed payments only)
// ============================================================================

/**
 * Get expected payment totals by method for a given date.
 * Only includes rows with status = 'completed'.
 */
export async function getExpectedAmountsByDate(
  tenantOrgId: string,
  date: Date
): Promise<Record<string, number>> {
  return withTenantContext(tenantOrgId, async () => {
    const start = startOfDayUTC(date);
    const end = endOfDayUTC(date);

    const rows = await prisma.org_payments_dtl_tr.groupBy({
      by: ['payment_method_code'],
      where: {
        tenant_org_id: tenantOrgId,
        status: 'completed',
        paid_at: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        paid_amount: true,
      },
    });

    const result: Record<string, number> = {};
    for (const row of rows) {
      const sum = row._sum.paid_amount;
      result[row.payment_method_code] = sum ? Number(sum) : 0;
    }
    return result;
  });
}

// ============================================================================
// Reconciliation log read
// ============================================================================

/**
 * Get reconciliation entries for a given date.
 */
export async function getReconciliationForDate(
  tenantOrgId: string,
  date: Date
): Promise<CashUpReconciliationEntry[]> {
  return withTenantContext(tenantOrgId, async () => {
    const dateOnly = startOfDayUTC(date);

    const logs = await prisma.org_payment_reconciliation_log.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        reconciliation_date: dateOnly,
      },
      orderBy: { payment_method_code: 'asc' },
    });

    return logs.map((log) => ({
      payment_method_code: log.payment_method_code,
      expected_amount: Number(log.expected_amount),
      actual_amount: Number(log.actual_amount),
      variance: log.variance != null ? Number(log.variance) : Number(log.actual_amount) - Number(log.expected_amount),
      status: log.status as CashUpReconciliationStatus,
      reconciled_by: log.reconciled_by ?? undefined,
      reconciled_at: log.reconciled_at?.toISOString(),
      notes: log.notes ?? undefined,
    }));
  });
}

// ============================================================================
// Save reconciliation (upsert)
// ============================================================================
//
// Unique key for upsert: Prisma uses the default compound name
// tenant_org_id_reconciliation_date_payment_method_code (not the schema map
// "uq_recon_tenant_date_method"). To validate: grep for
// org_payment_reconciliation_logWhereUniqueInput in node_modules/.prisma/client/index.d.ts
// and use the compound key shown there (e.g. tenant_org_id_reconciliation_date_...).
//

/**
 * Save or update reconciliation for a date. One row per payment method.
 * Status: variance_noted if variance !== 0, else reconciled.
 */
export async function saveReconciliation(
  tenantOrgId: string,
  date: Date,
  entries: CashUpSubmitEntry[],
  reconciledBy: string
): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const expectedByMethod = await getExpectedAmountsByDate(tenantOrgId, date);
    const dateOnly = startOfDayUTC(date);
    const now = new Date();

    await prisma.$transaction(
      entries.map((entry) => {
        const expected = expectedByMethod[entry.payment_method_code] ?? 0;
        const actual = Number(entry.actual_amount);
        const variance = actual - expected;
        const status: CashUpReconciliationStatus =
          variance !== 0 ? 'variance_noted' : 'reconciled';

        return prisma.org_payment_reconciliation_log.upsert({
          where: {
            tenant_org_id_reconciliation_date_payment_method_code: {
              //uq_recon_tenant_date_method: {
              tenant_org_id: tenantOrgId,
              reconciliation_date: dateOnly,
              payment_method_code: entry.payment_method_code,
            },
          },
          create: {
            tenant_org_id: tenantOrgId,
            reconciliation_date: dateOnly,
            payment_method_code: entry.payment_method_code,
            expected_amount: expected,
            actual_amount: actual,
            status,
            reconciled_by: reconciledBy,
            reconciled_at: now,
            notes: entry.notes ?? null,
            created_by: reconciledBy,
            updated_at: now,
            updated_by: reconciledBy,
          },
          update: {
            expected_amount: expected,
            actual_amount: actual,
            status,
            reconciled_by: reconciledBy,
            reconciled_at: now,
            notes: entry.notes ?? null,
            updated_at: now,
            updated_by: reconciledBy,
          },
        });
      })
    );
  });
}

// ============================================================================
// Reconciliation history (optional)
// ============================================================================

export interface ReconciliationHistoryFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ReconciliationHistoryItem {
  id: string;
  reconciliation_date: string;
  payment_method_code: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  status: CashUpReconciliationStatus;
  reconciled_by?: string;
  reconciled_at?: string;
  notes?: string;
}

/**
 * List reconciliation history for the tenant, ordered by date desc.
 */
export async function listReconciliationHistory(
  tenantOrgId: string,
  filters?: ReconciliationHistoryFilters
): Promise<ReconciliationHistoryItem[]> {
  return withTenantContext(tenantOrgId, async () => {
    const where: {
      tenant_org_id: string;
      reconciliation_date?: { gte?: Date; lte?: Date };
    } = {
      tenant_org_id: tenantOrgId,
    };

    if (filters?.startDate || filters?.endDate) {
      where.reconciliation_date = {};
      if (filters.startDate) {
        where.reconciliation_date.gte = startOfDayUTC(filters.startDate);
      }
      if (filters.endDate) {
        where.reconciliation_date.lte = endOfDayUTC(filters.endDate);
      }
    }

    const logs = await prisma.org_payment_reconciliation_log.findMany({
      where,
      orderBy: { reconciliation_date: 'desc' },
      take: filters?.limit ?? 50,
    });

    return logs.map((log) => ({
      id: log.id,
      reconciliation_date: log.reconciliation_date.toISOString().slice(0, 10),
      payment_method_code: log.payment_method_code,
      expected_amount: Number(log.expected_amount),
      actual_amount: Number(log.actual_amount),
      variance: log.variance != null ? Number(log.variance) : Number(log.actual_amount) - Number(log.expected_amount),
      status: log.status as CashUpReconciliationStatus,
      reconciled_by: log.reconciled_by ?? undefined,
      reconciled_at: log.reconciled_at?.toISOString(),
      notes: log.notes ?? undefined,
    }));
  });
}
