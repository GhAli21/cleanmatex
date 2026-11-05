/**
 * POST /api/v1/scan/resolve (HFC P3b, plan section 7.1)
 * Body { raw, context? } -> { success, data: ScanResult }
 * 400 VALIDATION_ERROR / SCAN_INVALID, 404 SCAN_NOT_FOUND (also for another tenant's code), 409 SCAN_AMBIGUOUS,
 * 422 SCAN_UNSUPPORTED_PAYLOAD. Requires orders:read. Read only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkScanRateLimit } from '@/lib/middleware/rate-limit';
import { scanInputSchema } from '@/lib/validations/code-format-schemas';
import { ScanResolveService } from '@/lib/services/scan-resolve/scan-resolve.service';
import { apiError, apiFailure, scanError } from '@/lib/services/scan-resolve/scan-api';

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;
    const limited = await checkScanRateLimit(auth.userId);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const parsed = scanInputSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 400);

    const supabase = await createClient();
    const outcome = await ScanResolveService.resolve(supabase, auth.tenantId, parsed.data.raw, parsed.data.context);
    if (outcome.ok === false) return scanError(outcome.code);
    return NextResponse.json({ success: true, data: outcome.result });
  } catch (error) {
    return apiFailure('POST /api/v1/scan/resolve', error);
  }
}
