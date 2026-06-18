'use client'

/**
 * Branding Settings Page
 *
 * Manages brand identity:
 * - Logo upload (real MinIO upload via /api/v1/settings/branding/logo)
 * - Brand colors (primary, secondary, accent)
 * - Theme preview
 *
 * UX:
 * - Loads on mount with skeleton
 * - Optimistic logo preview while upload is in flight; rolls back on failure
 * - Save is disabled while pristine, dirty edits warn on page unload
 * - Inline server-side field errors
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Palette, Loader2 } from 'lucide-react'
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token'

interface BrandingSettings {
  logo: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
}

const DEFAULTS: BrandingSettings = {
  logo: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
  accentColor: '#F59E0B',
}

const HEX = /^#[0-9A-Fa-f]{6}$/

/**
 *
 */
export default function BrandingSettingsPage() {
  const t = useTranslations('settings')
  const { token: csrfToken } = useCSRFToken()
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULTS)
  const [baseline, setBaseline] = useState<BrandingSettings>(DEFAULTS)
  const [previewLogo, setPreviewLogo] = useState<string | null>(null) // optimistic DataURL
  const [uploading, setUploading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [topError, setTopError] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [settings, baseline]
  )

  // Effective image source: optimistic preview wins until upload commits
  const displayedLogo = previewLogo ?? settings.logo

  // Load on mount
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/v1/settings/branding', { credentials: 'include' })
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        const json = await res.json()
        if (!active) return
        const data = json.data
        const next: BrandingSettings = {
          logo: data.logo ?? '',
          primaryColor: data.primaryColor || DEFAULTS.primaryColor,
          secondaryColor: data.secondaryColor || DEFAULTS.secondaryColor,
          accentColor: data.accentColor || DEFAULTS.accentColor,
        }
        setSettings(next)
        setBaseline(next)
      } catch (err) {
        console.error('Error loading branding:', err)
        if (active) setTopError(t('saveError'))
      } finally {
        if (active) setInitialLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  // beforeunload guard
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Optimistic local preview
    const reader = new FileReader()
    reader.onloadend = () => setPreviewLogo(reader.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    setFieldErrors((prev) => ({ ...prev, logo: '' }))
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/v1/settings/branding/logo', {
        method: 'POST',
        credentials: 'include',
        headers: { ...getCSRFHeader(csrfToken) },
        body: form,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        setPreviewLogo(null) // rollback
        setFieldErrors((prev) => ({ ...prev, logo: json.error || t('saveError') }))
        return
      }
      setSettings((prev) => ({ ...prev, logo: json.url }))
      setPreviewLogo(null)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setPreviewLogo(null)
      setFieldErrors((prev) => ({ ...prev, logo: t('saveError') }))
    } finally {
      setUploading(false)
      // Reset input value so re-selecting the same file fires onChange again
      e.target.value = ''
    }
  }

  // Quick client-side gate so users see hex errors before round-tripping
  const clientSideHexErrors = (): Record<string, string> => {
    const errs: Record<string, string> = {}
    if (!HEX.test(settings.primaryColor)) errs.primaryColor = t('colors.invalid')
    if (!HEX.test(settings.secondaryColor)) errs.secondaryColor = t('colors.invalid')
    if (!HEX.test(settings.accentColor)) errs.accentColor = t('colors.invalid')
    return errs
  }

  const handleSave = async () => {
    const local = clientSideHexErrors()
    if (Object.keys(local).length > 0) {
      setFieldErrors(local)
      return
    }
    setLoading(true)
    setSaved(false)
    setFieldErrors({})
    setTopError(null)
    try {
      const res = await fetch('/api/v1/settings/branding', {
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
      const data = json.data as BrandingSettings
      setSettings(data)
      setBaseline(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error saving branding:', err)
      setTopError(t('saveError'))
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return <SkeletonForm />
  }

  return (
    <div className="max-w-4xl space-y-6">
      {topError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {topError}
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('logo')}</h2>

        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 relative">
            {displayedLogo ? (
               
              <img
                src={displayedLogo}
                alt="Logo"
                className="w-32 h-32 object-contain border-2 border-gray-200 rounded-lg bg-white"
              />
            ) : (
              <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-sm">{t('noLogo')}</span>
              </div>
            )}
            {uploading && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60"
                aria-live="polite"
              >
                <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <label className="block">
              <span className="sr-only">{t('uploadLogo')}</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
            </label>
            <p className="mt-2 text-sm text-gray-500">{t('logoGuidelines')}</p>
            {fieldErrors.logo && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.logo}</p>
            )}
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t('brandColors')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ColorField
            label={t('primaryColor')}
            value={settings.primaryColor}
            error={fieldErrors.primaryColor}
            onChange={(v) => setSettings({ ...settings, primaryColor: v })}
            placeholder="#3B82F6"
          />
          <ColorField
            label={t('secondaryColor')}
            value={settings.secondaryColor}
            error={fieldErrors.secondaryColor}
            onChange={(v) => setSettings({ ...settings, secondaryColor: v })}
            placeholder="#10B981"
          />
          <ColorField
            label={t('accentColor')}
            value={settings.accentColor}
            error={fieldErrors.accentColor}
            onChange={(v) => setSettings({ ...settings, accentColor: v })}
            placeholder="#F59E0B"
          />
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('preview')}</h2>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              style={{ backgroundColor: settings.primaryColor }}
              className="px-4 py-2 text-white rounded-md font-medium"
            >
              {t('primaryButton')}
            </button>
            <button
              style={{ backgroundColor: settings.secondaryColor }}
              className="px-4 py-2 text-white rounded-md font-medium"
            >
              {t('secondaryButton')}
            </button>
            <button
              style={{ backgroundColor: settings.accentColor }}
              className="px-4 py-2 text-white rounded-md font-medium"
            >
              {t('accentButton')}
            </button>
          </div>

          <div className="border-2 rounded-lg p-4" style={{ borderColor: settings.primaryColor }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.primaryColor }} />
              <h3 className="font-semibold text-gray-900">{t('sampleCard')}</h3>
            </div>
            <p className="text-sm text-gray-600">{t('previewText')}</p>
          </div>
        </div>
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
          disabled={loading || !isDirty || uploading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Save className="h-5 w-5" />
          {loading ? t('saving') : t('saveChanges')}
        </button>
      </div>
    </div>
  )
}

// ---------- helpers ----------

function ColorField({
  label,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  error?: string
  placeholder?: string
  onChange: (next: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
          aria-label={`${label} (color picker)`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono uppercase"
          placeholder={placeholder}
          aria-label={`${label} (hex)`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function SkeletonForm() {
  return (
    <div className="max-w-4xl space-y-6 animate-pulse">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
        <div className="flex items-start gap-6">
          <div className="w-32 h-32 bg-gray-100 rounded-lg" />
          <div className="flex-1">
            <div className="h-10 w-full bg-gray-100 rounded mb-2" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-12 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
