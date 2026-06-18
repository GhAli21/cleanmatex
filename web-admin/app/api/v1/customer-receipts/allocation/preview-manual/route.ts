import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { createManualAllocationPreview } from '@/lib/services/customer-receipt-allocation-preview.service';
import { previewManualAllocationRequestSchema } from '@/lib/validations/customer-receipt-allocation-schema';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const auth = await requireAnyPermission([
    'orders:overpayment_allocate',
    'customers:receipt_allocate',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const input = previewManualAllocationRequestSchema.parse(body);
    const preview = await createManualAllocationPreview(auth.tenantId, auth.userId ?? null, input);
    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to preview manual allocation';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
