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
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const criticalCount = alerts.filter((a) => a.type === 'critical').length
  const warningCount = alerts.filter((a) => a.type === 'warning').length
  const hasAlerts = alerts.length > 0

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('alerts')}</h3>
        <div
          className={`p-2 rounded-lg ${
            criticalCount > 0
              ? 'bg-red-50 text-red-600'
              : warningCount > 0
              ? 'bg-yellow-50 text-yellow-600'
              : 'bg-gray-50 text-gray-600'
          }`}
        >
          <Bell className="h-5 w-5" />
          {hasAlerts && (
            <span className="absolute -mt-2 -mr-2 px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      {hasAlerts ? (
        <div className="space-y-3">
          {/* Alert Summary */}
          <div className="grid grid-cols-3 gap-2 pb-4 border-b border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-xs text-gray-600">{t('critical')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {warningCount}
              </p>
              <p className="text-xs text-gray-600">{t('warning')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {alerts.filter((a) => a.type === 'info').length}
              </p>
              <p className="text-xs text-gray-600">{t('info')}</p>
            </div>
          </div>

          {/* Alert List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg ${getAlertColor(alert.type)} border border-current border-opacity-20`}
              >
                <div className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 ${isRTL ? 'ml-3' : 'mr-3'}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1 break-words">
                      {alert.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 break-words">
                      {alert.message}
                    </p>
                    <div className={`flex items-center mt-2 text-xs text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Clock className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {formatTimestamp(alert.timestamp)}
                    </div>
                  </div>
                  {alert.actionUrl && (
                    <a
                      href={alert.actionUrl}
                      className={`${isRTL ? 'mr-3' : 'ml-3'} text-xs font-medium underline`}
                    >
                      {t('view')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* View All Link */}
          {alerts.length > 5 && (
            <div className="pt-3 border-t border-gray-200">
              <a
                href="/alerts"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('viewAll', { count: alerts.length })} {isRTL ? '←' : '→'}
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bell className="h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            {t('noAlerts')}
          </p>
          <p className="text-xs text-gray-600">
            {t('allSystemsRunning')}
          </p>
        </div>
      )}
    </div>
  )
}
