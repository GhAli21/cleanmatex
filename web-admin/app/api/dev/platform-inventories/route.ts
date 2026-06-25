import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import {
  normalizePlatformInventoryTab,
  queryPlatformInventory,
} from '@/lib/platform/platform-inventories-reader'
import { HELP_PERMISSIONS } from '@/lib/constants/help'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/dev/platform-inventories
 * Read-only platform inventory browser data.
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission(HELP_PERMISSIONS.PLATFORM_INVENTORIES)(request)
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const tab = normalizePlatformInventoryTab(searchParams.get('tab') ?? 'contracts')

    const result = queryPlatformInventory({
      tab,
      search: searchParams.get('search') ?? undefined,
      route: searchParams.get('route') ?? undefined,
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: Number(searchParams.get('pageSize') ?? '25'),
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('platform-inventories API failed', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load platform inventories' },
      { status: 500 }
    )
  }
}
