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
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* In Process */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="text-sm font-medium text-gray-600">{t('inProcess')}</p>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900">{data.inProcess}</p>
        <p className="mt-2 text-sm text-gray-600">{t('currentlyProcessing')}</p>
      </div>

      {/* Ready */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="text-sm font-medium text-gray-600">{t('ready')}</p>
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900">{data.ready}</p>
        <p className="mt-2 text-sm text-gray-600">{t('readyForPickup')}</p>
      </div>

      {/* Out for Delivery */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="text-sm font-medium text-gray-600">{t('outForDelivery')}</p>
          <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
            <Truck className="h-5 w-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900">{data.outForDelivery}</p>
        <p className="mt-2 text-sm text-gray-600">{t('enRoute')}</p>
      </div>
    </div>
  )
}
