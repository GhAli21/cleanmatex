import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createArInvoiceFromOrders } from '@/lib/services/ar-invoice.service';
import { createArInvoiceFromOrdersSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission('invoices:create')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createArInvoiceFromOrdersSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await createArInvoiceFromOrders(parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      userName: auth.userName,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return jsonApiError(error, 'Failed to create AR invoice from orders');
  }
}
