import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { issueArInvoice } from '@/lib/services/ar-invoice.service';
import { issueArInvoiceSchema } from '@/lib/validations/ar-invoice-schemas';
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
  const auth = await requirePermission('invoices:issue')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = issueArInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await issueArInvoice(id, parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      userName: auth.userName,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to issue AR invoice');
  }
}
