import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { forceClose, type DispositionDecisionInput } from '@/lib/services/cash-drawer-session.service';
import { forceCloseRequestSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardCashDrawerSessionBranch, guardDrawerBranch } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/force-close
 *
 * CLF §4B.7 — supervisor force-close from either `OPEN` (the count step
 * never ran) or `CLOSING`. A reason is mandatory; the same disposition rules
 * as a normal finalize apply.
 * @param request JSON body matching `forceCloseRequestSchema`
 * @param root0 route params
 * @param root0.params drawer and session ids
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('pos_session:force_close')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId, sessionId } = await params;
  const branchDenied = await guardDrawerBranch(auth, drawerId);
  if (branchDenied) return branchDenied;
  const sessionDenied = await guardCashDrawerSessionBranch(auth, sessionId);
  if (sessionDenied) return sessionDenied;
  const body = await request.json().catch(() => null);
  const parsed = forceCloseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await forceClose(tenantId, userId, {
      sessionId,
      drawerId,
      reason: parsed.data.reason,
      dispositions: parsed.data.dispositions as DispositionDecisionInput[],
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to force-close the session');
  }
}
