/**
 * GET /api/v1/setup-health?domain=&branchId=
 * Setup Health checks for the signed-in user's organization (read-only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { SETUP_HEALTH_PERMISSIONS } from '@/lib/constants/permissions/setup-health-perm'
import { listSetupHealth, listSetupHealthDomains } from '@/lib/services/setup-health/setup-health.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  domain: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  branchId: z.string().uuid().optional(),
})

/**
 * Lists visible checks and the domain labels used to group them.
 * @param request - Incoming request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(SETUP_HEALTH_PERMISSIONS.VIEW)(request)
  if (auth instanceof NextResponse) return auth

  const sp = request.nextUrl.searchParams
  const parsed = querySchema.safeParse({
    domain: sp.get('domain') || undefined,
    branchId: sp.get('branchId') || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid query', code: 'INVALID_QUERY' }, { status: 400 })
  }

  try {
    // Tenant resolved server-side from the authenticated session (auth.tenantId); a foreign branchId matches nothing.
    const [items, domains] = await Promise.all([
      listSetupHealth(auth.tenantId, parsed.data),
      listSetupHealthDomains(),
    ])
    return NextResponse.json({ success: true, data: { items, domains } })
  } catch (error) {
    logger.error('GET /api/v1/setup-health failed', error instanceof Error ? error : undefined, {
      feature: 'setup_health',
      action: 'list',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
