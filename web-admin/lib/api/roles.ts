/**
 * Roles API Client
 *
 * All calls go to platform-api (port 3002) via rbacFetch.
 * Roles are identified by their string `code`, NOT by a UUID role_id.
 *
 * Auth: pass session.access_token from useAuth()
 * Usage example:
 *   const { session } = useAuth()
 *   const roles = await getAllRoles(session?.access_token ?? '')
 */

import { rbacFetch } from './rbac-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantRolePermission {
  code: string
  name: string
  category: string
}

/**
 * Role returned by platform-api.
 * IMPORTANT: The primary identifier is `code` (string), not a UUID.
 */
export interface TenantRole {
  code: string             // Primary identifier — use this in all API calls
  name: string
  name2?: string           // Arabic name
  description?: string
  description2?: string
  is_system: boolean       // System roles cannot be edited or deleted
  is_active: boolean
  permissions?: TenantRolePermission[]
  permission_count?: number
  user_count?: number
  created_at: string
  updated_at?: string
}

export interface CreateRoleDto {
  code: string
  name: string
  name2?: string
  description?: string
  description2?: string
  permission_codes?: string[]
}

export interface UpdateRoleDto {
  name?: string
  name2?: string
  description?: string
  description2?: string
  is_active?: boolean
}

// Backwards-compatible alias (the old type used role_id; new code uses TenantRole)
export type Role = TenantRole

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Get all roles (system + custom) for the current tenant context.
 * Platform-api applies tenant scoping via the JWT claims.
 */
export async function getAllRoles(accessToken: string): Promise<TenantRole[]> {
  const response = await rbacFetch<{ data: TenantRole[] } | TenantRole[]>(
    '/tenant-api/roles',
    accessToken
  )
  // Handle both { data: [...] } and direct array shapes
  if (Array.isArray(response)) return response
  if (response && 'data' in response && Array.isArray(response.data)) return response.data
  return []
}

/**
 * Get a single role with its full permission list.
 */
export async function getRoleByCode(
  roleCode: string,
  accessToken: string
): Promise<TenantRole> {
  return rbacFetch<TenantRole>(
    `/tenant-api/roles/${encodeURIComponent(roleCode)}`,
    accessToken
  )
}

/**
 * @deprecated Use getRoleByCode() instead.
 * Kept for migration compatibility — fetches permissions for a role by its code.
 */
export async function getRolePermissions(
  roleCode: string,
  accessToken: string
): Promise<string[]> {
  const role = await getRoleByCode(roleCode, accessToken)
  return role.permissions?.map((p) => p.code) ?? []
}

/**
 * Create a new custom role.
 * System roles (is_system: true) are created by platform-api seed and cannot be created here.
 */
export async function createCustomRole(
  data: CreateRoleDto,
  accessToken: string
): Promise<TenantRole> {
  return rbacFetch<TenantRole>('/tenant-api/roles', accessToken, {
    method: 'POST',
    body: data,
  })
}

/**
 * Update a custom role. Cannot update system roles (platform-api enforces this).
 * @param roleCode - The role's string code (e.g. 'tenant_admin')
 */
export async function updateCustomRole(
  roleCode: string,
  data: UpdateRoleDto,
  accessToken: string
): Promise<TenantRole> {
  return rbacFetch<TenantRole>(
    `/tenant-api/roles/${encodeURIComponent(roleCode)}`,
    accessToken,
    { method: 'PATCH', body: data }
  )
}

/**
 * Delete a custom role. Fails if:
 * - Role is a system role (is_system: true)
 * - Role is assigned to any users (user_count > 0)
 */
export async function deleteCustomRole(
  roleCode: string,
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenant-api/roles/${encodeURIComponent(roleCode)}`,
    accessToken,
    { method: 'DELETE' }
  )
}

/**
 * Replace the full set of permissions assigned to a role.
 * Triggers a permissions rebuild for all users who have this role.
 *
 * @param roleCode - The role's string code
 * @param permissionCodes - Full list of permission codes to assign (replaces existing)
 */
export async function assignPermissionsToRole(
  roleCode: string,
  permissionCodes: string[],
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenant-api/roles/${encodeURIComponent(roleCode)}/permissions`,
    accessToken,
    {
      method: 'POST',
      body: { permission_codes: permissionCodes },
    }
  )
}
