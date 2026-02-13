/**
 * Higher-Order Component (HOC) for Role-Based Access Control
 *
 * Wraps pages that require specific roles
 * Redirects to dashboard if user doesn't have required role
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-context'
import { supabase } from '@/lib/supabase/client'

type UserRole = 'admin' | 'super_admin' | 'tenant_admin' | 'operator' | 'viewer'

interface WithRoleOptions {
  requiredRole: UserRole | UserRole[]
  redirectTo?: string
  fallbackComponent?: React.ComponentType
}

/**
 * HOC to protect pages based on user role
 *
 * @example
 * ```tsx
 * // Single role
 * const AdminPage = withRole(MyAdminPage, { requiredRole: 'admin' })
 *
 * // Multiple roles
 * const StaffPage = withRole(MyPage, { requiredRole: ['admin', 'operator'] })
 * ```
 */
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  options: WithRoleOptions
) {
  const {
    requiredRole,
    redirectTo = '/dashboard',
    fallbackComponent: FallbackComponent,
  } = options

  return function RoleProtectedComponent(props: P) {
    const router = useRouter()
    const { user, currentTenant, isAuthenticated, isLoading: authLoading } = useAuth()

    const [userRole, setUserRole] = useState<UserRole | null>(null)
    const [roleLoading, setRoleLoading] = useState(true)
    const [hasAccess, setHasAccess] = useState(false)

    // Fetch user role
    useEffect(() => {
      const fetchUserRole = async () => {
        if (!isAuthenticated || !user || !currentTenant) {
          setRoleLoading(false)
          return
        }

        try {
          const { data, error } = await supabase
            .from('org_users_mst')
            .select('role')
            .eq('user_id', user.id)
            .eq('tenant_org_id', currentTenant.tenant_id)
            .single()

          if (error) throw error

          const role = (data.role || '').toString().trim() as UserRole
          setUserRole(role as UserRole)

          // Check if user has required role (case-insensitive)
          const requiredRoles = (Array.isArray(requiredRole) ? requiredRole : [requiredRole]).map(
            (r) => (r || '').toString().toLowerCase()
          )
          setHasAccess(requiredRoles.includes(role.toLowerCase()))
        } catch (error) {
          console.error('Error fetching user role:', error)
          setHasAccess(false)
        } finally {
          setRoleLoading(false)
        }
      }

      fetchUserRole()
    }, [user, currentTenant, isAuthenticated])

    // Handle redirects
    useEffect(() => {
      if (authLoading || roleLoading) return

      if (!isAuthenticated) {
        router.push('/login')
        return
      }

      if (!hasAccess && !FallbackComponent) {
        router.push(`${redirectTo}?error=insufficient_permissions`)
      }
    }, [isAuthenticated, hasAccess, authLoading, roleLoading, router])

    // Show loading while checking auth and role
    if (authLoading || roleLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
      )
    }

    // Don't render if not authenticated
    if (!isAuthenticated) {
      return null
    }

    // If no access and fallback component provided
    if (!hasAccess && FallbackComponent) {
      return <FallbackComponent {...props} />
    }

    // If no access and no fallback, don't render (will redirect)
    if (!hasAccess) {
      return null
    }

    // Render the protected component
    return <Component {...props} />
  }
}

/**
 * Convenience wrapper for admin-only pages
 *
 * @example
 * ```tsx
 * const AdminPage = withAdminRole(MyAdminPage)
 * export default AdminPage
 * ```
 */
export function withAdminRole<P extends object>(
  Component: React.ComponentType<P>,
  fallbackComponent?: React.ComponentType
) {
  return withRole(Component, {
    requiredRole: ['admin', 'super_admin', 'tenant_admin'],
    fallbackComponent,
  })
}

/**
 * Convenience wrapper for operator pages (admin or operator)
 *
 * @example
 * ```tsx
 * const OperatorPage = withOperatorRole(MyOperatorPage)
 * export default OperatorPage
 * ```
 */
export function withOperatorRole<P extends object>(
  Component: React.ComponentType<P>,
  fallbackComponent?: React.ComponentType
) {
  return withRole(Component, {
    requiredRole: ['admin', 'operator'],
    fallbackComponent,
  })
}

/**
 * @deprecated Use withOperatorRole instead
 * Kept for backward compatibility
 */
export const withStaffRole = withOperatorRole

/**
 * Default fallback component for insufficient permissions
 */
export function InsufficientPermissions() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You don't have permission to access this page
          </p>
        </div>

        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                This page requires administrator privileges. Please contact your system
                administrator if you believe you should have access.
              </p>
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
