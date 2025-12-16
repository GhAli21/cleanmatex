'use client'

/**
 * Branding Settings Page
 *
 * Manages brand identity:
 * - Logo upload
 * - Brand colors (primary, secondary, accent)
 * - Theme preview
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Palette } from 'lucide-react'

export default function BrandingSettingsPage() {
  const t = useTranslations('settings')
  const [settings, setSettings] = useState({
    logo: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B'
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSettings({ ...settings, logo: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)

    try {
      // TODO: API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Logo Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('logo')}</h2>

        <div className="flex items-start gap-6">
          {/* Logo Preview */}
          <div className="flex-shrink-0">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className="w-32 h-32 object-contain border-2 border-gray-200 rounded-lg" />
            ) : (
              <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-sm">{t('noLogo')}</span>
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1">
            <label className="block">
              <span className="sr-only">{t('uploadLogo')}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </label>
            <p className="mt-2 text-sm text-gray-500">{t('logoGuidelines')}</p>
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
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('primaryColor')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono uppercase"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('secondaryColor')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.secondaryColor}
                onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondaryColor}
                onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono uppercase"
                placeholder="#10B981"
              />
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('accentColor')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                className="h-12 w-12 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono uppercase"
                placeholder="#F59E0B"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('preview')}</h2>

        <div className="space-y-4">
          {/* Button Previews */}
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

          {/* Card Preview */}
          <div className="border-2 rounded-lg p-4" style={{ borderColor: settings.primaryColor }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.primaryColor }}></div>
              <h3 className="font-semibold text-gray-900">{t('sampleCard')}</h3>
            </div>
            <p className="text-sm text-gray-600">{t('previewText')}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            ✓ {t('saveSuccess')}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          <Save className="h-5 w-5" />
          {loading ? t('saving') : t('saveChanges')}
        </button>
      </div>
    </div>
  )
}
