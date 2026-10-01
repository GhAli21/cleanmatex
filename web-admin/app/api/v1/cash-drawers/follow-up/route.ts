import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { listFollowUpSessions } from '@/lib/services/cash-drawer-follow-up.service';
import { followUpListQuerySchema } from '@/lib/validations/cash-drawer/list-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/cash-drawers/follow-up
 *
 * CLF §4B.7, CLF-8-9 — closed sessions whose disposition moved cash into a
 * `PENDING_DEPOSIT` drawer, filterable by post-close status, paginated.
 * @param request authenticated request with page/pageSize/postCloseStatusCode query params
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view_reports')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = followUpListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await listFollowUpSessions(tenantId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the follow-up list');
  }
}
