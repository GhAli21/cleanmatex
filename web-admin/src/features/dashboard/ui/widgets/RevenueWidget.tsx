'use client'

/**
 * Revenue Widget
 *
 * Displays revenue metrics (Today, MTD, Last 30 days)
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { DollarSign, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

export function RevenueWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState({
    today: 0,
    mtd: 0,
    last30d: 0,
    currency: 'OMR',
    trend: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        const kpi = await dashboardService.getKPIOverview(
          currentTenant.tenant_id
        )
        setData({
          today: kpi.revenue.today,
          mtd: kpi.revenue.mtd,
          last30d: kpi.revenue.last30d,
          currency: kpi.revenue.currency,
          trend: kpi.revenue.deltaToday ?? 0,
        })
      } catch (error) {
        console.error('Error fetching revenue:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-OM', {
      style: 'currency',
      currency: data.currency,
      minimumFractionDigits: 3,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', marginBottom: 6, width: '40%' }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '55%' }} /></div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {/* Today */}
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 6 }}>
        <p className="win2k-label" style={{ marginBottom: 2 }}>{t('today')}</p>
        <p className="win2k-value">{formatCurrency(data.today)}</p>
        {data.trend !== 0 && (
          <p style={{ fontSize: 10, color: data.trend >= 0 ? '#006400' : '#cc0000', fontWeight: 'bold' }}>
            {data.trend >= 0 ? '▲' : '▼'} {Math.abs(data.trend)}% {t('fromYesterday')}
          </p>
        )}
      </div>
      <hr className="win2k-separator" />
      {/* MTD */}
      <div style={{ padding: '4px 0', marginBottom: 4 }}>
        <p className="win2k-text" style={{ color: '#555' }}>{t('monthToDate')}</p>
        <p style={{ fontFamily: 'Courier New, monospace', fontSize: 15, fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>
          {formatCurrency(data.mtd)}
        </p>
      </div>
      <hr className="win2k-separator" />
      {/* Last 30 Days */}
      <div style={{ padding: '4px 0' }}>
        <p className="win2k-text" style={{ color: '#555' }}>{t('last30Days')}</p>
        <p style={{ fontFamily: 'Courier New, monospace', fontSize: 15, fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>
          {formatCurrency(data.last30d)}
        </p>
      </div>
    </div>
  )
}
