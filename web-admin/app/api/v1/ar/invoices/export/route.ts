import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { exportArInvoicesCsv } from '@/lib/services/ar-invoice.service';
import { arInvoiceListQuerySchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('invoices:export')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arInvoiceListQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const csv = await exportArInvoicesCsv(parsed.data, { tenantId: auth.tenantId });
    const filename = `ar-invoices-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonApiError(error, 'Failed to export AR invoices');
  }
}
