'use client'

/**
 * General Settings Page
 *
 * Manages business information, hours, and locale settings:
 * - Business name and contact info
 * - Business hours configuration
 * - Timezone and currency settings (currency/country are lock-once when
 *   the tenant has any orders — guarded server-side by tenant-profile service)
 * - Default language
 *
 * Features:
 * - Form validation with inline server field errors
 * - Dirty tracking + Save disabled when pristine
 * - beforeunload guard against losing unsaved edits
 * - Loading skeleton on first GET
 * - Bilingual support (EN/AR), RTL-aware
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Clock, Globe, DollarSign, Mail, Phone, MapPin, Lock } from 'lucide-react'
import Link from 'next/link'
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
import { CmxPhoneInput } from '@ui/forms'
import { dialCodeToDefaultCountry } from '@/lib/phone/phone-utils'
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token'

interface GeneralSettings {
  businessName: string
  businessNameAr: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  timezone: string
  currency: string
  defaultLanguage: string
}

interface IsLocked {
  currency: boolean
  country: boolean
}

const INITIAL_SETTINGS: GeneralSettings = {
  businessName: '',
  businessNameAr: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: 'US',
  timezone: 'UTC',
  currency: 'USD',
  defaultLanguage: 'en',
}

/**
 *
 */
export default function GeneralSettingsPage() {
  const t = useTranslations('settings')
  const { token: csrfToken } = useCSRFToken()
  const [settings, setSettings] = useState<GeneralSettings>(INITIAL_SETTINGS)
  const [baseline, setBaseline] = useState<GeneralSettings>(INITIAL_SETTINGS)
  const [isLocked, setIsLocked] = useState<IsLocked>({ currency: false, country: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [topError, setTopError] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [settings, baseline]
  )

  // Load on mount
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/v1/settings/general', { credentials: 'include' })
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        const json = await res.json()
        if (!active) return
        const data = json.data
        const next: GeneralSettings = {
          businessName: data.businessName ?? '',
          businessNameAr: data.businessNameAr ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          country: data.country || 'US',
          timezone: data.timezone || 'UTC',
          currency: data.currency || 'USD',
          defaultLanguage: data.defaultLanguage || 'en',
        }
        setSettings(next)
        setBaseline(next)
        setIsLocked(data.isLocked ?? { currency: false, country: false })
      } catch (err) {
        console.error('Error loading settings:', err)
        if (active) setTopError(t('saveError'))
      } finally {
        if (active) setInitialLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  // beforeunload guard for unsaved edits
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore the returned string but still show a generic prompt
      // when preventDefault is called and returnValue is set.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    setFieldErrors({})
    setTopError(null)
    try {
      const res = await fetch('/api/v1/settings/general', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify(settings),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors)
        setTopError(json.error || t('saveError'))
        return
      }

      const data = json.data
      const next: GeneralSettings = {
        businessName: data.businessName ?? '',
        businessNameAr: data.businessNameAr ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        country: data.country,
        timezone: data.timezone,
        currency: data.currency,
        defaultLanguage: data.defaultLanguage,
      }
      setSettings(next)
      setBaseline(next)
      setIsLocked(data.isLocked ?? isLocked)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setTopError(t('saveError'))
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return <SkeletonForm />
  }

  return (
    <div className="max-w-4xl">
      {topError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger-text"
        >
          {topError}
        </div>
      )}

      {/* Business Information Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          {t('businessInfo')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={`${t('businessName')} (English)`} error={fieldErrors.businessName}>
            <CmxInput
              type="text"
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              placeholder="My Laundry Business"
            />
          </Field>

          <Field label={`${t('businessName')} (العربية)`} error={fieldErrors.businessNameAr}>
            <CmxInput
              type="text"
              value={settings.businessNameAr}
              onChange={(e) => setSettings({ ...settings, businessNameAr: e.target.value })}
              placeholder="مغسلة الملابس"
              dir="rtl"
            />
          </Field>

          <Field
            label={
              <>
                <Mail className="inline h-4 w-4 me-1" />
                {t('email')}
              </>
            }
            error={fieldErrors.email}
          >
            <CmxInput
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              dir="ltr"
              placeholder="info@business.com"
            />
          </Field>

          <Field
            label={
              <>
                <Phone className="inline h-4 w-4 me-1" />
                {t('phone')}
              </>
            }
            error={fieldErrors.phone}
          >
            <CmxPhoneInput
              value={settings.phone}
              onChange={(e164) => setSettings({ ...settings, phone: e164 })}
              defaultCountry={dialCodeToDefaultCountry(settings.country)}
              disabled={loading}
            />
          </Field>

          <Field
            className="md:col-span-2"
            label={
              <>
                <MapPin className="inline h-4 w-4 me-1" />
                {t('address')}
              </>
            }
            error={fieldErrors.address}
          >
            <CmxInput
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="123 Main Street"
            />
          </Field>

          <Field label={t('city')} error={fieldErrors.city}>
            <CmxInput
              type="text"
              value={settings.city}
              onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              placeholder="New York"
            />
          </Field>

          <Field
            label={
              <span className="inline-flex items-center gap-1">
                {t('country')}
                {isLocked.country && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
            }
            error={fieldErrors.country}
            hint={isLocked.country ? t('error.settingLocked') : undefined}
          >
            <CmxSelect
              value={settings.country}
              disabled={isLocked.country}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              options={[
                { value: 'US', label: 'United States' },
                { value: 'OM', label: 'Oman' },
                { value: 'SA', label: 'Saudi Arabia' },
                { value: 'AE', label: 'United Arab Emirates' },
                { value: 'KW', label: 'Kuwait' },
                { value: 'BH', label: 'Bahrain' },
                { value: 'QA', label: 'Qatar' },
              ]}
            />
          </Field>
        </div>
      </div>

      {/* Regional Settings Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          {t('regionalSettings')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label={
              <>
                <Clock className="inline h-4 w-4 me-1" />
                {t('timezone')}
              </>
            }
            error={fieldErrors.timezone}
          >
            <CmxSelect
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              options={[
                { value: 'UTC', label: 'UTC (UTC+0)' },
                { value: 'Asia/Muscat', label: 'Asia/Muscat (GMT+4)' },
                { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
                { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
                { value: 'Asia/Kuwait', label: 'Asia/Kuwait (GMT+3)' },
                { value: 'Asia/Bahrain', label: 'Asia/Bahrain (GMT+3)' },
                { value: 'Asia/Qatar', label: 'Asia/Qatar (GMT+3)' },
              ]}
            />
          </Field>

          <Field
            label={
              <span className="inline-flex items-center gap-1">
                <DollarSign className="inline h-4 w-4 me-1" />
                {t('currency')}
                {isLocked.currency && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
            }
            error={fieldErrors.currency}
            hint={isLocked.currency ? t('error.settingLocked') : undefined}
          >
            <CmxSelect
              value={settings.currency}
              disabled={isLocked.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              options={[
                { value: 'USD', label: 'USD - US Dollar' },
                { value: 'SAR', label: 'SAR - Saudi Riyal' },
                { value: 'OMR', label: 'OMR - Omani Rial' },
                { value: 'AED', label: 'AED - UAE Dirham' },
                { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
                { value: 'BHD', label: 'BHD - Bahraini Dinar' },
                { value: 'QAR', label: 'QAR - Qatari Riyal' },
              ]}
            />
          </Field>

          <Field label={t('language')} error={fieldErrors.defaultLanguage}>
            <CmxSelect
              value={settings.defaultLanguage}
              onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'العربية (Arabic)' },
              ]}
            />
          </Field>
        </div>
      </div>

      {/* Business Hours Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          {t('businessHours')}
        </h2>

        <p className="text-sm text-muted-foreground mb-4">{t('calendar.movedFromGeneral')}</p>
        <CmxButton asChild variant="outline">
          <Link href="/dashboard/settings/calendar">{t('calendar.openPage')}</Link>
        </CmxButton>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        <span className="sr-only" role="status" aria-live="polite">
          {saved ? t('saveSuccess') : ''}
        </span>
        {saved && (
          <span className="text-sm text-success-text font-medium">
            ✓ {t('saveSuccess')}
          </span>
        )}
        <CmxButton
          type="button"
          variant="primary"
          size="lg"
          onClick={handleSave}
          loading={loading}
          disabled={loading || !isDirty}
        >
          <Save className="h-5 w-5 me-2" aria-hidden="true" />
          {loading ? t('saving') : t('saveChanges')}
        </CmxButton>
      </div>
    </div>
  )
}

// ---------- Local field & skeleton helpers (kept inline; trivial wrappers) ----------

function Field({
  label,
  children,
  error,
  hint,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  error?: string
  hint?: string
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SkeletonForm() {
  return (
    <div className="max-w-4xl animate-pulse">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <div className="h-5 w-40 bg-muted rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-muted rounded mb-2" />
              <div className="h-10 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <div className="h-5 w-40 bg-muted rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-muted rounded mb-2" />
              <div className="h-10 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
