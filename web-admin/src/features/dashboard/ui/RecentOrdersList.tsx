'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'
import { useRTL } from '@/lib/hooks/useRTL'

export function RecentOrdersList() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
  const [orders, setOrders] = useState<
    Array<{ id: string; order_no: string; status: string; created_at: string }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      if (!currentTenant) return
      try {
        setLoading(true)
        const data = await dashboardService.getRecentOrders(
          currentTenant.tenant_id,
          5
        )
        setOrders(data)
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [currentTenant])

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        {tCommon('loading')}
      </div>
    )
  }

  if (orders.length === 0) {
    return <p className="text-gray-500">{t('noOrdersYet')}</p>
  }

  return (
    <ul className="space-y-2">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/dashboard/orders/${order.id}`}
            className={`flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <span className="font-medium text-gray-900">{order.order_no}</span>
            <span className="text-sm text-gray-500">{order.status}</span>
          </Link>
        </li>
      ))}
      <li>
        <Link
          href="/dashboard/orders"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {t('viewAllOrders') || 'View all orders'}
          {isRTL ? ' ←' : ' →'}
        </Link>
      </li>
    </ul>
  )
}
