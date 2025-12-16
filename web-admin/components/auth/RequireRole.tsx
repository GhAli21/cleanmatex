'use client'

/**
 * RequireRole Component
 *
 * Conditionally renders children based on user role
 * Useful for hiding UI elements based on permissions
 */

import { ReactNode } from 'react'
import { useRole } from '@/lib/auth/role-context'
import type { UserRole } from '@/config/navigation'

interface RequireRoleProps {
  roles: UserRole | UserRole[]
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children only if user has required role(s)
 *
 * @example
 * <RequireRole roles="admin">
 *   <AdminOnlyButton />
 * </RequireRole>
 *
 * @example
 * <RequireRole roles={['admin', 'operator']} fallback={<p>Access Denied</p>}>
 *   <EditOrderForm />
 * </RequireRole>
 */
export function RequireRole({ roles, fallback = null, children }: RequireRoleProps) {
  const { hasRole } = useRole()

  if (!hasRole(roles)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user has minimum role level
 *
 * @example
 * <RequireMinimumRole role="operator">
 *   <OperatorFeatures />
 * </RequireMinimumRole>
 */
interface RequireMinimumRoleProps {
  role: UserRole
  fallback?: ReactNode
  children: ReactNode
}

export function RequireMinimumRole({
  role,
  fallback = null,
  children,
}: RequireMinimumRoleProps) {
  const { hasMinimumRole } = useRole()

  if (!hasMinimumRole(role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user is admin
 *
 * @example
 * <AdminOnly>
 *   <DeleteButton />
 * </AdminOnly>
 */
export function AdminOnly({
  fallback = null,
  children,
}: {
  fallback?: ReactNode
  children: ReactNode
}) {
  const { isAdmin } = useRole()

  if (!isAdmin) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user is operator or admin
 *
 * @example
 * <OperatorOnly>
 *   <EditCustomerButton />
 * </OperatorOnly>
 */
export function OperatorOnly({
  fallback = null,
  children,
}: {
  fallback?: ReactNode
  children: ReactNode
}) {
  return (
    <RequireRole roles={['admin', 'operator']} fallback={fallback}>
      {children}
    </RequireRole>
  )
}

/**
 * @deprecated Use OperatorOnly instead
 * Kept for backward compatibility
 */
export const StaffOnly = OperatorOnly
