/**
 * Notification Hub — outbox adapter (Phase 2).
 * Writes one row per recipient to org_ntf_outbox_dtl for external channels.
 * Respects quiet-hours scheduling and marketing-consent skip.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import type { NotificationEvent } from '@lib/notifications/types';
import { OUTBOX_STATUS } from '@lib/notifications/types';
import { renderChannelTemplate } from '@lib/notifications/template-renderer';

export interface EnqueueOptions {
  scheduledAt?: Date;
  skipReason?: string;
}

/** Format: {tenant_org_id}:{event_code}:{channel}:{source_entity_id}:{recipient_user_id} */
function buildOutboxIdempotencyKey(
  tenantOrgId: string,
  eventCode: string,
  channelCode: string,
  sourceEntityId: string,
  recipientUserId: string
): string {
  return `${tenantOrgId}:${eventCode}:${channelCode}:${sourceEntityId}:${recipientUserId}`;
}

async function resolveRecipientAddress(userId: string, channelCode: string): Promise<string | null> {
  if (channelCode !== 'EMAIL') return null;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

export async function enqueueOutbox(
  event: NotificationEvent,
  channelCode: string,
  opts: EnqueueOptions = {}
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const scheduledAt = opts.scheduledAt ?? new Date();
  const skipReason = opts.skipReason;
  const status = skipReason ? OUTBOX_STATUS.SKIPPED : OUTBOX_STATUS.QUEUED;

  // Pre-render template once (same content for all recipients)
  const rendered = await renderChannelTemplate(event.code, channelCode, event.variables);

  for (const recipientUserId of event.recipientUserIds) {
    const idempotencyKey = buildOutboxIdempotencyKey(
      event.tenantOrgId,
      event.code,
      channelCode,
      event.sourceEntityId ?? 'none',
      recipientUserId
    );

    const recipientAddress = skipReason
      ? null
      : await resolveRecipientAddress(recipientUserId, channelCode);

    const row = {
      tenant_org_id:      event.tenantOrgId,
      channel_code:       channelCode,
      recipient_user_id:  recipientUserId,
      recipient_address:  recipientAddress,
      rendered_subject:   rendered.title,
      rendered_subject2:  rendered.title2 ?? null,
      rendered_body:      rendered.body,
      rendered_body2:     rendered.body2 ?? null,
      metadata:           { ...rendered.metadata, variables: event.variables },
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
    };

    const { error } = await supabase
      .from('org_ntf_outbox_dtl')
      .insert(row)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('outbox adapter: insert failed', new Error(error.message), {
        tenantOrgId: event.tenantOrgId,
        eventCode:   event.code,
        channelCode,
        recipientUserId,
        feature:     'notifications',
      });
    }
  }
}
