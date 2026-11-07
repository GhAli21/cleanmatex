/**
 * GET /api/v1/setup-health/summary
 * Failing-check counts and banner blockers for the layout banner and home card.
 * Sign-in only (no setup_health:view): the banner must reach cashiers (PLAN §3.2).
 */
import { NextRequest, NextResponse } from 'next/server'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { getSetupHealthSummary } from '@/lib/services/setup-health/setup-health.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * Returns the summary for the caller's organization.
 * @param request - Incoming request
 */
export async function GET(request: NextRequest) {
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  try {
    // Tenant resolved server-side from the validated session.
    const summary = await getSetupHealthSummary(auth.tenantId)
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    logger.error('GET /api/v1/setup-health/summary failed', error instanceof Error ? error : undefined, {
      feature: 'setup_health',
      action: 'summary',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
