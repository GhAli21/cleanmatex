import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNavigationFromDatabase } from '@/lib/services/navigation.service'
import type { UserRole } from '@/config/navigation'

/**
 * GET /api/navigation
 * 
 * Returns navigation items filtered by user permissions
 * Uses database function to build parent chain automatically
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      // Return empty navigation for unauthenticated users (no default access)
      return NextResponse.json({
        sections: [],
        cached: false,
        source: 'fallback',
      })
    }

    // Get user's tenants to determine role
    const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants')

    if (tenantsError || !tenants || tenants.length === 0) {
      // No tenant access - return empty navigation
      return NextResponse.json({
        sections: [],
        cached: false,
        source: 'fallback',
      })
    }

    // Get user role - if not found, return empty navigation (no default role)
    const userRoleRaw = tenants[0].user_role?.toLowerCase()
    if (!userRoleRaw) {
      return NextResponse.json({
        sections: [],
        cached: false,
        source: 'fallback',
      })
    }

    const userRole = userRoleRaw as UserRole

    console.log('Jh In GET() [ 1 ] : user.id', user.id);
    console.log('Jh In GET() [ 2 ] : tenants[0].tenant_id', tenants[0].tenant_id);
    console.log('Jh In GET() [ 3 ] : userRole', userRole);
    // Get user permissions
    
    const { data: permissionsData, error: permsError } = await supabase.rpc('get_role_permissions_jh', {
      p_role_code: userRole as string,
    })
    
    /*
    const { data: permissionsData, error: permsError } = await supabase.rpc('get_user_permissions_jh', {
      p_cur_user_id: user.id,
      p_cur_tenant_org_id: tenants[0].tenant_id as string,
    })
    */

    const userPermissions: string[] = permsError
      ? []
      : (permissionsData || []).map((p: { permission_code: string }) => p.permission_code)

      console.log('Jh In GET() [ 4 ] : userPermissions.length', userPermissions?.length);
      //console.log('Jh In GET() [ 5 ] : permsError', permsError);
      
      // Get feature flags
    let featureFlags: Record<string, boolean> = {}
    try {
      const { getFeatureFlags } = await import('@/lib/services/feature-flags.service')
      console.log('Jh In GET() [ 5 ] : getFeatureFlags');
      const tenantId = tenants[0].tenant_id as string
      console.log('Jh In GET() [ 6 ] : tenantId', tenantId);
      const flags = await getFeatureFlags(tenantId)
      // Convert FeatureFlags type to Record<string, boolean>
      featureFlags = flags as unknown as Record<string, boolean>
    } catch (error) {
      console.warn('Failed to fetch feature flags for navigation:', error)
    }

    // Fetch navigation from database
    const navigation = await getNavigationFromDatabase(
      userPermissions,
      userRole,
      featureFlags
    )

    return NextResponse.json({
      sections: navigation,
      cached: false,
      source: 'database',
    })
  } catch (error) {
    console.error('Error in GET /api/navigation:', error)
    // Return empty navigation on error (no default access)
    return NextResponse.json({
      sections: [],
      cached: false,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
