import { guardCashDrawerSessionBranch } from '@/lib/api/branch-access-guard';
/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/reject-variance
 *
 * C3 — a supervisor rejects an over-threshold drawer-close variance with a mandatory reason: the
 * variance is not accepted and needs investigation. Same gate as approval
 * (`cash_drawer:approve_variance`) and the same branch scoping; no maker-checker. The decision is
 * final — a session is never both approved and rejected.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@lib/middleware/require-permission'
import { validateCSRF } from '@/lib/middleware/csrf'
import { rejectVariance } from '@/lib/services/cash-drawer-session.service'
import {
  VarianceApprovalError,
  VARIANCE_APPROVAL_ERRORS,
} from '@lib/services/cash-drawer.service'

const schema = z.object({
  reason: z.string().trim().min(1),
})

const ERROR_STATUS: Record<string, number> = {
  [VARIANCE_APPROVAL_ERRORS.NOT_PENDING_APPROVAL]: 409,
  [VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED]: 409,
  [VARIANCE_APPROVAL_ERRORS.ALREADY_REJECTED]: 409,
  [VARIANCE_APPROVAL_ERRORS.REASON_REQUIRED]: 400,
}

/**
 * Reject a session's pending drawer-close variance.
 *
 * @param request authenticated request carrying tenant context
 * @param root0 route params (drawerId unused server-side; sessionId is scoped by tenant + branch guard)
 * @param root0.params route params including drawer and session ids
 * @returns the rejected session id
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
  const sessionDenied = await guardCashDrawerSessionBranch(auth, sessionId)
  if (sessionDenied) return sessionDenied

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    await rejectVariance(tenantId, userId, sessionId, { reason: parsed.data.reason })
    return NextResponse.json({ success: true, data: { sessionId } })
  } catch (error) {
    if (error instanceof VarianceApprovalError) {
      return NextResponse.json(
        { success: false, error: error.code },
        { status: ERROR_STATUS[error.code] ?? 400 },
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to reject variance'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
