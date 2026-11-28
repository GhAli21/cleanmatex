import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { ERP_LITE_EXCEPTION_TYPES } from '@/lib/constants/erp-lite-posting';
import { EXPIRY_SWEEP_PAGE, runGiftCardExpiryItem, runLoyaltyExpiryItem } from './finance-expiry-jobs.service';
import { ErpLiteExceptionsService } from './erp-lite-exceptions.service';

/**
 * "Run now" for ONE Organization from its own screens (Background Jobs step 6g, migration 0851,
 * docs/features/Background_Jobs/STEP6_PLAN.md). The nightly jobs do the same for every
 * Organization; staff use these before a month close so the ledger and reports are current.
 *
 * Each run is synchronous and bounded (one page) and reuses the job code: the same due function
 * with the Organization filter, the same per-item poster. Every item re-checks "still due" under its
 * row lock, so two clicks, or a click during the nightly run, change nothing twice.
 */

/** Result of one run: done now, failed (left for the next run), and whether more are waiting. */
export interface RunNowOutcome {
  done: number;
  failed: number;
  /** A full page was handled: more may be due; another click continues. */
  more: boolean;
}

/** ERP "Retry all" handles at most this many exceptions a click (each posts a journal). */
export const ERP_RETRY_ALL_MAX = 50;

/**
 * Expires this Organization's due gift cards (ledger row + GL entry each, like the nightly job).
 * @param tenantOrgId Organization resolved server-side from the session by the caller.
 * @returns Counts of the run.
 * @example await expireDueGiftCardsNow('5f1c…'); // { done: 2, failed: 0, more: false }
 */
export async function expireDueGiftCardsNow(tenantOrgId: string): Promise<RunNowOutcome> {
  const due = await prisma.$queryRaw<{ gift_card_id: string }[]>`
    SELECT gift_card_id FROM public.fn_fin_gift_card_exp_due(${EXPIRY_SWEEP_PAGE}::int, ${tenantOrgId}::uuid)`;
  return runEach(due.map((r) => r.gift_card_id), EXPIRY_SWEEP_PAGE, async (id) => {
    const r = await runGiftCardExpiryItem(tenantOrgId, id);
    return r.outcome === 'EXPIRED' ? 'done' : 'skipped';
  }, { tenantOrgId, kind: 'gift_card' });
}

/**
 * Expires this Organization's loyalty points older than its program's expiry period.
 * @param tenantOrgId Organization resolved server-side from the session by the caller.
 * @returns Counts of the run (done = accounts whose points expired).
 * @example await expireDueLoyaltyPointsNow('5f1c…'); // { done: 4, failed: 0, more: false }
 */
export async function expireDueLoyaltyPointsNow(tenantOrgId: string): Promise<RunNowOutcome> {
  const due = await prisma.$queryRaw<{ account_id: string }[]>`
    SELECT account_id FROM public.fn_fin_loyalty_exp_due(${EXPIRY_SWEEP_PAGE}::int, ${tenantOrgId}::uuid)`;
  return runEach(due.map((r) => r.account_id), EXPIRY_SWEEP_PAGE, async (id) => {
    const r = await runLoyaltyExpiryItem(tenantOrgId, id);
    return r.outcome === 'EXPIRED' ? 'done' : 'skipped';
  }, { tenantOrgId, kind: 'loyalty' });
}

/**
 * Expires this Organization's credit notes past their date, in the database (the same function
 * the nightly pg_cron job runs, filtered to this Organization).
 * @param tenantOrgId Organization resolved server-side from the session by the caller.
 * @returns Counts of the run; `failed` notes are retried by the next run.
 * @example await expireDueCreditNotesNow('5f1c…'); // { done: 1, failed: 0, more: false }
 */
export async function expireDueCreditNotesNow(tenantOrgId: string): Promise<RunNowOutcome> {
  const rows = await prisma.$queryRaw<{ r: { expired: number; failed: number } }[]>`
    SELECT public.fn_fin_credit_note_expiry_run(${tenantOrgId}::uuid) AS r`;
  const r = rows[0]?.r ?? { expired: 0, failed: 0 };
  // The function handles up to 5,000 notes a call; one Organization does not reach that.
  return { done: r.expired, failed: r.failed, more: false };
}

/**
 * Retries this Organization's open SYSTEM_ERROR posting exceptions, oldest first, one by one
 * through the Workbench Retry (same audit row and status change as clicking Retry on each).
 * Other exception types need a person to fix the cause first, so they are left alone.
 * Must run inside a staff request: `retryException` resolves the Organization and user from it.
 * @param tenantOrgId Organization resolved server-side from the session by the caller.
 * @returns Counts of the run (done = posted now).
 * @example await retryErpSystemErrorsNow('5f1c…'); // { done: 3, failed: 1, more: false }
 */
export async function retryErpSystemErrorsNow(tenantOrgId: string): Promise<RunNowOutcome> {
  const open = await withTenantContext(tenantOrgId, () => prisma.$queryRaw<{ exception_id: string; posting_log_id: string }[]>`
    SELECT exception_id, posting_log_id
    FROM public.vw_fin_open_exceptions
    WHERE tenant_org_id = ${tenantOrgId}::uuid
      AND exception_type_code = ${ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR}
      AND status_code IN ('NEW', 'OPEN')
    ORDER BY created_at
    LIMIT ${ERP_RETRY_ALL_MAX}`);
  const logByException = new Map(open.map((r) => [r.exception_id, r.posting_log_id]));
  return runEach([...logByException.keys()], ERP_RETRY_ALL_MAX, async (id) => {
    const r = await ErpLiteExceptionsService.retryException(id, logByException.get(id)!);
    return r.success ? 'done' : 'failed';
  }, { tenantOrgId, kind: 'erp_retry' });
}

/**
 * Runs one item at a time; a failed or throwing item is counted and the rest go on. 'skipped' =
 * no longer due (someone or the nightly run got there first): neither done nor failed.
 */
async function runEach(
  ids: string[],
  pageSize: number,
  run: (id: string) => Promise<'done' | 'failed' | 'skipped'>,
  ctx: { tenantOrgId: string; kind: string },
): Promise<RunNowOutcome> {
  let done = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const r = await run(id);
      if (r === 'done') done += 1;
      else if (r === 'failed') failed += 1;
    } catch (err) {
      failed += 1;
      logger.warn('Run now: one item failed', {
        feature: 'finance-run-now', action: ctx.kind, tenantId: ctx.tenantOrgId, itemId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { done, failed, more: ids.length >= pageSize };
}
