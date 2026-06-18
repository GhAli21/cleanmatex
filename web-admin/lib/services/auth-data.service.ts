'use client'

/**
 * Batch Auth Data Service
 * 
 * Fetches all authentication-related data in parallel for better performance
 * Includes: tenants, permissions, workflow roles, and feature flags
 */

import { supabase } from '@/lib/supabase/client'
import type { UserTenant } from '@/types/auth'

/**
 *
 */
export interface AuthData {
  tenants: UserTenant[]
  permissions: string[]
  workflowRoles: string[]
  featureFlags: Record<string, boolean>
}

async function fetchTenantsWithRetry(maxAttempts = 2) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tenantsResult = await supabase.rpc('get_user_tenants')
    if (!tenantsResult.error) {
      return tenantsResult
    }

    lastError = tenantsResult.error
    if (attempt < maxAttempts) {
      await supabase.auth.refreshSession()
      await new Promise((resolve) => setTimeout(resolve, attempt * 250))
    }
  }

  return { data: null, error: lastError }
}

/**
 * Fetch all authentication data in parallel.
 * Pass `prefetchedTenants` to skip the get_user_tenants RPC (e.g. when the login
 * API already returned tenant data in the same response).
 * @param options
 * @param options.prefetchedTenants
 */
export async function fetchAuthData(options?: { prefetchedTenants?: UserTenant[] }): Promise<AuthData> {
  const skipTenants = (options?.prefetchedTenants?.length ?? 0) > 0
  const t0 = Date.now()

  if (skipTenants) {
    console.log(`[LOGIN:fetchAuthData] [${Date.now() - t0}ms] ▶ get_user_permissions + get_user_workflow_roles [parallel] (tenants prefetched: ${options!.prefetchedTenants!.length})`)
    const [permissionsResult, workflowRolesResult] = await Promise.all([
      supabase.rpc('get_user_permissions'),
      supabase.rpc('get_user_workflow_roles'),
    ])
    console.log(`[LOGIN:fetchAuthData] [${Date.now() - t0}ms] ✓ done — permissions: ${permissionsResult.data?.length ?? 0} row(s), workflowRoles: ${workflowRolesResult.data?.length ?? 0} row(s)`)

    if (permissionsResult.error) {
      console.error('Error fetching permissions:', permissionsResult.error)
    }
    if (workflowRolesResult.error) {
      console.error('Error fetching workflow roles:', workflowRolesResult.error)
    }

    const permissions: string[] = (permissionsResult.data || []).map(
      (p: { permission_code: string }) => p.permission_code
    )
    const workflowRoles: string[] = (workflowRolesResult.data || []).map(
      (r: { workflow_role: string }) => r.workflow_role
    )

    return {
      tenants: options!.prefetchedTenants!,
      permissions,
      workflowRoles,
      featureFlags: {},
    }
  }

  console.log(`[LOGIN:fetchAuthData] [${Date.now() - t0}ms] ▶ get_user_permissions + get_user_workflow_roles + get_user_tenants [parallel]`)
  const [permissionsResult, workflowRolesResult, tenantsResult] = await Promise.all([
    supabase.rpc('get_user_permissions'),
    supabase.rpc('get_user_workflow_roles'),
    fetchTenantsWithRetry(),
  ])
  console.log(`[LOGIN:fetchAuthData] [${Date.now() - t0}ms] ✓ done — permissions: ${permissionsResult.data?.length ?? 0} row(s), workflowRoles: ${workflowRolesResult.data?.length ?? 0} row(s), tenants: ${tenantsResult.data?.length ?? 0} row(s)`)

  if (tenantsResult.error) {
    console.error('Error fetching tenants:', tenantsResult.error)
    const message =
      typeof tenantsResult.error === 'object' &&
      tenantsResult.error !== null &&
      'message' in tenantsResult.error &&
      typeof tenantsResult.error.message === 'string'
        ? tenantsResult.error.message
        : 'Unable to load tenant access. Please try again.'
    throw new Error(message)
  }

  if (permissionsResult.error) {
    console.error('Error fetching permissions:', permissionsResult.error)
  }
  if (workflowRolesResult.error) {
    console.error('Error fetching workflow roles:', workflowRolesResult.error)
  }

  const tenants: UserTenant[] = (tenantsResult.data || []).map((t: {
    tenant_id: string
    tenant_name: string
    tenant_slug: string
    user_role: string
    is_active: boolean
    last_login_at: string | null
    s_current_plan?: string
  }) => ({
    tenant_id: t.tenant_id,
    tenant_name: t.tenant_name,
    tenant_slug: t.tenant_slug,
    user_role: t.user_role as any,
    is_active: t.is_active,
    last_login_at: t.last_login_at,
    s_current_plan: t.s_current_plan ?? 'FREE_TRIAL',
  }))

  const permissions: string[] = (permissionsResult.data || []).map(
    (p: { permission_code: string }) => p.permission_code
  )
  const workflowRoles: string[] = (workflowRolesResult.data || []).map(
    (r: { workflow_role: string }) => r.workflow_role
  )

  // Fetch feature flags for first tenant (if available)
  // TEMPORARILY DISABLED
  // if (tenants.length > 0) { ... }

  return {
    tenants,
    permissions,
    workflowRoles,
    featureFlags: {},
  }
}
