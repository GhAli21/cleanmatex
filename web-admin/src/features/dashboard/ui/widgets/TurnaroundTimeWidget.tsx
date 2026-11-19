'use client'

/**
 * Turnaround Time Widget
 *
 * Displays average turnaround time (TAT) and on-time delivery percentage
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, Target } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

interface TATData {
  avgTATHours: number
  onTimePct: number
  trend?: number
}

/**
 *
 */
export function TurnaroundTimeWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
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
          trend: kpiData.sla.trendPct,
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
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('turnaroundTime')}</h3>
        <div className="p-2 rounded-lg bg-info-bg text-info-text">
          <Clock className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Average TAT */}
        <div>
          <p className="text-sm text-muted-foreground">{t('averageTAT')}</p>
          <p className="text-2xl font-bold text-foreground">
            {formatTAT(data.avgTATHours)}
          </p>
          {data.trend !== undefined && data.trend !== 0 && (
            <p
              className={`text-sm mt-1 ${
                data.trend < 0 ? 'text-success-text' : 'text-danger-text'
              }`}
            >
              {data.trend < 0 ? '↓' : '↑'} {Math.abs(data.trend)}% {t('fromLastWeek')}
            </p>
          )}
        </div>

        {/* On-Time Delivery */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">{t('onTimeDelivery')}</p>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline">
            <p className="text-xl font-semibold text-foreground">
              {data.onTimePct.toFixed(1)}%
            </p>
          </div>
          {/* Progress Bar */}
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.onTimePct >= 90
                  ? 'bg-success'
                  : data.onTimePct >= 75
                  ? 'bg-warning'
                  : 'bg-destructive'
              }`}
              style={{ width: `${Math.min(data.onTimePct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
