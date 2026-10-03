import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { updatePostClose } from '@/lib/services/cash-drawer-session.service';
import { updatePostCloseRequestSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardCashDrawerSessionBranch } from '@/lib/api/branch-access-guard';

/**
 * PUT /api/v1/cash-drawers/[drawerId]/session/[sessionId]/post-close
 *
 * CLF §4B.7 — appends to the after-close change log (`IN_TRANSIT` ->
 * `DEPOSITED_TO_BANK` etc). Only valid once the session is `CLOSED` or
 * `FORCE_CLOSED`.
 * @param request JSON body matching `updatePostCloseRequestSchema`
 * @param root0 route params
 * @param root0.params drawer (unused server-side, scoped by session) and session ids
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:post_close_update')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { sessionId } = await params;
  const sessionDenied = await guardCashDrawerSessionBranch(auth, sessionId);
  if (sessionDenied) return sessionDenied;
  const body = await request.json().catch(() => null);
  const parsed = updatePostCloseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    await updatePostClose(tenantId, userId, {
      sessionId,
      postCloseStatusCode: parsed.data.postCloseStatusCode,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: { sessionId } });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to update the post-close status');
  }
}
