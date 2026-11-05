/**
 * GET /api/v1/orders/pieces/lookup?code=<piece code | live external tag> (HFC P3b, plan section 7.1)
 * -> { success, data: { piece, item, order } }. 400 VALIDATION_ERROR, 404 PIECE_NOT_FOUND. Requires orders:read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkScanRateLimit } from '@/lib/middleware/rate-limit';
import { SCAN_RAW_MAX_LENGTH } from '@/lib/validations/code-format-schemas';
import { ScanResolveService } from '@/lib/services/scan-resolve/scan-resolve.service';
import { apiError, apiFailure } from '@/lib/services/scan-resolve/scan-api';

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;
    const limited = await checkScanRateLimit(auth.userId);
    if (limited) return limited;

    const code = request.nextUrl.searchParams.get('code') ?? '';
    if (code.trim() === '' || code.length > SCAN_RAW_MAX_LENGTH) return apiError('VALIDATION_ERROR', 400);

    const supabase = await createClient();
    const outcome = await ScanResolveService.resolve(supabase, auth.tenantId, code);
    if (!outcome.ok || outcome.result.kind !== 'PIECE' || !outcome.result.piece) return apiError('PIECE_NOT_FOUND', 404);
    const { piece, item, order, matchedBy } = outcome.result;
    return NextResponse.json({ success: true, data: { piece, item: item ?? null, order, matchedBy } });
  } catch (error) {
    return apiFailure('GET /api/v1/orders/pieces/lookup', error);
  }
}
