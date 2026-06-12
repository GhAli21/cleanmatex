/**
 * Notification Hub — IN_APP adapter.
 * Writes one row per recipient to org_ntf_inbox_mst.
 * Uses an idempotency key so duplicate calls for the same business event are silently ignored.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import type { NotificationEvent, InAppResult } from '@lib/notifications/types';
import { NOTIFICATION_CHANNEL, NOTIFICATION_PRIORITY } from '@lib/notifications/types';
import type { RenderedContent } from '@lib/notifications/template-renderer';
import type { Json } from '@/types/database';

/** Format: {tenant_org_id}:{event_code}:{source_entity_id}:{recipient_user_id} */
function buildIdempotencyKey(
  tenantOrgId: string,
  eventCode: string,
  sourceEntityId: string,
  recipientUserId: string
): string {
  return `${tenantOrgId}:${eventCode}:${sourceEntityId}:${recipientUserId}`;
}

/**
 * Deliver an IN_APP notification to one or more recipients.
 * Skips duplicate rows silently via ON CONFLICT (idempotency_key) DO NOTHING.
 */
export async function deliverInApp(
  event: NotificationEvent,
  rendered: RenderedContent,
  categoryCode: string | null = null
): Promise<InAppResult[]> {
  const supabase = createAdminSupabaseClient();
  const results: InAppResult[] = [];

  for (const recipientUserId of event.recipientUserIds) {
    const idempotencyKey = buildIdempotencyKey(
      event.tenantOrgId,
      event.code,
      event.sourceEntityId ?? 'none',
      recipientUserId
    );

    const row = {
      tenant_org_id:       event.tenantOrgId,
      recipient_user_id:   recipientUserId,
      event_code:          event.code,
      category_code:       categoryCode,
      title:               rendered.title,
      title2:              rendered.title2 ?? null,
      body:                rendered.body,
      body2:               rendered.body2 ?? null,
      channel_code:        NOTIFICATION_CHANNEL.IN_APP,
      priority:            event.priority ?? NOTIFICATION_PRIORITY.NORMAL,
      is_read:             false,
      action_url:          event.actionUrl ?? null,
      action_label:        event.actionLabel ?? null,
      action_label2:       event.actionLabel2 ?? null,
      source_entity_type:  event.sourceEntityType ?? null,
      source_entity_id:    event.sourceEntityId ?? null,
      metadata:            rendered.metadata as unknown as Json,
      idempotency_key:     idempotencyKey,
      created_by:          'system',
      rec_status:          1,
      is_active:           true,
    };

    const { data, error } = await supabase
      .from('org_ntf_inbox_mst')
      .insert(row)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('in-app adapter: insert failed', new Error(error.message), {
        tenantOrgId: event.tenantOrgId,
        eventCode:   event.code,
        recipientUserId,
        feature:     'notifications',
      });
      results.push({ recipientUserId, success: false, error: error.message });
      continue;
    }

    // data is null when ON CONFLICT DO NOTHING fired (duplicate — not an error)
    results.push({ recipientUserId, success: true, inboxId: data?.id });
  }

  return results;
}
