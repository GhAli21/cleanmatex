/**
 * Shared assertion guard for ERP-Lite auto-post dispatch results that gate
 * AR-invoice writes.
 *
 * BVM Wiring Phase 6 Sub-item 2 extraction.
 * Previously this helper was duplicated verbatim inside
 * `invoice-service.ts` and `ar-invoice.service.ts`. The legacy adapter
 * was retired in Phase 6 Sub-item 2, leaving the canonical writer as the
 * sole AR-invoice producer. Both producers needed the same blocking
 * semantics, so the function now lives in this shared util to keep the
 * contract DRY.
 */
import 'server-only';

import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';
import { ERP_LITE_BLOCKING_MODES } from '@/lib/constants/erp-lite-posting';
import { logger } from '@/lib/utils/logger';
import type { ErpLiteAutoPostDispatchResult } from '@/lib/types/erp-lite-auto-post';

/**
 * The exact shape returned by `ErpLiteAutoPostService.dispatchInvoiceCreated`
 * and `dispatchInvoiceCreatedInTransaction`. Re-exported as a type alias to
 * keep call sites independent of the underlying service typing.
 */
export type InvoiceAutoPostDispatchResult = Awaited<
  ReturnType<typeof ErpLiteAutoPostService.dispatchInvoiceCreated>
>;

/**
 * Throw when an ERP-Lite auto-post policy is BLOCKING (or requires success)
 * and the dispatcher did not return a successful execution. Otherwise the
 * caller may proceed to commit the invoice.
 *
 * Why this lives here:
 * The canonical AR-invoice writer and the legacy order-invoice adapter both
 * need identical gating semantics — if a tenant policy says "block invoice
 * creation when the ERP-Lite journal posting failed", every producer must
 * honour it the same way. Pulling the rule into one util prevents drift.
 *
 * @param dispatchResult result from the ERP-Lite auto-post dispatcher
 * @throws Error with the dispatcher's failure / skip reason when blocking
 *         policy is set and the post did not succeed
 */
export function assertBlockingInvoiceAutoPostSucceeded(
  dispatchResult: InvoiceAutoPostDispatchResult,
): void {
  const shouldBlock =
    !!dispatchResult.policy &&
    (dispatchResult.policy.blocking_mode === ERP_LITE_BLOCKING_MODES.BLOCKING ||
      dispatchResult.policy.required_success === true);

  if (!shouldBlock) return;

  const success =
    dispatchResult.status === 'executed' &&
    dispatchResult.execute_result?.success === true;

  if (success) return;

  const failureMessage =
    dispatchResult.status === 'skipped'
      ? `ERP-Lite auto-post policy prevented invoice completion (${dispatchResult.skip_reason}).`
      : dispatchResult.execute_result?.error_message ??
        'ERP-Lite auto-post failed for the invoice.';

  throw new Error(failureMessage);
}

/**
 * B6 — shared outcome logger for the NON_BLOCKING call sites this package
 * wires (payment received, refund issued, gift-card lifecycle, wallet
 * top-up, customer advance receipt). Deliberately the inverse of
 * {@link assertBlockingInvoiceAutoPostSucceeded}: it never throws — the
 * whole point of these events being NON_BLOCKING (D007 failure coupling:
 * "ERP posting failure must not delete or roll back the operational
 * voucher") is that the business transaction that already committed must
 * never be undone by a downstream GL posting problem. A failed/skipped
 * dispatch still needs to be loud somewhere, so this logs it — the
 * `org_fin_post_exc_tr` exception row the engine already writes on failure
 * is the durable, actionable record; this log line is just the immediate
 * operational signal.
 *
 * @param eventLabel short identifier for the log line (e.g. 'payment_received')
 * @param dispatchResult result from any B6 dispatcher call
 */
export function logAutoPostOutcome(
  eventLabel: string,
  dispatchResult: ErpLiteAutoPostDispatchResult,
): void {
  if (dispatchResult.status === 'skipped') {
    // POLICY_NOT_FOUND / POLICY_DISABLED / FEATURE_NOT_ENABLED are all
    // expected, routine skips (tenant hasn't enabled ERP-Lite, or hasn't
    // published a policy for this event yet) — info level, not a warning.
    logger.info('ERP-Lite auto-post skipped', {
      feature: 'erp-lite',
      action: 'b6-dispatch-skip',
      event: eventLabel,
      txn_event_code: dispatchResult.txn_event_code,
      skip_reason: dispatchResult.skip_reason,
    });
    return;
  }

  if (dispatchResult.execute_result?.success !== true) {
    logger.warn('ERP-Lite auto-post failed (NON_BLOCKING — operational transaction proceeds)', {
      feature: 'erp-lite',
      action: 'b6-dispatch-failed',
      event: eventLabel,
      txn_event_code: dispatchResult.txn_event_code,
      error: dispatchResult.execute_result?.error_message ?? 'unknown',
    });
  }
}

/**
 * B6 — wraps a single dispatch call in try/catch so an UNGOVERNED exception
 * from the ERP-Lite layer itself (a bug in the engine, a DB hiccup — not a
 * governed posting failure, which the dispatcher already reports via its
 * returned `status`/`execute_result` and never throws for) can never
 * propagate into the caller's already-committing business transaction.
 * `logAutoPostOutcome` alone is not enough: it only runs if `dispatch()`
 * resolves. This is the belt to its suspenders — every B6 call site uses
 * this wrapper instead of calling a dispatcher + `logAutoPostOutcome`
 * directly, so the NON_BLOCKING guarantee (D007: "ERP posting failure must
 * not delete or roll back the operational voucher") holds even against a
 * failure mode the dispatcher itself didn't anticipate.
 *
 * @param eventLabel short identifier for the log line (e.g. 'payment_received')
 * @param dispatch thunk that performs the actual dispatch call
 */
export async function safeDispatchAutoPost(
  eventLabel: string,
  dispatch: () => Promise<ErpLiteAutoPostDispatchResult>,
): Promise<void> {
  try {
    const result = await dispatch();
    logAutoPostOutcome(eventLabel, result);
  } catch (error) {
    logger.error(
      `ERP-Lite auto-post threw unexpectedly (NON_BLOCKING — operational transaction proceeds): ${eventLabel}`,
      error instanceof Error ? error : undefined,
      { feature: 'erp-lite', action: 'b6-dispatch-threw', event: eventLabel },
    );
  }
}
