/**
 * Permission Hooks
 * 
 * React hooks for checking permissions
 * Uses AuthContext for permission data
 */

import { useMemo } from 'react'
import { useAuth } from '@/lib/auth/auth-context'

/**
 * Get all permissions for current user
 * @returns Array of permission codes
 */
export function usePermissions(): string[] {
  const { permissions } = useAuth()
  return permissions || []
}

/**
 * Check if user has a permission by full code (e.g. orders:overpayment_allocate).
 * Use this when the action segment contains underscores or multiple colons are not used.
 * @param permissionCode
 */
export function useHasPermissionCode(permissionCode: string): boolean {
  const { permissions } = useAuth()

  return useMemo(() => {
    if (!permissions || permissions.length === 0) return false

    if (permissions.includes(permissionCode)) return true
    if (permissions.includes('*:*')) return true

    const sep = permissionCode.indexOf(':')
    if (sep > 0) {
      const resource = permissionCode.slice(0, sep)
      if (permissions.includes(`${resource}:*`)) return true
    }

    return false
  }, [permissions, permissionCode])
}

/**
 * Check if user has specific permission
 * @param resource - Resource name (e.g., 'orders')
 * @param action - Action name (e.g., 'create')
 * @returns True if user has permission
 */
export function useHasPermission(resource: string, action: string): boolean {
  const { permissions } = useAuth()
  
  return useMemo(() => {
    if (!permissions || permissions.length === 0) return false
    
    const permission = `${resource}:${action}`
    
    // Check exact permission
    if (permissions.includes(permission)) return true
    
    // Wildcards only if returned by get_user_permissions (same rules for every user)
    if (permissions.includes('*:*')) return true
    if (permissions.includes(`${resource}:*`)) return true
    
    return false
  }, [permissions, resource, action])
}

/**
 * Check if user has any of the specified permissions
 * @param permissions - Array of permission strings in format 'resource:action'
 * @returns True if user has at least one permission
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const { permissions: userPermissions } = useAuth()
  
  return useMemo(() => {
    if (!userPermissions || userPermissions.length === 0) return false
    if (!permissions || permissions.length === 0) return false
    
    if (userPermissions.includes('*:*')) return true
    
    // Check if any permission matches
    return permissions.some(perm => {
      if (userPermissions.includes(perm)) return true
      
      // Check wildcard: resource:*
      const [resource] = perm.split(':')
      if (userPermissions.includes(`${resource}:*`)) return true
      
      return false
    })
  }, [userPermissions, permissions])
}

/**
 * Check if user has all of the specified permissions
 * @param permissions - Array of permission strings in format 'resource:action'
 * @returns True if user has all permissions
 */
export function useHasAllPermissions(permissions: string[]): boolean {
  const { permissions: userPermissions } = useAuth()
  
  return useMemo(() => {
    if (!userPermissions || userPermissions.length === 0) return false
    if (!permissions || permissions.length === 0) return true
    
    if (userPermissions.includes('*:*')) return true

    return permissions.every(perm => {
      if (userPermissions.includes(perm)) return true
      
      // Check wildcard: resource:*
      const [resource] = perm.split(':')
      if (userPermissions.includes(`${resource}:*`)) return true
      
      return false
    })
  }, [userPermissions, permissions])
}

