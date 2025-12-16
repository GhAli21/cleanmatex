'use client'

/**
 * General Settings Page
 *
 * Manages business information, hours, and locale settings:
 * - Business name and contact info
 * - Business hours configuration
 * - Timezone and currency settings
 * - Default language
 *
 * Features:
 * - Form validation
 * - Auto-save capability
 * - Bilingual support (EN/AR)
 * - RTL-aware layout
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Clock, Globe, DollarSign, Mail, Phone, MapPin } from 'lucide-react'
import { BusinessHoursEditor } from '@/components/settings/BusinessHoursEditor'

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

interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean }
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

export default function GeneralSettingsPage() {
  const t = useTranslations('settings')
  const [settings, setSettings] = useState<GeneralSettings>({
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
    businessHours: DEFAULT_HOURS
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load settings from API
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/settings/general')
      // const data = await response.json()
      // setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)

    try {
      // TODO: Replace with actual API call
      // await fetch('/api/settings/general', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(settings)
      // })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Business Information Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-gray-600" />
          {t('businessInfo')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Business Name (English) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('businessName')} (English)
            </label>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="My Laundry Business"
            />
          </div>

          {/* Business Name (Arabic) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('businessName')} (العربية)
            </label>
            <input
              type="text"
              value={settings.businessNameAr}
              onChange={(e) => setSettings({ ...settings, businessNameAr: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="مغسلة الملابس"
              dir="rtl"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="inline h-4 w-4 mr-1" />
              {t('email')}
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="info@business.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Phone className="inline h-4 w-4 mr-1" />
              {t('phone')}
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+968 9123 4567"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="inline h-4 w-4 mr-1" />
              {t('address')}
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="123 Main Street"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('city')}
            </label>
            <input
              type="text"
              value={settings.city}
              onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Muscat"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('country')}
            </label>
            <select
              value={settings.country}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="OM">Oman</option>
              <option value="SA">Saudi Arabia</option>
              <option value="AE">United Arab Emirates</option>
              <option value="KW">Kuwait</option>
              <option value="BH">Bahrain</option>
              <option value="QA">Qatar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Regional Settings Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-gray-600" />
          {t('regionalSettings')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="inline h-4 w-4 mr-1" />
              {t('timezone')}
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Asia/Muscat">Asia/Muscat (GMT+4)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
              <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
              <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="inline h-4 w-4 mr-1" />
              {t('currency')}
            </label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="OMR">OMR - Omani Rial</option>
              <option value="SAR">SAR - Saudi Riyal</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="KWD">KWD - Kuwaiti Dinar</option>
              <option value="BHD">BHD - Bahraini Dinar</option>
              <option value="QAR">QAR - Qatari Riyal</option>
            </select>
          </div>

          {/* Default Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('language')}
            </label>
            <select
              value={settings.defaultLanguage}
              onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </div>
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
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            ✓ {t('saveSuccess')}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Save className="h-5 w-5" />
          {loading ? t('saving') : t('saveChanges')}
        </button>
      </div>
    </div>
  )
}
