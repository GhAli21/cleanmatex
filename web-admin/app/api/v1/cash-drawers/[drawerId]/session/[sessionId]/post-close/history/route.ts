import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { listPostCloseHistory } from '@/lib/services/cash-drawer-session.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/post-close/history
 *
 * CLF §4B.7 — the full after-close change log for one session, newest first.
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params drawer (unused server-side, scoped by session) and session ids
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { sessionId } = await params;

  try {
    const rows = await listPostCloseHistory(tenantId, sessionId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the post-close history');
  }
}
