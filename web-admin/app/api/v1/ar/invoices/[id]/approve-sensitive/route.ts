import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { approveSensitiveArInvoice } from '@/lib/services/ar-invoice.service';
import { approveSensitiveArInvoiceSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('invoices:approve_sensitive')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = approveSensitiveArInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await approveSensitiveArInvoice(id, parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      userName: auth.userName,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to approve sensitive AR invoice action');
  }
}
