'use client'

/**
 * Permission-Based Access Control Components
 *
 * Conditionally renders children based on user permissions
 * Uses RBAC system for granular permission checks
 */

import { ReactNode } from 'react'
import {
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  useHasWorkflowRole,
  useHasAnyWorkflowRole,
} from '@/lib/hooks/usePermissions'

// ========================
// Single Permission Check
// ========================

export interface RequirePermissionProps {
  resource: string
  action: string
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children only if user has specific permission
 *
 * @example
 * <RequirePermission resource="orders" action="create">
 *   <CreateOrderButton />
 * </RequirePermission>
 */
export function RequirePermission({
  resource,
  action,
  fallback = null,
  children,
}: RequirePermissionProps) {
  const hasPermission = useHasPermission(resource, action)

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// ========================
// Multiple Permission Checks
// ========================

export interface RequireAnyPermissionProps {
  permissions: string[] // Array of 'resource:action' strings
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children if user has ANY of the specified permissions
 *
 * @example
 * <RequireAnyPermission permissions={['orders:create', 'orders:update']}>
 *   <EditOrderButton />
 * </RequireAnyPermission>
 */
export function RequireAnyPermission({
  permissions,
  fallback = null,
  children,
}: RequireAnyPermissionProps) {
  const hasAny = useHasAnyPermission(permissions)

  if (!hasAny) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export interface RequireAllPermissionsProps {
  permissions: string[] // Array of 'resource:action' strings
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children if user has ALL of the specified permissions
 *
 * @example
 * <RequireAllPermissions permissions={['orders:read', 'orders:export']}>
 *   <ExportOrdersButton />
 * </RequireAllPermissions>
 */
export function RequireAllPermissions({
  permissions,
  fallback = null,
  children,
}: RequireAllPermissionsProps) {
  const hasAll = useHasAllPermissions(permissions)

  if (!hasAll) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// ========================
// Permission Gate (with custom render)
// ========================

interface PermissionGateProps {
  resource: string
  action: string
  fallback?: ReactNode
  children: ReactNode | ((hasPermission: boolean) => ReactNode)
}

/**
 * Permission gate with custom render function
 * Useful for showing different UI based on permission
 *
 * @example
 * <PermissionGate resource="orders" action="delete">
 *   {(hasPermission) => (
 *     <Button disabled={!hasPermission}>
 *       Delete Order
 *     </Button>
 *   )}
 * </PermissionGate>
 */
export function PermissionGate({
  resource,
  action,
  fallback = null,
  children,
}: PermissionGateProps) {
  const hasPermission = useHasPermission(resource, action)

  if (typeof children === 'function') {
    return <>{children(hasPermission)}</>
  }

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// ========================
// Workflow Role Checks
// ========================

interface RequireWorkflowRoleProps {
  workflowRole: string
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children only if user has specific workflow role
 *
 * @example
 * <RequireWorkflowRole workflowRole="ROLE_RECEPTION">
 *   <ReceptionScreen />
 * </RequireWorkflowRole>
 */
export function RequireWorkflowRole({
  workflowRole,
  fallback = null,
  children,
}: RequireWorkflowRoleProps) {
  const hasRole = useHasWorkflowRole(workflowRole)

  if (!hasRole) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface RequireAnyWorkflowRoleProps {
  workflowRoles: string[]
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children if user has ANY of the specified workflow roles
 *
 * @example
 * <RequireAnyWorkflowRole workflowRoles={['ROLE_RECEPTION', 'ROLE_PROCESSING']}>
 *   <OrderProcessingScreen />
 * </RequireAnyWorkflowRole>
 */
export function RequireAnyWorkflowRole({
  workflowRoles,
  fallback = null,
  children,
}: RequireAnyWorkflowRoleProps) {
  const hasAny = useHasAnyWorkflowRole(workflowRoles)

  if (!hasAny) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

