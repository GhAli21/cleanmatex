import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getArInvoiceDetail } from '@/lib/services/ar-invoice.service';
import { jsonApiError } from '@/app/api/v1/ar/_shared';

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
  const auth = await requirePermission('invoices:print')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const data = await getArInvoiceDetail(id, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to load AR invoice print data');
  }
}
