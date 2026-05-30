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
