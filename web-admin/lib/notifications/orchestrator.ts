/**
 * Notification Hub — orchestrator.
 * Receives a NotificationEvent, checks tenant channel settings,
 * renders the template, and routes to the correct adapter.
 *
 * Phase 1: only IN_APP channel is active. External channels are stubbed.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import type { NotificationEvent } from '@lib/notifications/types';
import { NOTIFICATION_CHANNEL, SKIP_REASON } from '@lib/notifications/types';
import { renderInAppTemplate } from '@lib/notifications/template-renderer';
import { deliverInApp } from '@lib/notifications/adapters/in-app';
import { enqueueOutbox } from '@lib/notifications/adapters/outbox';

interface OrchestratorResult {
  eventCode: string;
  channelsAttempted: string[];
  inAppDelivered: number;
  inAppSkipped: number;
  errors: string[];
}

/**
 * Check whether the IN_APP channel is enabled for a tenant in org_ntf_settings_cf.
 * Returns true when no row exists (default: IN_APP is on until explicitly disabled).
 */
async function isInAppEnabledForTenant(tenantOrgId: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('org_ntf_settings_cf')
    .select('is_enabled')
    .eq('tenant_org_id', tenantOrgId)
    .eq('channel_code', NOTIFICATION_CHANNEL.IN_APP)
    .maybeSingle();

  // No row → default on
  if (!data) return true;
  return data.is_enabled === true;
}

/**
 * Fetch the event definition: mapped channels + category_code for the inbox row.
 */
async function getEventMeta(
  eventCode: string
): Promise<{ channels: string[]; categoryCode: string | null }> {
  const supabase = createAdminSupabaseClient();
  const [chanMap, eventRow] = await Promise.all([
    supabase
      .from('sys_ntf_event_chan_map')
      .select('channel_code')
      .eq('event_code', eventCode)
      .eq('is_active', true),
    supabase
      .from('sys_ntf_events_cd')
      .select('category_code')
      .eq('code', eventCode)
      .maybeSingle(),
  ]);
  return {
    channels: (chanMap.data ?? []).map((r) => r.channel_code as string),
    categoryCode: (eventRow.data as { category_code?: string | null } | null)?.category_code ?? null,
  };
}

/**
 * Main orchestration function.
 * Call this from event-emitter.ts — do not call adapters directly.
 */
export async function orchestrateNotification(
  event: NotificationEvent
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    eventCode:        event.code,
    channelsAttempted:[],
    inAppDelivered:   0,
    inAppSkipped:     0,
    errors:           [],
  };

  if (event.recipientUserIds.length === 0) {
    logger.warn('orchestrator: no recipients — skipping', {
      eventCode: event.code,
      tenantOrgId: event.tenantOrgId,
      feature: 'notifications',
    });
    return result;
  }

  // Determine channels + category for this event
  const { channels: eventChannels, categoryCode } = await getEventMeta(event.code);

  // --- IN_APP delivery (Phase 1 primary channel) ---
  if (eventChannels.includes(NOTIFICATION_CHANNEL.IN_APP)) {
    result.channelsAttempted.push(NOTIFICATION_CHANNEL.IN_APP);

    const inAppEnabled = await isInAppEnabledForTenant(event.tenantOrgId);
    if (!inAppEnabled) {
      result.inAppSkipped = event.recipientUserIds.length;
      logger.info('orchestrator: IN_APP disabled for tenant — skipping', {
        eventCode:   event.code,
        tenantOrgId: event.tenantOrgId,
        reason:      SKIP_REASON.CHANNEL_DISABLED,
        feature:     'notifications',
      });
    } else {
      try {
        const rendered = await renderInAppTemplate(event.code, event.variables);
        const deliveryResults = await deliverInApp(event, rendered, categoryCode);
        result.inAppDelivered = deliveryResults.filter((r) => r.success).length;
        const failed = deliveryResults.filter((r) => !r.success);
        if (failed.length > 0) {
          result.errors.push(
            ...failed.map((r) => `IN_APP[${r.recipientUserId}]: ${r.error}`)
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`IN_APP render/deliver: ${msg}`);
        logger.error('orchestrator: IN_APP delivery error', err instanceof Error ? err : new Error(msg), {
          eventCode:   event.code,
          tenantOrgId: event.tenantOrgId,
          feature:     'notifications',
        });
      }
    }
  }

  // --- External channels (Phase 1: stub only) ---
  for (const channel of eventChannels) {
    if (channel === NOTIFICATION_CHANNEL.IN_APP || channel === NOTIFICATION_CHANNEL.WEB_SOCKET) continue;
    result.channelsAttempted.push(channel);
    await enqueueOutbox(event, channel);
  }

  return result;
}
