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
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="h-48 bg-gray-200 rounded"></div>
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900">{t('paymentMix')}</h3>
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <CreditCard className="h-5 w-5" />
        </div>
      </div>

      {hasData ? (
        <div className="space-y-4">
          {/* Pie Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                 label={(props: any) => {
                   const { name, percent } = props;
                   return `${name} ${((percent as number) * 100).toFixed(0)}%`;
                 }}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>

          {/* Payment Method List */}
          <div className="space-y-2">
            {chartData.map((item) => (
              <div key={item.name} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-3 h-3 rounded-full ${isRTL ? 'ml-2' : 'mr-2'}`}
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-700 line-clamp-1 break-words">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {item.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Wallet className="h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">{t('noPaymentData')}</p>
        </div>
      )}
    </div>
  )
}
