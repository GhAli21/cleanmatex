import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { recordSpotCount, listDrawerCounts } from '@/lib/services/cash-drawer-count.service';
import { recordSpotCountRequestSchema } from '@/lib/validations/cash-drawer/count-schemas';
import { drawerCountsListQuerySchema } from '@/lib/validations/cash-drawer/list-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * POST /api/v1/cash-drawers/[drawerId]/counts
 *
 * CLF §4B.7 — a standalone SPOT check (mid-shift, on an OPEN session) or any
 * count on a count-only drawer (SAFE/PENDING_DEPOSIT/DRIVER_BAG, no session),
 * or a RECOUNT superseding a prior SPOT. The session lifecycle's own OPENING/
 * CLOSING counts are never written through this endpoint.
 * @param request JSON body matching `recordSpotCountRequestSchema`, plus an
 *   optional `cashDrawerSessionId` for a mid-shift SPOT on an OPEN session
 * @param root0 route params
 * @param root0.params drawer id
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:count')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = recordSpotCountRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await recordSpotCount(tenantId, userId, {
      drawerId,
      cashDrawerSessionId: parsed.data.cashDrawerSessionId ?? null,
      countType: parsed.data.countType,
      currencyCode: parsed.data.currencyCode,
      countMode: parsed.data.count.countMode,
      totalAmount: parsed.data.count.totalAmount,
      denominations: parsed.data.count.denominations,
      supersedesCountId: parsed.data.supersedesCountId,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to record the count');
  }
}

/**
 * GET /api/v1/cash-drawers/[drawerId]/counts — paginated count history.
 * @param request authenticated request with page/pageSize query params
 * @param root0 route params
 * @param root0.params drawer id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> },
) {
  const auth = await requirePermission('cash_drawer:count')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { drawerId } = await params;
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = drawerCountsListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await listDrawerCounts(tenantId, drawerId, parsed.data.page, parsed.data.pageSize);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load count history');
  }
}
