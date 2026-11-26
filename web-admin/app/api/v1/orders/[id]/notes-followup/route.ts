/**
 * GET  /api/v1/orders/[id]/notes-followup   -> list order/item/piece/preference notes_followup
 * POST /api/v1/orders/[id]/notes-followup   -> append one operational follow-up note via DB RPC
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  OrderFollowupNotesService,
} from '@/lib/services/order-followup-notes-service';
import {
  NOTES_FOLLOWUP_TARGET_LEVELS,
  PRC_TRX_SOURCE_SCREENS,
} from '@/lib/constants/processing-trx';
import {
  PREFS_FOLLOWUP_NOTE_MAX_LEN,
  PREFS_SOURCE_STAGE,
} from '@/lib/constants/order-preferences';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const appendNoteSchema = z.object({
  targetLevel: z.enum([
    NOTES_FOLLOWUP_TARGET_LEVELS.ORDER,
    NOTES_FOLLOWUP_TARGET_LEVELS.ITEM,
    NOTES_FOLLOWUP_TARGET_LEVELS.PIECE,
    NOTES_FOLLOWUP_TARGET_LEVELS.PREFERENCE,
  ]),
  targetId: z.string().uuid(),
  noteText: z.string().trim().min(1).max(PREFS_FOLLOWUP_NOTE_MAX_LEN),
  noteSource: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .default(PREFS_SOURCE_STAGE.ORDER_PROCESSING),
  sourceScreen: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .default(PRC_TRX_SOURCE_SCREENS.PROCESSING_DETAIL),
  recordPrcTrx: z.boolean().optional().default(true),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await params;
    const result = await OrderFollowupNotesService.listOrderNotes(tenantId, id);
    if (!result.success || !result.data) {
      const status = result.error === 'Order not found' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to fetch notes' },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    log.error(
      '[API] GET /orders/[id]/notes-followup error',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load follow-up notes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:update')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId, userName } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = appendNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid follow-up note payload',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await OrderFollowupNotesService.appendNote({
      tenantId,
      orderId: id,
      targetLevel: parsed.data.targetLevel,
      targetId: parsed.data.targetId,
      noteText: parsed.data.noteText,
      noteSource: parsed.data.noteSource,
      sourceScreen: parsed.data.sourceScreen,
      recordPrcTrx: parsed.data.recordPrcTrx,
      userId,
      userName,
    });

    if (!result.success) {
      const notFound = /not found|mismatch/i.test(result.error ?? '');
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to save follow-up note' },
        { status: notFound ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        notes: result.notes ?? [],
        trxId: result.trxId,
        trxCode: result.trxCode,
      },
    });
  } catch (error) {
    log.error(
      '[API] POST /orders/[id]/notes-followup error',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: 'Failed to append follow-up note' },
      { status: 500 }
    );
  }
}
