'use client'

import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import DashboardContent from '@features/dashboard/ui/DashboardContent'

/**
 * Preserves the authenticated loading boundary outside the route so the route can emit server metadata.
 */
export default function DashboardHomePage() {
  const tCommon = useTranslations('common')
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  return <DashboardContent />
}
