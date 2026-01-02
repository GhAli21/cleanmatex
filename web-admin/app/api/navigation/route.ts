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
// Add timeout wrapper for Vercel (10s timeout on Hobby plan)
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ])
}

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
    
    const { data: permissionsData, error: permsError } = await (supabase.rpc as any)('get_role_permissions_jh', {
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
    // TEMPORARILY DISABLED to prevent timeout - feature flags will use defaults
    // try {
    //   const { getFeatureFlags } = await import('@/lib/services/feature-flags.service')
    //   console.log('Jh In GET() [ 5 ] : getFeatureFlags');
    //   const tenantId = tenants[0].tenant_id as string
    //   console.log('Jh In GET() [ 6 ] : tenantId', tenantId);
    //   const flags = await getFeatureFlags(tenantId)
    //   // Convert FeatureFlags type to Record<string, boolean>
    //   featureFlags = flags as unknown as Record<string, boolean>
    // } catch (error) {
    //   console.warn('Failed to fetch feature flags for navigation:', error)
    // }

    // Fetch navigation from database with timeout
    const navigation = await withTimeout(
      getNavigationFromDatabase(userPermissions, userRole, featureFlags),
      7000 // 7 second timeout (leave 3s buffer for Vercel's 10s limit)
    )

    console.log('Navigation API returning:', {
      sectionsCount: navigation.length,
      userRole,
      permissionsCount: userPermissions.length,
      navigation: navigation.map(s => ({ key: s.key, label: s.label, childrenCount: s.children?.length || 0 })),
    })

    return NextResponse.json({
      sections: navigation,
      cached: false,
      source: 'database',
    })
  } catch (error) {
    console.error('Error in GET /api/navigation:', error)
    
    // Try to get fallback navigation even on error
    try {
      // If we have userRole, try to get fallback
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: tenants } = await supabase.rpc('get_user_tenants')
        if (tenants && tenants.length > 0) {
          const userRole = tenants[0].user_role?.toLowerCase() as UserRole | null
          if (userRole) {
            const navService = await import('@/lib/services/navigation.service')
            const fallback = navService.getSystemNavigationFallback(userRole, [], {})
            // Use fallback directly - it already handles super_admin case internally
            const navigation = fallback
            
            return NextResponse.json({
              sections: navigation,
              cached: false,
              source: 'fallback-error',
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }
      }
    } catch (fallbackError) {
      console.error('Error getting fallback navigation:', fallbackError)
    }
    
    // Return empty navigation as last resort
    return NextResponse.json({
      sections: [],
      cached: false,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 }) // Always return 200 to prevent connection errors
  }
}
