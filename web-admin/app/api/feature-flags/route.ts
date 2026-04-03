import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'

/**
 * GET /api/feature-flags
 * 
 * Returns feature flags for the current user's active tenant
 * Client-safe endpoint for fetching feature flags
 */
export async function GET() {
  try {
    const { tenantId } = await getAuthContext()
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
