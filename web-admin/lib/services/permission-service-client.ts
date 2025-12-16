/**
 * Permission Service - Client-Safe Version
 *
 * Client-side permission checking without Redis cache
 * Safe to import in client components
 */

import { supabase } from '@/lib/supabase/client';

// ========================
// Types
// ========================

export interface Permission {
  permission_code: string;
  resource_type: string | null;
  resource_id: string | null;
}

export interface UserRole {
  role_id: string;
  role_code: string;
  role_name: string;
}

export interface WorkflowRole {
  workflow_role: string;
}

export interface PermissionCheckOptions {
  resourceType?: string;
  resourceId?: string;
}

// ========================
// Client-Side Permission Checks
// ========================

/**
 * Get all permissions for current user
 * @param tenantId - Tenant ID (optional, uses current tenant if not provided)
 * @returns Array of permission codes
 */
export async function getUserPermissions(tenantId?: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions');

    if (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }

    // Extract permission codes
    return (data || []).map((p: Permission) => p.permission_code);
  } catch (error) {
    console.error('Error in getUserPermissions:', error);
    return [];
  }
}

/**
 * Check if user has specific permission
 * @param permission - Permission code (e.g., 'orders:create')
 * @param options - Optional resource type and ID for scoped permissions
 * @returns True if user has permission
 */
export async function hasPermission(
  permission: string,
  options?: PermissionCheckOptions
): Promise<boolean> {
  try {
    if (options?.resourceType && options?.resourceId) {
      // Resource-scoped permission check
      const { data, error } = await supabase.rpc('has_resource_permission', {
        p_permission: permission,
        p_resource_type: options.resourceType,
        p_resource_id: options.resourceId,
      });

      if (error) {
        console.error('Error checking resource permission:', error);
        return false;
      }

      return data === true;
    } else {
      // Tenant-wide permission check
      const { data, error } = await supabase.rpc('has_permission', {
        p_permission: permission,
      });

      if (error) {
        console.error('Error checking permission:', error);
        return false;
      }

      return data === true;
    }
  } catch (error) {
    console.error('Error in hasPermission:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified permissions
 * @param permissions - Array of permission codes
 * @returns True if user has at least one permission
 */
export async function hasAnyPermission(permissions: string[]): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_any_permission', {
      p_permissions: permissions,
    });

    if (error) {
      console.error('Error checking any permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in hasAnyPermission:', error);
    return false;
  }
}

/**
 * Check if user has all of the specified permissions
 * @param permissions - Array of permission codes
 * @returns True if user has all permissions
 */
export async function hasAllPermissions(permissions: string[]): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_all_permissions', {
      p_permissions: permissions,
    });

    if (error) {
      console.error('Error checking all permissions:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in hasAllPermissions:', error);
    return false;
  }
}

/**
 * Get user roles
 * @returns Array of user roles
 */
export async function getUserRoles(): Promise<UserRole[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_roles');

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }

    return (data || []) as UserRole[];
  } catch (error) {
    console.error('Error in getUserRoles:', error);
    return [];
  }
}

/**
 * Get workflow roles for current user
 * @returns Array of workflow role codes
 */
export async function getUserWorkflowRoles(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_workflow_roles');

    if (error) {
      console.error('Error fetching workflow roles:', error);
      return [];
    }

    return (data || []).map((r: WorkflowRole) => r.workflow_role);
  } catch (error) {
    console.error('Error in getUserWorkflowRoles:', error);
    return [];
  }
}

/**
 * Check if user has specific workflow role
 * @param workflowRole - Workflow role code (e.g., 'ROLE_RECEPTION')
 * @returns True if user has workflow role
 */
export async function hasWorkflowRole(workflowRole: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_workflow_role', {
      p_workflow_role: workflowRole,
    });

    if (error) {
      console.error('Error checking workflow role:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in hasWorkflowRole:', error);
    return false;
  }
}

/**
 * Check resource-scoped permission
 * Helper function for use-has-resource-permission hook
 *
 * @param resource - Resource name (e.g., 'orders', 'customers')
 * @param action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @param resourceType - Type of resource (branch, store, POS, route, device)
 * @param resourceId - ID of the specific resource instance
 * @returns True if user has permission for this resource
 */
export async function checkResourcePermission(
  resource: string,
  action: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const permissionCode = `${resource}:${action}`;
  return hasPermission(permissionCode, { resourceType, resourceId });
}
