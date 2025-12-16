import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'

/**
 * GET /api/feature-flags
 * 
 * Returns feature flags for the current user's active tenant
 * Client-safe endpoint for fetching feature flags
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's tenants
    const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants')
    
    if (tenantsError || !tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: 'No tenant access found' },
        { status: 403 }
      )
    }

    // Get feature flags for the first (current) tenant
    const tenantId = tenants[0].tenant_id as string
    const flags = await getFeatureFlags(tenantId)

    return NextResponse.json(flags)
  } catch (error) {
    console.error('Error fetching feature flags:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
