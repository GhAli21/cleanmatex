import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { expireGiftCards } from './gift-card-service';
import { ErpLitePostingEngineService } from './erp-lite-posting-engine.service';

/**
 * B19 — Expiry and Idempotency Jobs.
 *
 * Three scheduled finance maintenance jobs, each wrapped by
 * `runJob()` which writes a `sys_fin_job_run_log` row (RUNNING -> SUCCESS/
 * FAILED with processed/failed counts). Reachable two ways: the pg_cron ->
 * `fin_trigger_job()` -> `POST /api/finance/process-jobs` path (system,
 * `triggerSource: 'SCHEDULE'`), and an interactive manual-run route
 * (`POST /api/v1/finance/jobs/[jobCode]/run`, `triggerSource: 'MANUAL'`,
 * `triggeredBy: actorId`).
 *
 * Deliberately excluded from this file (see migration 0429's header for the
 * full reasoning, not duplicated here): wallet expiry (no policy surface
 * exists), loyalty points expiry (real policy exists but the ledger has no
 * per-lot allocation model yet — building an approximate sweep risked
 * wrongly zeroing out already-redeemed points), pending-payment aging (not
 * a job — computed query-time in `pending-payments-worklist.service.ts`).
 */

export const FINANCE_JOB_CODES = {
  GIFT_CARD_EXPIRY: 'gift_card_expiry',
  IDEMPOTENCY_CLEANUP: 'idempotency_cleanup',
  ERP_POSTING_RETRY: 'erp_posting_retry',
} as const;
export type FinanceJobCode = (typeof FINANCE_JOB_CODES)[keyof typeof FINANCE_JOB_CODES];

export const FINANCE_JOB_CODE_VALUES: readonly FinanceJobCode[] = Object.values(FINANCE_JOB_CODES);

export interface FinanceJobOutcome {
  processedCount: number;
  failedCount: number;
}

/**
 * B19 — gift-card expiry sweep. Loops every active tenant, calling the
 * ledger+GL-aware `expireGiftCards()` per tenant (replaces the retired
 * `expire-gift-cards` raw cron — see migration 0429). One tenant's failure
 * never blocks the rest.
 */
async function runGiftCardExpiry(): Promise<FinanceJobOutcome> {
  const tenants = await prisma.org_tenants_mst.findMany({
    where: { is_active: true },
    select: { id: true },
  });

  let processedCount = 0;
  let failedCount = 0;
  for (const tenant of tenants) {
    try {
      const result = await expireGiftCards(tenant.id);
      processedCount += result.expiredCount;
      failedCount += result.failedCount;
    } catch (err) {
      failedCount++;
      logger.error('B19 gift-card expiry sweep failed for tenant', err as Error, { tenantId: tenant.id });
    }
  }
  return { processedCount, failedCount };
}

/**
 * B19/D010 — idempotency-key cleanup. Single cross-tenant SQL DELETE via
 * `cleanup_expired_idempotency_keys()` (migration 0429) — the one
 * sanctioned deletion path for `org_idempotency_keys` (D010 invariant 8).
 */
async function runIdempotencyCleanup(): Promise<FinanceJobOutcome> {
  const rows = await prisma.$queryRaw<{ cleanup_expired_idempotency_keys: number }[]>`
    SELECT cleanup_expired_idempotency_keys()
  `;
  const deleted = rows[0]?.cleanup_expired_idempotency_keys ?? 0;
  return { processedCount: deleted, failedCount: 0 };
}

/**
 * B19 — ERP-Lite posting-retry sweep. Deliberately narrow: only
 * SYSTEM_ERROR exceptions within a bounded recent window (see
 * `list_retryable_posting_exceptions()`'s own comment, migration 0429) —
 * every other exception type needs a human fix first and is left for the
 * manual Retry button on the Exception Workbench. On a successful retry,
 * marks the original exception RETRIED so it drops out of the open-exception
 * view; a failed retry leaves the exception untouched for the next sweep or
 * manual intervention.
 */
async function runErpPostingRetry(): Promise<FinanceJobOutcome> {
  const eligible = await prisma.$queryRaw<
    { exception_id: string; tenant_org_id: string; posting_log_id: string }[]
  >`SELECT * FROM list_retryable_posting_exceptions(24)`;

  let processedCount = 0;
  let failedCount = 0;
  for (const row of eligible) {
    try {
      const result = await ErpLitePostingEngineService.retry({
        posting_log_id: row.posting_log_id,
        tenant_org_id: row.tenant_org_id,
      });
      if (result.success) {
        await prisma.$executeRaw`
          UPDATE public.org_fin_post_exc_tr
          SET status_code = 'RETRIED', resolved_at = NOW(), updated_at = NOW()
          WHERE id = ${row.exception_id}::uuid AND tenant_org_id = ${row.tenant_org_id}::uuid
        `;
        processedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      failedCount++;
      logger.error('B19 ERP posting-retry failed for exception', err as Error, {
        exceptionId: row.exception_id,
        tenantId: row.tenant_org_id,
      });
    }
  }
  return { processedCount, failedCount };
}

const JOB_RUNNERS: Record<FinanceJobCode, () => Promise<FinanceJobOutcome>> = {
  [FINANCE_JOB_CODES.GIFT_CARD_EXPIRY]: runGiftCardExpiry,
  [FINANCE_JOB_CODES.IDEMPOTENCY_CLEANUP]: runIdempotencyCleanup,
  [FINANCE_JOB_CODES.ERP_POSTING_RETRY]: runErpPostingRetry,
};

export interface RunJobParams {
  jobCode: FinanceJobCode;
  triggerSource: 'SCHEDULE' | 'MANUAL';
  triggeredBy?: string;
}

export interface RunJobResult extends FinanceJobOutcome {
  runId: string;
  status: 'SUCCESS' | 'FAILED';
}

/**
 * B19 — run one finance job, wrapped by a `sys_fin_job_run_log` row.
 * The row is created RUNNING before the job body executes and always
 * finalized (SUCCESS or FAILED) even if the job throws — a run is never
 * left stuck at RUNNING.
 */
export async function runFinanceJob(params: RunJobParams): Promise<RunJobResult> {
  const { jobCode, triggerSource, triggeredBy } = params;

  const run = await prisma.sys_fin_job_run_log.create({
    data: {
      job_code: jobCode,
      trigger_source: triggerSource,
      triggered_by: triggeredBy ?? null,
      status: 'RUNNING',
    },
    select: { id: true },
  });

  try {
    const outcome = await JOB_RUNNERS[jobCode]();
    await prisma.sys_fin_job_run_log.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        processed_count: outcome.processedCount,
        failed_count: outcome.failedCount,
        finished_at: new Date(),
      },
    });
    return { runId: run.id, status: 'SUCCESS', ...outcome };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JOB_FAILED';
    await prisma.sys_fin_job_run_log.update({
      where: { id: run.id },
      data: { status: 'FAILED', error_message: message, finished_at: new Date() },
    });
    logger.error('B19 finance job failed', err as Error, { jobCode, triggerSource });
    return { runId: run.id, status: 'FAILED', processedCount: 0, failedCount: 0 };
  }
}

export interface FinanceJobLastRun {
  jobCode: FinanceJobCode;
  lastRun: {
    runId: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    triggerSource: 'SCHEDULE' | 'MANUAL';
    processedCount: number | null;
    failedCount: number | null;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
}

/** B19 — the last run of each of the 3 registered jobs, for the ops screen. */
export async function listFinanceJobsLastRun(): Promise<FinanceJobLastRun[]> {
  const results: FinanceJobLastRun[] = [];
  for (const jobCode of FINANCE_JOB_CODE_VALUES) {
    const row = await prisma.sys_fin_job_run_log.findFirst({
      where: { job_code: jobCode },
      orderBy: { started_at: 'desc' },
    });
    results.push({
      jobCode,
      lastRun: row
        ? {
            runId: row.id,
            status: row.status as 'RUNNING' | 'SUCCESS' | 'FAILED',
            triggerSource: row.trigger_source as 'SCHEDULE' | 'MANUAL',
            processedCount: row.processed_count,
            failedCount: row.failed_count,
            errorMessage: row.error_message,
            startedAt: row.started_at.toISOString(),
            finishedAt: row.finished_at?.toISOString() ?? null,
          }
        : null,
    });
  }
  return results;
}
