/**
 * Notification Hub — outbox reconciliation (production implementation plan
 * section 8.2 step 6 / invariant 4.1.6).
 *
 * The outbox processor (app/api/notifications/process-outbox/route.ts) never
 * blindly retries a provider call once it has started: a thrown transport
 * error is held as `reconcile_state = 'ACCEPTANCE_UNCERTAIN'` (migration
 * 0556), and a worker that dies mid-flight leaves a PROCESSING row with an
 * expired lease and no recorded outcome at all. Neither case is resolved by
 * anything else in the system — this module is that missing resolution step.
 *
 * For each stuck row this tenant-scoped pass:
 *   1. Looks for a captured provider message identity (`provider_message_id`,
 *      persisted by the WhatsApp Twilio adapter — see adapters/whatsapp.ts).
 *   2. When one exists AND the tenant's currently active provider for that
 *      channel supports an authoritative status lookup (today: TWILIO_WHATSAPP
 *      via the Twilio Messages API), queries the provider and finalizes the
 *      row from that verified answer — never from a guess.
 *   3. When no lookup is possible (no captured SID, or the provider/channel
 *      has no implemented lookup), the row is dead-lettered to
 *      FAILED_PERMANENT with an explicit operator-review error message. It is
 *      never silently resent and never silently dropped — the existing
 *      delivery-log ledger and outbox error_message make it visible to
 *      operators exactly like any other permanent failure.
 *
 * A Twilio 404 (`code 20404`) on the status lookup is strong proof the
 * message was never created — invariant 4.1.6 ("retry only proven
 * unsubmitted/retryable attempts") allows that specific case to re-enter the
 * normal FAILED_TEMPORARY retry path instead of dead-lettering.
 */

import { randomUUID } from 'node:crypto'
import twilio from 'twilio'
import { createAdminSupabaseClient } from '@lib/supabase/server'
import { logger } from '@lib/utils/logger'
import { OUTBOX_STATUS } from '@lib/notifications/types'
import { notificationSettingsService } from '@lib/notifications/settings-service'
import { isTwilioMessagePermanentFailure } from '@lib/notifications/adapters/whatsapp'

const RECONCILE_BATCH_SIZE = 50
/** Extra buffer beyond the outbox lease (migration 0556: 5 minutes) before an expired PROCESSING claim is treated as crashed rather than merely slow. */
const LEASE_GRACE_MILLISECONDS = 2 * 60_000
/** Mirrors process-outbox/route.ts's retry backoff so a re-queued attempt follows the same policy. */
const RETRY_DELAY_MINUTES = [5, 15, 60, 240, 720] as const

type ReconcileRow = {
  id: string
  tenant_org_id: string
  channel_code: string
  provider_message_id: string | null
  retry_count: number
  max_retries: number
  reconcile_state: string | null
  claim_token: string | null
}

/** Terminal classification applied to one reconciled outbox row. */
export type ReconciliationOutcome =
  | 'RESOLVED_SENT'
  | 'RESOLVED_FAILED_RETRYABLE'
  | 'RESOLVED_FAILED_PERMANENT'
  | 'DEAD_LETTERED'
  | 'DEFERRED'
  | 'SKIPPED_STALE_CLAIM'

/** Per-row reconciliation outcome, returned for logging and tests. */
export interface ReconciliationRowResult {
  outboxId: string
  tenantOrgId: string
  outcome: ReconciliationOutcome
  detail?: string
}

/** Aggregate result of one tenant-scoped reconciliation pass. */
export interface ReconciliationSummary {
  tenantOrgId: string
  inspected: number
  results: ReconciliationRowResult[]
}

function nextRetryAt(retryCount: number): string {
  const delayMinutes = RETRY_DELAY_MINUTES[Math.min(retryCount, RETRY_DELAY_MINUTES.length - 1)]
  return new Date(Date.now() + delayMinutes * 60_000).toISOString()
}

/**
 * Conditionally finalizes a stuck row exactly like the live processor does
 * (same claim-token guard), then appends an immutable attempt record.
 * @param supabase Privileged internal client.
 * @param row Stuck delivery row read earlier in this reconciliation pass.
 * @param finalStatus Terminal (or retryable) outbox status to apply.
 * @param errorMessage Diagnostic recorded for audit and operator review.
 * @param providerMessageId Provider message identity, when known.
 * @returns The new attempt's id when finalization succeeded, otherwise null.
 */
async function finalizeStuckRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: ReconcileRow,
  finalStatus: string,
  errorMessage: string,
  providerMessageId?: string,
): Promise<string | null> {
  const finalizedAt = new Date().toISOString()
  const isRetry = finalStatus === OUTBOX_STATUS.FAILED_TEMPORARY

  const updatePayload: Record<string, unknown> = {
    status: finalStatus,
    error_message: errorMessage,
    skip_reason: finalStatus === OUTBOX_STATUS.SKIPPED ? errorMessage : null,
    finalized_at: isRetry ? null : finalizedAt,
    claim_token: null,
    claimed_by: null,
    lease_expires_at: null,
    reconcile_state: null,
    next_retry_at: isRetry ? nextRetryAt(row.retry_count + 1) : null,
    updated_at: finalizedAt,
    ...(finalStatus === OUTBOX_STATUS.SENT ? { sent_at: finalizedAt } : {}),
    ...(isRetry ? { retry_count: row.retry_count + 1 } : {}),
    ...(providerMessageId ? { provider_message_id: providerMessageId } : {}),
  }

  // Guard on tenant + id + PROCESSING + the exact claim token we read, so reconciliation
  // can never override a row the live processor (or a concurrent reconciliation run) has
  // since claimed, finalized, or moved out of PROCESSING.
  let query = supabase
    .from('org_ntf_outbox_dtl')
    .update(updatePayload)
    .eq('id', row.id)
    .eq('tenant_org_id', row.tenant_org_id)
    .eq('status', OUTBOX_STATUS.PROCESSING);
  query = row.claim_token ? query.eq('claim_token', row.claim_token) : query.is('claim_token', null);

  const { data, error } = await query.select('id').maybeSingle()

  if (error) {
    logger.error('reconcile-outbox: failed to finalize stuck row', new Error(error.message), {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
    return null
  }
  if (!data) {
    logger.warn('reconcile-outbox: skipped stale claim during reconciliation', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
    return null
  }

  const attemptId = randomUUID()
  const acceptanceState = finalStatus === OUTBOX_STATUS.SENT
    ? 'ACCEPTED'
    : (finalStatus === OUTBOX_STATUS.FAILED_PERMANENT || finalStatus === OUTBOX_STATUS.FAILED_TEMPORARY)
      ? 'REJECTED'
      : 'UNCERTAIN'

  const { error: logError } = await supabase.from('org_ntf_delivery_log_dtl').insert({
    tenant_org_id: row.tenant_org_id,
    outbox_id: row.id,
    attempt_id: attemptId,
    attempt_number: row.retry_count + 1,
    status: finalStatus,
    provider_message_id: providerMessageId ?? row.provider_message_id ?? null,
    acceptance_state: acceptanceState,
    retryable: isRetry,
    finished_at: finalizedAt,
    error_message: errorMessage,
    logged_at: finalizedAt,
    rec_status: 1,
  })

  if (logError) {
    logger.error('reconcile-outbox: failed to append reconciliation attempt log', new Error(logError.message), {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
    })
    return null
  }

  return attemptId
}

/**
 * Persists a verified provider status fact as an immutable receipt, scoped to
 * the attempt this reconciliation pass just logged. Idempotent: a repeated
 * identical observation hits the existing (tenant, provider_code,
 * provider_event_key) uniqueness constraint and is treated as already-recorded.
 * @param supabase Privileged internal client.
 * @param tenantOrgId Tenant owning the delivery and attempt being correlated.
 * @param outboxId Delivery identity this receipt belongs to.
 * @param attemptId Attempt identity this reconciliation pass just logged.
 * @param providerCode Provider catalog code that produced the verified status.
 * @param providerMessageId Provider message identity that was looked up.
 * @param providerStatusRaw Original provider status token, kept for diagnostics.
 * @param receiptKind Normalized receipt fact.
 */
async function recordVerifiedReceipt(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  tenantOrgId: string,
  outboxId: string,
  attemptId: string,
  providerCode: string,
  providerMessageId: string,
  providerStatusRaw: string,
  receiptKind: 'ACCEPTED' | 'DELIVERED' | 'READ' | 'FAILED' | 'UNDELIVERABLE',
): Promise<void> {
  const verifiedAt = new Date().toISOString()
  const { error } = await supabase.from('org_ntf_receipts_tr').insert({
    tenant_org_id: tenantOrgId,
    delivery_id: outboxId,
    attempt_id: attemptId,
    provider_code: providerCode,
    provider_event_key: `reconcile:${providerMessageId}:${providerStatusRaw}`,
    provider_message_id: providerMessageId,
    receipt_kind: receiptKind,
    provider_status_raw: providerStatusRaw,
    verified_at: verifiedAt,
    redacted_payload: { source: 'reconciliation', status: providerStatusRaw },
    rec_status: 1,
  })

  if (error && error.code !== '23505') {
    logger.error('reconcile-outbox: failed to record verified receipt', new Error(error.message), {
      outboxId, tenantOrgId, feature: 'notifications',
    })
  }
}

/**
 * Twilio's own status vocabulary for the Messages resource, normalized to one
 * outcome kind. Flat (non-discriminated-union) shape: web-admin's
 * `strict:false` tsconfig does not narrow discriminated unions reliably (see
 * project memory "ActionResult must be a flat type, not a discriminated
 * union"), so fields that only apply to some kinds stay optional instead.
 */
type TwilioLookupOutcome = {
  kind: 'ACCEPTED_IN_FLIGHT' | 'DELIVERED' | 'FAILED' | 'NOT_FOUND' | 'LOOKUP_ERROR';
  status?: string;
  permanent?: boolean;
  errorCode?: number;
  detail?: string;
}

/**
 * Queries Twilio for the authoritative current status of one message SID.
 * @param accountSid Tenant/platform Twilio account SID used for the original send.
 * @param authToken Matching Twilio auth token.
 * @param sid Provider message identity captured at send time.
 */
async function fetchTwilioMessageStatus(accountSid: string, authToken: string, sid: string): Promise<TwilioLookupOutcome> {
  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages(sid).fetch()

    if (message.status === 'failed' || message.status === 'undelivered' || message.status === 'canceled') {
      return {
        kind: 'FAILED',
        status: message.status,
        permanent: isTwilioMessagePermanentFailure(message.errorCode ?? undefined) || message.status === 'canceled',
        errorCode: message.errorCode ?? undefined,
      }
    }
    if (message.status === 'delivered' || message.status === 'read') {
      return { kind: 'DELIVERED', status: message.status }
    }
    // queued, sending, sent, accepted, scheduled, receiving, received: provider has the message in flight or accepted.
    return { kind: 'ACCEPTED_IN_FLIGHT', status: message.status }
  } catch (err) {
    const error = err as { status?: number; code?: number; message?: string }
    if (error.status === 404 || error.code === 20404) {
      return { kind: 'NOT_FOUND' }
    }
    return { kind: 'LOOKUP_ERROR', detail: error.message ?? 'Unknown Twilio lookup error' }
  }
}

/**
 * Resolves one stuck WhatsApp/Twilio row using an authoritative provider lookup.
 * @param supabase Privileged internal client.
 * @param row Stuck delivery row read earlier in this reconciliation pass.
 */
async function reconcileTwilioWhatsAppRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: ReconcileRow,
): Promise<ReconciliationRowResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken || !row.provider_message_id) {
    return deadLetterRow(supabase, row, 'Twilio credentials or provider_message_id unavailable for reconciliation lookup');
  }

  const lookup = await fetchTwilioMessageStatus(accountSid, authToken, row.provider_message_id)

  if (lookup.kind === 'LOOKUP_ERROR') {
    // Cannot conclude anything right now; leave the row exactly as-is for the next scheduled pass.
    logger.warn('reconcile-outbox: Twilio lookup failed, deferring', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, detail: lookup.detail, feature: 'notifications',
    })
    return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'DEFERRED', detail: lookup.detail }
  }

  if (lookup.kind === 'NOT_FOUND') {
    // Strong proof Twilio never created this message — safe to treat as proven-unsubmitted (invariant 4.1.6).
    const retryable = row.retry_count < row.max_retries
    const finalStatus = retryable ? OUTBOX_STATUS.FAILED_TEMPORARY : OUTBOX_STATUS.FAILED_PERMANENT
    const message = 'Reconciliation: Twilio has no record of this message SID (proven not submitted)'
    const attemptId = await finalizeStuckRow(supabase, row, finalStatus, message)
    if (!attemptId) return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'SKIPPED_STALE_CLAIM' };
    return {
      outboxId: row.id, tenantOrgId: row.tenant_org_id,
      outcome: retryable ? 'RESOLVED_FAILED_RETRYABLE' : 'RESOLVED_FAILED_PERMANENT',
      detail: message,
    };
  }

  if (lookup.kind === 'ACCEPTED_IN_FLIGHT' || lookup.kind === 'DELIVERED') {
    const message = `Reconciliation: Twilio confirmed acceptance (status=${lookup.status})`
    const attemptId = await finalizeStuckRow(supabase, row, OUTBOX_STATUS.SENT, message, row.provider_message_id)
    if (!attemptId) return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'SKIPPED_STALE_CLAIM' };
    await recordVerifiedReceipt(
      supabase, row.tenant_org_id, row.id, attemptId, 'TWILIO_WHATSAPP', row.provider_message_id, lookup.status,
      lookup.kind === 'DELIVERED' ? 'DELIVERED' : 'ACCEPTED',
    );
    return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'RESOLVED_SENT', detail: message };
  }

  // lookup.kind === 'FAILED'
  const retryable = !lookup.permanent && row.retry_count < row.max_retries
  const finalStatus = retryable ? OUTBOX_STATUS.FAILED_TEMPORARY : OUTBOX_STATUS.FAILED_PERMANENT
  const message = `Reconciliation: Twilio confirmed non-delivery (status=${lookup.status}${lookup.errorCode ? `, code=${lookup.errorCode}` : ''})`
  const attemptId = await finalizeStuckRow(supabase, row, finalStatus, message, row.provider_message_id)
  if (!attemptId) return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'SKIPPED_STALE_CLAIM' };
  await recordVerifiedReceipt(
    supabase, row.tenant_org_id, row.id, attemptId, 'TWILIO_WHATSAPP', row.provider_message_id, lookup.status, 'FAILED',
  );
  return {
    outboxId: row.id, tenantOrgId: row.tenant_org_id,
    outcome: retryable ? 'RESOLVED_FAILED_RETRYABLE' : 'RESOLVED_FAILED_PERMANENT',
    detail: message,
  };
}

/**
 * Terminal operator-review outcome for a row this pass cannot authoritatively resolve.
 * Never silently retried and never silently dropped: it lands in the existing
 * FAILED_PERMANENT vocabulary with an explicit, searchable error message.
 * @param supabase Privileged internal client.
 * @param row Stuck delivery row read earlier in this reconciliation pass.
 * @param reason Human-readable explanation of why no authoritative resolution was possible.
 */
async function deadLetterRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: ReconcileRow,
  reason: string,
): Promise<ReconciliationRowResult> {
  const message = `RECONCILIATION_REQUIRED: ${reason}. No authoritative provider status is available; manual operator review is required before any resend.`
  logger.error('reconcile-outbox: dead-lettering unresolvable row', new Error(message), {
    outboxId: row.id, tenantOrgId: row.tenant_org_id, channel: row.channel_code, feature: 'notifications',
  })
  const attemptId = await finalizeStuckRow(supabase, row, OUTBOX_STATUS.FAILED_PERMANENT, message)
  if (!attemptId) return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'SKIPPED_STALE_CLAIM' };
  return { outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'DEAD_LETTERED', detail: message };
}

/**
 * Reconciles every stuck WHATSAPP outbox row for one tenant: rows explicitly
 * held as ACCEPTANCE_UNCERTAIN, plus PROCESSING rows whose claim lease expired
 * well beyond its normal bound (a crashed worker that recorded nothing).
 * Every query and write below filters tenant_org_id directly.
 * @param tenantOrgId Tenant whose outbox is being reconciled.
 */
export async function reconcileTenantOutbox(tenantOrgId: string): Promise<ReconciliationSummary> {
  const supabase = createAdminSupabaseClient()
  const now = new Date()
  const leaseStaleBefore = new Date(now.getTime() - LEASE_GRACE_MILLISECONDS).toISOString()

  const selectColumns = 'id, tenant_org_id, channel_code, provider_message_id, retry_count, max_retries, reconcile_state, claim_token';

  const { data: uncertain, error: uncertainError } = await supabase
    .from('org_ntf_outbox_dtl')
    .select(selectColumns)
    .eq('tenant_org_id', tenantOrgId)
    .eq('reconcile_state', 'ACCEPTANCE_UNCERTAIN')
    .limit(RECONCILE_BATCH_SIZE)

  if (uncertainError) {
    logger.error('reconcile-outbox: failed to fetch ACCEPTANCE_UNCERTAIN rows', new Error(uncertainError.message), {
      tenantOrgId, feature: 'notifications',
    })
  }

  const { data: crashed, error: crashedError } = await supabase
    .from('org_ntf_outbox_dtl')
    .select(selectColumns)
    .eq('tenant_org_id', tenantOrgId)
    .eq('status', OUTBOX_STATUS.PROCESSING)
    .is('reconcile_state', null)
    .not('claim_token', 'is', null)
    .lt('lease_expires_at', leaseStaleBefore)
    .limit(RECONCILE_BATCH_SIZE)

  if (crashedError) {
    logger.error('reconcile-outbox: failed to fetch crashed-lease rows', new Error(crashedError.message), {
      tenantOrgId, feature: 'notifications',
    })
  }

  const rows = [...(uncertain ?? []), ...(crashed ?? [])] as ReconcileRow[]
  const results: ReconciliationRowResult[] = []

  for (const row of rows) {
    try {
      if (row.channel_code !== 'WHATSAPP') {
        // No authoritative lookup is implemented for EMAIL/SMS/PUSH yet (see STATUS.md).
        results.push(await deadLetterRow(supabase, row, `No reconciliation lookup is implemented for channel ${row.channel_code}`));
        continue;
      }

      const provider = await notificationSettingsService.getActiveProvider(row.tenant_org_id, 'WHATSAPP')
      if (provider?.providerCode === 'TWILIO_WHATSAPP' && row.provider_message_id) {
        results.push(await reconcileTwilioWhatsAppRow(supabase, row));
      } else if (!row.provider_message_id) {
        results.push(await deadLetterRow(
          supabase, row,
          'No provider message SID was captured for this attempt (the provider call threw before returning one)',
        ));
      } else {
        results.push(await deadLetterRow(
          supabase, row,
          `No reconciliation lookup is implemented for provider ${provider?.providerCode ?? 'UNKNOWN'}`,
        ));
      }
    } catch (error) {
      logger.error('reconcile-outbox: unexpected error reconciling row', error instanceof Error ? error : new Error(String(error)), {
        outboxId: row.id, tenantOrgId: row.tenant_org_id, feature: 'notifications',
      })
      results.push({ outboxId: row.id, tenantOrgId: row.tenant_org_id, outcome: 'DEFERRED', detail: 'Unexpected reconciliation error; left for next pass' });
    }
  }

  return { tenantOrgId, inspected: rows.length, results };
}
