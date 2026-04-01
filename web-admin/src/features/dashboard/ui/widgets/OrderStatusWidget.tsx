'use client'

/**
 * Order Status Widget
 *
 * Displays order counts by status (In Process, Ready, Out for Delivery)
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Clock, CheckCircle, Truck } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

export function OrderStatusWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState({
    inProcess: 0,
    ready: 0,
    outForDelivery: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        const statusCounts = await dashboardService.getOrdersByStatus(
          currentTenant.tenant_id
        )

        setData({
          inProcess: statusCounts['PROCESSING'] || 0,
          ready: statusCounts['READY'] || 0,
          outForDelivery: statusCounts['OUT_FOR_DELIVERY'] || 0,
        })
      } catch (error) {
        console.error('Error fetching order status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="win2k-panel" style={{ padding: '6px 10px' }}>
            <div style={{ height: 10, background: '#c0bdb5', marginBottom: 6, width: '60%' }} />
            <div className="win2k-inset" style={{ padding: '4px 8px' }}>
              <div style={{ height: 18, background: '#e0e0e0', width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const statuses = [
    { label: t('inProcess'), value: data.inProcess, detail: t('currentlyProcessing'), color: 'var(--win2k-titlebar-start)', Icon: Clock },
    { label: t('ready'), value: data.ready, detail: t('readyForPickup'), color: '#006400', Icon: CheckCircle },
    { label: t('outForDelivery'), value: data.outForDelivery, detail: t('enRoute'), color: '#886600', Icon: Truck },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 4 }}>
      {statuses.map(({ label, value, detail, color, Icon }) => (
        <div key={label} className="win2k-panel" style={{ padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <p className="win2k-label">{label}</p>
            <div style={{ border: '2px solid', borderColor: 'var(--win2k-dark-shadow) var(--win2k-light) var(--win2k-light) var(--win2k-dark-shadow)', padding: 2, background: 'var(--win2k-face)' }}>
              <Icon style={{ width: 12, height: 12, color }} />
            </div>
          </div>
          <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 4 }}>
            <p className="win2k-value" style={{ color }}>{value}</p>
          </div>
          <p className="win2k-text" style={{ color: '#555' }}>{detail}</p>
        </div>
      ))}
    </div>
  )
}
