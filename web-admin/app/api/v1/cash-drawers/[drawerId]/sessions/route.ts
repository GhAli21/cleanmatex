/**
 * GET /api/v1/cash-drawers/[drawerId]/sessions
 *
 * Returns the paginated session rows for a single cash drawer.
 */

import { NextRequest, NextResponse } from 'next/server'

import { requirePermission } from '@lib/middleware/require-permission'
import { getCashDrawerSessionsPage } from '@lib/services/cash-drawer.service'
import { cashDrawerSessionsQuerySchema } from '@lib/validations/cash-drawer-schemas'

/**
 * Load the lower detail table on the cash-drawer hub.
 *
 * @param request authenticated request carrying tenant context
 * @param root0 route params including the current drawer id
 * @returns paginated session rows scoped to the authenticated tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> },
) {
  const auth = await requirePermission('cash_drawer:view')(request)
  if (auth instanceof NextResponse) return auth

  const { drawerId } = await params
  const query = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = cashDrawerSessionsQuerySchema.safeParse(query)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const data = await getCashDrawerSessionsPage(
      auth.tenantId,
      drawerId,
      parsed.data.page,
      parsed.data.pageSize,
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load drawer sessions'
    const status = message === 'Cash drawer not found' ? 404 : 500
    const safeMessage = status === 404 ? 'Cash drawer not found' : 'Failed to load drawer sessions'

    return NextResponse.json({ success: false, error: safeMessage }, { status })
  }
}
