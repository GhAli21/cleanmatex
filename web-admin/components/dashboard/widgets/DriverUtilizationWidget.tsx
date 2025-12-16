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
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900">
          {t('driverUtilization')}
        </h3>
        <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
          <Truck className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Utilization Rate */}
        <div>
          <p className="text-sm text-gray-600">{t('utilizationRate')}</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.activePct.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.activePct >= 80
                  ? 'bg-green-500'
                  : data.activePct >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(data.activePct, 100)}%` }}
            />
          </div>
        </div>

        {/* Driver Stats */}
        <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
          {/* Active Drivers */}
          <div>
            <div className={`flex items-center mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Users className={`h-4 w-4 text-gray-400 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              <p className="text-xs text-gray-600">{t('activeNow')}</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {data.activeDrivers} / {data.totalDrivers}
            </p>
          </div>

          {/* Avg Deliveries */}
          <div>
            <div className={`flex items-center mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <TrendingUp className={`h-4 w-4 text-gray-400 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              <p className="text-xs text-gray-600">{t('avgDeliveries')}</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {data.avgDeliveriesPerDriver.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Action Link */}
        <div className="pt-4 border-t border-gray-200">
          <a
            href="/drivers"
            className={`text-sm text-blue-600 hover:text-blue-700 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {t('manageDrivers')} {isRTL ? '←' : '→'}
          </a>
        </div>
      </div>
    </div>
  )
}
