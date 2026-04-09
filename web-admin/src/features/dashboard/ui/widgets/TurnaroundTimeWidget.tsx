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
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', marginBottom: 6, width: '60%' }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '50%' }} /></div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {/* Avg TAT */}
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 6 }}>
        <p className="win2k-label" style={{ marginBottom: 2 }}>{t('averageTAT')}</p>
        <p className="win2k-value">{formatTAT(data.avgTATHours)}</p>
        {data.trend !== undefined && data.trend !== 0 && (
          <p style={{ fontSize: 10, color: data.trend < 0 ? '#006400' : '#cc0000', fontWeight: 'bold' }}>
            {data.trend < 0 ? '▼' : '▲'} {Math.abs(data.trend)}% {t('fromLastWeek')}
          </p>
        )}
      </div>
      <hr className="win2k-separator" />
      {/* On-Time Delivery */}
      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <p className="win2k-label">{t('onTimeDelivery')}</p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: data.onTimePct >= 90 ? '#006400' : data.onTimePct >= 75 ? '#886600' : '#cc0000' }}>
            {data.onTimePct.toFixed(1)}%
          </p>
        </div>
        {/* Win2K-style progress bar */}
        <div className="win2k-progress-track">
          <div
            className="win2k-progress-fill"
            style={{
              width: `${Math.min(data.onTimePct, 100)}%`,
              background: data.onTimePct >= 90 ? 'repeating-linear-gradient(90deg,#006400 0px,#006400 8px,#008800 8px,#008800 10px)' : undefined,
            }}
          />
        </div>
      </div>
    </div>
  )
}
