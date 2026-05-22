import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getArAgingReport } from '@/lib/services/ar-invoice.service';
import { arAgingQuerySchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('ar_aging:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arAgingQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const data = await getArAgingReport(parsed.data, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return jsonApiError(error, 'Failed to fetch AR aging report');
  }
}
