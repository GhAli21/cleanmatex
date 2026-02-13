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
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('revenue')}</h3>
        <div className="p-2 rounded-lg bg-green-50 text-green-600">
          <DollarSign className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Today */}
        <div>
          <p className="text-sm text-gray-600">{t('today')}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(data.today)}
          </p>
          {data.trend !== 0 && (
            <div className={`flex items-center mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <TrendingUp
                className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'} ${
                  data.trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  data.trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {data.trend >= 0 ? '+' : ''}
                {data.trend}%
              </span>
              <span className={`text-sm text-gray-600 ${isRTL ? 'mr-2' : 'ml-2'}`}>{t('fromYesterday')}</span>
            </div>
          )}
        </div>

        {/* MTD */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">{t('monthToDate')}</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatCurrency(data.mtd)}
          </p>
        </div>

        {/* Last 30 Days */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">{t('last30Days')}</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatCurrency(data.last30d)}
          </p>
        </div>
      </div>
    </div>
  )
}
