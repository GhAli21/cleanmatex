'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'
import { CmxSwitch } from '@ui/primitives/cmx-switch'
import { CmxTabsPanel } from '@ui/navigation/cmx-tabs-panel'
import { CmxSkeleton } from '@ui/primitives/cmx-skeleton'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { useAuth } from '@/lib/auth/auth-context'

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const
type ChannelCode = (typeof CHANNELS)[number]

const CHANNEL_LABELS: Record<ChannelCode, { en: string; ar: string }> = {
  IN_APP:   { en: 'In-App',   ar: 'داخل التطبيق' },
  EMAIL:    { en: 'Email',    ar: 'البريد الإلكتروني' },
  SMS:      { en: 'SMS',      ar: 'رسائل SMS' },
  WHATSAPP: { en: 'WhatsApp', ar: 'واتساب' },
  PUSH:     { en: 'Push',     ar: 'إشعارات الدفع' },
}

interface ChannelSetting {
  channel_code: ChannelCode
  is_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  quiet_hours_tz: string | null
}

interface UserPref {
  channel_code: ChannelCode
  event_code: string | null
  is_enabled: boolean
  marketing_consent: boolean
}

type Tab = 'my-prefs' | 'channel-settings'

/**
 *
 */
export function NotificationSettingsPage() {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const t = useTranslations('notifications')
  const { currentTenant } = useAuth()
  const userRole = currentTenant?.user_role

  const [settings, setSettings] = useState<ChannelSetting[]>([])
  const [prefs, setPrefs] = useState<UserPref[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(userRole ?? '')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, prefsRes] = await Promise.all([
        isAdmin ? fetch('/api/v1/notifications/settings') : Promise.resolve(null),
        fetch('/api/v1/notifications/user-prefs'),
      ])
      if (isAdmin && settingsRes) {
        const j = await settingsRes.json()
        if (j.success) setSettings(j.data)
      }
      if (prefsRes.ok) {
        const j = await prefsRes.json()
        if (j.success) setPrefs(j.data)
      }
    } catch {
      setError(t('settings.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, t])

  useEffect(() => { void fetchData() }, [fetchData])

  const updatePref = useCallback(async (channelCode: ChannelCode, field: 'is_enabled' | 'marketing_consent', value: boolean) => {
    setSaving(`${channelCode}-${field}`)
    try {
      await fetch('/api/v1/notifications/user-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_code: channelCode, [field]: value }),
      })
      setPrefs((prev) => {
        const existing = prev.find((p) => p.channel_code === channelCode && p.event_code === null)
        if (existing) return prev.map((p) => p.channel_code === channelCode && p.event_code === null ? { ...p, [field]: value } : p)
        return [...prev, { channel_code: channelCode, event_code: null, is_enabled: true, marketing_consent: false, [field]: value }]
      })
    } finally {
      setSaving(null)
    }
  }, [])

  const updateChannelSetting = useCallback(async (channelCode: ChannelCode, field: string, value: boolean | string | null) => {
    setSaving(`admin-${channelCode}-${field}`)
    try {
      const res = await fetch('/api/v1/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_code: channelCode, [field]: value }),
      })
      const j = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !j.success) {
        setError(j.error ?? t('settings.saveFailed'))
        return
      }
      setSettings((prev) => {
        const existing = prev.find((s) => s.channel_code === channelCode)
        if (existing) return prev.map((s) => s.channel_code === channelCode ? { ...s, [field]: value } : s)
        return [...prev, { channel_code: channelCode, is_enabled: false, quiet_hours_enabled: false, quiet_hours_start: null, quiet_hours_end: null, quiet_hours_tz: null, [field]: value }]
      })
    } catch {
      setError(t('settings.saveFailed'))
    } finally {
      setSaving(null)
    }
  }, [t])

  const getPref = (channelCode: ChannelCode) =>
    prefs.find((p) => p.channel_code === channelCode && p.event_code === null)

  const getChannelSetting = (channelCode: ChannelCode) =>
    settings.find((s) => s.channel_code === channelCode)

  /**
   *
   */
  type TabDef = { id: Tab; label: string }
  const TABS: TabDef[] = [
    { id: 'my-prefs', label: t('settings.myPrefs') },
    ...(isAdmin ? [{ id: 'channel-settings' as Tab, label: t('settings.channelSettings') }] : []),
  ]

  const tabsWithContent = TABS.map(({ id, label }) => ({
    id,
    label,
    content: (
      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CmxSkeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : error ? (
          <CmxSummaryMessage type="error" title={error} items={[]} />
        ) : id === 'my-prefs' ? (
          CHANNELS.map((ch) => {
            const pref = getPref(ch)
            const enabled = pref?.is_enabled ?? true
            const consent = pref?.marketing_consent ?? false
            return (
              <CmxCard key={ch}>
                <CmxCardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                        {isAr ? CHANNEL_LABELS[ch].ar : CHANNEL_LABELS[ch].en}
                      </p>
                      <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {t('settings.enableChannel')}
                      </p>
                    </div>
                    <CmxSwitch
                      checked={enabled}
                      onCheckedChange={(v) => void updatePref(ch, 'is_enabled', v)}
                      disabled={saving === `${ch}-is_enabled`}
                    />
                  </div>
                  {ch !== 'IN_APP' && (
                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] pt-3">
                      <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {t('settings.marketingConsent')}
                      </p>
                      <CmxSwitch
                        checked={consent}
                        onCheckedChange={(v) => void updatePref(ch, 'marketing_consent', v)}
                        disabled={saving === `${ch}-marketing_consent`}
                      />
                    </div>
                  )}
                </CmxCardContent>
              </CmxCard>
            )
          })
        ) : (
          // Channel Settings tab (admin only)
          CHANNELS.map((ch) => {
            const setting = getChannelSetting(ch)
            const isEnabled = setting?.is_enabled ?? false
            const quietEnabled = setting?.quiet_hours_enabled ?? false
            return (
              <CmxCard key={ch}>
                <CmxCardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                      {isAr ? CHANNEL_LABELS[ch].ar : CHANNEL_LABELS[ch].en}
                    </p>
                    <CmxSwitch
                      checked={isEnabled}
                      onCheckedChange={(v) => void updateChannelSetting(ch, 'is_enabled', v)}
                      disabled={saving === `admin-${ch}-is_enabled`}
                    />
                  </div>
                </CmxCardHeader>
                {isEnabled && (
                  <CmxCardContent className="pt-0 pb-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {t('settings.quietHours')}
                      </p>
                      <CmxSwitch
                        checked={quietEnabled}
                        onCheckedChange={(v) => void updateChannelSetting(ch, 'quiet_hours_enabled', v)}
                        disabled={saving === `admin-${ch}-quiet_hours_enabled`}
                      />
                    </div>
                    {quietEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                            {t('settings.quietHoursStart')}
                          </label>
                          <input
                            type="time"
                            defaultValue={setting?.quiet_hours_start ?? '22:00'}
                            onBlur={(e) => void updateChannelSetting(ch, 'quiet_hours_start', e.target.value)}
                            className="mt-1 w-full rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                            {t('settings.quietHoursEnd')}
                          </label>
                          <input
                            type="time"
                            defaultValue={setting?.quiet_hours_end ?? '08:00'}
                            onBlur={(e) => void updateChannelSetting(ch, 'quiet_hours_end', e.target.value)}
                            className="mt-1 w-full rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </CmxCardContent>
                )}
              </CmxCard>
            )
          })
        )}
      </div>
    ),
  }))

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
        {t('settings.title')}
      </h1>
      <CmxTabsPanel tabs={tabsWithContent} defaultTab="my-prefs" />
    </div>
  )
}
