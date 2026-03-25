'use client'

/**
 * RequireFeature Component
 *
 * Conditionally renders children based on feature flag availability
 * Integrates with subscription plan-based feature flags
 */

import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import type { FeatureFlagKey } from '@/lib/services/feature-flags.service'

function FeatureGateSkeleton() {
  return (
    <div className="space-y-6 p-4" role="status" aria-live="polite" aria-busy="true">
      <div className="h-8 bg-gray-200 rounded w-1/3 max-w-xs animate-pulse" />
      <div className="h-40 bg-gray-200 rounded animate-pulse" />
    </div>
  )
}

interface RequireFeatureProps {
  feature: FeatureFlagKey | FeatureFlagKey[]
  fallback?: ReactNode
  requireAll?: boolean // If multiple features, require all or any
  children: ReactNode
}

/**
 * Render children only if feature flag is enabled
 *
 * @example
 * <RequireFeature feature={FEATURE_FLAG_KEYS.PDF_INVOICES}>
 *   <DownloadPDFButton />
 * </RequireFeature>
 *
 * @example
 * <RequireFeature
 *   feature={[FEATURE_FLAG_KEYS.PDF_INVOICES, FEATURE_FLAG_KEYS.PRINTING]}
 *   requireAll={false}
 *   fallback={<p>Upgrade to access this feature</p>}
 * >
 *   <InvoiceActions />
 * </RequireFeature>
 */
export function RequireFeature({
  feature,
  fallback = null,
  requireAll = true,
  children,
}: RequireFeatureProps) {
  const { currentTenant, isLoading: authLoading, user, isTenantContextReady } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkFeatureAccess() {
      if (authLoading) {
        setIsLoading(true)
        return
      }

      if (!user) {
        setHasAccess(false)
        setIsLoading(false)
        return
      }

      if (!isTenantContextReady) {
        setIsLoading(true)
        return
      }

      if (!currentTenant) {
        setHasAccess(false)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const res = await fetch('/api/feature-flags')
        if (!res.ok) {
          setHasAccess(false)
          return
        }
        const flags = (await res.json()) as Record<string, boolean>

        if (Array.isArray(feature)) {
          if (requireAll) {
            const allEnabled = feature.every((f) => flags[f] === true)
            setHasAccess(allEnabled)
          } else {
            const anyEnabled = feature.some((f) => flags[f] === true)
            setHasAccess(anyEnabled)
          }
        } else {
          setHasAccess(flags[feature] === true)
        }
      } catch (error) {
        console.error('Error checking feature access:', error)
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    }

    void checkFeatureAccess()
  }, [currentTenant, feature, requireAll, authLoading, user, isTenantContextReady])

  if (authLoading || isLoading) {
    return <FeatureGateSkeleton />
  }

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render upgrade prompt for disabled feature
 *
 * @example
 * <RequireFeature feature="advanced_analytics" fallback={<UpgradePrompt feature="advanced_analytics" />}>
 *   <AnalyticsDashboard />
 * </RequireFeature>
 */
export function UpgradePrompt({
  feature,
  message,
}: {
  feature: FeatureFlagKey
  message?: string
}) {
  const featureNames: Record<FeatureFlagKey, string> = {
    pdf_invoices: 'PDF Invoices',
    whatsapp_receipts: 'WhatsApp Receipts',
    in_app_receipts: 'In-App Receipts',
    printing: 'Receipt Printing',
    b2b_contracts: 'B2B Contracts',
    white_label: 'White Label',
    marketplace_listings: 'Marketplace Listings',
    loyalty_programs: 'Loyalty Programs',
    driver_app: 'Driver App',
    multi_branch: 'Multi-Branch',
    advanced_analytics: 'Advanced Analytics',
    api_access: 'API Access',
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Upgrade Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              {message ||
                `The "${featureNames[feature]}" feature is not available on your current plan. Upgrade to access this feature.`}
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              onClick={() => {
                window.location.href = '/dashboard/settings/subscription'
              }}
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check feature availability (returns true when no flag specified)
 *
 * @example
 * const canShow = useFeatureOptional(featureFlag) // true when featureFlag undefined
 * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES)
 */
export function useFeatureOptional(feature: FeatureFlagKey | undefined): boolean {
  const { currentTenant, isLoading: authLoading, user, isTenantContextReady } = useAuth()
  const [hasAccess, setHasAccess] = useState(!feature)

  useEffect(() => {
    if (!feature) {
      setHasAccess(true)
      return
    }
    async function checkFeature() {
      if (authLoading || !user || !isTenantContextReady || !currentTenant) {
        setHasAccess(false)
        return
      }
      try {
        const res = await fetch('/api/feature-flags')
        if (!res.ok) {
          setHasAccess(false)
          return
        }
        const flags = (await res.json()) as Record<string, boolean>
        setHasAccess(flags[feature] === true)
      } catch (error) {
        console.error('Error checking feature access:', error)
        setHasAccess(false)
      }
    }
    void checkFeature()
  }, [currentTenant, feature, authLoading, user, isTenantContextReady])

  return hasAccess
}

/**
 * Hook to check feature availability
 *
 * @example
 * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES)
 * if (canExportPDF) {
 *   // Show export button
 * }
 */
export function useFeature(feature: FeatureFlagKey): boolean {
  return useFeatureOptional(feature)
}
