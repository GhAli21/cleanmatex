import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getArCustomerBalance } from '@/lib/services/ar-invoice.service';
import { jsonApiError } from '@/app/api/v1/ar/_shared';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requirePermission('ar_ledger:view')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { customerId } = await params;
    const data = await getArCustomerBalance(customerId, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to fetch AR customer balance');
  }
}
