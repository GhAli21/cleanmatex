/**
 * User Management Types
 *
 * Types for user management functionality including
 * user CRUD operations, roles, and permissions
 */

/**
 * User role types
 */
export type UserRole = 'admin' | 'operator' | 'viewer'

/**
 * User status
 */
export type UserStatus = 'active' | 'inactive' | 'pending'

/**
 * User data from org_users_mst table
 */
export interface UserData {
  id: string
  user_id: string
  tenant_org_id: string
  display_name: string | null
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  login_count: number
  preferences: Record<string, any>
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  rec_status: number
  rec_notes: string | null
}

/**
 * User with auth.users data joined
 */
export interface UserWithAuth extends UserData {
  email: string
  email_confirmed_at: string | null
  phone: string | null
  auth_created_at: string
}

/**
 * User list item for table display
 */
export interface UserListItem {
  id: string
  user_id: string
  email: string
  display_name: string | null
  role: UserRole
  is_active: boolean
  email_verified: boolean
  last_login_at: string | null
  login_count: number
  created_at: string
}

/**
 * Create user form data
 */
export interface CreateUserData {
  email: string
  password: string
  display_name: string
  role: UserRole
  send_invite: boolean
}

/**
 * Update user form data
 */
export interface UpdateUserData {
  display_name?: string
  role?: UserRole
  is_active?: boolean
  preferences?: Record<string, any>
}

/**
 * User filters for list page
 */
export interface UserFilters {
  search?: string
  role?: UserRole | 'all'
  status?: 'active' | 'inactive' | 'all'
  sortBy?: 'email' | 'name' | 'role' | 'last_login' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Pagination data
 */
export interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * User list response
 */
export interface UserListResponse {
  users: UserListItem[]
  pagination: PaginationData
}

/**
 * Role display info
 */
export interface RoleInfo {
  value: UserRole
  label: string
  description: string
  color: string
  icon?: string
}

/**
 * User action types for audit log
 */
export type UserAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'activate'
  | 'deactivate'
  | 'role_change'
  | 'password_reset'

/**
 * User action result
 */
export interface UserActionResult {
  success: boolean
  message: string
  user?: UserListItem
  error?: string
}

/**
 * Bulk user action
 */
export interface BulkUserAction {
  user_ids: string[]
  action: 'activate' | 'deactivate' | 'delete'
}

/**
 * User statistics
 */
export interface UserStats {
  total: number
  active: number
  inactive: number
  admins: number
  operators: number
  viewers: number
  recentLogins: number // Last 7 days
}

/**
 * User activity log entry
 */
export interface UserActivityLog {
  id: string
  user_id: string
  action: UserAction
  entity_type: string
  entity_id: string | null
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
