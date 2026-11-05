/**
 * GET /api/v1/orders/[id]/label-data?pieces=none|all|<uuid,uuid,...> (HFC P4, plan T4.2)
 * -> { success, data: { order, pieces, settings } } for the printed order label, piece tags and receipt barcode.
 * 400 VALIDATION_ERROR (bad id or piece list), 404 ORDER_NOT_FOUND (also for another tenant's order).
 * Requires orders:read. Read only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { isUuidLike, LabelDataService, parsePieceSelection } from '@/lib/services/labels/label-data.service';
import { apiError, apiFailure } from '@/lib/services/scan-resolve/scan-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!isUuidLike(id)) return apiError('VALIDATION_ERROR', 400);
    const pieces = parsePieceSelection(request.nextUrl.searchParams.get('pieces'));
    if (pieces === null) return apiError('VALIDATION_ERROR', 400);

    const supabase = await createClient();
    const data = await LabelDataService.getLabelData(supabase, {
      tenantId: auth.tenantId,
      orderId: id,
      userId: auth.userId,
      pieces,
    });
    if (!data) return apiError('ORDER_NOT_FOUND', 404);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiFailure('GET /api/v1/orders/[id]/label-data', error);
  }
}
