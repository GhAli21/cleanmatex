'use client'

/* eslint-disable jsdoc/require-param */
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
      className={`bg-card rounded-lg shadow ${className}`}
      style={{ gridColumn: `span ${colSpan}` }}
    >
      {/* Widget Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <div className="flex items-center space-x-2">
          {titleAction}
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              aria-label="Refresh widget"
            >
              <RefreshCw
                className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="p-6">
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
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded"></div>
        <div className="h-4 bg-muted rounded w-5/6"></div>
        <div className="h-4 bg-muted rounded w-4/6"></div>
      </div>
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
  
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-12 w-12 text-danger-text mb-4" />
      <h4 className="text-lg font-medium text-foreground mb-2">
        {t('failedToLoad')}
      </h4>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
        >
          <RefreshCw className="h-4 w-4 me-2" />
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="h-16 w-16 text-muted-foreground mb-4" />}
      <h4 className="text-lg font-medium text-foreground mb-2">{title}</h4>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
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
    blue: 'bg-info-bg text-info-text',
    green: 'bg-success-bg text-success-text',
    red: 'bg-danger-bg text-danger-text',
    yellow: 'bg-warning-bg text-warning-text',
    gray: 'bg-muted text-muted-foreground',
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-muted rounded w-1/3"></div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline">
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className="mt-2 flex items-center">
          {trend !== undefined && (
            <span
              className={`text-sm font-medium ${
                trend >= 0 ? 'text-success-text' : 'text-danger-text'
              }`}
            >
              {trend >= 0 ? '+' : ''}
              {trend}%
            </span>
          )}
          {trendLabel && (
            <span className="text-sm text-muted-foreground ms-2">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
