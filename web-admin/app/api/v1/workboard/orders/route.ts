import { NextRequest, NextResponse } from 'next/server'

import { WORKBOARD_PERMISSIONS } from '@/lib/constants/permissions/workboard-perm'
import { requirePermission } from '@/lib/middleware/require-permission'
import { WorkboardQueryService } from '@/lib/services/workboard/workboard-query.service'
import { logger } from '@/lib/utils/logger'
import { workboardQuerySchema } from '@/lib/validations/workboard-schema'

/** Returns the tenant-scoped, read-only supervisor Workboard projection. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(WORKBOARD_PERMISSIONS.READ)(request)
  if (auth instanceof NextResponse) return auth

  const parsed = workboardQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid Workboard query.' }, { status: 400 })

  try {
    const data = await WorkboardQueryService.list(auth.tenantId, parsed.data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Workboard query failed', error as Error, { feature: 'workboard', action: 'list', tenantId: auth.tenantId })
    return NextResponse.json({ success: false, error: 'Unable to load the Workboard.' }, { status: 500 })
  }
}
