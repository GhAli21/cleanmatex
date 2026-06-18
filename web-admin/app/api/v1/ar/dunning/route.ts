import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listArDunningRuns } from '@/lib/services/ar-dunning-ops.service';
import { arDunningQuerySchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('ar_dunning:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arDunningQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const data = await listArDunningRuns(parsed.data, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return jsonApiError(error, 'Failed to list AR dunning runs');
  }
}
