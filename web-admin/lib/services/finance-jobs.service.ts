import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { expireGiftCards } from './gift-card-service';
import { expireCreditNotes } from './stored-value.service';
import { processOutboxBatch } from './outbox-processor.service';
import { ErpLitePostingEngineService } from './erp-lite-posting-engine.service';

/**
 * Finance maintenance jobs shown on the outbox ops hub.
 *
 * Each job is wrapped by `runFinanceJob()` which writes a
 * `sys_fin_job_run_log` row (RUNNING -> SUCCESS/FAILED). Reachable two
 * ways: pg_cron -> dispatcher route (`triggerSource: 'SCHEDULE'`), and
 * `POST /api/v1/finance/jobs/[jobCode]/run` (`MANUAL`).
 *
 * Deliberately excluded (see migration 0429): wallet expiry, loyalty
 * points expiry, pending-payment aging.
 */

export const FINANCE_JOB_CODES = {
  OUTBOX_PROCESSOR: 'outbox_processor',
  GIFT_CARD_EXPIRY: 'gift_card_expiry',
  CREDIT_NOTE_EXPIRY: 'credit_note_expiry',
  IDEMPOTENCY_CLEANUP: 'idempotency_cleanup',
  ERP_POSTING_RETRY: 'erp_posting_retry',
} as const;
export type FinanceJobCode = (typeof FINANCE_JOB_CODES)[keyof typeof FINANCE_JOB_CODES];

export const FINANCE_JOB_CODE_VALUES: readonly FinanceJobCode[] = Object.values(FINANCE_JOB_CODES);

/** Minutes after which a stuck RUNNING row is released so a new run can start. */
const STALE_RUNNING_MS = 15 * 60 * 1000;
/** Idle every-minute processor SUCCESS ticks older than this are pruned. */
const OUTBOX_IDLE_RETENTION = '36 hours';

export interface FinanceJobCatalogEntry {
  jobCode: FinanceJobCode;
  cronName: string;
  cronExpr: string;
  relatedHref: string | null;
}

export const FINANCE_JOB_CATALOG: readonly FinanceJobCatalogEntry[] = [
  {
    jobCode: FINANCE_JOB_CODES.OUTBOX_PROCESSOR,
    cronName: 'fin-outbox-processor',
    cronExpr: '* * * * *',
    relatedHref: '/dashboard/internal_fin/outbox#outbox-events',
  },
  {
    jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY,
    cronName: 'fin-gift-card-expiry',
    cronExpr: '0 2 * * *',
    relatedHref: '/dashboard/marketing/gift-cards',
  },
  {
    jobCode: FINANCE_JOB_CODES.CREDIT_NOTE_EXPIRY,
    cronName: 'fin-credit-note-expiry',
    cronExpr: '5 2 * * *',
    relatedHref: '/dashboard/customers/stored-value',
  },
  {
    jobCode: FINANCE_JOB_CODES.IDEMPOTENCY_CLEANUP,
    cronName: 'fin-idempotency-cleanup',
    cronExpr: '0 3 * * *',
    relatedHref: null,
  },
  {
    jobCode: FINANCE_JOB_CODES.ERP_POSTING_RETRY,
    cronName: 'fin-erp-posting-retry',
    cronExpr: '15 * * * *',
    relatedHref: '/dashboard/erp-lite/exceptions',
  },
];

export interface FinanceJobOutcome {
  processedCount: number;
  failedCount: number;
}

export class FinanceJobAlreadyRunningError extends Error {
  readonly code = 'JOB_ALREADY_RUNNING' as const;
  constructor(readonly startedAt: string) {
    super('JOB_ALREADY_RUNNING');
    this.name = 'FinanceJobAlreadyRunningError';
  }
}

export function isFinanceJobAlreadyRunningError(
  err: unknown,
): err is FinanceJobAlreadyRunningError {
  return err instanceof FinanceJobAlreadyRunningError;
}

function cronFieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  if (/^\d+$/.test(field)) return Number(field) === value;
  return false;
}

/**
 * Next UTC occurrence for the 5-field cron expressions this hub actually
 * registers (`*`, or a single integer). Not a general cron parser.
 */
export function nextCronOccurrence(cronExpr: string, from: Date = new Date()): Date | null {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minuteField, hourField] = parts;
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  for (let step = 0; step < 24 * 60 + 5; step++) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    if (
      cronFieldMatches(minuteField, cursor.getUTCMinutes()) &&
      cronFieldMatches(hourField, cursor.getUTCHours())
    ) {
      return new Date(cursor.getTime());
    }
  }
  return null;
}

async function runOutboxProcessor(): Promise<FinanceJobOutcome> {
  const result = await processOutboxBatch();
  return {
    processedCount: result.processed + result.skipped,
    failedCount: result.failed + result.deadLettered,
  };
}

/**
 * Gift-card expiry sweep. Loops every active tenant, calling the ledger+GL
 * `expireGiftCards()` per tenant. One tenant's failure never blocks the rest.
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
      logger.error('Gift-card expiry sweep failed for tenant', err as Error, { tenantId: tenant.id });
    }
  }
  return { processedCount, failedCount };
}

/**
 * Credit-note expiry sweep. Loops every active tenant through the
 * ledger-aware `expireCreditNotes()` — replaces the retired
 * `expire-credit-notes` raw cron (bare status UPDATE, zero ledger rows).
 */
async function runCreditNoteExpiry(): Promise<FinanceJobOutcome> {
  const tenants = await prisma.org_tenants_mst.findMany({
    where: { is_active: true },
    select: { id: true },
  });

  let processedCount = 0;
  let failedCount = 0;
  for (const tenant of tenants) {
    try {
      const result = await expireCreditNotes(tenant.id);
      processedCount += result.expiredCount;
      failedCount += result.failedCount;
    } catch (err) {
      failedCount++;
      logger.error('Credit-note expiry sweep failed for tenant', err as Error, { tenantId: tenant.id });
    }
  }
  return { processedCount, failedCount };
}

/**
 * Idempotency-key cleanup. Single cross-tenant SQL DELETE via
 * `cleanup_expired_idempotency_keys()` — the sanctioned deletion path
 * for `org_idempotency_keys` (D010 invariant 8).
 */
async function runIdempotencyCleanup(): Promise<FinanceJobOutcome> {
  const rows = await prisma.$queryRaw<{ cleanup_expired_idempotency_keys: number }[]>`
    SELECT cleanup_expired_idempotency_keys()
  `;
  const deleted = rows[0]?.cleanup_expired_idempotency_keys ?? 0;
  return { processedCount: deleted, failedCount: 0 };
}

/**
 * ERP-Lite posting-retry sweep. Only SYSTEM_ERROR exceptions in a bounded
 * recent window. A failed retry leaves the exception open.
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
      logger.error('ERP posting-retry failed for exception', err as Error, {
        exceptionId: row.exception_id,
        tenantId: row.tenant_org_id,
      });
    }
  }
  return { processedCount, failedCount };
}

const JOB_RUNNERS: Record<FinanceJobCode, () => Promise<FinanceJobOutcome>> = {
  [FINANCE_JOB_CODES.OUTBOX_PROCESSOR]: runOutboxProcessor,
  [FINANCE_JOB_CODES.GIFT_CARD_EXPIRY]: runGiftCardExpiry,
  [FINANCE_JOB_CODES.CREDIT_NOTE_EXPIRY]: runCreditNoteExpiry,
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
  skippedBecauseRunning?: boolean;
}

function isUniqueRunningConflict(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

async function releaseStaleRunning(jobCode: FinanceJobCode): Promise<void> {
  await prisma.sys_fin_job_run_log.updateMany({
    where: {
      job_code: jobCode,
      status: 'RUNNING',
      started_at: { lt: new Date(Date.now() - STALE_RUNNING_MS) },
    },
    data: {
      status: 'FAILED',
      error_message: 'STALE_RUNNING_RELEASED',
      finished_at: new Date(),
    },
  });
}

async function findActiveRun(jobCode: FinanceJobCode) {
  return prisma.sys_fin_job_run_log.findFirst({
    where: { job_code: jobCode, status: 'RUNNING' },
    orderBy: { started_at: 'desc' },
    select: { id: true, started_at: true },
  });
}

function overlapResult(
  triggerSource: 'SCHEDULE' | 'MANUAL',
  existing: { id: string; started_at: Date } | null,
): RunJobResult {
  const startedAt = (existing?.started_at ?? new Date()).toISOString();
  if (triggerSource === 'MANUAL') {
    throw new FinanceJobAlreadyRunningError(startedAt);
  }
  return {
    runId: existing?.id ?? 'overlap',
    status: 'SUCCESS',
    processedCount: 0,
    failedCount: 0,
    skippedBecauseRunning: true,
  };
}

async function pruneIdleOutboxProcessorRuns(keepId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM public.sys_fin_job_run_log
      WHERE job_code = 'outbox_processor'
        AND status = 'SUCCESS'
        AND trigger_source = 'SCHEDULE'
        AND COALESCE(processed_count, 0) = 0
        AND COALESCE(failed_count, 0) = 0
        AND started_at < NOW() - INTERVAL '36 hours'
        AND id <> ${keepId}::uuid
    `;
  } catch (err) {
    logger.warn('Idle outbox processor run-log prune failed', {
      feature: 'finance-jobs',
      action: 'prune-idle',
      error: err instanceof Error ? err.message : String(err),
      keepId,
      retention: OUTBOX_IDLE_RETENTION,
    });
  }
}

/**
 * Run one finance job, wrapped by a `sys_fin_job_run_log` row.
 * The row is created RUNNING before the body executes and always finalized
 * (SUCCESS or FAILED). A second overlapping run is rejected: MANUAL throws
 * `FinanceJobAlreadyRunningError`; SCHEDULE no-ops so pg_cron does not storm.
 */
export async function runFinanceJob(params: RunJobParams): Promise<RunJobResult> {
  const { jobCode, triggerSource, triggeredBy } = params;

  await releaseStaleRunning(jobCode);

  const already = await findActiveRun(jobCode);
  if (already) {
    return overlapResult(triggerSource, already);
  }

  let run: { id: string };
  try {
    run = await prisma.sys_fin_job_run_log.create({
      data: {
        job_code: jobCode,
        trigger_source: triggerSource,
        triggered_by: triggeredBy ?? null,
        status: 'RUNNING',
      },
      select: { id: true },
    });
  } catch (err) {
    if (isUniqueRunningConflict(err)) {
      const raced = await findActiveRun(jobCode);
      return overlapResult(triggerSource, raced);
    }
    throw err;
  }

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
    if (jobCode === FINANCE_JOB_CODES.OUTBOX_PROCESSOR) {
      await pruneIdleOutboxProcessorRuns(run.id);
    }
    return { runId: run.id, status: 'SUCCESS', ...outcome };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JOB_FAILED';
    await prisma.sys_fin_job_run_log.update({
      where: { id: run.id },
      data: { status: 'FAILED', error_message: message, finished_at: new Date() },
    });
    logger.error('Finance job failed', err as Error, { jobCode, triggerSource });
    return { runId: run.id, status: 'FAILED', processedCount: 0, failedCount: 0 };
  }
}

export interface FinanceJobRunView {
  runId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  triggerSource: 'SCHEDULE' | 'MANUAL';
  processedCount: number | null;
  failedCount: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface FinanceJobLastRun {
  jobCode: FinanceJobCode;
  lastRun: FinanceJobRunView | null;
}

export interface FinanceJobListItem {
  jobCode: FinanceJobCode;
  cronName: string;
  cronExpr: string;
  cronActive: boolean | null;
  nextRunAt: string | null;
  relatedHref: string | null;
  secretConfigured: boolean | null;
  isRunning: boolean;
  lastRun: FinanceJobRunView | null;
}

function toRunView(row: {
  id: string;
  status: string;
  trigger_source: string;
  processed_count: number | null;
  failed_count: number | null;
  error_message: string | null;
  started_at: Date;
  finished_at: Date | null;
}): FinanceJobRunView {
  const finishedAt = row.finished_at;
  const durationMs = finishedAt
    ? Math.max(0, finishedAt.getTime() - row.started_at.getTime())
    : row.status === 'RUNNING'
      ? Math.max(0, Date.now() - row.started_at.getTime())
      : null;
  return {
    runId: row.id,
    status: row.status as FinanceJobRunView['status'],
    triggerSource: row.trigger_source as FinanceJobRunView['triggerSource'],
    processedCount: row.processed_count,
    failedCount: row.failed_count,
    errorMessage: row.error_message,
    startedAt: row.started_at.toISOString(),
    finishedAt: finishedAt?.toISOString() ?? null,
    durationMs,
  };
}

async function loadCronSchedules(): Promise<Map<string, boolean>> {
  try {
    const rows = await prisma.$queryRaw<{ job_code: string; is_active: boolean | null }[]>`
      SELECT job_code, is_active FROM public.fin_list_job_schedules()
    `;
    return new Map(rows.map((row) => [row.job_code, Boolean(row.is_active)]));
  } catch (err) {
    logger.warn('fin_list_job_schedules unavailable', {
      feature: 'finance-jobs',
      action: 'list-schedules',
      error: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }
}

function mapLastRun(row: {
  id: string;
  status: string;
  trigger_source: string;
  processed_count: number | null;
  failed_count: number | null;
  error_message: string | null;
  started_at: Date;
  finished_at: Date | null;
} | null): FinanceJobRunView | null {
  return row ? toRunView(row) : null;
}

/** Last run of each registered job (compat shape for existing callers/tests). */
export async function listFinanceJobsLastRun(): Promise<FinanceJobLastRun[]> {
  const jobs = await listFinanceJobs();
  return jobs.map((job) => ({ jobCode: job.jobCode, lastRun: job.lastRun }));
}

/** Catalog + last run + cron health for the ops hub. */
export async function listFinanceJobs(): Promise<FinanceJobListItem[]> {
  const cronByCode = await loadCronSchedules();
  const now = new Date();
  const secretConfigured = Boolean(process.env.FINANCE_OUTBOX_SECRET);
  const results: FinanceJobListItem[] = [];

  for (const entry of FINANCE_JOB_CATALOG) {
    const row = await prisma.sys_fin_job_run_log.findFirst({
      where: { job_code: entry.jobCode },
      orderBy: { started_at: 'desc' },
    });
    const lastRun = mapLastRun(row);
    const next = nextCronOccurrence(entry.cronExpr, now);
    const cronKnown = cronByCode.size > 0;
    results.push({
      jobCode: entry.jobCode,
      cronName: entry.cronName,
      cronExpr: entry.cronExpr,
      cronActive: cronKnown ? (cronByCode.get(entry.jobCode) ?? false) : null,
      nextRunAt: next?.toISOString() ?? null,
      relatedHref: entry.relatedHref,
      secretConfigured: entry.jobCode === FINANCE_JOB_CODES.OUTBOX_PROCESSOR ? secretConfigured : null,
      isRunning: lastRun?.status === 'RUNNING',
      lastRun,
    });
  }
  return results;
}

const RUN_HISTORY_MAX = 50;

/**
 * Recent run history for one job. The every-minute outbox processor only
 * returns productive / failed / manual ticks plus the latest heartbeat so
 * the dialog is not 50 idle SUCCESS rows.
 */
export async function listFinanceJobRuns(
  jobCode: FinanceJobCode,
  limit = 30,
): Promise<FinanceJobRunView[]> {
  const take = Math.min(Math.max(limit, 1), RUN_HISTORY_MAX);

  if (jobCode === FINANCE_JOB_CODES.OUTBOX_PROCESSOR) {
    const latest = await prisma.sys_fin_job_run_log.findFirst({
      where: { job_code: jobCode },
      orderBy: { started_at: 'desc' },
      select: { id: true },
    });
    const rows = await prisma.sys_fin_job_run_log.findMany({
      where: {
        job_code: jobCode,
        OR: [
          { trigger_source: 'MANUAL' },
          { status: { in: ['FAILED', 'RUNNING'] } },
          { processed_count: { gt: 0 } },
          { failed_count: { gt: 0 } },
          ...(latest ? [{ id: latest.id }] : []),
        ],
      },
      orderBy: { started_at: 'desc' },
      take,
    });
    return rows.map(toRunView);
  }

  const rows = await prisma.sys_fin_job_run_log.findMany({
    where: { job_code: jobCode },
    orderBy: { started_at: 'desc' },
    take,
  });
  return rows.map(toRunView);
}
