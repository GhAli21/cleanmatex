import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  createArInvoice,
  listArInvoices,
} from '@/lib/services/ar-invoice.service';
import {
  arInvoiceListQuerySchema,
  createArInvoiceSchema,
} from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('invoices:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arInvoiceListQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const data = await listArInvoices(parsed.data, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return jsonApiError(error, 'Failed to list AR invoices');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('invoices:create')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createArInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await createArInvoice(parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      userName: auth.userName,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return jsonApiError(error, 'Failed to create AR invoice');
  }
}
