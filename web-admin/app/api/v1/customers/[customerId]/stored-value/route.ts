import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getStoredValueSummary } from '@/lib/services/stored-value.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requirePermission('stored_value:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { customerId } = await params;

  try {
    const summary = await getStoredValueSummary(tenantId, customerId);
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch stored value';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
