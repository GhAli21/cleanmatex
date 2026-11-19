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

/**
 *
 */
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
          critical: kpiData.issues.critical,
          resolved: kpiData.issues.resolved,
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
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  const hasIssues = data.open > 0
  const hasCritical = data.critical > 0

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('issues')}</h3>
        <div
          className={`p-2 rounded-lg ${
            hasCritical
              ? 'bg-danger-bg text-danger-text'
              : hasIssues
              ? 'bg-warning-bg text-warning-text'
              : 'bg-success-bg text-success-text'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Open Issues */}
        <div>
          <p className="text-sm text-muted-foreground">{t('openIssues')}</p>
          <p
            className={`text-3xl font-bold ${
              hasCritical
                ? 'text-danger-text'
                : hasIssues
                ? 'text-warning-text'
                : 'text-success-text'
            }`}
          >
            {data.open}
          </p>
          {data.critical > 0 && (
            <div className="flex items-center mt-2 text-danger-text">
              <AlertCircle className="h-4 w-4 me-1" />
              <span className="text-sm font-medium">
                {t('criticalCount', { count: data.critical })}
              </span>
            </div>
          )}
        </div>

        {/* Issue Statistics */}
        <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
          {/* Last 7 Days */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('last7Days')}</p>
            <p className="text-lg font-semibold text-foreground">{data.last7d}</p>
          </div>

          {/* Resolved */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('resolved')}</p>
            <p className="text-lg font-semibold text-foreground">
              {data.resolved}
            </p>
          </div>
        </div>

        {/* Action Link */}
        {hasIssues && (
          <div className="pt-4 border-t border-border">
            <a
              href="/dashboard/issues"
              className="text-sm text-primary-text hover:text-primary-text/80 font-medium"
            >
              {t('viewAllIssues')} {isRTL ? '←' : '→'}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
