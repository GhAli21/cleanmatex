/**
 * Permission Middleware for API Routes
 * 
 * Provides middleware functions to protect API routes with permission checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/services/permission-service-server'

// ========================
// Types
// ========================

export interface PermissionCheckOptions {
  resourceType?: string
  resourceId?: string
}

export interface AuthContext {
  user: any
  tenantId: string
  userId: string
  userName: string
}

// ========================
// Auth Context Helper
// ========================

/**
 * Get authentication context from request
 * @returns Auth context with user and tenant info
 * @throws Error if unauthorized
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  console.log('[Jh] getAuthContext ( 1 ): User:', user)

  if (!user) {
    throw new Error('Unauthorized')
  }
  console.log('[Jh] getAuthContext ( 2 ): Test get_user_tenants')
  const { data: tenants, error } = await supabase.rpc('get_user_tenants')
  console.log('[Jh] getAuthContext ( 3 ): get_user_tenants(): tenants:', tenants)
  console.log('[Jh] getAuthContext ( 4 ): error:', error)
  if (error || !tenants || tenants.length === 0) {
    console.log('[Jh] getAuthContext ( 5 ): No tenant access found')
    throw new Error('No tenant access found')
  }
  console.log('[Jh] getAuthContext ( 6 ): tenants[0].tenant_id:', tenants[0].tenant_id)
  console.log('[Jh] getAuthContext ( 7 ): tenants[0].user_role:', tenants[0].user_role)
  console.log('[Jh] getAuthContext ( 8 ): user.id:', user.id)
  console.log('[Jh] getAuthContext ( 9 ): user.user_metadata?.full_name:', user.user_metadata?.full_name)
  console.log('[Jh] getAuthContext ( 10 ): user.email:', user.email)
  console.log('[Jh] getAuthContext ( 11 ): user.user_metadata?.tenant_id:', user.user_metadata?.tenant_id)
  console.log('[Jh] getAuthContext ( 12 ): user.user_metadata?.role:', user.user_metadata?.role)

  return {
    user,
    tenantId: tenants[0].tenant_id as string,
    userId: user.id as string,
    userName: user.user_metadata?.full_name || user.email || 'User',
  }
}

// ========================
// Permission Middleware
// ========================

/**
 * Middleware to require a specific permission
 * @param permission - Permission code (e.g., 'orders:create')
 * @param options - Optional resource type and ID for scoped permissions
 * @returns Middleware function
 */
export function requirePermission(
  permission: string,
  options?: PermissionCheckOptions
) {
  return async (request: NextRequest): Promise<AuthContext | NextResponse> => {
    try {
      const authContext = await getAuthContext()
      console.log('[Jh] requirePermission ( 1 ): Auth context:', authContext)
      console.log('[Jh] requirePermission ( 2 ): Permission:', permission)
      console.log('[Jh] requirePermission ( 3 ): Options:', options)
      
      //const hasAccess = true;// true for testing
      let hasAccess = await hasPermissionServer(permission, options) 
      hasAccess = false; // false for testing

      console.log('[Jh] requirePermission ( 4 ): The access For Testing:', hasAccess)

      if (!hasAccess) {
        console.log('[Jh] requirePermission ( 5 ): Permission denied')
        console.log('[Jh] requirePermission ( 6 ): Error:', `Permission denied: ${permission}`)
        return NextResponse.json(
          { error: `Permission denied: ${permission}` },
          { status: 403 }
        )
      }

      return authContext
    } catch (error) {
      console.log('[Jh] requirePermission ( 7 ): Error:', error)
      const message = error instanceof Error ? error.message : 'Unauthorized'
      console.log('[Jh] requirePermission ( 8 ): Message:', message)
      console.log('[Jh] requirePermission ( 9 ): Returning unauthorized response')
      return NextResponse.json({ error: message }, { status: 401 })
    }
  }
}

/**
 * Middleware to require any of the specified permissions
 * @param permissions - Array of permission codes
 * @returns Middleware function
 */
export function requireAnyPermission(permissions: string[]) {
  return async (request: NextRequest): Promise<AuthContext | NextResponse> => {
    try {
      const authContext = await getAuthContext()
      
      // Check if user has any of the required permissions
      const checks = await Promise.all(
        permissions.map(perm => hasPermissionServer(perm))
      )
      const hasAccess = checks.some(check => check === true)

      if (!hasAccess) {
        return NextResponse.json(
          { error: `Permission denied: requires one of [${permissions.join(', ')}]` },
          { status: 403 }
        )
      }

      return authContext
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      return NextResponse.json({ error: message }, { status: 401 })
    }
  }
}

/**
 * Middleware to require all of the specified permissions
 * @param permissions - Array of permission codes
 * @returns Middleware function
 */
export function requireAllPermissions(permissions: string[]) {
  return async (request: NextRequest): Promise<AuthContext | NextResponse> => {
    try {
      const authContext = await getAuthContext()
      
      // Check if user has all required permissions
      const checks = await Promise.all(
        permissions.map(perm => hasPermissionServer(perm))
      )
      const hasAccess = checks.every(check => check === true)

      if (!hasAccess) {
        return NextResponse.json(
          { error: `Permission denied: requires all of [${permissions.join(', ')}]` },
          { status: 403 }
        )
      }

      return authContext
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      return NextResponse.json({ error: message }, { status: 401 })
    }
  }
}

// ========================
// Higher-Order Function Wrapper
// ========================

/**
 * Wrap an API route handler with permission checking
 * @param handler - Route handler function
 * @param permission - Required permission
 * @param options - Optional resource scoping
 * @returns Protected route handler
 */
export function withPermission<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>,
  permission: string,
  options?: PermissionCheckOptions
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authCheck = await requirePermission(permission, options)(request)
    
    if (authCheck instanceof NextResponse) {
      return authCheck // Permission denied or unauthorized
    }

    // Call the original handler with auth context
    return handler(request, ...args)
  }
}

/**
 * Wrap an API route handler with any permission check
 * @param handler - Route handler function
 * @param permissions - Array of required permissions (user needs at least one)
 * @returns Protected route handler
 */
export function withAnyPermission<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>,
  permissions: string[]
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authCheck = await requireAnyPermission(permissions)(request)
    
    if (authCheck instanceof NextResponse) {
      return authCheck // Permission denied or unauthorized
    }

    return handler(request, ...args)
  }
}

/**
 * Wrap an API route handler with all permissions check
 * @param handler - Route handler function
 * @param permissions - Array of required permissions (user needs all)
 * @returns Protected route handler
 */
export function withAllPermissions<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>,
  permissions: string[]
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authCheck = await requireAllPermissions(permissions)(request)
    
    if (authCheck instanceof NextResponse) {
      return authCheck // Permission denied or unauthorized
    }

    return handler(request, ...args)
  }
}

