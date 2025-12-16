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
 * <RequireFeature feature="pdf_invoices">
 *   <DownloadPDFButton />
 * </RequireFeature>
 *
 * @example
 * <RequireFeature
 *   feature={['pdf_invoices', 'printing']}
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
  const { currentTenant } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkFeatureAccess() {
      if (!currentTenant) {
        setHasAccess(false)
        setIsLoading(false)
        return
      }

      try {
        // TODO: Replace with actual feature flags service call
        // For now, mock some feature flags
        const mockFeatureFlags: Record<string, boolean> = {
          pdf_invoices: true,
          whatsapp_receipts: true,
          in_app_receipts: true,
          printing: true,
          b2b_contracts: false,
          white_label: false,
          marketplace_listings: false,
          loyalty_programs: true,
          driver_app: true,
          multi_branch: true,
          advanced_analytics: true,
          api_access: false,
        }

        // Check feature access
        if (Array.isArray(feature)) {
          if (requireAll) {
            // All features must be enabled
            const allEnabled = feature.every((f) => mockFeatureFlags[f] === true)
            setHasAccess(allEnabled)
          } else {
            // Any feature can be enabled
            const anyEnabled = feature.some((f) => mockFeatureFlags[f] === true)
            setHasAccess(anyEnabled)
          }
        } else {
          // Single feature check
          setHasAccess(mockFeatureFlags[feature] === true)
        }
      } catch (error) {
        console.error('Error checking feature access:', error)
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkFeatureAccess()
  }, [currentTenant, feature, requireAll])

  if (isLoading) {
    return null // Or a loading skeleton
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
                // TODO: Navigate to subscription page
                window.location.href = '/dashboard/subscription'
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
 * Hook to check feature availability
 *
 * @example
 * const canExportPDF = useFeature('pdf_invoices')
 * if (canExportPDF) {
 *   // Show export button
 * }
 */
export function useFeature(feature: FeatureFlagKey): boolean {
  const { currentTenant } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    async function checkFeature() {
      if (!currentTenant) {
        setHasAccess(false)
        return
      }

      try {
        // TODO: Replace with actual feature flags service call
        const mockFeatureFlags: Record<string, boolean> = {
          pdf_invoices: true,
          whatsapp_receipts: true,
          in_app_receipts: true,
          printing: true,
          b2b_contracts: false,
          white_label: false,
          marketplace_listings: false,
          loyalty_programs: true,
          driver_app: true,
          multi_branch: true,
          advanced_analytics: true,
          api_access: false,
        }

        setHasAccess(mockFeatureFlags[feature] === true)
      } catch (error) {
        console.error('Error checking feature:', error)
        setHasAccess(false)
      }
    }

    checkFeature()
  }, [currentTenant, feature])

  return hasAccess
}
