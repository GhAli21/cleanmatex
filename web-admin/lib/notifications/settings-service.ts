/**
 * Centralized source of truth for notification settings.
 *
 * All code that needs channel config, active provider, or user preferences
 * should call this service — never query org_ntf_settings_cf or
 * org_ntf_user_prefs_dtl directly from business logic.
 *
 * Cache TTL: 30 seconds (module-level Map; warm across requests in Node.js).
 * Cache invalidation: call invalidateChannel() / invalidateUserPrefs() after
 * any write to the underlying tables.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { collapseUserPrefRows } from '@lib/notifications/user-prefs'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 *
 */
export interface ActiveProvider {
  providerCode: string
  /** Non-secret config stored in org_ntf_channel_provider_cf.config */
  config: Record<string, unknown>
}

/**
 *
 */
export interface ChannelConfig {
  channelCode: string
  isEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  quietHoursTz: string | null
  dailyLimit: number | null
  /** Null when no provider has been configured/activated for this channel. */
  activeProvider: ActiveProvider | null
  /** Free-form per-tenant/channel config. See {@link NotificationSettingsService.isHqDispatchEnabledForChannel}. */
  metadata: Record<string, unknown> | null
}

/**
 *
 */
export interface UserPref {
  channelCode: string
  /** Null = preference applies to all events on this channel. */
  eventCode: string | null
  isEnabled: boolean
  marketingConsent: boolean
}

// ---------------------------------------------------------------------------
// Internal cache helpers
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const CACHE_TTL_MS = 30_000

// ---------------------------------------------------------------------------
// Service class (singleton exported below)
// ---------------------------------------------------------------------------

class NotificationSettingsService {
  private channelCache = new Map<string, CacheEntry<ChannelConfig[]>>()
  private prefsCache   = new Map<string, CacheEntry<UserPref[]>>()

  // -------------------------------------------------------------------------
  // Channel config
  // -------------------------------------------------------------------------

  /**
   * Returns all channel configs for a tenant, merged with the active provider.
   * Results are cached 30 s per tenant.
   * @param tenantOrgId
   */
  async getAllChannelConfigs(tenantOrgId: string): Promise<ChannelConfig[]> {
    const key = `ch:${tenantOrgId}`
    const hit = this.channelCache.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.data

    const supabase = createAdminSupabaseClient()

    const [{ data: settings }, { data: providers }] = await Promise.all([
      supabase
        .from('org_ntf_settings_cf')
        .select('channel_code, is_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_tz, daily_limit, metadata')
        .eq('tenant_org_id', tenantOrgId)
        .eq('is_active', true),
      supabase
        .from('org_ntf_channel_provider_cf')
        .select('channel_code, provider_code, config')
        .eq('tenant_org_id', tenantOrgId)
        .eq('is_active', true),
    ])

    const providerMap = new Map<string, ActiveProvider>(
      (providers ?? []).map(p => [
        p.channel_code,
        {
          providerCode: p.provider_code,
          config: (p.config as Record<string, unknown>) ?? {},
        },
      ])
    )

    const configs: ChannelConfig[] = (settings ?? []).map(s => ({
      channelCode:        s.channel_code,
      isEnabled:          s.is_enabled,
      quietHoursEnabled:  s.quiet_hours_enabled,
      quietHoursStart:    s.quiet_hours_start   ?? null,
      quietHoursEnd:      s.quiet_hours_end     ?? null,
      quietHoursTz:       s.quiet_hours_tz      ?? null,
      dailyLimit:         s.daily_limit         ?? null,
      activeProvider:     providerMap.get(s.channel_code) ?? null,
      metadata:           (s.metadata as Record<string, unknown> | null) ?? null,
    }))

    this.channelCache.set(key, { data: configs, expiresAt: Date.now() + CACHE_TTL_MS })
    return configs
  }

  /**
   * Returns config for a single channel, or null if no settings row exists.
   * @param tenantOrgId
   * @param channelCode
   */
  async getChannelConfig(tenantOrgId: string, channelCode: string): Promise<ChannelConfig | null> {
    const all = await this.getAllChannelConfigs(tenantOrgId)
    return all.find(c => c.channelCode === channelCode) ?? null
  }

  /**
   * Quick boolean: is this channel enabled for the tenant?
   * @param tenantOrgId
   * @param channelCode
   */
  async isChannelEnabled(tenantOrgId: string, channelCode: string): Promise<boolean> {
    const cfg = await this.getChannelConfig(tenantOrgId, channelCode)
    return cfg?.isEnabled ?? false
  }

  /**
   * Returns the currently active provider for a channel, or null if none configured.
   * @param tenantOrgId
   * @param channelCode
   */
  async getActiveProvider(tenantOrgId: string, channelCode: string): Promise<ActiveProvider | null> {
    const cfg = await this.getChannelConfig(tenantOrgId, channelCode)
    return cfg?.activeProvider ?? null
  }

  /**
   * Per-tenant/channel opt-in for the HQ dispatch proxy, layered on top of the
   * platform-wide `ntf_dispatch_via_hq` runtime flag (`sys_ntf_runtime_cf` —
   * confirmed, via `information_schema.columns`, to have no `tenant_org_id`
   * column at all; it is a genuine global switch, not tenant-scopable on its
   * own). Added 2026-10-10 (plan item A1) specifically so a pilot can be
   * scoped to one tenant/channel instead of flipping the proxy on for every
   * tenant's traffic simultaneously. Requires BOTH: the global flag true
   * (master kill switch — `isNtfDispatchViaHq()` in `lib/notifications/config.ts`)
   * AND this tenant's `org_ntf_settings_cf.metadata.dispatch_via_hq === true`
   * for the specific channel (no migration needed — `metadata` is an
   * existing, already-fetched jsonb column on this already tenant+channel
   * scoped table). Callers must check the global flag themselves first (every
   * adapter already does, for the pre-existing env-only escape-hatch
   * behavior) — this method only adds the per-tenant narrowing on top.
   * @param tenantOrgId Tenant to check the opt-in for.
   * @param channelCode Channel to check the opt-in for.
   */
  async isHqDispatchEnabledForChannel(tenantOrgId: string, channelCode: string): Promise<boolean> {
    const cfg = await this.getChannelConfig(tenantOrgId, channelCode)
    return cfg?.metadata?.dispatch_via_hq === true
  }

  // -------------------------------------------------------------------------
  // User preferences
  // -------------------------------------------------------------------------

  /**
   * Returns all preferences for a user, optionally filtered to one channel.
   * Results are cached 30 s per (tenant, user).
   * @param tenantOrgId
   * @param userId
   * @param channelCode
   */
  async getUserPrefs(tenantOrgId: string, userId: string, channelCode?: string): Promise<UserPref[]> {
    const key = `pref:${tenantOrgId}:${userId}`
    const hit = this.prefsCache.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      const data = hit.data
      return channelCode ? data.filter(p => p.channelCode === channelCode) : data
    }

    const supabase = createAdminSupabaseClient()
    const { data } = await supabase
      .from('org_ntf_user_prefs_dtl')
      .select('user_id, channel_code, event_code, branch_id, is_enabled, marketing_consent, updated_at, created_at')
      .eq('tenant_org_id', tenantOrgId)
      .eq('user_id', userId)

    const prefs: UserPref[] = collapseUserPrefRows(data ?? []).map(p => ({
      channelCode:       p.channel_code,
      eventCode:         p.event_code         ?? null,
      isEnabled:         p.is_enabled,
      marketingConsent:  p.marketing_consent,
    }))

    this.prefsCache.set(key, { data: prefs, expiresAt: Date.now() + CACHE_TTL_MS })
    return channelCode ? prefs.filter(p => p.channelCode === channelCode) : prefs
  }

  /**
   * Returns true if the user has given marketing consent for a channel.
   * Returns true unconditionally for transactional events (caller must check is_transactional first).
   * @param tenantOrgId
   * @param userId
   * @param channelCode
   */
  async hasMarketingConsent(tenantOrgId: string, userId: string, channelCode: string): Promise<boolean> {
    const prefs = await this.getUserPrefs(tenantOrgId, userId, channelCode)
    // Coarse preference (event_code = null) takes precedence; fall back to false if no row.
    const coarse = prefs.find(p => p.eventCode === null)
    return coarse?.marketingConsent ?? false
  }

  // -------------------------------------------------------------------------
  // Cache invalidation
  // -------------------------------------------------------------------------

  /**
   * Call after any write to org_ntf_settings_cf or org_ntf_channel_provider_cf.
   * @param tenantOrgId
   */
  invalidateChannel(tenantOrgId: string): void {
    this.channelCache.delete(`ch:${tenantOrgId}`)
  }

  /**
   * Call after any write to org_ntf_user_prefs_dtl.
   * @param tenantOrgId
   * @param userId
   */
  invalidateUserPrefs(tenantOrgId: string, userId: string): void {
    this.prefsCache.delete(`pref:${tenantOrgId}:${userId}`)
  }

  /**
   * Convenience: invalidate everything for a tenant (and optionally one user).
   * @param tenantOrgId
   * @param userId
   */
  invalidateAll(tenantOrgId: string, userId?: string): void {
    this.invalidateChannel(tenantOrgId)
    if (userId) this.invalidateUserPrefs(tenantOrgId, userId)
  }
}

// ---------------------------------------------------------------------------
// Singleton — import this in orchestrator, adapters, and API routes
// ---------------------------------------------------------------------------

export const notificationSettingsService = new NotificationSettingsService()
