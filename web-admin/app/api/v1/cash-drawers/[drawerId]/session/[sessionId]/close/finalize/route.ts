import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { finalizeClose, type DispositionDecisionInput } from '@/lib/services/cash-drawer-session.service';
import { finalizeCloseRequestSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/finalize
 *
 * CLF §4B.7 — finalizes a session that already went through the count step
 * (`CLOSING`): validates every currency's disposition, posts a
 * `CLOSE_DISPOSITION` custody transaction for whatever actually moves cash,
 * and sets the session `CLOSED` (or flags it pending variance approval).
 * @param request JSON body matching `finalizeCloseRequestSchema`
 * @param root0 route params
 * @param root0.params drawer and session ids
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:close_session')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId, sessionId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = finalizeCloseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await finalizeClose(tenantId, userId, {
      sessionId,
      drawerId,
      // The Zod enum validates each code against USER_SELECTABLE_DISPOSITIONS at
      // runtime but (like other CLF enum schemas) infers as `string` — see
      // cash-in-out/route.ts's `as never` for the same pattern.
      dispositions: parsed.data.dispositions as DispositionDecisionInput[],
      varianceReason: parsed.data.varianceReason,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to finalize the close');
  }
}
