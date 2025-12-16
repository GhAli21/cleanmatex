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
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Role-based access control
  if (roles && !hasRole(roles)) {
    return null // Hide widget if user doesn't have required role
  }

  // Feature flag check (TODO: integrate with actual feature flags service)
  if (featureFlag) {
    // For now, all features are enabled in development
    // Later: check against actual feature flags
  }

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && onRefresh) {
      const interval = setInterval(() => {
        onRefresh()
      }, autoRefresh)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, onRefresh])

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
      className={`bg-white rounded-lg shadow ${className}`}
      style={{ gridColumn: `span ${colSpan}` }}
    >
      {/* Widget Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center space-x-2">
          {titleAction}
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
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
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
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
  const isRTL = useRTL()
  
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h4 className="text-lg font-medium text-gray-900 mb-2">
        {t('failedToLoad')}
      </h4>
      <p className="text-sm text-gray-600 mb-4">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
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
      {Icon && <Icon className="h-16 w-16 text-gray-400 mb-4" />}
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      {description && (
        <p className="text-sm text-gray-600 mb-4 max-w-sm">{description}</p>
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
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className="mt-2 flex items-center">
          {trend !== undefined && (
            <span
              className={`text-sm font-medium ${
                trend >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend >= 0 ? '+' : ''}
              {trend}%
            </span>
          )}
          {trendLabel && (
            <span className="text-sm text-gray-600 ml-2">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
