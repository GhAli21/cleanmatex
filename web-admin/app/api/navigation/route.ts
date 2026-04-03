import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { createClient } from '@/lib/supabase/server'
import { getNavigationFromDatabase } from '@/lib/services/navigation.service'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'
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

export const runtime = 'nodejs' // Ensure Node.js runtime
export const maxDuration = 10 // Vercel timeout limit

export async function GET(request: Request) {
  const startTime = Date.now()
  console.log('[API] GET /api/navigation - Request started at', new Date().toISOString())
  
  // Immediately return a test response to verify route is working
  // Remove this after confirming route works
  if (request.headers.get('x-test') === 'true') {
    return NextResponse.json({ test: 'route-works', timestamp: Date.now() })
  }
  
  try {
    console.log('[API] Creating Supabase client...')
    const supabase = await createClient()
    console.log('[API] Supabase client created')

    let authContext
    try {
      authContext = await getAuthContext()
    } catch {
      return NextResponse.json({
        sections: [],
        cached: false,
        source: 'fallback',
      })
    }

    const userRole = authContext.userRole.toLowerCase() as UserRole
    const tenantId = authContext.tenantId
    const userId = authContext.userId

    console.log('Jh In GET() [ 1 ] : user.id', userId);
    console.log('Jh In GET() [ 2 ] : tenantId', tenantId);
    console.log('Jh In GET() [ 3 ] : userRole', userRole);
    // Get user permissions
    
    const { data: permissionsData, error: permsError } = await (supabase.rpc as any)('get_role_permissions_jh', {
      p_role_code: userRole as string,
    })
    
    /*
    const { data: permissionsData, error: permsError } = await supabase.rpc('get_user_permissions_jh', {
      p_cur_user_id: userId,
      p_cur_tenant_org_id: tenantId,
    })
    */

    const userPermissions: string[] = permsError
      ? []
      : (permissionsData || []).map((p: { permission_code: string }) => p.permission_code)

      console.log('Jh In GET() [ 4 ] : userPermissions.length', userPermissions?.length);
      //console.log('Jh In GET() [ 5 ] : permsError', permsError);
      
    let featureFlags: Record<string, boolean> = {}
    try {
      const flags = await withTimeout(getFeatureFlags(tenantId), 3000)
      featureFlags = flags as unknown as Record<string, boolean>
    } catch (error) {
      console.warn('Failed to fetch feature flags for navigation:', error)
    }

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

    const duration = Date.now() - startTime
    console.log(`[API] GET /api/navigation - Success (${duration}ms)`)
    
    return NextResponse.json({
      sections: navigation,
      cached: false,
      source: 'database',
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[API] GET /api/navigation - Error after ${duration}ms:`, error)
    
    // Try to get fallback navigation even on error
    try {
      const authContext = await getAuthContext()
      const userRole = authContext.userRole?.toLowerCase() as UserRole | null
      if (userRole) {
        const navService = await import('@/lib/services/navigation.service')
        const featureFlags = await getFeatureFlags(authContext.tenantId)
        const fallback = navService.getSystemNavigationFallback(
          userRole,
          [],
          featureFlags as unknown as Record<string, boolean>,
        )

        return NextResponse.json({
          sections: fallback,
          cached: false,
          source: 'fallback-error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
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
