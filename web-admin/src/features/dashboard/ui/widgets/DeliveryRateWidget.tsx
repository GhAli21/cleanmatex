'use client'

/**
 * Delivery Rate Widget
 *
 * Displays delivery success metrics and pending deliveries
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Truck, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

interface DeliveryData {
  successRate: number
  totalDeliveries: number
  pendingDeliveries: number
  failedDeliveries: number
}

/**
 *
 */
export function DeliveryRateWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
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

        const kpi = await dashboardService.getKPIOverview(currentTenant.tenant_id)
        const d = kpi.delivery
        setData({
          successRate: d.successRate,
          totalDeliveries: d.totalDeliveries,
          pendingDeliveries: d.pendingDeliveries,
          failedDeliveries: d.failedDeliveries,
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
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('deliveryRate')}</h3>
        <div className="p-2 rounded-lg bg-info-bg text-info-text">
          <Truck className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Success Rate */}
        <div>
          <p className="text-sm text-muted-foreground">{t('successRate')}</p>
          <p className="text-2xl font-bold text-foreground">
            {data.successRate.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-success"
              style={{ width: `${Math.min(data.successRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Delivery Stats */}
        <div className="pt-4 border-t border-border grid grid-cols-3 gap-4">
          {/* Total */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Truck className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {data.totalDeliveries}
            </p>
            <p className="text-xs text-muted-foreground">{t('total')}</p>
          </div>

          {/* Pending */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <AlertCircle className="h-4 w-4 text-warning-text" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {data.pendingDeliveries}
            </p>
            <p className="text-xs text-muted-foreground">{t('pending')}</p>
          </div>

          {/* Failed */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <AlertCircle className="h-4 w-4 text-danger-text" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {data.failedDeliveries}
            </p>
            <p className="text-xs text-muted-foreground">{t('failed')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
