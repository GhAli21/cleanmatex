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
import { shiftCivilDate, civilDateInZone } from '@/lib/utils/operational-time'
import { useDashboardZone } from '../use-dashboard-zone'
import { StatCard } from '../Widget'

/**
 *
 */
export function OrdersTodayWidget() {
  const { currentTenant } = useAuth()
  const { organization, isPending } = useDashboardZone()
  const t = useTranslations('dashboard')
  const [data, setData] = useState({
    count: 0,
    trend: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant || isPending) return

      try {
        setIsLoading(true)
        const today = civilDateInZone(new Date(), organization)
        const count = today
          ? await dashboardService.getTodayOrdersCount(currentTenant.tenant_id, organization)
          : 0
        const yesterday = today ? shiftCivilDate(today, -1) : ''
        const yesterdayCount = yesterday
          ? await dashboardService.getOrdersCountForCivilDay(
              currentTenant.tenant_id,
              yesterday,
              organization
            )
          : 0
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
  }, [currentTenant, organization, isPending])

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
