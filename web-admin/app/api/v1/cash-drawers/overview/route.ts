/**
 * GET /api/v1/cash-drawers/overview
 *
 * Returns the paginated master-table payload for the cash-drawer hub.
 */

import { NextRequest, NextResponse } from 'next/server'

import { requirePermission } from '@lib/middleware/require-permission'
import { getCashDrawerOverviewPage } from '@lib/services/cash-drawer.service'
import { cashDrawerOverviewQuerySchema } from '@lib/validations/cash-drawer-schemas'

/**
 * Load the cash-drawer hub master table.
 *
 * @param request authenticated request carrying tenant context
 * @returns paginated drawer overview rows scoped to the authenticated tenant
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view')(request)
  if (auth instanceof NextResponse) return auth

  const query = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = cashDrawerOverviewQuerySchema.safeParse(query)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const data = await getCashDrawerOverviewPage(
      auth.tenantId,
      parsed.data.page,
      parsed.data.pageSize,
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load cash drawers' }, { status: 500 })
  }
}
