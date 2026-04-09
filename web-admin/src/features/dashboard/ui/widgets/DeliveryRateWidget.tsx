'use client'

/**
 * Delivery Rate Widget
 *
 * Displays delivery success metrics and pending deliveries
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Truck, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { StatCard } from '../Widget'

interface DeliveryData {
  successRate: number
  totalDeliveries: number
  pendingDeliveries: number
  failedDeliveries: number
}

export function DeliveryRateWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState<DeliveryData>({
    successRate: 0,
    totalDeliveries: 0,
    pendingDeliveries: 0,
    failedDeliveries: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)

        // TODO: Implement actual delivery metrics query
        // For now using mock data
        setData({
          successRate: 0,
          totalDeliveries: 0,
          pendingDeliveries: 0,
          failedDeliveries: 0,
        })
      } catch (error) {
        console.error('Error fetching delivery data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', width: '60%', marginBottom: 6 }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '70%' }} /></div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {/* Success Rate */}
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 6 }}>
        <p className="win2k-label" style={{ marginBottom: 2 }}>{t('successRate')}</p>
        <p className="win2k-value">{data.successRate.toFixed(1)}%</p>
      </div>
      <div className="win2k-progress-track" style={{ marginBottom: 6 }}>
        <div className="win2k-progress-fill" style={{ width: `${Math.min(data.successRate, 100)}%` }} />
      </div>
      <hr className="win2k-separator" />
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 6 }}>
        {[
          { label: t('total'), value: data.totalDeliveries, color: 'var(--win2k-titlebar-start)' },
          { label: t('pending'), value: data.pendingDeliveries, color: '#886600' },
          { label: t('failed'), value: data.failedDeliveries, color: '#cc0000' },
        ].map(({ label, value, color }) => (
          <div key={label} className="win2k-inset" style={{ padding: '3px 6px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Courier New, monospace', fontSize: 14, fontWeight: 'bold', color }}>{value}</p>
            <p className="win2k-text">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
