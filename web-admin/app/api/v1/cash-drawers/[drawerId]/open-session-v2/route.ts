import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { openSession } from '@/lib/services/cash-drawer-session.service';
import { openSessionRequestSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardDrawerBranch } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/[drawerId]/open-session-v2
 *
 * CLF two-step lifecycle open (plan §4B.7 `open-session`) — the only way to
 * open a drawer session (the legacy single-step route was removed in CLF R3;
 * the drawer screen and Payment Modal V4 both call this). The expected
 * opening cash is always computed server-side from drawer history; the
 * caller may only supply what it physically counted (`openingCount`).
 * @param request JSON body matching `openSessionRequestSchema`
 * @param root0 route params
 * @param root0.params drawer id
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:open_session')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId } = await params;
  const branchDenied = await guardDrawerBranch(auth, drawerId);
  if (branchDenied) return branchDenied;
  const body = await request.json().catch(() => null);
  const parsed = openSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await openSession(tenantId, userId, {
      drawerId,
      openingCount: parsed.data.openingCount,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to open session');
  }
}
