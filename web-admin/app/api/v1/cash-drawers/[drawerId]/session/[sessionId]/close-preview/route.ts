import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getClosePreview } from '@/lib/services/cash-drawer-session.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardCashDrawerSessionBranch, guardDrawerBranch } from '@/lib/api/branch-access-guard';

/**
 * GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/close-preview
 *
 * CLF §4B.7, C2-1 absorbed — read-only preview of what a close would show
 * right now (not a frozen cut; the count step is what actually freezes it).
 * Omits `expected` per currency when the drawer's resolved `blindCloseEnabled`
 * setting is on.
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params drawer and session ids
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const auth = await requirePermission('cash_drawer:close_session')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId, sessionId } = await params;
  const branchDenied = await guardDrawerBranch(auth, drawerId);
  if (branchDenied) return branchDenied;
  const sessionDenied = await guardCashDrawerSessionBranch(auth, sessionId);
  if (sessionDenied) return sessionDenied;

  try {
    const result = await getClosePreview(tenantId, userId, { drawerId, sessionId });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load close preview');
  }
}
