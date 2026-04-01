'use client'

/**
 * Widget Component
 *
 * Reusable widget container with:
 * - Lazy loading support
 * - Skeleton loading states
 * - Error boundaries
 * - Auto-refresh capability
 * - Role and feature flag visibility
 */

import { ReactNode, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useRole } from '@/lib/auth/role-context'
import { useFeatureOptional } from '@/src/features/auth/ui/RequireFeature'
import type { UserRole } from '@/config/navigation'
import type { FeatureFlagKey } from '@/lib/services/feature-flags.service'

interface WidgetProps {
  title: string
  titleAction?: ReactNode
  children: ReactNode
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
  autoRefresh?: number // milliseconds (e.g., 60000 for 1 minute)
  className?: string
  // Access control
  roles?: UserRole[]
  featureFlag?: FeatureFlagKey
  // Layout
  colSpan?: number // Grid column span (1-12)
}

/**
 * Widget Container with Loading and Error States
 */
export function Widget({
  title,
  titleAction,
  children,
  isLoading = false,
  error = null,
  onRefresh,
  autoRefresh,
  className = '',
  roles,
  featureFlag,
  colSpan = 1,
}: WidgetProps) {
  const { hasRole } = useRole()
  const hasFeatureAccess = useFeatureOptional(featureFlag)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Auto-refresh functionality (must be called before any early returns)
  useEffect(() => {
    if (autoRefresh && onRefresh) {
      const interval = setInterval(() => {
        onRefresh()
      }, autoRefresh)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, onRefresh])

  // Role-based access control (check after hooks)
  if (roles && !hasRole(roles)) {
    return null // Hide widget if user doesn't have required role
  }

  // Feature flag gating: hide widget if tenant lacks access (only when featureFlag is set)
  if (featureFlag && !hasFeatureAccess) {
    return null
  }

  // Manual refresh handler
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
  }

  return (
    <div
      className={`win2k-panel ${className}`}
      style={{ gridColumn: `span ${colSpan}`, borderRadius: 0 }}
    >
      {/* Widget Header — Win2K title bar style */}
      <div
        style={{
          background: 'linear-gradient(to right, #000080, #1084d0)',
          color: '#ffffff',
          padding: '3px 6px',
          fontFamily: "'Trebuchet MS', 'MS Sans Serif', Arial, sans-serif",
          fontSize: 11,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ flex: 1 }}>{title}</span>
        <div className="flex items-center space-x-1">
          {titleAction}
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="win2k-btn"
              style={{ minWidth: 'unset', padding: '0 4px', height: 16, fontSize: 9, color: '#000' }}
              aria-label="Refresh widget"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div style={{ padding: '6px', backgroundColor: 'var(--win2k-face)' }}>
        {error ? (
          <ErrorState error={error} onRetry={onRefresh} />
        ) : isLoading ? (
          <SkeletonLoader />
        ) : (
          children
        )}
      </div>
    </div>
  )
}

/**
 * Skeleton Loading State
 */
function SkeletonLoader() {
  return (
    <div style={{ padding: 4 }}>
      <div style={{ height: 10, background: '#c0bdb5', marginBottom: 6, width: '50%' }} />
      <div className="win2k-progress-track" style={{ marginBottom: 6 }}>
        <div className="win2k-progress-fill" style={{ width: '60%' }} />
      </div>
      <div style={{ height: 8, background: '#c0bdb5', width: '80%', marginBottom: 4 }} />
      <div style={{ height: 8, background: '#c0bdb5', width: '65%' }} />
    </div>
  )
}

/**
 * Error State Component
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry?: () => void
}) {
  const t = useTranslations('dashboard')
  const isRTL = useRTL()

  return (
    <div className="win2k-inset" style={{ padding: 8, textAlign: 'center' }}>
      <AlertCircle style={{ width: 24, height: 24, color: '#cc0000', margin: '0 auto 6px' }} />
      <p className="win2k-label" style={{ color: '#cc0000', marginBottom: 4 }}>
        {t('failedToLoad')}
      </p>
      <p className="win2k-text" style={{ marginBottom: 8 }}>{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="win2k-btn"
        >
          <RefreshCw style={{ width: 10, height: 10, display: 'inline', marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0 }} />
          {t('tryAgain')}
        </button>
      )}
    </div>
  )
}

/**
 * Empty State Component
 */
export function WidgetEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: any
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="win2k-inset" style={{ padding: '16px 8px', textAlign: 'center' }}>
      {Icon && <Icon style={{ width: 32, height: 32, color: '#808080', margin: '0 auto 8px' }} />}
      <p className="win2k-label" style={{ marginBottom: 4 }}>{title}</p>
      {description && (
        <p className="win2k-text" style={{ marginBottom: 8 }}>{description}</p>
      )}
      {action}
    </div>
  )
}

/**
 * Widget Grid Container
 */
export function WidgetGrid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Stat Card Widget (for KPIs)
 */
export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  color = 'blue',
  isLoading = false,
}: {
  label: string
  value: string | number
  trend?: number // Percentage change (positive or negative)
  trendLabel?: string
  icon?: any
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray'
  isLoading?: boolean
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600',
  }

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 12, background: '#c0bdb5', marginBottom: 8, width: '60%' }} />
        <div className="win2k-inset" style={{ padding: '4px 8px' }}>
          <div style={{ height: 20, background: '#e0e0e0', width: '50%' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="win2k-panel" style={{ padding: '6px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p className="win2k-label">{label}</p>
        {Icon && (
          <div
            style={{
              padding: '3px',
              border: '2px solid',
              borderColor: 'var(--win2k-dark-shadow) var(--win2k-light) var(--win2k-light) var(--win2k-dark-shadow)',
              background: 'var(--win2k-face)',
            }}
          >
            <Icon style={{ width: 14, height: 14, color: 'var(--win2k-titlebar-start)' }} />
          </div>
        )}
      </div>
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 4 }}>
        <p className="win2k-value">{value}</p>
      </div>
      {(trend !== undefined || trendLabel) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend !== undefined && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "'MS Sans Serif', Arial, sans-serif",
                fontWeight: 'bold',
                color: trend >= 0 ? '#006400' : '#cc0000',
              }}
            >
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && (
            <span className="win2k-text" style={{ color: '#555' }}>{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
