/**
 * GET /api/v1/orders/lookup?code=ORD-YYYYMMDD-NNNN[-S<n>] (HFC P3b, plan section 7.1)
 * Exact order number -> { success, data: { order } }. 400 VALIDATION_ERROR, 404 ORDER_NOT_FOUND. Requires orders:read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkScanRateLimit } from '@/lib/middleware/rate-limit';
import { orderNoSchema } from '@/lib/validations/code-format-schemas';
import { ScanResolveService } from '@/lib/services/scan-resolve/scan-resolve.service';
import { apiError, apiFailure } from '@/lib/services/scan-resolve/scan-api';

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;
    const limited = await checkScanRateLimit(auth.userId);
    if (limited) return limited;

    const parsed = orderNoSchema.safeParse(request.nextUrl.searchParams.get('code') ?? '');
    if (!parsed.success) return apiError('VALIDATION_ERROR', 400);

    const supabase = await createClient();
    const outcome = await ScanResolveService.resolve(supabase, auth.tenantId, parsed.data);
    if (!outcome.ok || outcome.result.kind !== 'ORDER') return apiError('ORDER_NOT_FOUND', 404);
    return NextResponse.json({ success: true, data: { order: outcome.result.order } });
  } catch (error) {
    return apiFailure('GET /api/v1/orders/lookup', error);
  }
}
