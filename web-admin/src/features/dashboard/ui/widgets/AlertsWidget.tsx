'use client'

/**
 * Alerts Widget
 *
 * Displays system alerts, warnings, and critical notifications
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

type AlertType = 'critical' | 'warning' | 'info'
type AlertCategory = 'order' | 'payment' | 'system' | 'delivery'

interface Alert {
  id: string
  type: AlertType
  category: AlertCategory
  title: string
  message: string
  timestamp: Date
  actionUrl?: string
}

export function AlertsWidget() {
  const { currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const isRTL = useRTL()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAlerts() {
      if (!currentTenant) return

      try {
        setIsLoading(true)

        // TODO: Implement actual alerts query
        // For now, using mock data to demonstrate the UI
        const mockAlerts: Alert[] = []

        setAlerts(mockAlerts)
      } catch (error) {
        console.error('Error fetching alerts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlerts()
  }, [currentTenant])

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'critical':
        return <XCircle className="h-5 w-5" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />
      case 'info':
        return <Info className="h-5 w-5" />
    }
  }

  const getAlertColor = (type: AlertType) => {
    switch (type) {
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50'
      case 'info':
        return 'text-blue-600 bg-blue-50'
    }
  }

  const formatTimestamp = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return t('justNow')
    if (diffMins < 60) return t('minutesAgo', { minutes: diffMins })
    if (diffMins < 1440) return t('hoursAgo', { hours: Math.floor(diffMins / 60) })
    return t('daysAgo', { days: Math.floor(diffMins / 1440) })
  }

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', marginBottom: 8, width: '50%' }} />
        <div className="win2k-progress-track">
          <div className="win2k-progress-fill" style={{ width: '40%' }} />
        </div>
      </div>
    )
  }

  const criticalCount = alerts.filter((a) => a.type === 'critical').length
  const warningCount = alerts.filter((a) => a.type === 'warning').length
  const hasAlerts = alerts.length > 0

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {hasAlerts ? (
        <div>
          {/* Alert Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
            {[
              { count: criticalCount, label: t('critical'), color: '#cc0000' },
              { count: warningCount, label: t('warning'), color: '#886600' },
              { count: alerts.filter(a => a.type === 'info').length, label: t('info'), color: 'var(--win2k-titlebar-start)' },
            ].map(({ count, label, color }) => (
              <div key={label} className="win2k-inset" style={{ padding: '4px 8px', textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 'bold', color, fontFamily: 'Courier New, monospace' }}>{count}</p>
                <p className="win2k-text">{label}</p>
              </div>
            ))}
          </div>

          <hr className="win2k-separator" />

          {/* Alert List */}
          <div className="win2k-scroll" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="win2k-panel" style={{ padding: '4px 8px', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ color: alert.type === 'critical' ? '#cc0000' : alert.type === 'warning' ? '#886600' : '#000080', flexShrink: 0 }}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="win2k-label">{alert.title}</p>
                    <p className="win2k-text">{alert.message}</p>
                    <p className="win2k-text" style={{ color: '#666', marginTop: 2 }}>
                      {formatTimestamp(alert.timestamp)}
                    </p>
                  </div>
                  {alert.actionUrl && (
                    <a href={alert.actionUrl} style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontSize: 11 }}>
                      {t('view')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {alerts.length > 5 && (
            <div style={{ marginTop: 6, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 4 }}>
              <a href="/alerts" style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontSize: 11 }}>
                {t('viewAll', { count: alerts.length })} {isRTL ? '←' : '→'}
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="win2k-inset" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <Bell style={{ width: 24, height: 24, color: '#808080', margin: '0 auto 6px' }} />
          <p className="win2k-label" style={{ marginBottom: 2 }}>{t('noAlerts')}</p>
          <p className="win2k-text">{t('allSystemsRunning')}</p>
        </div>
      )}
    </div>
  )
}
