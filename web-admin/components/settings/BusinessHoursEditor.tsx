'use client'

/**
 * Business Hours Editor Component
 *
 * Allows editing of business operating hours for each day of the week
 *
 * Features:
 * - Open/close time selection for each day
 * - Closed day toggle
 * - Copy hours to all days
 * - Bilingual day names (EN/AR)
 * - RTL-aware layout
 */

import { useTranslations } from 'next-intl'
import { Copy } from 'lucide-react'

export interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean }
}

interface BusinessHoursEditorProps {
  hours: BusinessHours
  onChange: (hours: BusinessHours) => void
}

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]

export function BusinessHoursEditor({ hours, onChange }: BusinessHoursEditorProps) {
  const t = useTranslations('settings')

  const updateDay = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    onChange({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value
      }
    })
  }

  const copyToAll = (day: string) => {
    const template = hours[day]
    const newHours = { ...hours }
    DAYS.forEach(d => {
      newHours[d] = { ...template }
    })
    onChange(newHours)
  }

  const getDayName = (day: string) => {
    const dayNames: Record<string, string> = {
      monday: t('monday'),
      tuesday: t('tuesday'),
      wednesday: t('wednesday'),
      thursday: t('thursday'),
      friday: t('friday'),
      saturday: t('saturday'),
      sunday: t('sunday')
    }
    return dayNames[day] || day
  }

  return (
    <div className="space-y-3">
      {DAYS.map((day) => {
        const dayHours = hours[day] || { open: '09:00', close: '18:00', closed: false }

        return (
          <div
            key={day}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-50 rounded-lg"
          >
            {/* Day Name */}
            <div className="w-32 font-medium text-gray-900">
              {getDayName(day)}
            </div>

            {/* Open Time */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 min-w-[60px]">
                {t('opens')}:
              </label>
              <input
                type="time"
                value={dayHours.open}
                onChange={(e) => updateDay(day, 'open', e.target.value)}
                disabled={dayHours.closed}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Close Time */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 min-w-[60px]">
                {t('closes')}:
              </label>
              <input
                type="time"
                value={dayHours.close}
                onChange={(e) => updateDay(day, 'close', e.target.value)}
                disabled={dayHours.closed}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Closed Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dayHours.closed}
                onChange={(e) => updateDay(day, 'closed', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-sm text-gray-600">{t('closed')}</span>
            </label>

            {/* Copy to All Button */}
            <button
              onClick={() => copyToAll(day)}
              className="ml-auto sm:ml-2 flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              title={t('copyToAll')}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">{t('copyToAll')}</span>
            </button>
          </div>
        )
      })}

      {/* Info Message */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 {t('businessHoursNote')}
        </p>
      </div>
    </div>
  )
}
