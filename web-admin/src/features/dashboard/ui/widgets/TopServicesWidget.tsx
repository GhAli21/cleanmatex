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
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', width: '55%', marginBottom: 6 }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '70%' }} /></div>
      </div>
    )
  }

  const hasData = data && data.length > 0

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {hasData ? (
        <div>
          {/* Bar Chart */}
          <div className="win2k-inset" style={{ padding: 4, marginBottom: 6, height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="1 1" stroke="#c0bdb5" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "'MS Sans Serif', Arial" }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 9, fontFamily: "'MS Sans Serif', Arial" }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ border: '2px solid', borderColor: '#808080 #fff #fff #808080', background: 'var(--win2k-face)', fontFamily: "'MS Sans Serif', Arial", fontSize: 10, borderRadius: 0 }}
                />
                <Bar dataKey="amount" fill="#000080" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Service Table */}
          <table className="win2k-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ width: 20 }}>#</th>
                <th>{t('topServices')}</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 5).map((service, index) => (
                <tr key={service.name}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>{index + 1}</td>
                  <td className="win2k-text">{service.name}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>
                    {formatCurrency(service.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 6, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 4 }}>
            <a href="/reports/services" style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontSize: 11 }}>
              {t('viewDetailedReport')} {isRTL ? '←' : '→'}
            </a>
          </div>
        </div>
      ) : (
        <div className="win2k-inset" style={{ padding: '16px 8px', textAlign: 'center' }}>
          <Star style={{ width: 24, height: 24, color: '#808080', margin: '0 auto 6px' }} />
          <p className="win2k-text">{t('noServiceData')}</p>
        </div>
      )}
    </div>
  )
}
