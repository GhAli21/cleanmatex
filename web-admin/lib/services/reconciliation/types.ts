/**
 * Shared types and helpers for the BVM Phase 4 reconciliation service split.
 *
 * Why this module exists:
 * The reconciliation pipeline composes ~20 independent checks across vouchers,
 * orders, ledgers, cash drawer, and AR. Each check returns the same structural
 * payload (`CheckResult`) that the orchestrator persists via a single
 * `createMany` call. Centralising the type prevents drift between check modules
 * and the persistence layer, and lets per-check unit tests assert against the
 * same shape the orchestrator consumes.
 *
 * This file is internal to `lib/services/reconciliation/*` — outside callers
 * should keep using `@/lib/services/reconciliation.service` for the public API.
 */

import type { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

import {
  RECONCILIATION_RUN_STATUSES,
  RECONCILIATION_SEVERITIES,
  type ReconciliationCheckName,
  type ReconciliationSeverity,
} from '@/lib/constants/order-financial';
import { CASH_VARIANCE_TOLERANCE } from '@/lib/constants/financial-tolerances';

/**
 * Physical-cash variance tolerance for drawer/cash reconciliation checks.
 * Value owned by `lib/constants/financial-tolerances` (B15); order-level
 * checks use the strict `MONEY_COMPARISON_TOLERANCE` instead.
 */
export const RECONCILIATION_TOLERANCE = CASH_VARIANCE_TOLERANCE;

/**
 * Output of a single reconciliation check.
 *
 * A check that finds nothing wrong returns an empty array — only failures
 * (BLOCKER) and concerns (WARNING / INFO) are materialised as rows.
 */
export interface CheckResult {
  checkName: ReconciliationCheckName;
  severity: ReconciliationSeverity;
  passed: false;
  expectedValue?: number;
  actualValue?: number;
  delta?: number;
  message: string;
  affectedEntityType?: string;
  affectedEntityId?: string;
}

/** Aggregated counts derived from a check-result list. */
export interface ReconciliationSummary {
  issueCount: number;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  finalStatus: typeof RECONCILIATION_RUN_STATUSES[keyof typeof RECONCILIATION_RUN_STATUSES];
}

/**
 * Convert a Prisma Decimal (or null/undefined) to a plain number.
 *
 * Why:
 * Reconciliation math uses native arithmetic and the `RECONCILIATION_TOLERANCE`
 * threshold; the surrounding services already trust Decimal-to-number rounding
 * up to 4 decimals (matches `DECIMAL(19,4)` columns).
 * @param d
 */
export function toNumber(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

/**
 * Summarise a flat list of check results into per-severity counts and a final
 * run status.
 *
 * @param issues raw output of every check this run executed
 * @param totalChecks total number of distinct checks executed (passed + failed
 *   + warning); the orchestrator passes this so persisted run rows reflect the
 *   real check count rather than the stale magic-number `8` shipped pre-Phase 4
 * @returns per-severity counts plus the persistable run status
 *
 * @example
 *   const issues = [...orderChecks, ...voucherChecks];
 *   const summary = summarizeIssues(issues, RECONCILIATION_TOTAL_CHECKS);
 *   await persistReconciliationIssues(tx, tenantId, runId, issues);
 *   await tx.org_fin_recon_runs_mst.update({
 *     where: { id: runId },
 *     data: { status: summary.finalStatus, ... }
 *   });
 */
export function summarizeIssues(issues: CheckResult[], totalChecks: number): ReconciliationSummary {
  const blockerChecks = new Set<string>();
  const warningChecks = new Set<string>();

  for (const issue of issues) {
    if (issue.severity === RECONCILIATION_SEVERITIES.BLOCKER) {
      blockerChecks.add(issue.checkName);
    } else if (issue.severity === RECONCILIATION_SEVERITIES.WARNING) {
      warningChecks.add(issue.checkName);
    }
  }

  // A check that fired both a BLOCKER and a WARNING is counted as BLOCKER only,
  // otherwise the warning bucket would double-count it.
  for (const name of blockerChecks) {
    warningChecks.delete(name);
  }

  const failedChecks = blockerChecks.size;
  const warningCheckCount = warningChecks.size;
  const passedChecks = Math.max(0, totalChecks - failedChecks - warningCheckCount);

  const finalStatus =
    failedChecks > 0
      ? RECONCILIATION_RUN_STATUSES.FAILED
      : warningCheckCount > 0
        ? RECONCILIATION_RUN_STATUSES.PARTIAL
        : RECONCILIATION_RUN_STATUSES.PASSED;

  const blockerCount = issues.filter((i) => i.severity === RECONCILIATION_SEVERITIES.BLOCKER).length;
  const warningCount = issues.filter((i) => i.severity === RECONCILIATION_SEVERITIES.WARNING).length;
  const infoCount = issues.filter((i) => i.severity === RECONCILIATION_SEVERITIES.INFO).length;

  return {
    issueCount: issues.length,
    blockerCount,
    warningCount,
    infoCount,
    passedChecks,
    failedChecks,
    warningChecks: warningCheckCount,
    finalStatus,
  };
}

/**
 * Bulk-insert reconciliation issues into `org_fin_recon_issues_dtl`.
 *
 * Why bulk:
 * Pre-Phase 4 the service inserted one row per `withTenantContext()` call,
 * which produced N round-trips per run and was not transactional. A single
 * `createMany` runs inside the caller's tenant context and tx, so a partial
 * write can no longer leave a run with half its issues missing.
 *
 * @param tx Prisma client or tx scoped to the tenant
 * @param tenantOrgId active tenant — applied to every row for RLS safety
 * @param runId parent run identifier
 * @param issues flat list of check results to persist
 */
export async function persistReconciliationIssues(
  tx: Prisma.TransactionClient | { org_fin_recon_issues_dtl: { createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }> } },
  tenantOrgId: string,
  runId: string,
  issues: CheckResult[],
): Promise<void> {
  if (issues.length === 0) return;

  const data = issues.map((issue) => ({
    tenant_org_id: tenantOrgId,
    run_id: runId,
    check_name: issue.checkName,
    severity: issue.severity,
    affected_entity_type: issue.affectedEntityType ?? null,
    affected_entity_id: issue.affectedEntityId ?? null,
    expected_value: issue.expectedValue ?? null,
    actual_value: issue.actualValue ?? null,
    delta: issue.delta ?? null,
    message: issue.message,
    status: 'OPEN' as const,
  }));

  await tx.org_fin_recon_issues_dtl.createMany({ data });
}
