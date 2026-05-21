import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

/**
 * GET /api/feature-flags
 * 
 * Returns feature flags for the current user's active tenant
 * Client-safe endpoint for fetching feature flags
 */
export async function GET() {
  const startTime = Date.now()
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 8000)
    })

    const { tenantId } = await Promise.race([getAuthContext(), timeoutPromise])
    const flags = await Promise.race([getFeatureFlags(tenantId), timeoutPromise])

    return NextResponse.json(flags)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[API] GET /api/feature-flags - Error after ${duration}ms:`, error)
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
