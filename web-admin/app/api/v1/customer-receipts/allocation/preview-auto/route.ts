import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { createAutoAllocationPreview } from '@/lib/services/customer-receipt-allocation-preview.service';
import { previewAutoAllocationRequestSchema } from '@/lib/validations/customer-receipt-allocation-schema';

export async function POST(request: NextRequest) {
  const auth = await requireAnyPermission([
    'orders:overpayment_allocate',
    'customers:receipt_allocate',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const input = previewAutoAllocationRequestSchema.parse(body);
    const preview = await createAutoAllocationPreview(auth.tenantId, auth.userId ?? null, input);
    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to preview auto allocation';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
