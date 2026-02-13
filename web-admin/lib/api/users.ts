/**
 * User Management API Client
 *
 * All calls go to platform-api (port 3002) via rbacFetch.
 * No Supabase imports — all data flows through platform-api.
 *
 * Auth: pass session.access_token from useAuth()
 * Usage example:
 *   const { session } = useAuth()
 *   const accessToken = session?.access_token ?? ''
 *   const result = await fetchUsers(tenantId, filters, 1, 20, accessToken)
 */

import { rbacFetch } from './rbac-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantUser {
  id: string             // org_users_mst.id
  user_id: string        // auth.users.id
  email: string
  display_name: string | null
  role: string           // role code string
  is_active: boolean
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  last_login_at: string | null
  login_count: number
  created_at: string
}

export interface UserListResponse {
  data: TenantUser[]
  total: number
  page: number
  limit: number
}

export interface UserFilters {
  search?: string
  role?: string
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CreateUserData {
  email: string
  password: string
  display_name: string
  role: string
  first_name?: string
  last_name?: string
  phone?: string
  is_active?: boolean
}

export interface UpdateUserData {
  display_name?: string
  role?: string
  is_active?: boolean
  first_name?: string
  last_name?: string
  phone?: string
}

export interface UserRoleAssignment {
  role_code: string
  role_name: string
  is_system: boolean
  assigned_at: string
}

export interface EffectivePermissionsResponse {
  permissions: string[]
  computed_at?: string
}

export interface UserStats {
  total: number
  active: number
  inactive: number
  admins: number
  operators: number
  viewers: number
  recentLogins: number
}

/**
 * Backwards-compatible result type used by existing sub-components.
 * createUser, updateUser, deleteUser, activateUser, deactivateUser all return this.
 */
export interface UserActionResult {
  success: boolean
  message: string
  user?: TenantUser
  error?: string
}

// Backwards-compatible aliases for existing code still importing from @/types/user-management
// or expecting the old shape from this module.
export type UserListItem = TenantUser
export type { UserFilters as UserFiltersCompat }

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Fetch paginated list of users for a tenant.
 * GET /tenants/:tenantId/users
 */
export async function fetchUsers(
  tenantId: string,
  filters: UserFilters = {},
  page: number = 1,
  limit: number = 20,
  accessToken: string = ''
): Promise<UserListResponse> {
  const queryParams: Record<string, string | number | boolean | undefined | null> = {
    page,
    limit,
  }

  if (filters.search) {
    queryParams.search = filters.search
  }
  if (filters.role && filters.role !== 'all') {
    queryParams.role = filters.role
  }
  if (filters.status && filters.status !== 'all') {
    queryParams.is_active = filters.status === 'active'
  }
  if (filters.sortBy) {
    queryParams.sort_by = filters.sortBy
  }
  if (filters.sortOrder) {
    queryParams.sort_order = filters.sortOrder
  }

  const response = await rbacFetch<UserListResponse | TenantUser[]>(
    `/tenants/${encodeURIComponent(tenantId)}/users`,
    accessToken,
    { queryParams }
  )

  // Normalise response shape — handle both array and paginated object
  if (Array.isArray(response)) {
    return {
      data: response,
      total: response.length,
      page,
      limit,
    }
  }

  if (response && 'data' in response) {
    return response as UserListResponse
  }

  return { data: [], total: 0, page, limit }
}

/**
 * Fetch a single user by userId.
 * GET /tenants/:tenantId/users/:userId
 */
export async function fetchUser(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<TenantUser | null> {
  try {
    return await rbacFetch<TenantUser>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}`,
      accessToken
    )
  } catch {
    return null
  }
}

/**
 * Create a new user under a tenant.
 * POST /tenants/:tenantId/users
 */
export async function createUser(
  tenantId: string,
  data: CreateUserData,
  accessToken: string = ''
): Promise<UserActionResult> {
  try {
    const user = await rbacFetch<TenantUser>(
      `/tenants/${encodeURIComponent(tenantId)}/users`,
      accessToken,
      { method: 'POST', body: data }
    )
    return {
      success: true,
      message: `User ${data.email} created successfully`,
      user,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    console.error('Error creating user:', err)
    return { success: false, message, error: message }
  }
}

/**
 * Update an existing user.
 * PATCH /tenants/:tenantId/users/:userId
 */
export async function updateUser(
  tenantId: string,
  userId: string,
  data: UpdateUserData,
  accessToken: string = ''
): Promise<UserActionResult> {
  try {
    const user = await rbacFetch<TenantUser>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}`,
      accessToken,
      { method: 'PATCH', body: data }
    )
    return {
      success: true,
      message: 'User updated successfully',
      user,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update user'
    console.error('Error updating user:', err)
    return { success: false, message, error: message }
  }
}

/**
 * Delete a user.
 * DELETE /tenants/:tenantId/users/:userId
 */
export async function deleteUser(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<UserActionResult> {
  try {
    await rbacFetch<void>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}`,
      accessToken,
      { method: 'DELETE' }
    )
    return { success: true, message: 'User deleted successfully' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete user'
    console.error('Error deleting user:', err)
    return { success: false, message, error: message }
  }
}

/**
 * Activate a user.
 * POST /tenants/:tenantId/users/:userId/activate
 */
export async function activateUser(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<UserActionResult> {
  try {
    const user = await rbacFetch<TenantUser>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/activate`,
      accessToken,
      { method: 'POST' }
    )
    return { success: true, message: 'User activated successfully', user }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to activate user'
    console.error('Error activating user:', err)
    return { success: false, message, error: message }
  }
}

/**
 * Deactivate a user.
 * POST /tenants/:tenantId/users/:userId/deactivate
 */
export async function deactivateUser(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<UserActionResult> {
  try {
    const user = await rbacFetch<TenantUser>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/deactivate`,
      accessToken,
      { method: 'POST' }
    )
    return { success: true, message: 'User deactivated successfully', user }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate user'
    console.error('Error deactivating user:', err)
    return { success: false, message, error: message }
  }
}

/**
 * Get all roles assigned to a user.
 * GET /tenants/:tenantId/users/:userId/roles
 */
export async function getUserRoles(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<UserRoleAssignment[]> {
  const response = await rbacFetch<{ data: UserRoleAssignment[] } | UserRoleAssignment[]>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/roles`,
    accessToken
  )
  if (Array.isArray(response)) return response
  if (response && 'data' in response) return response.data ?? []
  return []
}

/**
 * Assign roles to a user (replaces existing assignments).
 * POST /tenants/:tenantId/users/:userId/roles
 */
export async function assignRolesToUser(
  tenantId: string,
  userId: string,
  roleCodes: string[],
  accessToken: string = ''
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/roles`,
    accessToken,
    { method: 'POST', body: { role_codes: roleCodes } }
  )
}

/**
 * Remove a single role from a user.
 * DELETE /tenants/:tenantId/users/:userId/roles/:roleCode
 */
export async function removeRoleFromUser(
  tenantId: string,
  userId: string,
  roleCode: string,
  accessToken: string = ''
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleCode)}`,
    accessToken,
    { method: 'DELETE' }
  )
}

/**
 * Get all effective permissions for a user (computed from all assigned roles).
 * GET /tenants/:tenantId/users/:userId/effective-permissions
 */
export async function getEffectivePermissions(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<EffectivePermissionsResponse> {
  const response = await rbacFetch<EffectivePermissionsResponse | string[]>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/effective-permissions`,
    accessToken
  )
  if (Array.isArray(response)) return { permissions: response }
  if (response && 'permissions' in response) return response as EffectivePermissionsResponse
  return { permissions: [] }
}

/**
 * Fetch user statistics computed client-side from the users list.
 * Fetches up to 100 users and derives counts locally.
 */
export async function fetchUserStats(
  tenantId: string,
  accessToken: string = ''
): Promise<UserStats> {
  try {
    const response = await fetchUsers(tenantId, {}, 1, 100, accessToken)
    const users = response.data

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return {
      total: response.total || users.length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
      //u.role === 'admin' || u.role === 'tenant_admin'
      admins: users.filter((u) =>
        /admin/i.test(u.role || '')
      ).length,
      operators: users.filter((u) => u.role === 'operator').length,
      viewers: users.filter((u) => u.role === 'viewer').length,
      recentLogins: users.filter(
        (u) => u.last_login_at && new Date(u.last_login_at) > sevenDaysAgo
      ).length,
    }
  } catch (err) {
    console.error('Error fetching user stats:', err)
    return {
      total: 0,
      active: 0,
      inactive: 0,
      admins: 0,
      operators: 0,
      viewers: 0,
      recentLogins: 0,
    }
  }
}

/**
 * Bulk user action stub — not supported by platform-api.
 * Kept for build compatibility with existing code.
 */
export async function bulkUserAction(
  _tenantId: string,
  _action: { user_ids: string[]; action: 'activate' | 'deactivate' | 'delete' }
): Promise<UserActionResult> {
  return {
    success: false,
    message: 'Bulk user actions are not supported by the current API version.',
    error: 'Not implemented',
  }
}

/**
 * Reset user password stub — kept for build compatibility.
 * Direct Supabase auth operations are not available; use platform-api workflows instead.
 */
export async function resetUserPassword(
  _email: string
): Promise<UserActionResult> {
  return {
    success: false,
    message: 'Password reset is not supported via this API client. Use the platform admin panel.',
    error: 'Not implemented',
  }
}
