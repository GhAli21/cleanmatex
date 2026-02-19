'use client'

/**
 * Top Services Widget
 *
 * Displays top performing services by revenue with bar chart
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Star, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ServiceData {
  name: string
  amount: number
  count?: number
}

export function TopServicesWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState<ServiceData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        const kpiData = await dashboardService.getKPIOverview(
          currentTenant.tenant_id
        )

        setData(kpiData.topServices)
      } catch (error) {
        console.error('Error fetching top services data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-OM', {
      style: 'currency',
      currency: 'OMR',
      minimumFractionDigits: 3,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  const hasData = data && data.length > 0

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900">{t('topServices')}</h3>
        <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
          <Star className="h-5 w-5" />
        </div>
      </div>

      {hasData ? (
        <div className="space-y-4">
          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Service List */}
          <div className="space-y-2">
            {data.slice(0, 5).map((service, index) => (
              <div
                key={service.name}
                className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold ${isRTL ? 'ml-3' : 'mr-3'}`}>
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-700 line-clamp-1 break-words">{service.name}</span>
                </div>
                <div className={isRTL ? 'text-left' : 'text-right'}>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(service.amount)}
                  </p>
                  {service.count && (
                    <p className="text-xs text-gray-600">{t('ordersCount', { count: service.count })}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* View All Link */}
          <div className="pt-4 border-t border-gray-200">
            <a
              href="/reports/services"
              className={`text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              {t('viewDetailedReport')}
              <TrendingUp className={`h-4 w-4 ${isRTL ? 'mr-1' : 'ml-1'}`} />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Star className="h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">{t('noServiceData')}</p>
        </div>
      )}
    </div>
  )
}
