/**
 * Permission Hooks
 * 
 * React hooks for checking permissions and workflow roles
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
    
    // Check wildcard permissions
    if (permissions.includes('*:*')) return true // Super admin
    if (permissions.includes(`${resource}:*`)) return true // All actions on resource
    
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
    
    // Check for super admin
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
    
    // Super admin has all permissions
    if (userPermissions.includes('*:*')) return true
    
    // Check if all permissions are present
    return permissions.every(perm => {
      if (userPermissions.includes(perm)) return true
      
      // Check wildcard: resource:*
      const [resource] = perm.split(':')
      if (userPermissions.includes(`${resource}:*`)) return true
      
      return false
    })
  }, [userPermissions, permissions])
}

/**
 * Get workflow roles for current user
 * @returns Array of workflow role codes
 */
export function useWorkflowRoles(): string[] {
  const { workflowRoles } = useAuth()
  return workflowRoles || []
}

/**
 * Check if user has specific workflow role
 * @param workflowRole - Workflow role code (e.g., 'ROLE_RECEPTION')
 * @returns True if user has workflow role
 */
export function useHasWorkflowRole(workflowRole: string): boolean {
  const { workflowRoles } = useAuth()
  
  return useMemo(() => {
    if (!workflowRoles || workflowRoles.length === 0) return false
    
    // ROLE_ADMIN has access to all workflow roles
    if (workflowRoles.includes('ROLE_ADMIN')) return true
    
    return workflowRoles.includes(workflowRole)
  }, [workflowRoles, workflowRole])
}

/**
 * Check if user has any of the specified workflow roles
 * @param workflowRoles - Array of workflow role codes
 * @returns True if user has at least one workflow role
 */
export function useHasAnyWorkflowRole(workflowRoles: string[]): boolean {
  const { workflowRoles: userWorkflowRoles } = useAuth()
  
  return useMemo(() => {
    if (!userWorkflowRoles || userWorkflowRoles.length === 0) return false
    if (!workflowRoles || workflowRoles.length === 0) return false
    
    // ROLE_ADMIN has access to all workflow roles
    if (userWorkflowRoles.includes('ROLE_ADMIN')) return true
    
    return workflowRoles.some(role => userWorkflowRoles.includes(role))
  }, [userWorkflowRoles, workflowRoles])
}

/**
 * Check if user has all of the specified workflow roles
 * @param workflowRoles - Array of workflow role codes
 * @returns True if user has all workflow roles
 */
export function useHasAllWorkflowRoles(workflowRoles: string[]): boolean {
  const { workflowRoles: userWorkflowRoles } = useAuth()
  
  return useMemo(() => {
    if (!userWorkflowRoles || userWorkflowRoles.length === 0) return false
    if (!workflowRoles || workflowRoles.length === 0) return true
    
    // ROLE_ADMIN has access to all workflow roles
    if (userWorkflowRoles.includes('ROLE_ADMIN')) return true
    
    return workflowRoles.every(role => userWorkflowRoles.includes(role))
  }, [userWorkflowRoles, workflowRoles])
}

