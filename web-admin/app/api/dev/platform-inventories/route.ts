import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { queryPlatformInventory } from '@/lib/platform/platform-inventories-reader'
import type { PlatformInventoryTab } from '@/lib/platform/platform-inventories-types'
import { logger } from '@/lib/utils/logger'

const VALID_TABS = new Set<PlatformInventoryTab>(['contracts', 'permissions', 'flags', 'navigation', 'summary'])

/**
 * GET /api/dev/platform-inventories
 * Read-only platform inventory browser data (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('admin:read')(request)
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const tabParam = searchParams.get('tab') ?? 'contracts'
    const tab = VALID_TABS.has(tabParam as PlatformInventoryTab)
      ? (tabParam as PlatformInventoryTab)
      : 'contracts'

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
