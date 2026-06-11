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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ActiveProvider {
  providerCode: string
  /** Non-secret config stored in org_ntf_channel_provider_cf.config */
  config: Record<string, unknown>
}

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
}

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
   */
  async getAllChannelConfigs(tenantOrgId: string): Promise<ChannelConfig[]> {
    const key = `ch:${tenantOrgId}`
    const hit = this.channelCache.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.data

    const supabase = createAdminSupabaseClient()

    const [{ data: settings }, { data: providers }] = await Promise.all([
      supabase
        .from('org_ntf_settings_cf')
        .select('channel_code, is_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_tz, daily_limit')
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
    }))

    this.channelCache.set(key, { data: configs, expiresAt: Date.now() + CACHE_TTL_MS })
    return configs
  }

  /** Returns config for a single channel, or null if no settings row exists. */
  async getChannelConfig(tenantOrgId: string, channelCode: string): Promise<ChannelConfig | null> {
    const all = await this.getAllChannelConfigs(tenantOrgId)
    return all.find(c => c.channelCode === channelCode) ?? null
  }

  /** Quick boolean: is this channel enabled for the tenant? */
  async isChannelEnabled(tenantOrgId: string, channelCode: string): Promise<boolean> {
    const cfg = await this.getChannelConfig(tenantOrgId, channelCode)
    return cfg?.isEnabled ?? false
  }

  /** Returns the currently active provider for a channel, or null if none configured. */
  async getActiveProvider(tenantOrgId: string, channelCode: string): Promise<ActiveProvider | null> {
    const cfg = await this.getChannelConfig(tenantOrgId, channelCode)
    return cfg?.activeProvider ?? null
  }

  // -------------------------------------------------------------------------
  // User preferences
  // -------------------------------------------------------------------------

  /**
   * Returns all preferences for a user, optionally filtered to one channel.
   * Results are cached 30 s per (tenant, user).
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
      .select('channel_code, event_code, is_enabled, marketing_consent')
      .eq('tenant_org_id', tenantOrgId)
      .eq('user_id', userId)

    const prefs: UserPref[] = (data ?? []).map(p => ({
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

  /** Call after any write to org_ntf_settings_cf or org_ntf_channel_provider_cf. */
  invalidateChannel(tenantOrgId: string): void {
    this.channelCache.delete(`ch:${tenantOrgId}`)
  }

  /** Call after any write to org_ntf_user_prefs_dtl. */
  invalidateUserPrefs(tenantOrgId: string, userId: string): void {
    this.prefsCache.delete(`pref:${tenantOrgId}:${userId}`)
  }

  /** Convenience: invalidate everything for a tenant (and optionally one user). */
  invalidateAll(tenantOrgId: string, userId?: string): void {
    this.invalidateChannel(tenantOrgId)
    if (userId) this.invalidateUserPrefs(tenantOrgId, userId)
  }
}

// ---------------------------------------------------------------------------
// Singleton — import this in orchestrator, adapters, and API routes
// ---------------------------------------------------------------------------

export const notificationSettingsService = new NotificationSettingsService()
