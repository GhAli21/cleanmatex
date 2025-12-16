/**
 * Roles API Client
 *
 * Client-safe wrapper for role management API calls
 */

export interface Role {
  role_id: string;
  code: string;
  name: string;
  name2?: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface CreateRoleDto {
  code: string;
  name: string;
  name2?: string;
  description?: string;
}

export interface UpdateRoleDto {
  code?: string;
  name?: string;
  name2?: string;
  description?: string;
}

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<Role[]> {
  const response = await fetch('/api/roles', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to fetch roles');
  }

  return result.data;
}

/**
 * Get role permissions
 */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to fetch role permissions');
  }

  return result.data.permissions;
}

/**
 * Create custom role
 */
export async function createCustomRole(data: CreateRoleDto): Promise<Role> {
  const response = await fetch('/api/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to create role');
  }

  return result.data;
}

/**
 * Update custom role
 */
export async function updateCustomRole(
  roleId: string,
  data: UpdateRoleDto
): Promise<Role> {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to update role');
  }

  return result.data;
}

/**
 * Delete custom role
 */
export async function deleteCustomRole(roleId: string): Promise<void> {
  const response = await fetch(`/api/roles/${roleId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to delete role');
  }
}

/**
 * Assign permissions to role
 */
export async function assignPermissionsToRole(
  roleId: string,
  permissionCodes: string[]
): Promise<string[]> {
  const response = await fetch(`/api/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissionCodes }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to assign permissions');
  }

  return result.data.permissions;
}
