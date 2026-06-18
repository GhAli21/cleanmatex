import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getDrawersWithCurrentSession } from '@/lib/services/cash-drawer.service';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;

  try {
    const drawers = await getDrawersWithCurrentSession(tenantId, branchId);
    return NextResponse.json({ success: true, data: drawers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch drawers';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
