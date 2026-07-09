/**
 * GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]
 *
 * Returns the full session truth payload used by the hidden session detail
 * route.
 */

import { NextRequest, NextResponse } from 'next/server'

import { requirePermission } from '@lib/middleware/require-permission'
import { getCashDrawerSessionDetail } from '@lib/services/cash-drawer.service'
import { cashDrawerSessionDetailQuerySchema } from '@lib/validations/cash-drawer-schemas'

/**
 * Load the canonical session detail payload.
 *
 * @param request authenticated request carrying tenant context
 * @param root0 route params including drawer and session ids
 * @returns full session detail DTO with independently paginated child grids
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const auth = await requirePermission('cash_drawer:view')(request)
  if (auth instanceof NextResponse) return auth

  const { drawerId, sessionId } = await params
  const query = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = cashDrawerSessionDetailQuerySchema.safeParse(query)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const data = await getCashDrawerSessionDetail(auth.tenantId, drawerId, sessionId, parsed.data)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load cash drawer session'
    const status = message === 'Cash drawer session not found' || message === 'Cash drawer not found' ? 404 : 500
    const safeMessage =
      status === 404 ? (message === 'Cash drawer not found' ? 'Cash drawer not found' : 'Cash drawer session not found') : 'Failed to load cash drawer session'

    return NextResponse.json({ success: false, error: safeMessage }, { status })
  }
}
