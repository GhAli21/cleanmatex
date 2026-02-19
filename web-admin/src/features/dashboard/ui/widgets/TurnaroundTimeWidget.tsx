'use client'

/**
 * Turnaround Time Widget
 *
 * Displays average turnaround time (TAT) and on-time delivery percentage
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Clock, Target } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

interface TATData {
  avgTATHours: number
  onTimePct: number
  trend?: number
}

export function TurnaroundTimeWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState<TATData>({
    avgTATHours: 0,
    onTimePct: 0,
    trend: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        const kpiData = await dashboardService.getKPIOverview(
          currentTenant.tenant_id
        )

        setData({
          avgTATHours: kpiData.sla.avgTATHours,
          onTimePct: kpiData.sla.onTimePct,
          trend: 0, // TODO: Calculate trend from historical data
        })
      } catch (error) {
        console.error('Error fetching TAT data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  const formatTAT = (hours: number): string => {
    if (hours < 24) {
      return `${hours.toFixed(1)} ${t('hours')}`
    }
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours > 0
      ? `${days}${t('days').charAt(0)} ${remainingHours.toFixed(0)}${t('hours').charAt(0)}`
      : `${days} ${t('days')}`
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900">{t('turnaroundTime')}</h3>
        <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
          <Clock className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Average TAT */}
        <div>
          <p className="text-sm text-gray-600">{t('averageTAT')}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatTAT(data.avgTATHours)}
          </p>
          {data.trend !== undefined && data.trend !== 0 && (
            <p
              className={`text-sm mt-1 ${
                data.trend < 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {data.trend < 0 ? '↓' : '↑'} {Math.abs(data.trend)}% {t('fromLastWeek')}
            </p>
          )}
        </div>

        {/* On-Time Delivery */}
        <div className="pt-4 border-t border-gray-200">
          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="text-sm text-gray-600">{t('onTimeDelivery')}</p>
            <Target className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-baseline">
            <p className="text-xl font-semibold text-gray-900">
              {data.onTimePct.toFixed(1)}%
            </p>
          </div>
          {/* Progress Bar */}
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.onTimePct >= 90
                  ? 'bg-green-500'
                  : data.onTimePct >= 75
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(data.onTimePct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
