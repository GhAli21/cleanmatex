import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { startClose } from '@/lib/services/cash-drawer-session.service';
import { startCloseRequestSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardCashDrawerSessionBranch, guardDrawerBranch } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/count
 *
 * CLF §4B.7 — the close wizard's count step: freezes the cut
 * (`close_ledger_seq`), takes the optional closing count, and moves the
 * session OPEN -> CLOSING. From here the ledger gate refuses interactive
 * cash on this drawer until finalize or force-close.
 * @param request JSON body matching `startCloseRequestSchema`
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
  const branchDenied = await guardDrawerBranch(auth, drawerId);
  if (branchDenied) return branchDenied;
  const sessionDenied = await guardCashDrawerSessionBranch(auth, sessionId);
  if (sessionDenied) return sessionDenied;
  const body = await request.json().catch(() => null);
  const parsed = startCloseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await startClose(tenantId, userId, {
      sessionId,
      drawerId,
      closingCount: parsed.data.closingCount,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to start the close count step');
  }
}
