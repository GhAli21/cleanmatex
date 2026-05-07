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
import { BusinessHoursEditor } from '@features/settings/ui/BusinessHoursEditor'
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token'

interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean }
}

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
  businessHours: BusinessHours
}

interface IsLocked {
  currency: boolean
  country: boolean
}

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '09:00', close: '14:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true }
}

const INITIAL_SETTINGS: GeneralSettings = {
  businessName: '',
  businessNameAr: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: 'OM',
  timezone: 'Asia/Muscat',
  currency: 'OMR',
  defaultLanguage: 'en',
  businessHours: DEFAULT_HOURS,
}

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
          country: data.country || 'OM',
          timezone: data.timezone || 'Asia/Muscat',
          currency: data.currency || 'OMR',
          defaultLanguage: data.defaultLanguage || 'en',
          businessHours: data.businessHours ?? DEFAULT_HOURS,
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
        businessHours: data.businessHours,
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
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {topError}
        </div>
      )}

      {/* Business Information Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-gray-600" />
          {t('businessInfo')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={`${t('businessName')} (English)`} error={fieldErrors.businessName}>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="My Laundry Business"
            />
          </Field>

          <Field label={`${t('businessName')} (العربية)`} error={fieldErrors.businessNameAr}>
            <input
              type="text"
              value={settings.businessNameAr}
              onChange={(e) => setSettings({ ...settings, businessNameAr: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="مغسلة الملابس"
              dir="rtl"
            />
          </Field>

          <Field
            label={
              <>
                <Mail className="inline h-4 w-4 mr-1" />
                {t('email')}
              </>
            }
            error={fieldErrors.email}
          >
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="info@business.com"
            />
          </Field>

          <Field
            label={
              <>
                <Phone className="inline h-4 w-4 mr-1" />
                {t('phone')}
              </>
            }
            error={fieldErrors.phone}
          >
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+968 9123 4567"
            />
          </Field>

          <Field
            className="md:col-span-2"
            label={
              <>
                <MapPin className="inline h-4 w-4 mr-1" />
                {t('address')}
              </>
            }
            error={fieldErrors.address}
          >
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="123 Main Street"
            />
          </Field>

          <Field label={t('city')} error={fieldErrors.city}>
            <input
              type="text"
              value={settings.city}
              onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Muscat"
            />
          </Field>

          <Field
            label={
              <span className="inline-flex items-center gap-1">
                {t('country')}
                {isLocked.country && <Lock className="h-3.5 w-3.5 text-gray-400" />}
              </span>
            }
            error={fieldErrors.country}
            hint={isLocked.country ? t('error.settingLocked') : undefined}
          >
            <select
              value={settings.country}
              disabled={isLocked.country}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="OM">Oman</option>
              <option value="SA">Saudi Arabia</option>
              <option value="AE">United Arab Emirates</option>
              <option value="KW">Kuwait</option>
              <option value="BH">Bahrain</option>
              <option value="QA">Qatar</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Regional Settings Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-gray-600" />
          {t('regionalSettings')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label={
              <>
                <Clock className="inline h-4 w-4 mr-1" />
                {t('timezone')}
              </>
            }
            error={fieldErrors.timezone}
          >
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Asia/Muscat">Asia/Muscat (GMT+4)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
              <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
              <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
              <option value="Asia/Bahrain">Asia/Bahrain (GMT+3)</option>
              <option value="Asia/Qatar">Asia/Qatar (GMT+3)</option>
            </select>
          </Field>

          <Field
            label={
              <span className="inline-flex items-center gap-1">
                <DollarSign className="inline h-4 w-4 mr-1" />
                {t('currency')}
                {isLocked.currency && <Lock className="h-3.5 w-3.5 text-gray-400" />}
              </span>
            }
            error={fieldErrors.currency}
            hint={isLocked.currency ? t('error.settingLocked') : undefined}
          >
            <select
              value={settings.currency}
              disabled={isLocked.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="SAR">SAR - Saudi Riyal</option>
              <option value="OMR">OMR - Omani Rial</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="KWD">KWD - Kuwaiti Dinar</option>
              <option value="BHD">BHD - Bahraini Dinar</option>
              <option value="QAR">QAR - Qatari Riyal</option>
            </select>
          </Field>

          <Field label={t('language')} error={fieldErrors.defaultLanguage}>
            <select
              value={settings.defaultLanguage}
              onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Business Hours Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600" />
          {t('businessHours')}
        </h2>

        <BusinessHoursEditor
          hours={settings.businessHours}
          onChange={(hours) => setSettings({ ...settings, businessHours: hours })}
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        <span className="sr-only" role="status" aria-live="polite">
          {saved ? t('saveSuccess') : ''}
        </span>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            ✓ {t('saveSuccess')}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={loading || !isDirty}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Save className="h-5 w-5" />
          {loading ? t('saving') : t('saveChanges')}
        </button>
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function SkeletonForm() {
  return (
    <div className="max-w-4xl animate-pulse">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-10 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-10 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
