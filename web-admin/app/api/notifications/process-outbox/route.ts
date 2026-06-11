/**
 * POST /api/notifications/process-outbox
 * Internal-only outbox processor. Called by pg_cron every minute via pg_net.
 * Authorization: Bearer {NOTIFICATIONS_OUTBOX_SECRET}
 *
 * Channels: EMAIL, PUSH, SMS, WHATSAPP (IN_APP is written directly to inbox, not via outbox).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { OUTBOX_STATUS } from '@lib/notifications/types';
import { deliverEmailOutbox    } from '@lib/notifications/adapters/email';
import { deliverSmsOutbox      } from '@lib/notifications/adapters/sms';
import { deliverWhatsAppOutbox } from '@lib/notifications/adapters/whatsapp';
import { deliverPushOutbox     } from '@lib/notifications/adapters/push';

const BATCH_SIZE       = 50;
const RETRY_BATCH_SIZE = 25;
const MAX_RETRY_DELAY_MINUTES = [5, 15, 60, 240, 720] as const; // backoff per retry_count

function nextRetryAt(retryCount: number): string {
  const delayMinutes = MAX_RETRY_DELAY_MINUTES[Math.min(retryCount, MAX_RETRY_DELAY_MINUTES.length - 1)];
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFICATIONS_OUTBOX_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${secret}`;
}

// Flat union of all fields fetched from org_ntf_outbox_dtl.
// Each adapter only uses the subset of fields relevant to its channel.
type OutboxRow = {
  id:                 string
  tenant_org_id:      string
  channel_code:       string
  recipient_address:  string | null
  recipient_user_id:  string | null
  rendered_subject:   string | null
  rendered_body:      string
  event_code:         string | null
  retry_count:        number
  max_retries:        number
  status:             string
};


async function markProcessing(supabase: ReturnType<typeof createAdminSupabaseClient>, id: string): Promise<void> {
  await supabase
    .from('org_ntf_outbox_dtl')
    .update({ status: OUTBOX_STATUS.PROCESSING, updated_at: new Date().toISOString() })
    .eq('id', id);
}

async function writeDeliveryLog(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  tenantOrgId: string,
  outboxId: string,
  attemptNumber: number,
  status: string,
  errorMessage?: string
): Promise<void> {
  await supabase.from('org_ntf_delivery_log_dtl').insert({
    tenant_org_id: tenantOrgId,
    outbox_id:     outboxId,
    attempt_number: attemptNumber,
    status,
    error_message: errorMessage ?? null,
    logged_at:     new Date().toISOString(),
    rec_status:    1,
  });
}

async function processRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: OutboxRow
): Promise<void> {
  await markProcessing(supabase, row.id);
  const startMs = Date.now();

  let finalStatus: string;
  let errorMessage: string | undefined;

  let result: { success: boolean; errorMessage?: string; permanent?: boolean } | null = null;

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
      // Push fans out to multiple subscriptions; treat as success when at least one sent
      result = {
        success:      pushResult.success,
        errorMessage: pushResult.errorMessage ?? (pushResult.skippedCount > 0 && pushResult.sentCount === 0
          ? `No subscriptions reached (skipped: ${pushResult.skippedCount})`
          : undefined),
        permanent: false,
      };
      break;
    }
    case 'IN_APP':
      // IN_APP is written directly to org_ntf_inbox_mst by the orchestrator; skip here
      finalStatus  = OUTBOX_STATUS.SKIPPED;
      errorMessage = 'IN_APP channel is handled by orchestrator, not outbox processor';
      break;
    default:
      finalStatus  = OUTBOX_STATUS.SKIPPED;
      errorMessage = `Unknown channel: ${row.channel_code}`;
  }

  if (result !== null) {
    if (result.success) {
      finalStatus = OUTBOX_STATUS.SENT;
    } else if (result.permanent || row.retry_count >= row.max_retries) {
      finalStatus  = OUTBOX_STATUS.FAILED_PERMANENT;
      errorMessage = result.errorMessage;
    } else {
      finalStatus  = OUTBOX_STATUS.FAILED_TEMPORARY;
      errorMessage = result.errorMessage;
    }
  }

  // Update outbox row
  const updatePayload: Record<string, unknown> = {
    status:      finalStatus,
    updated_at:  new Date().toISOString(),
    error_message: errorMessage ?? null,
  };
  if (finalStatus === OUTBOX_STATUS.SENT) {
    updatePayload.sent_at = new Date().toISOString();
  }
  if (finalStatus === OUTBOX_STATUS.FAILED_TEMPORARY) {
    updatePayload.retry_count    = row.retry_count + 1;
    updatePayload.next_retry_at  = nextRetryAt(row.retry_count + 1);
  }
  await supabase.from('org_ntf_outbox_dtl').update(updatePayload).eq('id', row.id);

  // Write delivery log
  await writeDeliveryLog(
    supabase,
    row.tenant_org_id,
    row.id,
    row.retry_count + 1,
    finalStatus,
    errorMessage
  );

  logger.info('process-outbox: row processed', {
    outboxId:    row.id,
    channel:     row.channel_code,
    finalStatus,
    durationMs:  Date.now() - startMs,
    feature:     'notifications',
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  // Fetch QUEUED rows due for dispatch
  const { data: queued, error: queuedErr } = await supabase
    .from('org_ntf_outbox_dtl')
    .select('id, tenant_org_id, channel_code, recipient_address, recipient_user_id, rendered_subject, rendered_body, event_code, retry_count, max_retries, status')
    .eq('status', OUTBOX_STATUS.QUEUED)
    .lte('scheduled_at', now)
    .limit(BATCH_SIZE);

  if (queuedErr) {
    logger.error('process-outbox: failed to fetch QUEUED rows', new Error(queuedErr.message), { feature: 'notifications' });
    return NextResponse.json({ error: 'DB error fetching queued rows' }, { status: 500 });
  }

  // Fetch FAILED_TEMPORARY rows eligible for retry
  const { data: retryable, error: retryErr } = await supabase
    .from('org_ntf_outbox_dtl')
    .select('id, tenant_org_id, channel_code, recipient_address, recipient_user_id, rendered_subject, rendered_body, event_code, retry_count, max_retries, status')
    .eq('status', OUTBOX_STATUS.FAILED_TEMPORARY)
    .lte('next_retry_at', now)
    .limit(RETRY_BATCH_SIZE);

  if (retryErr) {
    logger.error('process-outbox: failed to fetch FAILED_TEMPORARY rows', new Error(retryErr.message), { feature: 'notifications' });
  }

  const rows = [...(queued ?? []), ...(retryable ?? [])] as OutboxRow[];

  // Process all rows (sequential to avoid hammering provider)
  let processed = 0;
  let errors     = 0;
  for (const row of rows) {
    try {
      await processRow(supabase, row);
      processed++;
    } catch (err) {
      errors++;
      logger.error('process-outbox: unhandled error for row', err instanceof Error ? err : new Error(String(err)), {
        outboxId: row.id,
        feature:  'notifications',
      });
      // Mark as FAILED_TEMPORARY so it retries
      await supabase
        .from('org_ntf_outbox_dtl')
        .update({ status: OUTBOX_STATUS.FAILED_TEMPORARY, retry_count: (row.retry_count ?? 0) + 1, next_retry_at: nextRetryAt((row.retry_count ?? 0) + 1), updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  return NextResponse.json({ success: true, processed, errors, total: rows.length });
}
