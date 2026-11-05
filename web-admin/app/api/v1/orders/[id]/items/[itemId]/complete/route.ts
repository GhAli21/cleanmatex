/**
 * POST /api/v1/orders/[id]/items/[itemId]/complete
 * Mark item as complete
 * PRD-010: Item completion and auto-transition
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { ItemProcessingService } from '@/lib/services/item-processing-service';

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

    const result = await ItemProcessingService.markItemComplete({
      orderId: id,
      orderItemId: itemId,
      tenantId,
      userId,
      userName,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { allItemsReady: result.allItemsReady },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

