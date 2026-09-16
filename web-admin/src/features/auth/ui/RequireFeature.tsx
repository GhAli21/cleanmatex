'use client'

/**
 * RequireFeature Component
 *
 * Conditionally renders children based on tenant-level feature flags.
 * Reads the shared TanStack Query cache — does not fetch independently.
 */

import { ReactNode } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { useFeatureFlagsQuery, useFeature, useFeatureOptional } from '@/lib/hooks/use-feature-flags'
import type { FeatureFlagKey } from '@/lib/services/feature-flags.service'

export { useFeature, useFeatureOptional }

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
  requireAll?: boolean
  children: ReactNode
}

/**
 * Render children only if the tenant feature flag is enabled.
 *
 * @param root0
 * @param root0.feature - One flag or a list of flags
 * @param root0.fallback - Rendered when the flag is off or the query fails
 * @param root0.requireAll - When multiple flags, require all (default) or any
 * @param root0.children - Gated content
 */
export function RequireFeature({
  feature,
  fallback = null,
  requireAll = true,
  children,
}: RequireFeatureProps) {
  const { currentTenant, isLoading: authLoading, user, isTenantContextReady } = useAuth()
  const canQuery = Boolean(user) && !authLoading && isTenantContextReady && Boolean(currentTenant)
  const { data: flags, isLoading, isError } = useFeatureFlagsQuery({ enabled: canQuery })

  if (authLoading || !isTenantContextReady || (canQuery && isLoading)) {
    return <FeatureGateSkeleton />
  }

  if (!user || !currentTenant || isError || !flags) {
    return <>{fallback}</>
  }

  const hasAccess = Array.isArray(feature)
    ? requireAll
      ? feature.every((flagKey) => flags[flagKey] === true)
      : feature.some((flagKey) => flags[flagKey] === true)
    : flags[feature] === true

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render upgrade prompt for a disabled feature.
 *
 * @param root0
 * @param root0.feature
 * @param root0.message
 */
export function UpgradePrompt({
  feature,
  message,
}: {
  feature: FeatureFlagKey
  message?: string
}) {
  const featureNames: Partial<Record<FeatureFlagKey, string>> = {
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
    erp_lite_enabled: 'ERP-Lite',
    erp_lite_gl_enabled: 'ERP-Lite General Ledger',
    erp_lite_reports_enabled: 'ERP-Lite Financial Reports',
    erp_lite_ar_enabled: 'ERP-Lite AR Aging',
    erp_lite_expenses_enabled: 'ERP-Lite Expenses',
    erp_lite_bank_recon_enabled: 'ERP-Lite Bank Reconciliation',
    erp_lite_ap_enabled: 'ERP-Lite Accounts Payable',
    erp_lite_po_enabled: 'ERP-Lite Purchase Orders',
    erp_lite_branch_pl_enabled: 'ERP-Lite Branch P&L',
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
                `The "${featureNames[feature] ?? feature.replace(/_/g, ' ')}" feature is not available on your current plan. Upgrade to access this feature.`}
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              onClick={() => {
                window.location.href = '/dashboard/tenant-admin/subscription'
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
