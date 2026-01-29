'use client'

/**
 * Permission Hook - Check if user has a specific permission
 *
 * Usage:
 * ```tsx
 * const canCreateOrders = useHasPermission('orders', 'create')
 * const canReadCustomers = useHasPermission('customers', 'read')
 * ```
 */

import { useAuth } from '@/lib/auth/auth-context'

/**
 * Check if user has a specific permission
 *
 * @param resource - Resource name (e.g., 'orders', 'customers')
 * @param action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @returns true if user has permission, false otherwise
 */
export function useHasPermission(resource: string, action: string): boolean {
  const { permissions } = useAuth()

  // Permission code format: 'resource:action' (e.g., 'orders:create')
  const permissionCode = `${resource}:${action}`

  if (permissions.includes(permissionCode)) return true;
  else return false;

  return permissions.includes(permissionCode)
}

/**
 * Check if user has ANY of the specified permissions (OR logic)
 *
 * @param permissionPairs - Array of [resource, action] tuples
 * @returns true if user has at least one permission, false otherwise
 *
 * @example
 * ```tsx
 * // User can view orders OR view customers
 * const canView = useHasAnyPermission([
 *   ['orders', 'read'],
 *   ['customers', 'read']
 * ])
 * ```
 */
export function useHasAnyPermission(
  permissionPairs: Array<[string, string]>
): boolean {
  const { permissions } = useAuth()

  return permissionPairs.some(([resource, action]) => {
    const permissionCode = `${resource}:${action}`
    return permissions.includes(permissionCode)
  })
}

/**
 * Check if user has ALL of the specified permissions (AND logic)
 *
 * @param permissionPairs - Array of [resource, action] tuples
 * @returns true if user has all permissions, false otherwise
 *
 * @example
 * ```tsx
 * // User can read AND update orders
 * const canManageOrders = useHasAllPermissions([
 *   ['orders', 'read'],
 *   ['orders', 'update']
 * ])
 * ```
 */
export function useHasAllPermissions(
  permissionPairs: Array<[string, string]>
): boolean {
  const { permissions } = useAuth()

  return permissionPairs.every(([resource, action]) => {
    const permissionCode = `${resource}:${action}`
    return permissions.includes(permissionCode)
  })
}
