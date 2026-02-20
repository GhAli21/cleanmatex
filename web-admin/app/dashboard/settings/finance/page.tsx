'use client'

/**
 * Finance Settings Page
 * 
 * Manages financial and tax settings:
 * - Tax rate configuration
 * - Tax type (VAT, Sales Tax, GST, etc.)
 * - Tax exemption rules (future)
 * 
 * Features:
 * - Form validation
 * - Real-time updates
 * - Bilingual support (EN/AR)
 * - RTL-aware layout
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Save, DollarSign, Info, AlertCircle } from 'lucide-react'
import { showSuccessToast, showErrorToast } from '@/src/ui/feedback/cmx-toast'
import { CmxInput } from '@ui/primitives'
import { CmxCard } from '@ui/primitives/cmx-card'
import { CmxButton } from '@ui/primitives'

interface TaxSettings {
  taxRate: number
  taxType: string
  lastUpdated?: string
  lastUpdatedBy?: string
}

const TAX_TYPES = [
  { value: 'VAT', label: 'VAT (Value Added Tax)', label2: 'ضريبة القيمة المضافة' },
  { value: 'SALES_TAX', label: 'Sales Tax', label2: 'ضريبة المبيعات' },
  { value: 'GST', label: 'GST (Goods and Services Tax)', label2: 'ضريبة السلع والخدمات' },
  { value: 'NONE', label: 'No Tax', label2: 'بدون ضريبة' },
]

export default function FinanceSettingsPage() {
  const t = useTranslations('settings')
  const isRTL = useRTL()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<TaxSettings>({
    taxRate: 0.05,
    taxType: 'VAT',
  })
  const [error, setError] = useState<string | null>(null)

  // Load current tax settings
  useEffect(() => {
    loadTaxSettings()
  }, [])

  async function loadTaxSettings() {
    setLoading(true)
    setError(null)
    try {
      // Get effective settings
      const res = await fetch('/api/settings/tenants/me/effective')
      const json = await res.json()

      if (!res.ok) throw new Error(json?.error || 'Failed to load tax settings')

      // Find TAX_RATE setting
      const taxRateSetting = json.data?.find((s: any) => s.stngCode === 'TAX_RATE')

      if (taxRateSetting) {
        const rate = parseFloat(taxRateSetting.stngValue || '0.05')
        setSettings({
          taxRate: isNaN(rate) ? 0.05 : rate,
          taxType: 'VAT', // Default, can be extended later
          lastUpdated: taxRateSetting.computedAt,
          lastUpdatedBy: taxRateSetting.stngSourceId,
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tax settings')
      console.error('Error loading tax settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Validate tax rate
      if (settings.taxRate < 0 || settings.taxRate > 1) {
        throw new Error('Tax rate must be between 0 and 1 (e.g., 0.05 for 5%)')
      }

      // Update tax rate setting
      const res = await fetch('/api/settings/tenants/me/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settingCode: 'TAX_RATE',
          value: settings.taxRate.toString(),
          overrideReason: 'Tax rate updated via Finance Settings',
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to update tax rate')

      showSuccessToast('Tax settings updated successfully')

      // Reload to get updated info
      await loadTaxSettings()
    } catch (err: any) {
      setError(err.message || 'Failed to save tax settings')
      showErrorToast(err.message || 'Failed to save tax settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading tax settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <CmxCard className="p-6">
        <div className={`flex items-center gap-3 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="p-2 bg-blue-50 rounded-lg">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tax Configuration</h2>
            <p className="text-sm text-gray-500">Configure tax rates and tax type for your business</p>
          </div>
        </div>

        {error && (
          <div className={`mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Current Tax Rate Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div>
                <p className="text-sm font-medium text-blue-900">Current Tax Rate</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {(settings.taxRate * 100).toFixed(2)}%
                </p>
              </div>
              <div className={`text-right ${isRTL ? 'text-left' : 'text-right'}`}>
                {settings.lastUpdated && (
                  <>
                    <p className="text-xs text-blue-700">Last updated</p>
                    <p className="text-xs text-blue-600">
                      {new Date(settings.lastUpdated).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tax Rate Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Rate (Decimal)
            </label>
            <div className="relative">
              <CmxInput
                type="number"
                step="0.001"
                min="0"
                max="1"
                value={settings.taxRate}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  if (!isNaN(value) && value >= 0 && value <= 1) {
                    setSettings({ ...settings, taxRate: value })
                  }
                }}
                className="w-full"
                placeholder="0.05"
                required
              />
              <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} h-full flex items-center px-3 pointer-events-none`}>
                <span className="text-gray-500 text-sm">
                  ({(settings.taxRate * 100).toFixed(2)}%)
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter as decimal (e.g., 0.05 for 5% VAT). Range: 0.000 to 1.000
            </p>
          </div>

          {/* Tax Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Type
            </label>
            <select
              value={settings.taxType}
              onChange={(e) => setSettings({ ...settings, taxType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TAX_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the type of tax applicable in your region
            </p>
          </div>

          {/* Info Box */}
          <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Info className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-gray-700">
              <p className="font-medium mb-1">Tax Rate Information</p>
              <ul className={`list-disc list-inside space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <li>Tax rate is applied to all order items unless exempt</li>
                <li>Changes take effect immediately for new orders</li>
                <li>Existing orders retain their original tax rate</li>
                <li>Tax exemptions can be configured per product or customer (coming soon)</li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton
              type="submit"
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Tax Settings'}
            </CmxButton>
          </div>
        </form>
      </CmxCard>
    </div>
  )
}

