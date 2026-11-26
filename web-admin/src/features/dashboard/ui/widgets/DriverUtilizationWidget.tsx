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
import { useDashboardZone } from '../use-dashboard-zone'

interface DriverData {
  activePct: number
  totalDrivers: number
  activeDrivers: number
  avgDeliveriesPerDriver: number
}

/**
 *
 */
export function DriverUtilizationWidget() {
  const { currentTenant } = useAuth()
  const { organization, isPending } = useDashboardZone()
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
      if (!currentTenant || isPending) return

      try {
        setIsLoading(true)
        const kpiData = await dashboardService.getKPIOverview(
          currentTenant.tenant_id,
          { timeZone: organization }
        )

        setData({
          activePct: kpiData.drivers.activePct,
          totalDrivers: kpiData.drivers.totalDrivers,
          activeDrivers: kpiData.drivers.activeDrivers,
          avgDeliveriesPerDriver: kpiData.drivers.avgDeliveriesPerDriver,
        })
      } catch (error) {
        console.error('Error fetching driver utilization data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant, organization, isPending])

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {t('driverUtilization')}
        </h3>
        <div className="p-2 rounded-lg bg-warning-bg text-warning-text">
          <Truck className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Utilization Rate */}
        <div>
          <p className="text-sm text-muted-foreground">{t('utilizationRate')}</p>
          <p className="text-2xl font-bold text-foreground">
            {data.activePct.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.activePct >= 80
                  ? 'bg-success'
                  : data.activePct >= 50
                  ? 'bg-warning'
                  : 'bg-destructive'
              }`}
              style={{ width: `${Math.min(data.activePct, 100)}%` }}
            />
          </div>
        </div>

        {/* Driver Stats */}
        <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
          {/* Active Drivers */}
          <div>
            <div className="flex items-center mb-1">
              <Users className="h-4 w-4 text-muted-foreground me-1" />
              <p className="text-xs text-muted-foreground">{t('activeNow')}</p>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {data.activeDrivers} / {data.totalDrivers}
            </p>
          </div>

          {/* Avg Deliveries */}
          <div>
            <div className="flex items-center mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground me-1" />
              <p className="text-xs text-muted-foreground">{t('avgDeliveries')}</p>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {data.avgDeliveriesPerDriver.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Action Link */}
        <div className="pt-4 border-t border-border">
          <a
            href="/drivers"
            className="text-sm text-primary-text hover:text-primary-text/80 font-medium"
          >
            {t('manageDrivers')} {isRTL ? '←' : '→'}
          </a>
        </div>
      </div>
    </div>
  )
}
