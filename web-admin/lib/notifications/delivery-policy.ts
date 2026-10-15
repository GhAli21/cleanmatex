/**
 * Notification Hub — delivery policy (pure, no I/O).
 *
 * The single place that decides WHETHER and WHEN a notification may go out, shared by events
 * (orchestrator), campaigns (process-campaigns) and test sends (plan NTF-06). Callers gather the inputs
 * (channel configuration, consent, transactional flag); this module only decides, so every rule is unit
 * testable with an injected clock.
 */

import type { ChannelConfig } from '@lib/notifications/settings-service';
import type { NotificationPriority, SkipReason } from '@lib/notifications/types';
import { NOTIFICATION_PRIORITY, SKIP_REASON } from '@lib/notifications/types';

/** What the caller must do with the notification. */
export type DeliveryDecision =
  | { action: 'SEND'; scheduledAt: Date }
  | { action: 'SKIP'; skipReason: SkipReason; scheduledAt: Date };

/** Inputs to {@link decideDelivery}. */
export interface DeliveryPolicyInput {
  /** Per-tenant/channel configuration; null when none exists (treated as disabled). */
  channelConfig: ChannelConfig | null;
  /** Transactional events (order lifecycle) skip consent and quiet hours; marketing does not. */
  isTransactional: boolean;
  /** Marketing consent of the recipient on this channel; null = unknown/not required. */
  hasMarketingConsent: boolean | null;
  priority?: NotificationPriority;
  /** Documented test mode: consent is not required (the channel and quiet-hours rules still apply). */
  bypassConsent?: boolean;
  /** Injectable clock. */
  now?: Date;
}

/**
 * Computes when a notification may be delivered. Transactional notifications and URGENT/CRITICAL
 * priorities leave immediately; otherwise delivery waits for the end of the tenant's quiet window.
 *
 * @param config Channel configuration with the quiet-hours window and its timezone.
 * @param priority Notification priority.
 * @param isTransactional True for order-lifecycle style events (always immediate).
 * @param now Injectable clock (defaults to the current time).
 * @returns The earliest delivery instant.
 */
export function computeScheduledAt(
  config: Pick<ChannelConfig, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'quietHoursTz'>,
  priority: NotificationPriority | undefined,
  isTransactional = false,
  now: Date = new Date(),
): Date {
  // Order lifecycle WA/SMS must leave immediately; quiet hours are for marketing.
  if (isTransactional) return now;
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

/**
 * Decides whether a notification may be sent and when.
 * Order of rules: channel disabled → skip; marketing without consent → skip; otherwise send at the
 * quiet-hours-aware time. Suppression-list and provider-level rules stay in the dispatch adapters, which
 * re-check at send time.
 *
 * @param input Gathered facts about the channel, the event and the recipient.
 * @returns SEND with its scheduled instant, or SKIP with the reason.
 */
export function decideDelivery(input: DeliveryPolicyInput): DeliveryDecision {
  const now = input.now ?? new Date();

  if (!input.channelConfig?.isEnabled) {
    return { action: 'SKIP', skipReason: SKIP_REASON.CHANNEL_DISABLED, scheduledAt: now };
  }

  const scheduledAt = computeScheduledAt(input.channelConfig, input.priority, input.isTransactional, now);

  if (!input.isTransactional && !input.bypassConsent && input.hasMarketingConsent !== true) {
    return { action: 'SKIP', skipReason: SKIP_REASON.NO_MARKETING_CONSENT, scheduledAt };
  }
  return { action: 'SEND', scheduledAt };
}
