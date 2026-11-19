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
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmount } from '@/lib/money/format-money'
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

/**
 *
 */
export function TopServicesWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const { decimalPlaces, currencyCode } = useTenantCurrency()
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

  const formatCurrency = (amount: number) =>
    formatMoneyAmount(amount, {
      currencyCode,
      decimalPlaces,
      locale: isRTL ? 'ar' : 'en',
    })

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-2/3 mb-4"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    )
  }

  const hasData = data && data.length > 0

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('topServices')}</h3>
        <div className="p-2 rounded-lg bg-warning-bg text-warning-text">
          <Star className="h-5 w-5" />
        </div>
      </div>

      {hasData ? (
        <div className="space-y-4">
          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Service List */}
          <div className="space-y-2">
            {data.slice(0, 5).map((service, index) => (
              <div
                key={service.name}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-info-bg text-info-text text-xs font-semibold me-3">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground line-clamp-1 break-words">{service.name}</span>
                </div>
                <div className="text-end">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(service.amount)}
                  </p>
                  {service.count && (
                    <p className="text-xs text-muted-foreground">{t('ordersCount', { count: service.count })}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* View All Link */}
          <div className="pt-4 border-t border-border">
            <a
              href="/reports/services"
              className="text-sm text-primary-text hover:text-primary-text/80 font-medium flex items-center"
            >
              {t('viewDetailedReport')}
              <TrendingUp className="h-4 w-4 ms-1" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Star className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t('noServiceData')}</p>
        </div>
      )}
    </div>
  )
}
