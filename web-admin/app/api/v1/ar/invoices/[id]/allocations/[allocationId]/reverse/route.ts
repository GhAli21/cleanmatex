import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { reverseArPaymentAllocation } from '@/lib/services/ar-invoice.service';
import { reverseArPaymentAllocationSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocationId: string }> }
) {
  const auth = await requirePermission('invoices:allocate_payment')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, allocationId } = await params;
    const body = await request.json();
    const parsed = reverseArPaymentAllocationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await reverseArPaymentAllocation(id, allocationId, parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      userName: auth.userName,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to reverse AR payment allocation');
  }
}
