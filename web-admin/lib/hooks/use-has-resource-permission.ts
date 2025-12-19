'use client'

/**
 * Resource-Scoped Permission Hook
 *
 * Check if user has permission for a specific resource instance
 * (e.g., specific branch, store, POS, route, device)
 *
 * Usage:
 * ```tsx
 * const canEditBranch = useHasResourcePermission('orders', 'update', 'branch', branchId)
 * const canViewStore = useHasResourcePermission('products', 'read', 'store', storeId)
 * ```
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { checkResourcePermission } from '@/lib/services/permission-service-client'

/**
 * Resource types supported by the system
 */
export type ResourceType = 'branch' | 'store' | 'pos' | 'route' | 'device'

/**
 * Check if user has permission for a specific resource instance
 *
 * This hook makes an API call to verify resource-scoped permissions.
 * Results are cached to minimize API calls.
 *
 * @param resource - Resource name (e.g., 'orders', 'customers')
 * @param action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @param resourceType - Type of resource (branch, store, POS, route, device)
 * @param resourceId - ID of the specific resource instance
 * @returns true if user has permission for this resource, false otherwise
 */
export function useHasResourcePermission(
  resource: string,
  action: string,
  resourceType: ResourceType,
  resourceId: string
): boolean {
  const { currentTenant, permissions } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // If no tenant or no resource ID, no permission
    if (!currentTenant || !resourceId) {
      setHasPermission(false)
      return
    }

    // Check global permission first (optimization)
    const permissionCode = `${resource}:${action}`
    const hasGlobalPermission = permissions.includes(permissionCode)

    // If user has global permission for this resource:action, grant access
    if (hasGlobalPermission) {
      setHasPermission(true)
      return
    }

    // Otherwise, check resource-scoped permission via API
    const checkPermission = async () => {
      setIsChecking(true)
      try {
        const result = await checkResourcePermission(
          resource,
          action,
          resourceType,
          resourceId
        )
        setHasPermission(result)
      } catch (error) {
        console.error('Error checking resource permission:', error)
        setHasPermission(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkPermission()
  }, [resource, action, resourceType, resourceId, currentTenant, permissions])

  // While checking, assume no permission (fail-safe)
  return isChecking ? false : hasPermission
}

/**
 * Check if user has ANY resource permission (OR logic)
 *
 * @param checks - Array of permission check parameters
 * @returns true if user has at least one resource permission
 *
 * @example
 * ```tsx
 * // Can edit branch A OR branch B
 * const canEdit = useHasAnyResourcePermission([
 *   ['orders', 'update', 'branch', branchAId],
 *   ['orders', 'update', 'branch', branchBId]
 * ])
 * ```
 */
export function useHasAnyResourcePermission(
  checks: Array<[string, string, ResourceType, string]>
): boolean {
  const { currentTenant, permissions } = useAuth()
  const [hasAnyPermission, setHasAnyPermission] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (!currentTenant || checks.length === 0) {
      setHasAnyPermission(false)
      return
    }

    const checkPermissions = async () => {
      setIsChecking(true)
      try {
        // Check global permissions first
        for (const [resource, action] of checks) {
          const permissionCode = `${resource}:${action}`
          if (permissions.includes(permissionCode)) {
            setHasAnyPermission(true)
            setIsChecking(false)
            return
          }
        }

        // Check resource-scoped permissions
        const permissionPromises = checks.map(([resource, action, resourceType, resourceId]) =>
          checkResourcePermission(resource, action, resourceType, resourceId)
        )
        const results = await Promise.all(permissionPromises)
        setHasAnyPermission(results.some((result) => result === true))
      } catch (error) {
        console.error('Error checking resource permissions:', error)
        setHasAnyPermission(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkPermissions()
  }, [checks, currentTenant, permissions])

  return isChecking ? false : hasAnyPermission
}

/**
 * Check if user has ALL resource permissions (AND logic)
 *
 * @param checks - Array of permission check parameters
 * @returns true if user has all resource permissions
 *
 * @example
 * ```tsx
 * // Can read AND update this branch
 * const canManage = useHasAllResourcePermissions([
 *   ['orders', 'read', 'branch', branchId],
 *   ['orders', 'update', 'branch', branchId]
 * ])
 * ```
 */
export function useHasAllResourcePermissions(
  checks: Array<[string, string, ResourceType, string]>
): boolean {
  const { currentTenant, permissions } = useAuth()
  const [hasAllPermissions, setHasAllPermissions] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (!currentTenant || checks.length === 0) {
      setHasAllPermissions(false)
      return
    }

    const checkPermissions = async () => {
      setIsChecking(true)
      try {
        // Check if all have global permissions first
        const allHaveGlobal = checks.every(([resource, action]) => {
          const permissionCode = `${resource}:${action}`
          return permissions.includes(permissionCode)
        })

        if (allHaveGlobal) {
          setHasAllPermissions(true)
          setIsChecking(false)
          return
        }

        // Check resource-scoped permissions
        const permissionPromises = checks.map(([resource, action, resourceType, resourceId]) =>
          checkResourcePermission(resource, action, resourceType, resourceId)
        )
        const results = await Promise.all(permissionPromises)
        setHasAllPermissions(results.every((result) => result === true))
      } catch (error) {
        console.error('Error checking resource permissions:', error)
        setHasAllPermissions(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkPermissions()
  }, [checks, currentTenant, permissions])

  return isChecking ? false : hasAllPermissions
}
