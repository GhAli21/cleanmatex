import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { processRefund } from '@/lib/services/order-refund.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:process_refund')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { refundId } = await params;

  try {
    const refund = await processRefund(tenantId, refundId, userId);
    return NextResponse.json({ success: true, data: refund });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund processing failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
