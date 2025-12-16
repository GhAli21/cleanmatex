'use client'

/**
 * RequireWorkflowRole Component
 *
 * Conditionally renders children based on workflow roles.
 * Workflow roles control access to workflow screens and state transitions.
 *
 * Usage:
 * ```tsx
 * <RequireWorkflowRole role="RECEPTION">
 *   <ReceptionScreen />
 * </RequireWorkflowRole>
 * ```
 */

import React from 'react'
import {
  useHasWorkflowRole,
  type WorkflowRole,
} from '@/lib/hooks/use-has-workflow-role'

export interface RequireWorkflowRoleProps {
  /** Workflow role code (e.g., 'RECEPTION', 'QA', 'DELIVERY') */
  role: WorkflowRole
  /** Content to render if user has this workflow role */
  children: React.ReactNode
  /** Optional fallback content to render if user doesn't have this workflow role */
  fallback?: React.ReactNode
}

/**
 * Render children only if user has the specified workflow role
 */
export function RequireWorkflowRole({
  role,
  children,
  fallback = null,
}: RequireWorkflowRoleProps) {
  const hasRole = useHasWorkflowRole(role)

  if (!hasRole) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user has ANY of the specified workflow roles (OR logic)
 *
 * Usage:
 * ```tsx
 * <RequireAnyWorkflowRole roles={['RECEPTION', 'PREPARATION']}>
 *   <EarlyStageScreen />
 * </RequireAnyWorkflowRole>
 * ```
 */
export interface RequireAnyWorkflowRoleProps {
  /** Array of workflow role codes */
  roles: WorkflowRole[]
  /** Content to render if user has at least one workflow role */
  children: React.ReactNode
  /** Optional fallback content */
  fallback?: React.ReactNode
}

export function RequireAnyWorkflowRole({
  roles,
  children,
  fallback = null,
}: RequireAnyWorkflowRoleProps) {
  // Check if user has any of the workflow roles
  const hasAnyRole = roles.some((role) => useHasWorkflowRole(role))

  if (!hasAnyRole) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Render children only if user has ALL of the specified workflow roles (AND logic)
 *
 * Usage:
 * ```tsx
 * <RequireAllWorkflowRoles roles={['QA', 'DELIVERY']}>
 *   <QAAndDeliveryScreen />
 * </RequireAllWorkflowRoles>
 * ```
 */
export interface RequireAllWorkflowRolesProps {
  /** Array of workflow role codes */
  roles: WorkflowRole[]
  /** Content to render if user has all workflow roles */
  children: React.ReactNode
  /** Optional fallback content */
  fallback?: React.ReactNode
}

export function RequireAllWorkflowRoles({
  roles,
  children,
  fallback = null,
}: RequireAllWorkflowRolesProps) {
  // Check if user has all of the workflow roles
  const hasAllRoles = roles.every((role) => useHasWorkflowRole(role))

  if (!hasAllRoles) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
