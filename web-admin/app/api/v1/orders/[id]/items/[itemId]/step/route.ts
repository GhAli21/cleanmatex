/**
 * POST /api/v1/orders/[id]/items/[itemId]/step
 * Record processing step for an item
 * PRD-010: 5-step processing tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { ItemProcessingService } from '@/lib/services/item-processing-service';
import { RecordStepRequestSchema } from '@/lib/validations/workflow-schema';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requirePermission('orders:transition')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, itemId } = await params;
    const { tenantId, userId, userName } = auth;

    const body = await request.json();
    const parsed = RecordStepRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error },
        { status: 400 }
      );
    }

    const result = await ItemProcessingService.recordProcessingStep({
      orderId: id,
      orderItemId: itemId,
      tenantId,
      stepCode: parsed.data.stepCode,
      stepSeq: parsed.data.stepSeq,
      notes: parsed.data.notes,
      userId,
      userName,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

