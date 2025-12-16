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
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900">{t('deliveryRate')}</h3>
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
          <Truck className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Success Rate */}
        <div>
          <p className="text-sm text-gray-600">{t('successRate')}</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.successRate.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{ width: `${Math.min(data.successRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Delivery Stats */}
        <div className="pt-4 border-t border-gray-200 grid grid-cols-3 gap-4">
          {/* Total */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Truck className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {data.totalDeliveries}
            </p>
            <p className="text-xs text-gray-600">{t('total')}</p>
          </div>

          {/* Pending */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {data.pendingDeliveries}
            </p>
            <p className="text-xs text-gray-600">{t('pending')}</p>
          </div>

          {/* Failed */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {data.failedDeliveries}
            </p>
            <p className="text-xs text-gray-600">{t('failed')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
