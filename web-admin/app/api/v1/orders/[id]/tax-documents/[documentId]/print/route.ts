/**
 * B14 follow-up — Tax document print/view data.
 *
 * GET /api/v1/orders/[id]/tax-documents/[documentId]/print
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getTaxDocumentPrintDetail, TaxDocumentReadError } from '@/lib/services/tax-document-read.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await requirePermission('orders:view_financial_breakdown')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: orderId, documentId } = await params;

  try {
    const data = await getTaxDocumentPrintDetail(tenantId, orderId, documentId);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    if (err instanceof TaxDocumentReadError) {
      return NextResponse.json({ success: false, error: err.code }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'Failed to load tax document';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
