/**
 * Notification Hub — orchestrator.
 * Receives a NotificationEvent, checks tenant channel settings via the
 * NotificationSettingsService (source of truth), renders the template,
 * and routes to the correct adapter.
 *
 * Phase 2: IN_APP + EMAIL channels active. Quiet hours and marketing consent enforced.
 * Phase 3: Push/SMS/WhatsApp adapters will plug in here with zero orchestrator changes.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import type { NotificationEvent, NotificationPriority } from '@lib/notifications/types';
import { NOTIFICATION_CHANNEL, NOTIFICATION_PRIORITY, SKIP_REASON } from '@lib/notifications/types';
import { renderInAppTemplate } from '@lib/notifications/template-renderer';
import { deliverInApp } from '@lib/notifications/adapters/in-app';
import { enqueueOutbox } from '@lib/notifications/adapters/outbox';
import { notificationSettingsService, type ChannelConfig } from '@lib/notifications/settings-service';

interface OrchestratorResult {
  eventCode: string;
  channelsAttempted: string[];
  inAppDelivered: number;
  inAppSkipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers that still need direct DB access (event catalog, not settings)
// ---------------------------------------------------------------------------

async function isEventTransactional(eventCode: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('sys_ntf_events_cd')
    .select('is_transactional')
    .eq('code', eventCode)
    .maybeSingle();
  return data?.is_transactional ?? true;
}

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

// ---------------------------------------------------------------------------
// Quiet hours — timezone-aware scheduled delivery time
// ---------------------------------------------------------------------------

function computeScheduledAt(config: ChannelConfig, priority: NotificationPriority | undefined): Date {
  const now = new Date();
  if (!config.quietHoursEnabled || !config.quietHoursStart || !config.quietHoursEnd) return now;
  if (priority === NOTIFICATION_PRIORITY.URGENT || priority === NOTIFICATION_PRIORITY.CRITICAL) return now;

  const tz = config.quietHoursTz ?? 'UTC';
  const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const hhmm = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const startMins   = hhmm(config.quietHoursStart);
  const endMins     = hhmm(config.quietHoursEnd);
  const currentMins = nowInTz.getHours() * 60 + nowInTz.getMinutes();

  const inQuietHours =
    startMins < endMins
      ? currentMins >= startMins && currentMins < endMins   // same-day quiet window
      : currentMins >= startMins || currentMins < endMins;  // overnight quiet window

  if (!inQuietHours) return now;

  const [endH, endM] = config.quietHoursEnd.split(':').map(Number);
  const endToday = new Date(nowInTz);
  endToday.setHours(endH, endM, 0, 0);
  if (endToday <= nowInTz) endToday.setDate(endToday.getDate() + 1);
  const offsetMs = now.getTime() - nowInTz.getTime();
  return new Date(endToday.getTime() + offsetMs);
}

// ---------------------------------------------------------------------------
// Main orchestration function
// ---------------------------------------------------------------------------

/**
 * Main orchestration function.
 * Call this from event-emitter.ts — do not call adapters directly.
 */
export async function orchestrateNotification(
  event: NotificationEvent
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    eventCode:         event.code,
    channelsAttempted: [],
    inAppDelivered:    0,
    inAppSkipped:      0,
    errors:            [],
  };

  if (event.recipientUserIds.length === 0) {
    logger.warn('orchestrator: no recipients — skipping', {
      eventCode: event.code, tenantOrgId: event.tenantOrgId, feature: 'notifications',
    });
    return result;
  }

  const { channels: eventChannels, categoryCode } = await getEventMeta(event.code);

  // --- IN_APP delivery ---
  if (eventChannels.includes(NOTIFICATION_CHANNEL.IN_APP)) {
    result.channelsAttempted.push(NOTIFICATION_CHANNEL.IN_APP);

    const inAppEnabled = await notificationSettingsService.isChannelEnabled(
      event.tenantOrgId,
      NOTIFICATION_CHANNEL.IN_APP
    );

    if (!inAppEnabled) {
      result.inAppSkipped = event.recipientUserIds.length;
      logger.info('orchestrator: IN_APP disabled for tenant — skipping', {
        eventCode: event.code, tenantOrgId: event.tenantOrgId,
        reason: SKIP_REASON.CHANNEL_DISABLED, feature: 'notifications',
      });
    } else {
      try {
        const rendered = await renderInAppTemplate(event.code, event.variables);
        const deliveryResults = await deliverInApp(event, rendered, categoryCode);
        result.inAppDelivered = deliveryResults.filter((r) => r.success).length;
        const failed = deliveryResults.filter((r) => !r.success);
        if (failed.length > 0) {
          result.errors.push(...failed.map((r) => `IN_APP[${r.recipientUserId}]: ${r.error}`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`IN_APP render/deliver: ${msg}`);
        logger.error('orchestrator: IN_APP delivery error', err instanceof Error ? err : new Error(msg), {
          eventCode: event.code, tenantOrgId: event.tenantOrgId, feature: 'notifications',
        });
      }
    }
  }

  // --- External channels (EMAIL active Phase 2; Push/SMS/WA plug in Phase 3) ---
  const isTransactional = await isEventTransactional(event.code);

  for (const channel of eventChannels) {
    if (channel === NOTIFICATION_CHANNEL.IN_APP || channel === NOTIFICATION_CHANNEL.WEB_SOCKET) continue;
    result.channelsAttempted.push(channel);

    // Source of truth: NotificationSettingsService (cached 30 s)
    const channelConfig = await notificationSettingsService.getChannelConfig(event.tenantOrgId, channel);
    if (!channelConfig?.isEnabled) {
      logger.info('orchestrator: external channel disabled — skipping', {
        channel, eventCode: event.code, tenantOrgId: event.tenantOrgId,
        reason: SKIP_REASON.CHANNEL_DISABLED, feature: 'notifications',
      });
      continue;
    }

    const scheduledAt = computeScheduledAt(channelConfig, event.priority);

    const eligible: string[] = [];
    for (const userId of event.recipientUserIds) {
      if (!isTransactional) {
        const consent = await notificationSettingsService.hasMarketingConsent(
          event.tenantOrgId, userId, channel
        );
        if (!consent) {
          await enqueueOutbox(
            { ...event, recipientUserIds: [userId] },
            channel,
            { skipReason: SKIP_REASON.NO_MARKETING_CONSENT, scheduledAt }
          );
          continue;
        }
      }
      eligible.push(userId);
    }

    if (eligible.length > 0) {
      await enqueueOutbox({ ...event, recipientUserIds: eligible }, channel, { scheduledAt });
    }
  }

  return result;
}
