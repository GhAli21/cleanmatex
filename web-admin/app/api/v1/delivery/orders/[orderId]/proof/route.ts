import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { DeliveryProofAuditService } from '@/lib/services/delivery/delivery-proof-audit.service';

/** Returns tenant-scoped delivery proof with expiring evidence links for authorized operations staff. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  const { orderId } = await params;
  const audit = await DeliveryProofAuditService.getOrderAudit(auth.tenantId, orderId);
  if (!audit) {
    return NextResponse.json(
      { success: false, code: 'ORDER_NOT_FOUND', error: 'Order was not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: audit });
}
