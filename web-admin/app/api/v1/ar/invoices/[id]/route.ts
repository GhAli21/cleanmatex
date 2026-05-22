import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getArInvoiceDetail,
  updateArInvoice,
} from '@/lib/services/ar-invoice.service';
import { updateArInvoiceSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('invoices:view')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const data = await getArInvoiceDetail(id, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to fetch AR invoice');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('invoices:update')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateArInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await updateArInvoice(id, parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      userName: auth.userName,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to update AR invoice');
  }
}
