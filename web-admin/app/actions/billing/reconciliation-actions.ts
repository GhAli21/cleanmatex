/**
 * Server Actions: Financial Reconciliation
 *
 * listReconRunsAction: list all reconciliation runs (paginated).
 * runReconciliationAction: trigger a new reconciliation run.
 * getReconRunAction: get a single run with its issues.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  listReconRuns,
  runReconciliation,
  getReconRunWithIssues,
} from '@/lib/services/reconciliation.service';
import type { ReconciliationParams } from '@/lib/services/reconciliation.service';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/** List all reconciliation runs for the tenant (paginated). */
export async function listReconRunsAction(page = 1, pageSize = 20) {
  try {
    const auth = await getAuthContext();
    const result = await listReconRuns(auth.tenantId, page, pageSize);

    const serialized = result.items.map((r) => ({
      id:              r.id,
      run_no:          r.run_no,
      run_type:        r.run_type,
      status:          r.status,
      period_from:     r.period_from?.toISOString() ?? null,
      period_to:       r.period_to?.toISOString() ?? null,
      branch_id:       r.branch_id,
      currency_code:   r.currency_code,
      total_checked:   r.total_checked,
      passed_checks:   r.passed_checks,
      failed_checks:   r.failed_checks,
      warning_checks:  r.warning_checks,
      triggered_by:    r.triggered_by,
      started_at:      r.started_at?.toISOString() ?? null,
      completed_at:    r.completed_at?.toISOString() ?? null,
    }));

    return {
      success: true as const,
      data: { items: serialized, total: result.total, page: result.page, pageSize: result.pageSize },
    };
  } catch (error) {
    console.error('[listReconRunsAction] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load reconciliation runs',
    };
  }
}

/** Trigger a new reconciliation run. */
export async function runReconciliationAction(params: {
  periodFrom: string;
  periodTo: string;
  currencyCode: string;
  branchId?: string;
}) {
  try {
    const auth = await getAuthContext();
    const reconParams: ReconciliationParams = {
      periodFrom:   new Date(params.periodFrom),
      periodTo:     new Date(params.periodTo),
      currencyCode: params.currencyCode,
      branchId:     params.branchId,
      triggeredBy:  auth.userId,
    };
    const run = await runReconciliation(auth.tenantId, reconParams);
    revalidatePath('/dashboard/billing/reconciliation');
    return { success: true as const, data: { id: run.id, run_no: run.run_no, status: run.status } };
  } catch (error) {
    console.error('[runReconciliationAction] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to run reconciliation',
    };
  }
}

/** Get a single reconciliation run with its issues. */
export async function getReconRunAction(runId: string) {
  try {
    const auth = await getAuthContext();
    const run = await getReconRunWithIssues(auth.tenantId, runId);

    const serializedRun = {
      id:             run.id,
      run_no:         run.run_no,
      run_type:       run.run_type,
      status:         run.status,
      period_from:    run.period_from?.toISOString() ?? null,
      period_to:      run.period_to?.toISOString() ?? null,
      branch_id:      run.branch_id,
      currency_code:  run.currency_code,
      total_checked:  run.total_checked,
      passed_checks:  run.passed_checks,
      failed_checks:  run.failed_checks,
      warning_checks: run.warning_checks,
      triggered_by:   run.triggered_by,
      started_at:     run.started_at?.toISOString() ?? null,
      completed_at:   run.completed_at?.toISOString() ?? null,
      issues:         run.org_fin_recon_issues_dtl.map((issue) => ({
        id:                   issue.id,
        check_name:           issue.check_name,
        severity:             issue.severity,
        affected_entity_type: issue.affected_entity_type,
        affected_entity_id:   issue.affected_entity_id,
        expected_value:       toNumber(issue.expected_value),
        actual_value:         toNumber(issue.actual_value),
        delta:                toNumber(issue.delta),
        message:              issue.message,
        status:               issue.status,
        notes:                issue.notes,
      })),
    };

    return { success: true as const, data: serializedRun };
  } catch (error) {
    console.error('[getReconRunAction] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load reconciliation run',
    };
  }
}
