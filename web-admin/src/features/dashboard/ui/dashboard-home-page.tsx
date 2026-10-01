'use client'

import { useAuth } from '@/lib/auth/auth-context'
import DashboardContent from '@features/dashboard/ui/DashboardContent'

/**
 * Preserves the authenticated loading boundary outside the route so the route can emit server metadata.
 */
export default function DashboardHomePage() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <DashboardContent />
}
