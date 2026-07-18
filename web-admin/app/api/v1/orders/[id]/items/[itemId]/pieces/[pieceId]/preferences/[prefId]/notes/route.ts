/**
 * POST /api/v1/orders/.../preferences/:prefId/notes
 * Append follow-up note to notes_followup (atomic RPC).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderPieceProcessingPreferenceService } from '@/lib/services/order-piece-processing-preference.service';
import { appendProcessingPrefNoteSchema } from '@/lib/validations/processing-piece-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Append one notes_followup entry (note_source = ORDER_PROCESSING).
 * Ownership enforced inside RPC (tenant + pref + piece).
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      itemId: string;
      pieceId: string;
      prefId: string;
    }>;
  }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;
    const { pieceId, prefId } = await params;

    const body = await request.json();
    const parsed = appendProcessingPrefNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await OrderPieceProcessingPreferenceService.appendFollowupNote(
      supabase,
      tenantId,
      pieceId,
      prefId,
      parsed.data.note_text,
      userId
    );

    if (!result.success) {
      const status = result.error === 'Preference not found' ? 404 : 400;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    log.error(
      '[API] POST preference followup note error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_piece_processing_preference' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to append note' },
      { status: 500 }
    );
  }
}
