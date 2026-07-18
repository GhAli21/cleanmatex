/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/approve-variance
 *
 * B16 — deferred variance-approval action: a supervisor approves an
 * over-threshold drawer-close variance with a mandatory reason. Permission
 * `cash_drawer:approve_variance` is seeded by B27; this route stays fail-closed
 * (permission denied) until that migration lands and the role is granted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import {
  approveSessionVariance,
  VarianceApprovalError,
  VARIANCE_APPROVAL_ERRORS,
} from '@lib/services/cash-drawer.service'

const schema = z.object({
  reason: z.string().trim().min(1),
})

const ERROR_STATUS: Record<string, number> = {
  [VARIANCE_APPROVAL_ERRORS.NOT_PENDING_APPROVAL]: 409,
  [VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED]: 409,
  [VARIANCE_APPROVAL_ERRORS.SELF_APPROVAL_BLOCKED]: 403,
  [VARIANCE_APPROVAL_ERRORS.REASON_REQUIRED]: 400,
}

/**
 * Approve a session's pending drawer-close variance.
 *
 * @param request authenticated request carrying tenant context
 * @param root0 route params (drawerId unused server-side; sessionId is scoped by tenant + route)
 * @param root0.params route params including drawer and session ids
 * @returns the updated session row
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const csrf = await validateCSRF(request)
  if (csrf) return csrf

  const auth = await requirePermission('cash_drawer:approve_variance')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth

  const { sessionId } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const session = await approveSessionVariance(tenantId, sessionId, {
      approvedBy: userId,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ success: true, data: session })
  } catch (error) {
    if (error instanceof VarianceApprovalError) {
      return NextResponse.json(
        { success: false, error: error.code },
        { status: ERROR_STATUS[error.code] ?? 400 },
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to approve variance'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
