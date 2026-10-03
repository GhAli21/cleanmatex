/**
 * POST /api/notifications/process-outbox
 * Internal-only, claim-aware outbox processor called by pg_cron via pg_net.
 * Authorization: Bearer {NOTIFICATIONS_OUTBOX_SECRET}
 *
 * Channels: EMAIL, PUSH, SMS, WHATSAPP (IN_APP is written directly to inbox).
 */

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { OUTBOX_STATUS } from '@lib/notifications/types';
import { deliverEmailOutbox } from '@lib/notifications/adapters/email';
import { deliverSmsOutbox } from '@lib/notifications/adapters/sms';
import { deliverWhatsAppOutbox } from '@lib/notifications/adapters/whatsapp';
import { deliverPushOutbox } from '@lib/notifications/adapters/push';
import { enqueueEmailFallbackFromWhatsApp } from '@lib/notifications/adapters/outbox';

const BATCH_SIZE = 50;
const RETRY_BATCH_SIZE = 25;
const CLAIM_LEASE_MILLISECONDS = 5 * 60_000; // Five minutes bounds an orphaned worker without interrupting normal provider requests.
const MAX_RETRY_DELAY_MINUTES = [5, 15, 60, 240, 720] as const;

/**
 * Flat union of the fields read from org_ntf_outbox_dtl.
 * Adapters receive only immutable delivery inputs; claim fields stay in the worker.
 */
type OutboxRow = {
  id: string;
  tenant_org_id: string;
  channel_code: string;
  recipient_address: string | null;
  recipient_user_id: string | null;
  rendered_subject: string | null;
  rendered_body: string;
  event_code: string | null;
  retry_count: number;
  max_retries: number;
  status: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

/** Claim data required to make every result write conditional on worker ownership. */
type OutboxClaim = {
  token: string;
  workerId: string;
};

/** Delivery adapters share this result contract while retaining legacy status values. */
type DeliveryResult = {
  success: boolean;
  errorMessage?: string;
  permanent?: boolean;
  skipped?: boolean;
};

/**
 * Calculates the next retry time for a provider outcome known to be retryable.
 * @param retryCount Number of completed failed attempts.
 * @returns ISO-8601 UTC timestamp for the next retry.
 */
function nextRetryAt(retryCount: number): string {
  const delayMinutes = MAX_RETRY_DELAY_MINUTES[Math.min(retryCount, MAX_RETRY_DELAY_MINUTES.length - 1)];
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

/**
 * Produces a non-secret worker identity that helps operators diagnose ownership.
 * @returns Stable configured worker ID or a per-run ID.
 */
function createWorkerId(): string {
  const configuredWorkerId = process.env.NOTIFICATIONS_OUTBOX_WORKER_ID?.trim();
  return configuredWorkerId && configuredWorkerId.length > 0
    ? configuredWorkerId
    : `notifications-outbox:${randomUUID()}`;
}

/**
 * Verifies the internal scheduler bearer secret without exposing it to logs.
 * @param request Internal pg_net request.
 * @returns Whether the request may process the outbox.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFICATIONS_OUTBOX_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${secret}`;
}

/**
 * Claims a currently unowned, non-reconciled row before any provider interaction.
 * @param supabase Privileged internal client.
 * @param row Candidate delivery row with an explicit tenant owner.
 * @param workerId Non-secret identity for this scheduler invocation.
 * @returns Claim token only when the conditional write acquired the row.
 */
async function claimRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: OutboxRow,
  workerId: string,
): Promise<OutboxClaim | null> {
  const token = randomUUID();
  const claimedAt = new Date();
  const leaseExpiresAt = new Date(claimedAt.getTime() + CLAIM_LEASE_MILLISECONDS).toISOString();

  const { data, error } = await supabase
    .from('org_ntf_outbox_dtl')
    .update({
      status: OUTBOX_STATUS.PROCESSING,
      claim_token: token,
      claimed_by: workerId,
      lease_expires_at: leaseExpiresAt,
      updated_at: claimedAt.toISOString(),
    })
    .eq('id', row.id)
    .eq('tenant_org_id', row.tenant_org_id)
    .eq('status', row.status)
    .eq('retry_count', row.retry_count)
    .is('claim_token', null)
    .is('reconcile_state', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('process-outbox: failed to claim row', new Error(error.message), {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return null;
  }

  return data ? { token, workerId } : null;
}

/**
 * Appends the immutable attempt record after a claim-aware outcome is stored.
 * @param supabase Privileged internal client.
 * @param tenantOrgId Explicit tenant key required by the delivery-log RLS boundary.
 * @param outboxId Delivery identity belonging to tenantOrgId.
 * @param attemptNumber Monotonic attempt number derived from the outbox row.
 * @param status Outcome recorded for audit and support.
 * @param errorMessage Safe provider or reconciliation diagnostic, if any.
 */
async function writeDeliveryLog(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  tenantOrgId: string,
  outboxId: string,
  attemptNumber: number,
  status: string,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase
    .from('org_ntf_delivery_log_dtl')
    .insert({
      tenant_org_id: tenantOrgId,
      outbox_id: outboxId,
      attempt_number: attemptNumber,
      status,
      error_message: errorMessage ?? null,
      logged_at: new Date().toISOString(),
      rec_status: 1,
    });

  if (error) {
    logger.error('process-outbox: failed to append delivery log', new Error(error.message), {
      outboxId,
      tenantOrgId,
      feature: 'notifications',
    });
  }
}

/**
 * Persists a provider-submission ambiguity while the original worker still owns the row.
 * The row deliberately remains PROCESSING and is excluded from automatic retry selection.
 * @param supabase Privileged internal client.
 * @param row Delivery identity and explicit tenant key.
 * @param claim Active claim that must match to change the row.
 * @param errorMessage Diagnostic from a dispatch call with uncertain acceptance.
 * @returns Whether this worker retained the ambiguity for manual/provider reconciliation.
 */
async function markAcceptanceUncertain(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: OutboxRow,
  claim: OutboxClaim,
  errorMessage: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('org_ntf_outbox_dtl')
    .update({
      reconcile_state: 'ACCEPTANCE_UNCERTAIN',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('tenant_org_id', row.tenant_org_id)
    .eq('status', OUTBOX_STATUS.PROCESSING)
    .eq('claim_token', claim.token)
    .is('reconcile_state', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('process-outbox: failed to preserve uncertain acceptance', new Error(error.message), {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return false;
  }

  if (!data) {
    logger.warn('process-outbox: uncertain acceptance was not persisted because claim ownership changed', {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return false;
  }

  await writeDeliveryLog(
    supabase,
    row.tenant_org_id,
    row.id,
    row.retry_count + 1,
    'ACCEPTANCE_UNCERTAIN',
    errorMessage,
  );
  return true;
}

/**
 * Finalizes only the exact PROCESSING claim that performed the provider call.
 * @param supabase Privileged internal client.
 * @param row Delivery identity and explicit tenant key.
 * @param claim Active claim that must match to write an outcome.
 * @param finalStatus Existing outbox status selected from a resolved provider result.
 * @param errorMessage Safe provider diagnostic, if any.
 * @returns Whether the conditional finalization succeeded.
 */
async function finalizeClaim(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: OutboxRow,
  claim: OutboxClaim,
  finalStatus: string,
  errorMessage?: string,
): Promise<boolean> {
  const finalizedAt = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: finalStatus,
    error_message: errorMessage ?? null,
    skip_reason: finalStatus === OUTBOX_STATUS.SKIPPED
      ? errorMessage ?? 'Delivery skipped'
      : null,
    finalized_at: finalizedAt,
    claim_token: null,
    claimed_by: null,
    lease_expires_at: null,
    reconcile_state: null,
    next_retry_at: null,
    updated_at: finalizedAt,
  };

  if (finalStatus === OUTBOX_STATUS.SENT) {
    updatePayload.sent_at = finalizedAt;
  }
  if (finalStatus === OUTBOX_STATUS.FAILED_TEMPORARY) {
    updatePayload.retry_count = row.retry_count + 1;
    updatePayload.next_retry_at = nextRetryAt(row.retry_count + 1);
  }

  const { data, error } = await supabase
    .from('org_ntf_outbox_dtl')
    .update(updatePayload)
    .eq('id', row.id)
    .eq('tenant_org_id', row.tenant_org_id)
    .eq('status', OUTBOX_STATUS.PROCESSING)
    .eq('claim_token', claim.token)
    .is('reconcile_state', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('process-outbox: failed to finalize claimed row', new Error(error.message), {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return false;
  }

  if (!data) {
    logger.warn('process-outbox: skipped stale claim finalization', {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return false;
  }

  await writeDeliveryLog(
    supabase,
    row.tenant_org_id,
    row.id,
    row.retry_count + 1,
    finalStatus,
    errorMessage,
  );
  return true;
}

/**
 * Delivers one claimed row and records either a resolved outcome or explicit uncertainty.
 * @param supabase Privileged internal client.
 * @param row Candidate row read from the tenant-scoped queue.
 * @param workerId Scheduler identity used for durable claim ownership.
 * @returns True when a row was safely finalized or held for reconciliation.
 */
async function processRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: OutboxRow,
  workerId: string,
): Promise<boolean> {
  const claim = await claimRow(supabase, row, workerId);
  if (!claim) return false;

  const startMs = Date.now();
  let result: DeliveryResult | null = null;
  let finalStatus: string;
  let errorMessage: string | undefined;

  try {
    switch (row.channel_code) {
      case 'EMAIL':
        result = await deliverEmailOutbox(row);
        break;
      case 'SMS':
        result = await deliverSmsOutbox(row);
        break;
      case 'WHATSAPP':
        result = await deliverWhatsAppOutbox(row);
        break;
      case 'PUSH': {
        const pushResult = await deliverPushOutbox(row);
        result = {
          success: pushResult.success,
          errorMessage: pushResult.errorMessage ?? (
            pushResult.skippedCount > 0 && pushResult.sentCount === 0
              ? `No subscriptions reached (skipped: ${pushResult.skippedCount})`
              : undefined
          ),
          permanent: false,
        };
        break;
      }
      case 'IN_APP':
        finalStatus = OUTBOX_STATUS.SKIPPED;
        errorMessage = 'IN_APP channel is handled by orchestrator, not outbox processor';
        break;
      default:
        finalStatus = OUTBOX_STATUS.SKIPPED;
        errorMessage = `Unknown channel: ${row.channel_code}`;
    }
  } catch (error) {
    // Once a provider call begins, a timeout or transport exception cannot prove that it was not accepted.
    const diagnostic = error instanceof Error ? error.message : String(error);
    const preserved = await markAcceptanceUncertain(supabase, row, claim, diagnostic);
    logger.error('process-outbox: provider acceptance is uncertain', error instanceof Error ? error : new Error(diagnostic), {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      preserved,
      durationMs: Date.now() - startMs,
      feature: 'notifications',
    });
    return preserved;
  }

  if (result !== null) {
    if (result.skipped) {
      finalStatus = OUTBOX_STATUS.SKIPPED;
      errorMessage = result.errorMessage;
    } else if (result.success) {
      finalStatus = OUTBOX_STATUS.SENT;
    } else if (result.permanent || row.retry_count >= row.max_retries) {
      finalStatus = OUTBOX_STATUS.FAILED_PERMANENT;
      errorMessage = result.errorMessage;
    } else {
      finalStatus = OUTBOX_STATUS.FAILED_TEMPORARY;
      errorMessage = result.errorMessage;
    }
  }

  const finalized = await finalizeClaim(supabase, row, claim, finalStatus!, errorMessage);
  if (!finalized) return false;

  if (row.channel_code === 'WHATSAPP' && finalStatus === OUTBOX_STATUS.FAILED_PERMANENT) {
    await enqueueEmailFallbackFromWhatsApp(
      {
        tenant_org_id: row.tenant_org_id,
        recipient_user_id: row.recipient_user_id,
        event_code: row.event_code,
        source_entity_type: row.source_entity_type,
        source_entity_id: row.source_entity_id,
        rendered_subject: row.rendered_subject,
        rendered_body: row.rendered_body,
        metadata: row.metadata,
      },
      errorMessage ?? 'whatsapp_delivery_failed',
    );
  }

  logger.info('process-outbox: row processed', {
    outboxId: row.id,
    tenantOrgId: row.tenant_org_id,
    channel: row.channel_code,
    finalStatus,
    durationMs: Date.now() - startMs,
    feature: 'notifications',
  });
  return true;
}

/**
 * POST /api/notifications/process-outbox
 *
 * Processes due external notifications after internal scheduler authentication.
 * Every provider call is guarded by a durable tenant-scoped claim; ambiguous
 * acceptance is held for reconciliation instead of sent again automatically.
 *
 * @param request Internal POST carrying the server-side outbox secret.
 * @returns Batch totals or an authorization/discovery failure response.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const workerId = createWorkerId();

  // This authenticated scheduler can dispatch only for active tenant organizations.
  // org_tenants_mst identifies its tenant by id and has no tenant_org_id column.
  const { data: tenants, error: tenantError } = await supabase
    .from('org_tenants_mst')
    .select('id')
    .eq('is_active', true)
    .eq('rec_status', 1);

  if (tenantError) {
    logger.error('process-outbox: failed to resolve active tenants', new Error(tenantError.message), {
      feature: 'notifications',
    });
    return NextResponse.json({ error: 'DB error fetching active tenants' }, { status: 500 });
  }

  const tenantIds = (tenants ?? []).map((tenant) => tenant.id);
  if (tenantIds.length === 0) {
    return NextResponse.json({ success: true, processed: 0, errors: 0, total: 0 });
  }

  const outboxColumns = 'id, tenant_org_id, channel_code, recipient_address, recipient_user_id, rendered_subject, rendered_body, event_code, retry_count, max_retries, status, source_entity_type, source_entity_id, metadata';

  // Uncertain and still-owned rows are intentionally absent: only a reconciler may release them.
  const { data: queued, error: queuedError } = await supabase
    .from('org_ntf_outbox_dtl')
    .select(outboxColumns)
    .eq('status', OUTBOX_STATUS.QUEUED)
    .in('tenant_org_id', tenantIds)
    .is('claim_token', null)
    .is('reconcile_state', null)
    .lte('scheduled_at', now)
    .limit(BATCH_SIZE);

  if (queuedError) {
    logger.error('process-outbox: failed to fetch QUEUED rows', new Error(queuedError.message), {
      feature: 'notifications',
    });
    return NextResponse.json({ error: 'DB error fetching queued rows' }, { status: 500 });
  }

  const { data: retryable, error: retryError } = await supabase
    .from('org_ntf_outbox_dtl')
    .select(outboxColumns)
    .eq('status', OUTBOX_STATUS.FAILED_TEMPORARY)
    .in('tenant_org_id', tenantIds)
    .is('claim_token', null)
    .is('reconcile_state', null)
    .lte('next_retry_at', now)
    .limit(RETRY_BATCH_SIZE);

  if (retryError) {
    logger.error('process-outbox: failed to fetch FAILED_TEMPORARY rows', new Error(retryError.message), {
      feature: 'notifications',
    });
  }

  const rows = [...(queued ?? []), ...(retryable ?? [])] as OutboxRow[];
  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (await processRow(supabase, row, workerId)) processed++;
    } catch (error) {
      errors++;
      // Do not overwrite PROCESSING after an internal failure: it may have followed provider acceptance.
      logger.error('process-outbox: claimed row requires investigation after an internal failure', error instanceof Error ? error : new Error(String(error)), {
        outboxId: row.id,
        tenantOrgId: row.tenant_org_id,
        feature: 'notifications',
      });
    }
  }

  return NextResponse.json({ success: true, processed, errors, total: rows.length });
}
