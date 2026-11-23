'use client'

/**
 * UserPreferencesScreen - Personal workspace, sidebar, language, and notification preferences.
 *
 * Improvements over the legacy page:
 * - Loads real tenant branches into Default Branch selector
 * - Syncs controlled values cleanly with resolved effectiveSettings (fixes stale reset state)
 * - Uses cmxMessage feedback on save/reset and per-setting saving state
 * - Integrates per-user DB-persisted Sidebar Color Palette + Pinned Screens manager
 * - Uses CmxSkeleton, CmxSummaryMessage, and CmxSwitch (100% Cmx design system compliant)
 *
 * @module features/settings/ui/user-preferences-screen
 */

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  Bell,
  Building2,
  Check,
  ExternalLink,
  Globe,
  Palette,
  RefreshCw,
  Star,
  User,
  X,
} from 'lucide-react'
import { CmxCard } from '@ui/primitives/cmx-card'
import { CmxButton, CmxSelect, CmxSkeleton, CmxSwitch } from '@ui/primitives'
import { CmxSummaryMessage, useMessage } from '@ui/feedback'
import { settingsClient, type ResolvedSetting } from '@/lib/api/settings-client'
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { useUserSidebarPreferences } from '@/lib/hooks/use-user-sidebar-preferences'
import { UI_SIDEBAR_THEMES, type UiSidebarTheme } from '@/lib/constants/ui-theme'
import { EnhancedSettingField } from '@features/settings/ui/enhanced-setting-field'
import type { SettingSource } from '@features/settings/ui/source-badge'
import type { BranchOption } from '@/lib/services/inventory-service'
import { cn } from '@/lib/utils'

const VALID_SOURCES: readonly SettingSource[] = [
  'SYSTEM_DEFAULT',
  'SYSTEM_PROFILE',
  'PLAN_CONSTRAINT',
  'FEATURE_FLAG',
  'TENANT_OVERRIDE',
  'BRANCH_OVERRIDE',
  'USER_OVERRIDE',
]

function toSettingSource(raw: string | undefined): SettingSource {
  if (raw && (VALID_SOURCES as readonly string[]).includes(raw)) {
    return raw as SettingSource
  }
  return 'SYSTEM_DEFAULT'
}

const SWATCH_CLASS_MAP: Record<UiSidebarTheme, string> = {
  OCEAN: 'cmx-sb-swatch-OCEAN',
  MIDNIGHT: 'cmx-sb-swatch-MIDNIGHT',
  EMERALD: 'cmx-sb-swatch-EMERALD',
  INDIGO: 'cmx-sb-swatch-INDIGO',
  SAND: 'cmx-sb-swatch-SAND',
}

export function UserPreferencesScreen() {
  const locale = useLocale()
  const tAppearance = useTranslations('authSession.appearance')
  const tSidebar = useTranslations('layout.sidebar')
  const t = useTranslations('settings.advancedSettings')
  const tSettings = useTranslations('settings')
  const tCommon = useTranslations('common')
  const { showSuccess, showError } = useMessage()

  const { sidebarTheme, pinnedKeys, setSidebarTheme, togglePin, clearPins } =
    useUserSidebarPreferences()
  const { navigation } = useNavigation()

  const [effectiveSettings, setEffectiveSettings] = React.useState<ResolvedSetting[]>([])
  const [branches, setBranches] = React.useState<BranchOption[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [savingCode, setSavingCode] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const loadPreferences = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [settings, branchesResult] = await Promise.all([
        settingsClient.getEffectiveSettings({ userId: 'me' }),
        getBranchesAction().catch(() => ({ success: false as const, data: undefined })),
      ])
      setEffectiveSettings(settings)
      if (branchesResult.success && branchesResult.data) {
        setBranches(branchesResult.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadErrorPreferences'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  const handleSave = React.useCallback(
    async (settingCode: string, value: unknown) => {
      setSavingCode(settingCode)
      try {
        await settingsClient.upsertOverride({
          settingCode,
          value,
          userId: 'me',
          overrideReason: 'User preference',
        })
        const refreshed = await settingsClient.getEffectiveSettings({ userId: 'me' })
        setEffectiveSettings(refreshed)
        showSuccess(t('preferenceSaved'))
      } catch (err) {
        showError(err instanceof Error ? err.message : t('preferenceSaveError'))
      } finally {
        setSavingCode(null)
      }
    },
    [showError, showSuccess, t],
  )

  const handleAfterReset = React.useCallback(async () => {
    try {
      const refreshed = await settingsClient.getEffectiveSettings({ userId: 'me' })
      setEffectiveSettings(refreshed)
      showSuccess(t('preferenceReset'))
    } catch (err) {
      showError(err instanceof Error ? err.message : t('preferenceSaveError'))
    }
  }, [showError, showSuccess, t])

  // Resolve pinned comp_codes into localized labels using active navigation tree
  const pinnedLabelMap = React.useMemo(() => {
    const map = new Map<string, string>()
    const isAr = locale === 'ar'
    for (const section of navigation) {
      map.set(section.key, (isAr && section.label2) || section.label || section.key)
      for (const child of section.children ?? []) {
        map.set(child.key, (isAr && child.label2) || child.label || child.key)
      }
    }
    return map
  }, [locale, navigation])

  const getResolved = (code: string) => effectiveSettings.find((s) => s.stngCode === code)

  const branchOptions = React.useMemo(
    () => [
      { value: '', label: t('noDefaultBranch') },
      ...branches.map((b) => ({
        value: b.id,
        label: b.name || b.id,
      })),
    ],
    [branches, t],
  )

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <CmxSkeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <CmxSkeleton className="h-7 w-52" />
            <CmxSkeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CmxSkeleton className="h-64 w-full rounded-xl" />
          <CmxSkeleton className="h-64 w-full rounded-xl" />
          <CmxSkeleton className="h-56 w-full rounded-xl" />
          <CmxSkeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <CmxSummaryMessage
          type="error"
          title={t('preferencesLoadErrorTitle')}
          message={error}
        />
        <CmxButton onClick={() => void loadPreferences()} variant="outline">
          <RefreshCw className="h-4 w-4 me-2" aria-hidden />
          {tCommon('tryAgain')}
        </CmxButton>
      </div>
    )
  }

  const renderSelectField = (
    settingCode: string,
    label: string,
    description: string,
    options: Array<{ value: string; label: string }>,
  ) => {
    const resolved = getResolved(settingCode)
    const currentValue = typeof resolved?.stngValue === 'string' ? resolved.stngValue : ''
    return (
      <EnhancedSettingField
        settingCode={settingCode}
        label={label}
        description={description}
        value={currentValue}
        source={toSettingSource(resolved?.stngSourceLayer)}
        sourceName={resolved?.stngSourceId}
        isOverridable
        isLocked={false}
        userId="me"
        onReset={() => void handleAfterReset()}
      >
        <CmxSelect
          value={currentValue}
          disabled={savingCode === settingCode}
          onChange={(e) => void handleSave(settingCode, e.target.value || null)}
          options={options}
        />
      </EnhancedSettingField>
    )
  }

  const renderSwitchField = (settingCode: string, label: string, description: string) => {
    const resolved = getResolved(settingCode)
    const checked = Boolean(resolved?.stngValue)
    return (
      <EnhancedSettingField
        settingCode={settingCode}
        label={label}
        description={description}
        value={checked}
        source={toSettingSource(resolved?.stngSourceLayer)}
        sourceName={resolved?.stngSourceId}
        isOverridable
        isLocked={false}
        userId="me"
        onReset={() => void handleAfterReset()}
      >
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm text-foreground">{label}</span>
          <CmxSwitch
            checked={checked}
            disabled={savingCode === settingCode}
            onCheckedChange={(next) => void handleSave(settingCode, next)}
            aria-label={label}
          />
        </div>
      </EnhancedSettingField>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-bg rounded-xl">
            <User className="h-6 w-6 text-primary-text" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('preferencesTitle')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('preferencesSubtitle')}</p>
          </div>
        </div>
        <CmxButton
          variant="outline"
          size="sm"
          onClick={() => void loadPreferences()}
          disabled={Boolean(savingCode)}
        >
          <RefreshCw className="h-4 w-4 me-1.5" aria-hidden />
          {tCommon('refresh')}
        </CmxButton>
      </div>

      {/* Section 1: Sidebar & Appearance (Per-User DB Preferences) */}
      <CmxCard className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <Palette className="h-5 w-5 text-primary-text" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t('sidebarPreferencesTitle')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('sidebarPreferencesDesc')}</p>
            </div>
          </div>
          <CmxButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/account/appearance">
              {tAppearance('openLink')}
              <ExternalLink className="h-3.5 w-3.5 ms-1.5" aria-hidden />
            </Link>
          </CmxButton>
        </div>

        {/* 5-Palette Sidebar Color Picker */}
        <div className="space-y-2.5">
          <div className="text-sm font-medium text-foreground">{tSidebar('mySidebarColor')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {UI_SIDEBAR_THEMES.map((themeCode) => {
              const selected = sidebarTheme === themeCode
              const label = tSidebar(`themes.${themeCode}` as 'themes.OCEAN')
              return (
                <button
                  key={themeCode}
                  type="button"
                  onClick={() => setSidebarTheme(themeCode)}
                  aria-pressed={selected}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary bg-primary-bg/50 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={cn(
                        'h-6 w-10 rounded-md border border-border/60',
                        SWATCH_CLASS_MAP[themeCode],
                      )}
                      aria-hidden
                    />
                    {selected ? (
                      <Check className="h-4 w-4 text-primary-text shrink-0" aria-hidden />
                    ) : null}
                  </div>
                  <span className="text-xs font-medium text-foreground truncate w-full">
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pinned Screens Manager */}
        <div className="space-y-2.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Star className="h-4 w-4 text-warning fill-current" aria-hidden />
              <span>{t('pinnedScreensTitle')}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ({pinnedKeys.length})
              </span>
            </div>
            {pinnedKeys.length > 0 ? (
              <CmxButton variant="ghost" size="xs" onClick={clearPins}>
                {t('clearAllPins')}
              </CmxButton>
            ) : null}
          </div>

          {pinnedKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('pinnedScreensEmpty')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pinnedKeys.map((key) => {
                const label = pinnedLabelMap.get(key) ?? key
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
                  >
                    <span>{label}</span>
                    <button
                      type="button"
                      onClick={() => togglePin(key)}
                      aria-label={tSidebar('unpinItem', { label })}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </CmxCard>

      {/* Main 2-Column Preferences Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Language & Localization */}
        <CmxCard className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Globe className="h-5 w-5 text-primary-text" aria-hidden />
            <h2 className="text-base font-semibold text-foreground">
              {t('languageSectionTitle')}
            </h2>
          </div>

          <div className="space-y-4">
            {renderSelectField('user.language', tSettings('language'), t('languageDescription'), [
              { value: 'en', label: t('langEnglish') },
              { value: 'ar', label: t('langArabic') },
            ])}

            {renderSelectField('user.timezone', tSettings('timezone'), t('timezoneDescription'), [
              { value: 'Asia/Muscat', label: t('tzMuscat') },
              { value: 'Asia/Riyadh', label: t('tzRiyadh') },
              { value: 'Asia/Dubai', label: t('tzDubai') },
              { value: 'Asia/Kuwait', label: t('tzKuwait') },
              { value: 'Asia/Bahrain', label: t('tzBahrain') },
              { value: 'Asia/Qatar', label: t('tzQatar') },
              { value: 'UTC', label: t('tzUtc') },
            ])}

            {renderSelectField(
              'user.date_format',
              t('dateFormatLabel'),
              t('dateFormatDescription'),
              [
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              ],
            )}
          </div>
        </CmxCard>

        {/* Notifications & Workspace Column */}
        <div className="space-y-6">
          {/* Notifications */}
          <CmxCard className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Bell className="h-5 w-5 text-primary-text" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">
                {t('notificationsSectionTitle')}
              </h2>
            </div>

            <div className="space-y-4">
              {renderSwitchField(
                'user.email_notifications',
                t('emailNotificationsLabel'),
                t('emailNotificationsDesc'),
              )}
              {renderSwitchField(
                'user.sms_notifications',
                t('smsNotificationsLabel'),
                t('smsNotificationsDesc'),
              )}
              {renderSwitchField(
                'user.browser_notifications',
                t('browserNotificationsLabel'),
                t('browserNotificationsDesc'),
              )}
            </div>
          </CmxCard>

          {/* Workspace / Default Branch */}
          <CmxCard className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="h-5 w-5 text-primary-text" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">
                {t('workspaceSectionTitle')}
              </h2>
            </div>

            {renderSelectField(
              'user.default_branch',
              t('defaultBranchLabel'),
              t('defaultBranchDesc'),
              branchOptions,
            )}
          </CmxCard>
        </div>
      </div>
    </div>
  )
}

