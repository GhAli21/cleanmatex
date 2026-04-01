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
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '50%' }} /></div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="win2k-inset" style={{ padding: '12px 8px', textAlign: 'center' }}>
        <p className="win2k-text">{t('noOrdersYet')}</p>
      </div>
    )
  }

  return (
    <div>
      <table className="win2k-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}
                >
                  {order.order_no}
                </Link>
              </td>
              <td className="win2k-text">{order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 6, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 4 }}>
        <Link
          href="/dashboard/orders"
          style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}
        >
          {t('viewAllOrders') || 'View all orders'}{isRTL ? ' ←' : ' →'}
        </Link>
      </div>
    </div>
  )
}
