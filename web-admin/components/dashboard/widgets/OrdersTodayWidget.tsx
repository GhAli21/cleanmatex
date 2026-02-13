'use client'

/**
 * Orders Today Widget
 *
 * Displays today's order count with trend comparison
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Package, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'
import { StatCard } from '../Widget'

export function OrdersTodayWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const [data, setData] = useState({
    count: 0,
    trend: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        const count = await dashboardService.getTodayOrdersCount(
          currentTenant.tenant_id
        )
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayCount =
          await dashboardService.getOrdersCountForDate(
            currentTenant.tenant_id,
            yesterday
          )
        const trend =
          yesterdayCount > 0
            ? Math.round(((count - yesterdayCount) / yesterdayCount) * 100)
            : count > 0 ? 100 : 0

        setData({ count, trend })
      } catch (error) {
        console.error('Error fetching today orders:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  return (
    <StatCard
      label={t('ordersToday')}
      value={data.count}
      trend={data.trend}
      trendLabel={t('fromYesterday')}
      icon={Package}
      color="blue"
      isLoading={isLoading}
    />
  )
}
