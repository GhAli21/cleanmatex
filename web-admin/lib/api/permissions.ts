/**
 * Permissions API Client
 *
 * All calls go to platform-api (port 3002) via rbacFetch.
 * Permissions use a `resource:action` code format (e.g. 'orders:read').
 *
 * Auth: pass session.access_token from useAuth()
 */

import { rbacFetch } from './rbac-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Permission returned by platform-api.
 * Code format: resource:action (e.g. 'orders:read', 'customers:create')
 */
export interface TenantPermission {
  code: string            // Format: resource:action — primary identifier
  name: string
  name2?: string          // Arabic name
  category: string
  category_main?: string
  description?: string
  description2?: string
  is_system: boolean      // System permissions cannot be edited or deleted
  is_active: boolean
  role_count?: number     // How many roles use this permission
  created_at: string
  updated_at?: string
}

/** Permissions grouped by their category string */
export type PermissionsByCategory = Record<string, TenantPermission[]>

export interface CreatePermissionDto {
  /** Must match /^[a-z_]+:[a-z_]+$/ */
  code: string
  name: string
  name2?: string
  category: string
  description?: string
  description2?: string
}

export interface UpdatePermissionDto {
  name?: string
  name2?: string
  category?: string
  description?: string
  description2?: string
  is_active?: boolean
}

// Backwards-compatible aliases for existing code
export type Permission = TenantPermission

export interface PermissionsResponse {
  permissions: TenantPermission[]
  grouped: PermissionsByCategory
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Get all permissions grouped by category.
 * Returns an object keyed by category name, each value being an array of permissions.
 */
export async function getPermissionsByCategory(
  accessToken: string
): Promise<PermissionsByCategory> {
  const response = await rbacFetch<{ data: PermissionsByCategory }>(
    '/tenant-api/permissions/by-category',
    accessToken
  )
  return response?.data ?? {}
}

/**
 * Get all permissions (flat array + grouped object).
 * Backwards-compatible signature for existing consumers (e.g. PermissionAssignmentModal).
 */
export async function getAllPermissions(accessToken: string): Promise<PermissionsResponse> {
  const grouped = await getPermissionsByCategory(accessToken)
  const permissions = Object.values(grouped).flat()
  return { permissions, grouped }
}

/**
 * Get a flat list of all permissions.
 */
export async function getAllPermissionsList(
  accessToken: string
): Promise<TenantPermission[]> {
  const response = await rbacFetch<{ data: TenantPermission[]; total: number } | TenantPermission[]>(
    '/tenant-api/permissions',
    accessToken
  )
  if (Array.isArray(response)) return response
  if (response && 'data' in response) return response.data ?? []
  return []
}

/**
 * Create a new custom permission.
 * Code must be unique and match format: resource:action
 */
export async function createPermission(
  data: CreatePermissionDto,
  accessToken: string
): Promise<TenantPermission> {
  return rbacFetch<TenantPermission>('/tenant-api/permissions', accessToken, {
    method: 'POST',
    body: data,
  })
}

/**
 * Update a custom permission.
 * Cannot update system permissions (platform-api enforces this).
 */
export async function updatePermission(
  permissionCode: string,
  data: UpdatePermissionDto,
  accessToken: string
): Promise<TenantPermission> {
  return rbacFetch<TenantPermission>(
    `/tenant-api/permissions/${encodeURIComponent(permissionCode)}`,
    accessToken,
    { method: 'PATCH', body: data }
  )
}

/**
 * Delete a custom permission.
 * Fails if permission is_system === true or role_count > 0.
 */
export async function deletePermission(
  permissionCode: string,
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenant-api/permissions/${encodeURIComponent(permissionCode)}`,
    accessToken,
    { method: 'DELETE' }
  )
}

/**
 * Validate permission code format: must match resource:action pattern.
 * Uses lowercase letters and underscores only (no spaces, no uppercase).
 */
export function isValidPermissionCode(code: string): boolean {
  return /^[a-z_]+:[a-z_]+$/.test(code)
}
