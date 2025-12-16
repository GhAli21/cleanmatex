'use client'

/**
 * Workflow Role Hook - Check if user has a specific workflow role
 *
 * Workflow roles are independent from user roles and control access to
 * workflow screens and state transitions.
 *
 * Usage:
 * ```tsx
 * const isReceptionist = useHasWorkflowRole('RECEPTION')
 * const canDoQA = useHasWorkflowRole('QA')
 * ```
 */

import { useAuth } from '@/lib/auth/auth-context'

/**
 * Workflow roles available in the system
 */
export type WorkflowRole =
  | 'RECEPTION'
  | 'PREPARATION'
  | 'PROCESSING'
  | 'QA'
  | 'DELIVERY'
  | 'ADMIN'

/**
 * Check if user has a specific workflow role
 *
 * @param workflowRole - Workflow role code (e.g., 'RECEPTION', 'QA', 'DELIVERY')
 * @returns true if user has this workflow role, false otherwise
 */
export function useHasWorkflowRole(workflowRole: WorkflowRole): boolean {
  const { workflowRoles } = useAuth()

  return workflowRoles.includes(workflowRole)
}

/**
 * Check if user has ANY of the specified workflow roles (OR logic)
 *
 * @param roles - Array of workflow role codes
 * @returns true if user has at least one workflow role, false otherwise
 *
 * @example
 * ```tsx
 * // User can access reception OR preparation screens
 * const canAccessEarly = useHasAnyWorkflowRole(['RECEPTION', 'PREPARATION'])
 * ```
 */
export function useHasAnyWorkflowRole(roles: WorkflowRole[]): boolean {
  const { workflowRoles } = useAuth()

  return roles.some((role) => workflowRoles.includes(role))
}

/**
 * Check if user has ALL of the specified workflow roles (AND logic)
 *
 * @param roles - Array of workflow role codes
 * @returns true if user has all workflow roles, false otherwise
 *
 * @example
 * ```tsx
 * // User can do both QA and delivery
 * const canDoQAAndDelivery = useHasAllWorkflowRoles(['QA', 'DELIVERY'])
 * ```
 */
export function useHasAllWorkflowRoles(roles: WorkflowRole[]): boolean {
  const { workflowRoles } = useAuth()

  return roles.every((role) => workflowRoles.includes(role))
}

/**
 * Get all workflow roles for current user
 *
 * @returns Array of workflow role codes
 */
export function useWorkflowRoles(): WorkflowRole[] {
  const { workflowRoles } = useAuth()

  return workflowRoles as WorkflowRole[]
}
