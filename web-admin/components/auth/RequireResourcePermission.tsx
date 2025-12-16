'use client'

/**
 * RequireResourcePermission Component
 *
 * Conditionally renders children based on resource-scoped permissions.
 * Checks if user has permission for a specific resource instance.
 *
 * Usage:
 * ```tsx
 * <RequireResourcePermission
 *   resource="orders"
 *   action="update"
 *   resourceType="branch"
 *   resourceId={branchId}
 * >
 *   <EditButton />
 * </RequireResourcePermission>
 * ```
 */

import React from 'react'
import {
  useHasResourcePermission,
  type ResourceType,
} from '@/lib/hooks/use-has-resource-permission'

export interface RequireResourcePermissionProps {
  /** Resource name (e.g., 'orders', 'customers') */
  resource: string
  /** Action name (e.g., 'create', 'read', 'update', 'delete') */
  action: string
  /** Type of resource (branch, store, POS, route, device) */
  resourceType: ResourceType
  /** ID of the specific resource instance */
  resourceId: string
  /** Content to render if user has permission */
  children: React.ReactNode
  /** Optional fallback content to render if user doesn't have permission */
  fallback?: React.ReactNode
  /** Optional loading content while checking permission */
  loading?: React.ReactNode
}

/**
 * Render children only if user has permission for the specific resource
 */
export function RequireResourcePermission({
  resource,
  action,
  resourceType,
  resourceId,
  children,
  fallback = null,
  loading = null,
}: RequireResourcePermissionProps) {
  const hasPermission = useHasResourcePermission(
    resource,
    action,
    resourceType,
    resourceId
  )

  // While permission is being checked, show loading state
  // (useHasResourcePermission returns false while checking)
  // For now, we'll just hide content while checking
  // You can enhance this to track loading state separately if needed

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user has permission for ANY of the resources (OR logic)
 *
 * Usage:
 * ```tsx
 * <RequireAnyResourcePermission
 *   checks={[
 *     ['orders', 'update', 'branch', branchAId],
 *     ['orders', 'update', 'branch', branchBId]
 *   ]}
 * >
 *   <EditButton />
 * </RequireAnyResourcePermission>
 * ```
 */
export interface RequireAnyResourcePermissionProps {
  /** Array of [resource, action, resourceType, resourceId] tuples */
  checks: Array<[string, string, ResourceType, string]>
  /** Content to render if user has at least one permission */
  children: React.ReactNode
  /** Optional fallback content */
  fallback?: React.ReactNode
}

export function RequireAnyResourcePermission({
  checks,
  children,
  fallback = null,
}: RequireAnyResourcePermissionProps) {
  // Check each resource permission
  const hasAnyPermission = checks.some(
    ([resource, action, resourceType, resourceId]) =>
      useHasResourcePermission(resource, action, resourceType, resourceId)
  )

  if (!hasAnyPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user has permission for ALL of the resources (AND logic)
 *
 * Usage:
 * ```tsx
 * <RequireAllResourcePermissions
 *   checks={[
 *     ['orders', 'read', 'branch', branchId],
 *     ['orders', 'update', 'branch', branchId]
 *   ]}
 * >
 *   <ManageButton />
 * </RequireAllResourcePermissions>
 * ```
 */
export interface RequireAllResourcePermissionsProps {
  /** Array of [resource, action, resourceType, resourceId] tuples */
  checks: Array<[string, string, ResourceType, string]>
  /** Content to render if user has all permissions */
  children: React.ReactNode
  /** Optional fallback content */
  fallback?: React.ReactNode
}

export function RequireAllResourcePermissions({
  checks,
  children,
  fallback = null,
}: RequireAllResourcePermissionsProps) {
  // Check each resource permission
  const hasAllPermissions = checks.every(
    ([resource, action, resourceType, resourceId]) =>
      useHasResourcePermission(resource, action, resourceType, resourceId)
  )

  if (!hasAllPermissions) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
