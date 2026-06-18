import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getArCustomerStatement } from '@/lib/services/ar-invoice.service';
import { arStatementQuerySchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requirePermission('customer_statements:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arStatementQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const { customerId } = await params;
    const data = await getArCustomerStatement(customerId, parsed.data, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to load AR statement print data');
  }
}
