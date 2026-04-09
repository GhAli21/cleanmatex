'use client'

/**
 * Issues Widget
 *
 * Displays open issues, recent issues, and issue trends
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { AlertTriangle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'

interface IssuesData {
  open: number
  last7d: number
  critical: number
  resolved: number
}

export function IssuesWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [data, setData] = useState<IssuesData>({
    open: 0,
    last7d: 0,
    critical: 0,
    resolved: 0,
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
          open: kpiData.issues.open,
          last7d: kpiData.issues.last7d,
          critical: 0, // TODO: Add critical issues count
          resolved: 0, // TODO: Add resolved issues count
        })
      } catch (error) {
        console.error('Error fetching issues data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', width: '50%', marginBottom: 6 }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '30%' }} /></div>
      </div>
    )
  }

  const hasIssues = data.open > 0
  const hasCritical = data.critical > 0

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {/* Open Issues */}
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 6 }}>
        <p className="win2k-label" style={{ marginBottom: 2 }}>{t('openIssues')}</p>
        <p className="win2k-value" style={{ color: hasCritical ? '#cc0000' : hasIssues ? '#886600' : '#006400' }}>
          {data.open}
        </p>
        {data.critical > 0 && (
          <p style={{ fontSize: 10, color: '#cc0000', fontWeight: 'bold' }}>
            ⚠ {t('criticalCount', { count: data.critical })}
          </p>
        )}
      </div>
      <hr className="win2k-separator" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
        <div className="win2k-inset" style={{ padding: '3px 6px' }}>
          <p className="win2k-text" style={{ color: '#555', marginBottom: 2 }}>{t('last7Days')}</p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>{data.last7d}</p>
        </div>
        <div className="win2k-inset" style={{ padding: '3px 6px' }}>
          <p className="win2k-text" style={{ color: '#555', marginBottom: 2 }}>{t('resolved')}</p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: '#006400' }}>{data.resolved}</p>
        </div>
      </div>
      {hasIssues && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 4 }}>
          <a href="/issues" style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontSize: 11 }}>
            {t('viewAllIssues')} {isRTL ? '←' : '→'}
          </a>
        </div>
      )}
    </div>
  )
}
