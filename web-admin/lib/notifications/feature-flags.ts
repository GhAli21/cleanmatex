/**
 * Notification Hub — feature-flag helpers.
 * Thin wrappers around the existing FLAG_KEYS catalog.
 * Never query sys_feature_flags_* directly — always go through the HQ API or
 * the cached flag values passed down from the page/server action.
 *
 * Phase 1: IN_APP channel has no feature flag gate — it is always enabled when
 * org_ntf_settings_cf.is_enabled = true for the tenant.
 */

import { FLAG_KEYS } from '@lib/constants/feature-flags';

/** Flag keys that gate each external notification channel. */
export const CHANNEL_FLAG_MAP: Record<string, string | undefined> = {
  EMAIL:     undefined,                         // Phase 2 — no flag yet
  SMS:       FLAG_KEYS.SMS_NOTIFICATIONS,
  WHATSAPP:  FLAG_KEYS.WHATSAPP_NOTIFICATIONS,
  PUSH:      FLAG_KEYS.PUSH_NOTIFICATIONS,
  IN_APP:    undefined,                         // Always available; gated by org_ntf_settings_cf only
  WEB_SOCKET:undefined,
};

/**
 * Returns true if the given channel is enabled for the tenant according to the
 * already-resolved featureFlags record (from the HQ FF batch API).
 *
 * Returns true when no flag key is defined for the channel (e.g. IN_APP).
 */
export function isChannelFlagEnabled(
  channel: string,
  featureFlags: Record<string, boolean>
): boolean {
  const flagKey = CHANNEL_FLAG_MAP[channel];
  if (!flagKey) return true;
  return featureFlags[flagKey] === true;
}
