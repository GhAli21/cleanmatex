/**
 * Notification Hub — outbox adapter (Phase 2).
 * Writes one row per recipient to org_ntf_outbox_dtl for external channels.
 * Respects quiet-hours scheduling and marketing-consent skip.
 * WHATSAPP → EMAIL fallback when phone/provider unavailable (see config.ts).
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import type { Database } from '@/types/database';
import type { NotificationEvent } from '@lib/notifications/types';
import { NOTIFICATION_CHANNEL, OUTBOX_STATUS } from '@lib/notifications/types';
import { renderChannelTemplate } from '@lib/notifications/template-renderer';
import { resolveRecipientAddress } from '@lib/notifications/recipient-resolver';
import { isOutboxInlineDispatchEnabled, isWhatsappEmailFallbackEnabled } from '@lib/notifications/config';
import { deliverWhatsAppOutbox } from '@lib/notifications/adapters/whatsapp';

/**
 *
 */
export interface EnqueueOptions {
  scheduledAt?: Date;
  skipReason?: string;
  /** Suffix appended to idempotency key (e.g. WA email fallback). */
  idempotencySuffix?: string;
}

/**
 *
 */
export interface OutboxRowSnapshot {
  tenant_org_id:      string;
  recipient_user_id:  string | null;
  event_code:         string | null;
  source_entity_type: string | null;
  source_entity_id:   string | null;
  rendered_subject:   string | null;
  rendered_body:      string;
  metadata?:          Record<string, unknown> | null;
}

/**
 * Format: {tenant_org_id}:{event_code}:{channel}:{source_entity_id}:{recipient_user_id}[:suffix]
 */
function buildOutboxIdempotencyKey(
  tenantOrgId: string,
  eventCode: string,
  channelCode: string,
  sourceEntityId: string,
  recipientUserId: string,
  suffix?: string,
): string {
  const base = `${tenantOrgId}:${eventCode}:${channelCode}:${sourceEntityId}:${recipientUserId}`;
  return suffix ? `${base}:${suffix}` : base;
}

type OutboxInsert = Database['public']['Tables']['org_ntf_outbox_dtl']['Insert'];

async function insertOutboxRow(
  row: OutboxInsert,
  logContext: Record<string, unknown>,
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('org_ntf_outbox_dtl')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      logger.info('outbox adapter: duplicate idempotency key — skipping', {
        ...logContext,
        feature: 'notifications',
      });
      return null;
    }
    logger.error('outbox adapter: insert failed', new Error(error.message), {
      ...logContext,
      feature: 'notifications',
    });
    return null;
  }
  return data?.id ?? null;
}

/**
 * Send a just-queued WhatsApp row immediately so local/sandbox tests do not wait for pg_cron.
 * @param row Snapshot of the inserted outbox row
 */
async function dispatchWhatsAppInline(row: {
  id: string
  tenant_org_id: string
  recipient_address: string | null
  rendered_body: string
  rendered_subject: string | null
  event_code: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await supabase
    .from('org_ntf_outbox_dtl')
    .update({ status: OUTBOX_STATUS.PROCESSING, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('tenant_org_id', row.tenant_org_id);

  const result = await deliverWhatsAppOutbox({
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    recipient_address: row.recipient_address,
    rendered_body: row.rendered_body,
    rendered_subject: row.rendered_subject,
    event_code: row.event_code,
    retry_count: 0,
    metadata: row.metadata,
  });

  const finalStatus = result.success
    ? OUTBOX_STATUS.SENT
    : result.permanent
      ? OUTBOX_STATUS.FAILED_PERMANENT
      : OUTBOX_STATUS.FAILED_TEMPORARY;

  await supabase
    .from('org_ntf_outbox_dtl')
    .update({
      status: finalStatus,
      error_message: result.errorMessage ?? null,
      sent_at: result.success ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('tenant_org_id', row.tenant_org_id);

  logger.info('outbox adapter: inline WhatsApp dispatch', {
    outboxId: row.id,
    finalStatus,
    errorMessage: result.errorMessage,
    feature: 'notifications',
  });
}

/**
 * Enqueue EMAIL as fallback for a failed or skipped WHATSAPP delivery.
 * @returns true when a new EMAIL row was queued
 */
export async function enqueueEmailFallbackFromWhatsApp(
  snapshot: OutboxRowSnapshot,
  reason: string,
): Promise<boolean> {
  if (!(await isWhatsappEmailFallbackEnabled())) return false;
  if (!snapshot.recipient_user_id) return false;

  const emailAddress = await resolveRecipientAddress({
    tenantOrgId:      snapshot.tenant_org_id,
    recipientUserId:  snapshot.recipient_user_id,
    channelCode:      NOTIFICATION_CHANNEL.EMAIL,
    sourceEntityType: snapshot.source_entity_type,
    sourceEntityId:   snapshot.source_entity_id,
  });

  if (!emailAddress) {
    logger.info('outbox adapter: WA→EMAIL fallback skipped — no customer email', {
      tenantOrgId: snapshot.tenant_org_id,
      eventCode:   snapshot.event_code,
      reason,
      feature:     'notifications',
    });
    return false;
  }

  const eventCode = snapshot.event_code ?? 'unknown';
  const variables =
    (snapshot.metadata?.variables as Record<string, string> | undefined) ?? {};

  const rendered = await renderChannelTemplate(
    eventCode,
    NOTIFICATION_CHANNEL.EMAIL,
    variables,
  );

  const sourceEntityId = snapshot.source_entity_id ?? 'none';
  const idempotencyKey = buildOutboxIdempotencyKey(
    snapshot.tenant_org_id,
    eventCode,
    NOTIFICATION_CHANNEL.EMAIL,
    sourceEntityId,
    snapshot.recipient_user_id,
    'wa_fb',
  );

  const insertedId = await insertOutboxRow(
    {
      tenant_org_id:      snapshot.tenant_org_id,
      channel_code:       NOTIFICATION_CHANNEL.EMAIL,
      recipient_user_id:  snapshot.recipient_user_id,
      recipient_address:  emailAddress,
      rendered_subject:   rendered.title,
      rendered_subject2:  rendered.title2 ?? null,
      rendered_body:      rendered.body,
      rendered_body2:     rendered.body2 ?? null,
      metadata:           {
        ...rendered.metadata,
        variables,
        whatsapp_fallback: true,
        whatsapp_fallback_reason: reason,
      },
      event_code:         eventCode,
      source_entity_type: snapshot.source_entity_type,
      source_entity_id:   snapshot.source_entity_id,
      status:             OUTBOX_STATUS.QUEUED,
      skip_reason:        null,
      scheduled_at:       new Date().toISOString(),
      idempotency_key:    idempotencyKey,
      created_by:         'system',
      rec_status:         1,
      is_active:          true,
    },
    {
      tenantOrgId: snapshot.tenant_org_id,
      eventCode,
      channelCode: NOTIFICATION_CHANNEL.EMAIL,
      recipientUserId: snapshot.recipient_user_id,
      fallback:    'whatsapp',
    },
  );

  if (insertedId) {
    logger.info('outbox adapter: WHATSAPP→EMAIL fallback queued', {
      tenantOrgId: snapshot.tenant_org_id,
      eventCode,
      reason,
      feature:     'notifications',
    });
  }

  return Boolean(insertedId);
}

/**
 *
 * @param event
 * @param channelCode
 * @param opts
 */
export async function enqueueOutbox(
  event: NotificationEvent,
  channelCode: string,
  opts: EnqueueOptions = {},
): Promise<void> {
  const scheduledAt = opts.scheduledAt ?? new Date();
  const skipReason = opts.skipReason;
  const status = skipReason ? OUTBOX_STATUS.SKIPPED : OUTBOX_STATUS.QUEUED;

  const rendered = await renderChannelTemplate(event.code, channelCode, event.variables);

  for (const recipientUserId of event.recipientUserIds) {
    const sourceEntityId = event.sourceEntityId ?? 'none';
    const idempotencyKey = buildOutboxIdempotencyKey(
      event.tenantOrgId,
      event.code,
      channelCode,
      sourceEntityId,
      recipientUserId,
      opts.idempotencySuffix,
    );

    const resolveCtx = {
      tenantOrgId:      event.tenantOrgId,
      recipientUserId,
      channelCode,
      sourceEntityType: event.sourceEntityType,
      sourceEntityId:   event.sourceEntityId,
    };

    let recipientAddress: string | null = null;
    if (!skipReason) {
      recipientAddress = await resolveRecipientAddress(resolveCtx);

      if (
        channelCode === NOTIFICATION_CHANNEL.WHATSAPP &&
        !recipientAddress &&
        await isWhatsappEmailFallbackEnabled()
      ) {
        await enqueueEmailFallbackFromWhatsApp(
          {
            tenant_org_id:      event.tenantOrgId,
            recipient_user_id:  recipientUserId,
            event_code:         event.code,
            source_entity_type: event.sourceEntityType ?? null,
            source_entity_id:   event.sourceEntityId ?? null,
            rendered_subject:   rendered.title,
            rendered_body:      rendered.body,
            metadata:           { variables: event.variables },
          },
          'no_customer_phone',
        );
        continue;
      }
    }

    const metadata = { ...rendered.metadata, variables: event.variables };
    const outboxId = await insertOutboxRow(
      {
        tenant_org_id:      event.tenantOrgId,
        channel_code:       channelCode,
        recipient_user_id:  recipientUserId,
        recipient_address:  recipientAddress,
        rendered_subject:   rendered.title,
        rendered_subject2:  rendered.title2 ?? null,
        rendered_body:      rendered.body,
        rendered_body2:     rendered.body2 ?? null,
        metadata,
        event_code:         event.code,
        source_entity_type: event.sourceEntityType ?? null,
        source_entity_id:   event.sourceEntityId ?? null,
        status,
        skip_reason:        skipReason ?? null,
        scheduled_at:       scheduledAt.toISOString(),
        idempotency_key:    idempotencyKey,
        created_by:         'system',
        rec_status:         1,
        is_active:          true,
      },
      {
        tenantOrgId: event.tenantOrgId,
        eventCode:   event.code,
        channelCode,
        recipientUserId,
      },
    );

    if (
      outboxId &&
      !skipReason &&
      channelCode === NOTIFICATION_CHANNEL.WHATSAPP &&
      await isOutboxInlineDispatchEnabled()
    ) {
      await dispatchWhatsAppInline({
        id: outboxId,
        tenant_org_id: event.tenantOrgId,
        recipient_address: recipientAddress,
        rendered_body: rendered.body,
        rendered_subject: rendered.title,
        event_code: event.code,
        metadata,
      });
    }
  }
}
