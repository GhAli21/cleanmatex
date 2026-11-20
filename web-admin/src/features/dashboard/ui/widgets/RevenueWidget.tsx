'use client'

/**
 * Revenue Widget
 *
 * Displays revenue metrics (Today, MTD, Last 30 days)
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DollarSign, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { dashboardService } from '@/lib/services/dashboard.service'

/**
 *
 */
export function RevenueWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const { formatMoney, formatNumber } = useTenantCurrency()
  const [data, setData] = useState<{
    today: number
    mtd: number
    last30d: number
    currency: string
    trend: number
  }>({
    today: 0,
    mtd: 0,
    last30d: 0,
    currency: '',
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

  const formatRevenueMoney = (amount: number) =>
    formatMoney(amount, data.currency || undefined)

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('revenue')}</h3>
        <div className="p-2 rounded-lg bg-success-bg text-success-text">
          <DollarSign className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Today */}
        <div>
          <p className="text-sm text-muted-foreground">{t('today')}</p>
          <p className="text-2xl font-bold text-foreground">
            {formatRevenueMoney(data.today)}
          </p>
          {data.trend !== 0 && (
            <div className="flex items-center mt-1">
              <TrendingUp
                className={`h-4 w-4 me-1 ${
                  data.trend >= 0 ? 'text-success-text' : 'text-danger-text'
                }`}
              />
              <span
                className={`text-sm font-medium tabular-nums ${
                  data.trend >= 0 ? 'text-success-text' : 'text-danger-text'
                }`}
              >
                {data.trend >= 0 ? '+' : '-'}
                {formatNumber(Math.abs(data.trend))}%
              </span>
              <span className="text-sm text-muted-foreground ms-2">{t('fromYesterday')}</span>
            </div>
          )}
        </div>

        {/* MTD */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">{t('monthToDate')}</p>
          <p className="text-xl font-semibold text-foreground">
            {formatRevenueMoney(data.mtd)}
          </p>
        </div>

        {/* Last 30 Days */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">{t('last30Days')}</p>
          <p className="text-xl font-semibold text-foreground">
            {formatRevenueMoney(data.last30d)}
          </p>
        </div>
      </div>
    </div>
  )
}
