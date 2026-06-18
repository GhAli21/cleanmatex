import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getCreditNotes } from '@/lib/services/stored-value.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('stored_value:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: customerId } = await params;

  try {
    const creditNotes = await getCreditNotes(tenantId, customerId);
    return NextResponse.json({ success: true, data: creditNotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch credit notes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
