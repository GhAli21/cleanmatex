import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getSessionSummary } from '@/lib/services/cash-drawer.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string; sessionId: string }> }
) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { sessionId } = await params;

  try {
    const summary = await getSessionSummary(tenantId, sessionId);
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch session summary';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
