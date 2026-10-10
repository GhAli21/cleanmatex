import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { recordMissingOpeningCount } from '@/lib/services/cash-drawer-session.service';
import { recordMissingOpeningCountSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardCashDrawerSessionBranch, guardDrawerBranch } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/opening-count
 *
 * Records the opening count on a session that was opened without one, so a
 * POS session can connect to that drawer after the cashier counts or confirms.
 * Refuses when an opening count is already stored.
 * @param request JSON body matching `recordMissingOpeningCountSchema`
 * @param root0 route params
 * @param root0.params drawer and session ids
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:open_session')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId, sessionId } = await params;
  const branchDenied = await guardDrawerBranch(auth, drawerId);
  if (branchDenied) return branchDenied;
  const sessionDenied = await guardCashDrawerSessionBranch(auth, sessionId);
  if (sessionDenied) return sessionDenied;
  const body = await request.json().catch(() => null);
  const parsed = recordMissingOpeningCountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await recordMissingOpeningCount(tenantId, userId, {
      drawerId,
      sessionId,
      openingCount: parsed.data.openingCount,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to record the opening count');
  }
}
