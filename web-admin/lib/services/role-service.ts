/**
 * Role Service
 * 
 * Handles role management, user role assignments, and workflow role assignments
 */

import { createClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase/client';

// ========================
// Types
// ========================

export interface Role {
  role_id: string;
  code: string;
  name: string;
  name2?: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  tenant_org_id: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkflowRoleAssignment {
  id: string;
  user_id: string;
  tenant_org_id: string;
  workflow_role: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  name2?: string;
  description?: string;
  permission_ids?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  name2?: string;
  description?: string;
}

export interface AssignRoleRequest {
  user_id: string;
  tenant_org_id: string;
  role_id: string;
}

export interface AssignWorkflowRoleRequest {
  user_id: string;
  tenant_org_id: string;
  workflow_role: string;
}

// ========================
// System Roles
// ========================

/**
 * Get all system roles
 * @returns Array of system roles
 */
export async function getSystemRoles(): Promise<Role[]> {
  const client = supabase;

  try {
    const { data, error } = await client
      .from('sys_auth_roles')
      .select('*')
      .eq('is_system', true)
      .order('code');

    if (error) {
      console.error('Error fetching system roles:', error);
      return [];
    }

    return (data || []) as Role[];
  } catch (error) {
    console.error('Error in getSystemRoles:', error);
    return [];
  }
}

/**
 * Get all roles (system + custom) for a tenant
 * @param tenantId - Tenant ID
 * @returns Array of roles
 */
export async function getAllRoles(tenantId?: string): Promise<Role[]> {
  const client = supabase;

  try {
    let query = client
      .from('sys_auth_roles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('code');

    // If tenantId provided, filter custom roles by tenant
    // System roles are tenant-agnostic
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }

    return (data || []) as Role[];
  } catch (error) {
    console.error('Error in getAllRoles:', error);
    return [];
  }
}

/**
 * Get role by code
 * @param roleCode - Role code (e.g., 'tenant_admin', 'operator')
 * @returns Role or null
 */
export async function getRoleByCode(roleCode: string): Promise<Role | null> {
  const client = supabase;

  try {
    const { data, error } = await client
      .from('sys_auth_roles')
      .select('*')
      .eq('code', roleCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching role:', error);
      return null;
    }

    return data as Role;
  } catch (error) {
    console.error('Error in getRoleByCode:', error);
    return null;
  }
}

/**
 * Get role by ID
 * @param roleId - Role ID
 * @returns Role or null
 */
export async function getRoleById(roleId: string): Promise<Role | null> {
  const client = supabase;

  try {
    const { data, error } = await client
      .from('sys_auth_roles')
      .select('*')
      .eq('role_id', roleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching role:', error);
      return null;
    }

    return data as Role;
  } catch (error) {
    console.error('Error in getRoleById:', error);
    return null;
  }
}

// ========================
// Custom Role Management
// ========================

/**
 * Create custom role (server-side only)
 * @param request - Role creation request
 * @returns Created role
 */
export async function createCustomRole(request: CreateRoleRequest): Promise<Role> {
  const client = await createClient();

  try {
    // Validate code format
    if (!/^[a-z_]+$/.test(request.code)) {
      throw new Error('Role code must be lowercase letters and underscores only');
    }

    // Check if code already exists
    const existing = await getRoleByCode(request.code);
    if (existing) {
      throw new Error(`Role code "${request.code}" already exists`);
    }

    // Create role
    const { data: role, error: roleError } = await client
      .from('sys_auth_roles')
      .insert({
        code: request.code,
        name: request.name,
        name2: request.name2 || null,
        description: request.description || null,
        is_system: false,
      })
      .select()
      .single();

    if (roleError || !role) {
      console.error('Error creating role:', roleError);
      throw new Error('Failed to create role');
    }

    // Assign permissions if provided
    if (request.permission_ids && request.permission_ids.length > 0) {
      const rolePermissions = request.permission_ids.map((permId) => ({
        role_id: role.role_id,
        permission_id: permId,
      }));

      const { error: permError } = await client
        .from('sys_auth_role_default_permissions')
        .insert(rolePermissions);

      if (permError) {
        console.error('Error assigning permissions:', permError);
        // Don't fail, just log
      }
    }

    return role as Role;
  } catch (error) {
    console.error('Error in createCustomRole:', error);
    throw error;
  }
}

/**
 * Update custom role (server-side only)
 * @param roleId - Role ID
 * @param request - Update request
 * @returns Updated role
 */
export async function updateCustomRole(
  roleId: string,
  request: UpdateRoleRequest
): Promise<Role> {
  const client = await createClient();

  try {
    // Check if role exists and is not system role
    const role = await getRoleById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.is_system) {
      throw new Error('Cannot update system roles');
    }

    const updates: any = {};
    if (request.name !== undefined) updates.name = request.name;
    if (request.name2 !== undefined) updates.name2 = request.name2;
    if (request.description !== undefined) updates.description = request.description;

    const { data, error } = await client
      .from('sys_auth_roles')
      .update(updates)
      .eq('role_id', roleId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating role:', error);
      throw new Error('Failed to update role');
    }

    return data as Role;
  } catch (error) {
    console.error('Error in updateCustomRole:', error);
    throw error;
  }
}

/**
 * Delete custom role (server-side only)
 * @param roleId - Role ID
 */
export async function deleteCustomRole(roleId: string): Promise<void> {
  const client = await createClient();

  try {
    // Check if role exists and is not system role
    const role = await getRoleById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.is_system) {
      throw new Error('Cannot delete system roles');
    }

    // Check if role is assigned to any users
    const { data: assignments, error: checkError } = await client
      .from('org_auth_user_roles')
      .select('id')
      .eq('role_id', roleId)
      .limit(1);

    if (checkError) {
      console.error('Error checking role assignments:', checkError);
      throw new Error('Failed to check role assignments');
    }

    if (assignments && assignments.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    // Delete role (cascade will delete role-permission mappings)
    const { error } = await client
      .from('sys_auth_roles')
      .delete()
      .eq('role_id', roleId);

    if (error) {
      console.error('Error deleting role:', error);
      throw new Error('Failed to delete role');
    }
  } catch (error) {
    console.error('Error in deleteCustomRole:', error);
    throw error;
  }
}

// ========================
// User Role Assignments
// ========================

/**
 * Assign role to user
 * @param request - Assignment request
 * @returns Assignment record
 */
export async function assignRoleToUser(request: AssignRoleRequest): Promise<UserRoleAssignment> {
  const client = await createClient();

  try {
    const { data, error } = await client
      .from('org_auth_user_roles')
      .insert({
        user_id: request.user_id,
        tenant_org_id: request.tenant_org_id,
        role_id: request.role_id,
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error assigning role:', error);
      throw new Error('Failed to assign role');
    }

    // Rebuild effective permissions (dynamic import for server-only)
    try {
      const { rebuildUserPermissions } = await import('./permission-service-server');
      await rebuildUserPermissions(request.user_id, request.tenant_org_id);
    } catch (rebuildError) {
      console.warn('Permission rebuild failed:', rebuildError);
    }

    // Invalidate Redis cache (dynamic import for server-only)
    try {
      const { invalidatePermissionCache } = await import('./permission-service-server');
      await invalidatePermissionCache(request.user_id, request.tenant_org_id);
    } catch (cacheError) {
      console.warn('Cache invalidation failed:', cacheError);
    }

    return data as UserRoleAssignment;
  } catch (error) {
    console.error('Error in assignRoleToUser:', error);
    throw error;
  }
}

/**
 * Remove role from user
 * @param assignmentId - Assignment ID
 */
export async function removeRoleFromUser(assignmentId: string): Promise<void> {
  const client = await createClient();

  try {
    // Get assignment to get user_id and tenant_org_id for rebuild
    const { data: assignment, error: fetchError } = await client
      .from('org_auth_user_roles')
      .select('user_id, tenant_org_id')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      throw new Error('Role assignment not found');
    }

    // Delete assignment
    const { error } = await client
      .from('org_auth_user_roles')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing role:', error);
      throw new Error('Failed to remove role');
    }

    // Rebuild effective permissions (dynamic import for server-only)
    try {
      const { rebuildUserPermissions } = await import('./permission-service-server');
      await rebuildUserPermissions(assignment.user_id, assignment.tenant_org_id);
    } catch (rebuildError) {
      console.warn('Permission rebuild failed:', rebuildError);
    }

    // Invalidate Redis cache (dynamic import for server-only)
    try {
      const { invalidatePermissionCache } = await import('./permission-service-server');
      await invalidatePermissionCache(assignment.user_id, assignment.tenant_org_id);
    } catch (cacheError) {
      console.warn('Cache invalidation failed:', cacheError);
    }
  } catch (error) {
    console.error('Error in removeRoleFromUser:', error);
    throw error;
  }
}

/**
 * Get user role assignments
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns Array of role assignments
 */
export async function getUserRoleAssignments(
  userId: string,
  tenantId: string
): Promise<UserRoleAssignment[]> {
  const client = supabase;

  try {
    const { data, error } = await client
      .from('org_auth_user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching user role assignments:', error);
      return [];
    }

    return (data || []) as UserRoleAssignment[];
  } catch (error) {
    console.error('Error in getUserRoleAssignments:', error);
    return [];
  }
}

// ========================
// Workflow Role Assignments
// ========================

/**
 * Assign workflow role to user
 * @param request - Assignment request
 * @returns Assignment record
 */
export async function assignWorkflowRoleToUser(
  request: AssignWorkflowRoleRequest
): Promise<WorkflowRoleAssignment> {
  const client = await createClient();

  try {
    const { data, error } = await client
      .from('org_auth_user_workflow_roles')
      .insert({
        user_id: request.user_id,
        tenant_org_id: request.tenant_org_id,
        workflow_role: request.workflow_role,
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error assigning workflow role:', error);
      throw new Error('Failed to assign workflow role');
    }

    // Invalidate Redis cache (dynamic import for server-only)
    try {
      const { invalidatePermissionCache } = await import('./permission-service-server');
      await invalidatePermissionCache(request.user_id, request.tenant_org_id);
    } catch (cacheError) {
      console.warn('Cache invalidation failed:', cacheError);
    }

    return data as WorkflowRoleAssignment;
  } catch (error) {
    console.error('Error in assignWorkflowRoleToUser:', error);
    throw error;
  }
}

/**
 * Remove workflow role from user
 * @param assignmentId - Assignment ID
 */
export async function removeWorkflowRoleFromUser(assignmentId: string): Promise<void> {
  const client = await createClient();

  try {
    // Get assignment details before deletion
    const { data: assignment, error: fetchError } = await client
      .from('org_auth_user_workflow_roles')
      .select('user_id, tenant_org_id')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      throw new Error('Workflow role assignment not found');
    }

    const { error } = await client
      .from('org_auth_user_workflow_roles')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing workflow role:', error);
      throw new Error('Failed to remove workflow role');
    }

    // Invalidate Redis cache
    await invalidatePermissionCache(assignment.user_id, assignment.tenant_org_id);
  } catch (error) {
    console.error('Error in removeWorkflowRoleFromUser:', error);
    throw error;
  }
}

/**
 * Get user workflow role assignments
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns Array of workflow role assignments
 */
export async function getUserWorkflowRoleAssignments(
  userId: string,
  tenantId: string
): Promise<WorkflowRoleAssignment[]> {
  const client = supabase;

  try {
    const { data, error } = await client
      .from('org_auth_user_workflow_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching workflow role assignments:', error);
      return [];
    }

    return (data || []) as WorkflowRoleAssignment[];
  } catch (error) {
    console.error('Error in getUserWorkflowRoleAssignments:', error);
    return [];
  }
}

// ========================
// Role Permissions Management
// ========================

/**
 * Get permissions for a role
 * @param roleId - Role ID
 * @returns Array of permission codes
 */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  const client = supabase;

  try {
    const { data, error } = await client
      .from('sys_auth_role_default_permissions')
      .select('permission_id, sys_auth_permissions(code)')
      .eq('role_id', roleId);

    if (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }

    return (data || [])
      .map((item: any) => item.sys_auth_permissions?.code)
      .filter((code: string) => code);
  } catch (error) {
    console.error('Error in getRolePermissions:', error);
    return [];
  }
}

/**
 * Assign permissions to role (server-side only)
 * @param roleId - Role ID
 * @param permissionIds - Array of permission IDs
 */
export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  const client = await createClient();

  try {
    const rolePermissions = permissionIds.map((permId) => ({
      role_id: roleId,
      permission_id: permId,
    }));

    const { error } = await client
      .from('sys_auth_role_default_permissions')
      .upsert(rolePermissions, {
        onConflict: 'role_id,permission_id',
      });

    if (error) {
      console.error('Error assigning permissions:', error);
      throw new Error('Failed to assign permissions');
    }

    // Note: Rebuilding permissions for all users with this role would be expensive
    // In production, this could be done via a background job
  } catch (error) {
    console.error('Error in assignPermissionsToRole:', error);
    throw error;
  }
}

/**
 * Remove permissions from role (server-side only)
 * @param roleId - Role ID
 * @param permissionIds - Array of permission IDs to remove
 */
export async function removePermissionsFromRole(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  const client = await createClient();

  try {
    const { error } = await client
      .from('sys_auth_role_default_permissions')
      .delete()
      .eq('role_id', roleId)
      .in('permission_id', permissionIds);

    if (error) {
      console.error('Error removing permissions:', error);
      throw new Error('Failed to remove permissions');
    }

    // Invalidate cache for all tenants using this role
    try {
      const { data: tenants } = await client
        .from('org_auth_user_roles')
        .select('tenant_org_id')
        .eq('role_id', roleId)
        .eq('is_active', true);

      if (tenants) { 
        const uniqueTenants = [...new Set(tenants.map((t: { tenant_org_id: string }) => t.tenant_org_id))];
        for (const tenantId of uniqueTenants) {
          const { invalidateTenantPermissionCache } = await import('./permission-service-server');
          await invalidateTenantPermissionCache(tenantId);
        }
      }
    } catch (cacheError) {
      // Don't fail if cache invalidation fails
      console.error('Error invalidating cache:', cacheError);
    }
  } catch (error) {
    console.error('Error in removePermissionsFromRole:', error);
    throw error;
  }
}

