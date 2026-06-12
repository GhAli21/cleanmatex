import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { postCustomerAccountReceipt } from '@/lib/services/customer-receipt-posting.service';
import { postCustomerReceiptRequestSchema } from '@/lib/validations/customer-receipt-allocation-schema';

export async function POST(request: NextRequest) {
  const auth = await requireAnyPermission([
    'customers:receipt_allocate',
    'orders:overpayment_allocate',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const input = postCustomerReceiptRequestSchema.parse(body);
    const result = await postCustomerAccountReceipt(
      auth.tenantId,
      auth.userId ?? 'system',
      input
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post customer receipt';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
