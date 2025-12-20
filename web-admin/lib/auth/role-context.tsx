'use client'

/**
 * Role-Based Access Control (RBAC) Context
 *
 * Extends AuthContext with role and permission checking capabilities
 * Used for UI-level authorization decisions
 */

import { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react'
import { useAuth } from './auth-context'
import type { UserRole } from '@/config/navigation'

// Role hierarchy: admin > operator > viewer
const ROLE_HIERARCHY: Partial<Record<UserRole, number>> = {
  admin: 3,
  operator: 2,
  viewer: 1,
}
 
interface RoleContextType {
  role: UserRole | null
  isAdmin: boolean
  isOperator: boolean
  isViewer: boolean
  //isDriver: boolean
  hasRole: (role: UserRole | UserRole[]) => boolean
  hasMinimumRole: (minimumRole: UserRole) => boolean
  canAccessPath: (path: string, requiredRoles?: UserRole[]) => boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

/**
 * Role Provider Component
 * Wraps the app to provide role-based access control
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useAuth()

  // Get user role from current tenant (normalize to lowercase)
  const role = useMemo(() => {
    if (!currentTenant?.user_role) return null
    return currentTenant.user_role.toLowerCase() as UserRole
  }, [currentTenant])

  // Role checks
  const isAdmin = role === 'admin'
  const isOperator = role === 'operator'
  const isViewer = role === 'viewer'
  //const isDriver = role === 'driver'

  /**
   * Check if user has specific role(s)
   * @param requiredRole - Single role or array of roles
   * @returns True if user has any of the required roles
   */
  const hasRole = useCallback(
    (requiredRole: UserRole | UserRole[]): boolean => {
      if (!role) return false

      if (Array.isArray(requiredRole)) {
        return requiredRole.includes(role)
      }

      return role === requiredRole
    },
    [role]
  )

  /**
   * Check if user has minimum role level
   * Uses role hierarchy: admin > operator > viewer
   * @param minimumRole - Minimum required role
   * @returns True if user role >= minimum role
   */
  const hasMinimumRole = useCallback(
    (minimumRole: UserRole): boolean => {
      if (!role) return false

      const userRoleLevel = ROLE_HIERARCHY[role] || 0
      const minimumRoleLevel = ROLE_HIERARCHY[minimumRole] || 0

      return userRoleLevel >= minimumRoleLevel
    },
    [role]
  )

  /**
   * Check if user can access a specific path
   * @param path - Route path to check
   * @param requiredRoles - Optional array of required roles
   * @returns True if user can access the path
   */
  const canAccessPath = useCallback(
    (path: string, requiredRoles?: UserRole[]): boolean => {
      if (!role) return false
      if (!requiredRoles || requiredRoles.length === 0) return true

      return requiredRoles.includes(role)
    },
    [role]
  )

  const value: RoleContextType = {
    role,
    isAdmin,
    isOperator,
    isViewer,
    hasRole,
    hasMinimumRole,
    canAccessPath,
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

/**
 * Hook to use role context
 * @throws Error if used outside RoleProvider
 */
export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}

/**
 * Hook to check if user has required role(s)
 * Useful for conditional rendering
 *
 * @example
 * const canEdit = useHasRole(['admin', 'operator'])
 * if (canEdit) return <EditButton />
 */
export function useHasRole(requiredRole: UserRole | UserRole[]): boolean {
  const { hasRole } = useRole()
  return hasRole(requiredRole)
}

/**
 * Hook to check if user has minimum role level
 *
 * @example
 * const canManage = useHasMinimumRole('operator')
 * // Returns true for operator and admin, false for viewer
 */
export function useHasMinimumRole(minimumRole: UserRole): boolean {
  const { hasMinimumRole } = useRole()
  return hasMinimumRole(minimumRole)
}

/**
 * Hook to check if user can access a path
 *
 * @example
 * const canViewReports = useCanAccessPath('/dashboard/reports', ['admin'])
 */
export function useCanAccessPath(
  path: string,
  requiredRoles?: UserRole[]
): boolean {
  const { canAccessPath } = useRole()
  return canAccessPath(path, requiredRoles)
}
