import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import {
  confirmAllocationPreview,
  getAllocationPreview,
} from '@/lib/services/customer-receipt-allocation-preview.service';
import {
  confirmAllocationPreviewRequestSchema,
  postAllocationRequestSchema,
} from '@/lib/validations/customer-receipt-allocation-schema';

export async function POST(request: NextRequest) {
  const auth = await requireAnyPermission([
    'orders:overpayment_allocate',
    'customers:receipt_allocate',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    if (body.confirmOnly === true) {
      const input = confirmAllocationPreviewRequestSchema.parse(body);
      const preview = await confirmAllocationPreview(
        auth.tenantId,
        input.previewId,
        input.customerId,
        auth.userId ?? null
      );
      return NextResponse.json({ success: true, data: preview });
    }

    const input = postAllocationRequestSchema.parse(body);
    const preview = await getAllocationPreview(auth.tenantId, input.previewId);
    if (!preview) {
      return NextResponse.json({ success: false, error: 'Preview not found' }, { status: 404 });
    }

    const confirmed = await confirmAllocationPreview(
      auth.tenantId,
      input.previewId,
      input.customerId,
      auth.userId ?? null
    );

    return NextResponse.json({
      success: true,
      data: {
        previewId: confirmed.previewId,
        previewStatus: confirmed.previewStatus,
        allocations: confirmed.allocations,
        remainingUnallocatedAmount: confirmed.remainingUnallocatedAmount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post allocation preview';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
