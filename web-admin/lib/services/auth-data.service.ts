'use client'

/**
 * Batch Auth Data Service
 * 
 * Fetches all authentication-related data in parallel for better performance
 * Includes: tenants, permissions, workflow roles, and feature flags
 */

import { supabase } from '@/lib/supabase/client'
import type { UserTenant } from '@/types/auth'

export interface AuthData {
  tenants: UserTenant[]
  permissions: string[]
  workflowRoles: string[]
  featureFlags: Record<string, boolean>
}

/**
 * Fetch all authentication data in parallel
 * @returns Combined auth data (tenants, permissions, workflow roles, feature flags)
 */
export async function fetchAuthData(): Promise<AuthData> {
  try {
    // Fetch all data in parallel
    const [tenantsResult, permissionsResult, workflowRolesResult] = await Promise.all([
      supabase.rpc('get_user_tenants'),
      supabase.rpc('get_user_permissions'),
      supabase.rpc('get_user_workflow_roles'),
    ])

    // Handle errors
    if (tenantsResult.error) {
      console.error('Error fetching tenants:', tenantsResult.error)
      throw new Error('Failed to fetch tenants')
    }

    if (permissionsResult.error) {
      console.error('Error fetching permissions:', permissionsResult.error)
      // Don't throw - permissions might not be critical for initial load
    }

    if (workflowRolesResult.error) {
      console.error('Error fetching workflow roles:', workflowRolesResult.error)
      // Don't throw - workflow roles might not be critical for initial load
    }

    // Transform data
    const tenants: UserTenant[] = (tenantsResult.data || []).map((t: {
      tenant_id: string
      tenant_name: string
      tenant_slug: string
      user_role: string
      is_active: boolean
      last_login_at: string | null
    }) => ({
      tenant_id: t.tenant_id,
      tenant_name: t.tenant_name,
      tenant_slug: t.tenant_slug,
      user_role: t.user_role as any,
      is_active: t.is_active,
      last_login_at: t.last_login_at,
    }))

    const permissions: string[] = (permissionsResult.data || []).map(
      (p: { permission_code: string }) => p.permission_code
    )

    const workflowRoles: string[] = (workflowRolesResult.data || []).map(
      (r: { workflow_role: string }) => r.workflow_role
    )

    // Fetch feature flags for first tenant (if available)
    let featureFlags: Record<string, boolean> = {}
    // TEMPORARILY DISABLED
    // if (tenants.length > 0) {
    //   try {
    //     const response = await fetch('/api/feature-flags')
    //     if (response.ok) {
    //       featureFlags = await response.json()
    //     } else {
    //       console.warn('Failed to fetch feature flags:', response.statusText)
    //     }
    //   } catch (error) {
    //     console.warn('Error fetching feature flags:', error)
    //     // Continue with empty feature flags
    //   }
    // }

    return {
      tenants,
      permissions,
      workflowRoles,
      featureFlags,
    }
  } catch (error) {
    console.error('Error in fetchAuthData:', error)
    // Return empty data structure on error
    return {
      tenants: [],
      permissions: [],
      workflowRoles: [],
      featureFlags: {},
    }
  }
}
