/**
 * User Management API Client
 *
 * Handles all user-related API operations including
 * CRUD, role management, and user statistics
 */

import { supabase } from '@/lib/supabase/client'
import type {
  UserListItem,
  UserListResponse,
  UserFilters,
  CreateUserData,
  UpdateUserData,
  UserActionResult,
  UserStats,
  UserWithAuth,
  BulkUserAction,
} from '@/types/user-management'

/**
 * Fetch paginated list of users for current tenant
 */
export async function fetchUsers(
  tenantId: string,
  filters: UserFilters = {},
  page: number = 1,
  limit: number = 20
): Promise<UserListResponse> {
  try {
    // Build query
    let query = supabase
      .from('org_users_mst')
      .select(`
        id,
        user_id,
        display_name,
        role,
        is_active,
        last_login_at,
        login_count,
        created_at,
        auth_users:user_id (
          email,
          email_confirmed_at
        )
      `, { count: 'exact' })
      .eq('tenant_org_id', tenantId)

    // Apply filters
    if (filters.role && filters.role !== 'all') {
      query = query.eq('role', filters.role)
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('is_active', filters.status === 'active')
    }

    // Apply search
    if (filters.search) {
      query = query.or(`display_name.ilike.%${filters.search}%,auth_users.email.ilike.%${filters.search}%`)
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'desc'

    switch (sortBy) {
      case 'email':
        query = query.order('auth_users(email)', { ascending: sortOrder === 'asc' })
        break
      case 'name':
        query = query.order('display_name', { ascending: sortOrder === 'asc', nullsFirst: false })
        break
      case 'role':
        query = query.order('role', { ascending: sortOrder === 'asc' })
        break
      case 'last_login':
        query = query.order('last_login_at', { ascending: sortOrder === 'asc', nullsFirst: false })
        break
      default:
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    // Transform data
    const users: UserListItem[] = (data || []).map((user: any) => ({
      id: user.id,
      user_id: user.user_id,
      email: user.auth_users?.email || '',
      display_name: user.display_name,
      role: user.role,
      is_active: user.is_active,
      email_verified: !!user.auth_users?.email_confirmed_at,
      last_login_at: user.last_login_at,
      login_count: user.login_count || 0,
      created_at: user.created_at,
    }))

    return {
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    throw error
  }
}

/**
 * Fetch single user by ID
 */
export async function fetchUser(userId: string, tenantId: string): Promise<UserWithAuth | null> {
  try {
    const { data, error } = await supabase
      .from('org_users_mst')
      .select(`
        *,
        auth_users:user_id (
          email,
          email_confirmed_at,
          phone,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .single()

    if (error) throw error

    if (!data) return null

    return {
      ...data,
      role: data.role as any, // Cast to fix type compatibility
      login_count: data.login_count ?? 0, // Ensure number instead of null
      email: (data.auth_users as any)?.email || '',
      email_confirmed_at: (data.auth_users as any)?.email_confirmed_at,
      phone: (data.auth_users as any)?.phone,
      auth_created_at: (data.auth_users as any)?.created_at || data.created_at,
    } as any // Cast entire object to fix type compatibility
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

/**
 * Create new user
 */
export async function createUser(
  tenantId: string,
  userData: CreateUserData
): Promise<UserActionResult> {
  try {
    // First create auth user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: !userData.send_invite, // Auto-confirm if not sending invite
      user_metadata: {
        display_name: userData.display_name,
      },
    })

    if (authError) throw authError

    // Then create org_users_mst record
    const { data: orgUserData, error: orgUserError } = await supabase
      .from('org_users_mst')
      .insert({
        user_id: authData.user.id,
        tenant_org_id: tenantId,
        display_name: userData.display_name,
        role: userData.role,
        is_active: true,
      })
      .select()
      .single()

    if (orgUserError) throw orgUserError

    // Send invite email if requested
    if (userData.send_invite) {
      await supabase.auth.admin.inviteUserByEmail(userData.email)
    }

    return {
      success: true,
      message: `User ${userData.email} created successfully`,
      user: {
        id: orgUserData.id,
        user_id: authData.user.id,
        email: userData.email,
        display_name: userData.display_name,
        role: userData.role,
        is_active: true,
        email_verified: !userData.send_invite,
        last_login_at: null,
        login_count: 0,
        created_at: orgUserData.created_at || new Date().toISOString(),
      },
    }
  } catch (error: any) {
    console.error('Error creating user:', error)
    return {
      success: false,
      message: 'Failed to create user',
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  tenantId: string,
  updates: UpdateUserData
): Promise<UserActionResult> {
  try {
    const { data, error } = await supabase
      .from('org_users_mst')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .select(`
        *,
        auth_users:user_id (email, email_confirmed_at)
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      message: 'User updated successfully',
      user: {
        id: data.id,
        user_id: data.user_id,
        email: (data.auth_users as any)?.email || '',
        display_name: data.display_name,
        role: data.role as any,
        is_active: data.is_active,
        email_verified: !!(data.auth_users as any)?.email_confirmed_at,
        last_login_at: data.last_login_at,
        login_count: data.login_count || 0,
        created_at: data.created_at || new Date().toISOString(),
      },
    }
  } catch (error: any) {
    console.error('Error updating user:', error)
    return {
      success: false,
      message: 'Failed to update user',
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Delete user (soft delete - set is_active to false)
 */
export async function deleteUser(
  userId: string,
  tenantId: string
): Promise<UserActionResult> {
  try {
    const { error } = await supabase
      .from('org_users_mst')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)

    if (error) throw error

    return {
      success: true,
      message: 'User deactivated successfully',
    }
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return {
      success: false,
      message: 'Failed to deactivate user',
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Activate user
 */
export async function activateUser(
  userId: string,
  tenantId: string
): Promise<UserActionResult> {
  try {
    const { error } = await supabase
      .from('org_users_mst')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)

    if (error) throw error

    return {
      success: true,
      message: 'User activated successfully',
    }
  } catch (error: any) {
    console.error('Error activating user:', error)
    return {
      success: false,
      message: 'Failed to activate user',
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Bulk user actions
 */
export async function bulkUserAction(
  tenantId: string,
  action: BulkUserAction
): Promise<UserActionResult> {
  try {
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    switch (action.action) {
      case 'activate':
        updates.is_active = true
        break
      case 'deactivate':
        updates.is_active = false
        break
      case 'delete':
        updates.is_active = false
        updates.rec_status = 0
        break
    }

    const { error } = await supabase
      .from('org_users_mst')
      .update(updates)
      .in('user_id', action.user_ids)
      .eq('tenant_org_id', tenantId)

    if (error) throw error

    return {
      success: true,
      message: `${action.user_ids.length} user(s) ${action.action}d successfully`,
    }
  } catch (error: any) {
    console.error('Error bulk user action:', error)
    return {
      success: false,
      message: `Failed to ${action.action} users`,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Fetch user statistics
 */
export async function fetchUserStats(tenantId: string): Promise<UserStats> {
  try {
    // Get all users for tenant
    const { data, error } = await supabase
      .from('org_users_mst')
      .select('role, is_active, last_login_at')
      .eq('tenant_org_id', tenantId)

    if (error) throw error

    const users = data || []
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const stats: UserStats = {
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
      admins: users.filter((u) => u.role === 'admin').length,
      operators: users.filter((u) => u.role === 'operator').length,
      viewers: users.filter((u) => u.role === 'viewer').length,
      recentLogins: users.filter(
        (u) => u.last_login_at && new Date(u.last_login_at) > sevenDaysAgo
      ).length,
    }

    return stats
  } catch (error) {
    console.error('Error fetching user stats:', error)
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
 * Reset user password (admin action)
 */
export async function resetUserPassword(
  email: string
): Promise<UserActionResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) throw error

    return {
      success: true,
      message: `Password reset email sent to ${email}`,
    }
  } catch (error: any) {
    console.error('Error resetting password:', error)
    return {
      success: false,
      message: 'Failed to send password reset email',
      error: error.message || 'Unknown error',
    }
  }
}
