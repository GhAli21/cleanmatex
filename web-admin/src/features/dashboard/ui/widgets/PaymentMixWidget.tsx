'use client'

/**
 * Payment Mix Widget
 *
 * Displays payment method distribution with pie chart
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { CreditCard, Wallet } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface PaymentMixData {
  cashPct: number
  onlinePct: number
  cardPct: number
  otherPct: number
}

export function PaymentMixWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState<PaymentMixData>({
    cashPct: 0,
    onlinePct: 0,
    cardPct: 0,
    otherPct: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        const kpiData = await dashboardService.getKPIOverview(
          currentTenant.tenant_id
        )

        setData({
          cashPct: kpiData.payments.cashPct,
          onlinePct: kpiData.payments.onlinePct,
          cardPct: 0, // TODO: Add card payments
          otherPct: 0, // TODO: Add other payment methods
        })
      } catch (error) {
        console.error('Error fetching payment mix data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', width: '60%', marginBottom: 6 }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '45%' }} /></div>
      </div>
    )
  }

  // Prepare chart data
  const chartData = [
    {
      name: t('cash'),
      value: data.cashPct,
      color: '#10b981', // green-500
    },
    {
      name: t('online'),
      value: data.onlinePct,
      color: '#3b82f6', // blue-500
    },
    {
      name: t('card'),
      value: data.cardPct,
      color: '#8b5cf6', // purple-500
    },
    {
      name: t('other'),
      value: data.otherPct,
      color: '#6b7280', // gray-500
    },
  ].filter((item) => item.value > 0)

  const hasData = chartData.length > 0 && chartData.some((item) => item.value > 0)

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {hasData ? (
        <div>
          {/* Chart */}
          <div className="win2k-inset" style={{ padding: 4, marginBottom: 6, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* List */}
          <table className="win2k-table" style={{ fontSize: 11 }}>
            <tbody>
              {chartData.map((item) => (
                <tr key={item.name}>
                  <td style={{ width: 14 }}>
                    <div style={{ width: 10, height: 10, backgroundColor: item.color, border: '1px solid #808080' }} />
                  </td>
                  <td className="win2k-text">{item.name}</td>
                  <td style={{ fontWeight: 'bold', textAlign: 'right' }}>{item.value.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="win2k-inset" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <Wallet style={{ width: 24, height: 24, color: '#808080', margin: '0 auto 6px' }} />
          <p className="win2k-text">{t('noPaymentData')}</p>
        </div>
      )}
    </div>
  )
}
