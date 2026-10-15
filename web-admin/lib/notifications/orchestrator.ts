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
import { isWhatsappEmailFallbackEnabled } from '@lib/notifications/config';
import { notificationSettingsService } from '@lib/notifications/settings-service';
import { computeScheduledAt, decideDelivery } from '@lib/notifications/delivery-policy';

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
// Main orchestration function
// ---------------------------------------------------------------------------

/**
 * Main orchestration function.
 * Call this from event-emitter.ts — do not call adapters directly.
 * @param event
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

    let deliveryChannel = channel;
    let whatsappEmailFallback = false;

    if (channel === NOTIFICATION_CHANNEL.WHATSAPP) {
      const waEnabled = await notificationSettingsService.isChannelEnabled(
        event.tenantOrgId,
        NOTIFICATION_CHANNEL.WHATSAPP,
      );
      const waProvider = await notificationSettingsService.getActiveProvider(
        event.tenantOrgId,
        NOTIFICATION_CHANNEL.WHATSAPP,
      );
      if (!waEnabled || !waProvider) {
        logger.warn('orchestrator: WhatsApp will not send as WhatsApp', {
          eventCode: event.code,
          tenantOrgId: event.tenantOrgId,
          channelEnabled: waEnabled,
          hasActiveProvider: Boolean(waProvider),
          settingsTable: 'org_ntf_settings_cf',
          providerTable: 'org_ntf_channel_provider_cf',
          hint: 'Set org_ntf_settings_cf WHATSAPP is_enabled=true and org_ntf_channel_provider_cf TWILIO_WHATSAPP is_active=true',
          feature: 'notifications',
        });
      }
      if (!waProvider && await isWhatsappEmailFallbackEnabled()) {
        const emailEnabled = await notificationSettingsService.isChannelEnabled(
          event.tenantOrgId,
          NOTIFICATION_CHANNEL.EMAIL,
        );
        if (emailEnabled) {
          deliveryChannel = NOTIFICATION_CHANNEL.EMAIL;
          whatsappEmailFallback = true;
          logger.info('orchestrator: WHATSAPP→EMAIL fallback (no active provider)', {
            eventCode: event.code, tenantOrgId: event.tenantOrgId, feature: 'notifications',
          });
        }
      }
    }

    result.channelsAttempted.push(
      whatsappEmailFallback ? `${channel}→${deliveryChannel}` : channel,
    );

    const channelConfig = await notificationSettingsService.getChannelConfig(
      event.tenantOrgId,
      deliveryChannel,
    );
    if (!channelConfig?.isEnabled) {
      logger.warn('orchestrator: external channel disabled — skipping', {
        channel: deliveryChannel,
        eventCode: event.code,
        tenantOrgId: event.tenantOrgId,
        reason: SKIP_REASON.CHANNEL_DISABLED,
        settingsTable: 'org_ntf_settings_cf',
        feature: 'notifications',
      });
      continue;
    }

    const scheduledAt = computeScheduledAt(channelConfig, event.priority, isTransactional);

    const eligible: string[] = [];
    for (const userId of event.recipientUserIds) {
      // Consent is only consulted for marketing (non-transactional) events; the rule itself lives in the
      // shared delivery policy so campaigns and test sends decide identically.
      const consent = isTransactional
        ? null
        : await notificationSettingsService.hasMarketingConsent(event.tenantOrgId, userId, deliveryChannel);
      const decision = decideDelivery({
        channelConfig,
        isTransactional,
        hasMarketingConsent: consent,
        priority: event.priority,
      });
      if (decision.action === 'SKIP') {
        await enqueueOutbox(
          { ...event, recipientUserIds: [userId] },
          deliveryChannel,
          {
            skipReason: decision.skipReason,
            scheduledAt,
            idempotencySuffix: whatsappEmailFallback ? 'wa_fb' : undefined,
          },
        );
        continue;
      }
      eligible.push(userId);
    }

    if (eligible.length > 0) {
      await enqueueOutbox(
        { ...event, recipientUserIds: eligible },
        deliveryChannel,
        {
          scheduledAt,
          idempotencySuffix: whatsappEmailFallback ? 'wa_fb' : undefined,
        },
      );
    }
  }

  return result;
}
