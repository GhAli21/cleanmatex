import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getSessionClosureView } from '@/lib/services/cash-drawer-session-view.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/closure
 *
 * CLF-8-8 — per-currency balances, counts (with denominations), disposition
 * and post-close status/history for one session.
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params drawer and session ids
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;

  const { drawerId, sessionId } = await params;
  try {
    const view = await getSessionClosureView(auth.tenantId, drawerId, sessionId);
    if (!view) return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: view });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the session closure details');
  }
}
