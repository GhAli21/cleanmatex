'use client'

/**
 * Driver Utilization Widget
 *
 * Displays driver activity metrics and utilization percentage
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Truck, Users, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

interface DriverData {
  activePct: number
  totalDrivers: number
  activeDrivers: number
  avgDeliveriesPerDriver: number
}

export function DriverUtilizationWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState<DriverData>({
    activePct: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    avgDeliveriesPerDriver: 0,
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
          activePct: kpiData.drivers.activePct,
          totalDrivers: 0, // TODO: Add total drivers count
          activeDrivers: 0, // TODO: Add active drivers count
          avgDeliveriesPerDriver: 0, // TODO: Add avg deliveries
        })
      } catch (error) {
        console.error('Error fetching driver utilization data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', width: '65%', marginBottom: 6 }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '60%' }} /></div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {/* Utilization Rate */}
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 6 }}>
        <p className="win2k-label" style={{ marginBottom: 2 }}>{t('utilizationRate')}</p>
        <p className="win2k-value">{data.activePct.toFixed(1)}%</p>
      </div>
      <div className="win2k-progress-track" style={{ marginBottom: 6 }}>
        <div
          className="win2k-progress-fill"
          style={{
            width: `${Math.min(data.activePct, 100)}%`,
            background: data.activePct >= 80
              ? 'repeating-linear-gradient(90deg,#006400 0,#006400 8px,#008800 8px,#008800 10px)'
              : data.activePct >= 50 ? undefined : 'repeating-linear-gradient(90deg,#cc0000 0,#cc0000 8px,#aa0000 8px,#aa0000 10px)',
          }}
        />
      </div>
      <hr className="win2k-separator" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
        <div className="win2k-inset" style={{ padding: '3px 6px' }}>
          <p className="win2k-text" style={{ color: '#555', marginBottom: 2 }}>{t('activeNow')}</p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>
            {data.activeDrivers} / {data.totalDrivers}
          </p>
        </div>
        <div className="win2k-inset" style={{ padding: '3px 6px' }}>
          <p className="win2k-text" style={{ color: '#555', marginBottom: 2 }}>{t('avgDeliveries')}</p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>
            {data.avgDeliveriesPerDriver.toFixed(1)}
          </p>
        </div>
      </div>
      <div style={{ marginTop: 6, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 4 }}>
        <a href="/drivers" style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontSize: 11 }}>
          {t('manageDrivers')} {isRTL ? '←' : '→'}
        </a>
      </div>
    </div>
  )
}
