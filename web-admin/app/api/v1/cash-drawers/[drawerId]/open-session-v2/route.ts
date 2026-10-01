import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { openSession } from '@/lib/services/cash-drawer-session.service';
import { openSessionRequestSchema } from '@/lib/validations/cash-drawer/session-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * POST /api/v1/cash-drawers/[drawerId]/open-session-v2
 *
 * CLF two-step lifecycle open (plan §4B.7 `open-session`, CLF-8 slice A).
 * A distinct path from the legacy `.../open-session` — that route is still
 * live for Payment Modal V4's checkout flow (`use-cash-drawer.ts`, an
 * explicitly behavior-frozen surface) and is retired separately, in the same
 * pass that migrates checkout onto this contract (M10/R3). The opening
 * float is always computed server-side from drawer history; this route
 * never accepts a manually declared `openingBalance`.
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
