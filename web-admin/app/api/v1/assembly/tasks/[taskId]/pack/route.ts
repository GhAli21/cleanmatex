/**
 * Assembly API - Pack Order
 * POST /api/v1/assembly/tasks/:taskId/pack
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 * @param request
 * @param context
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:transition')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    const { tenantId, userId } = authCheck;
    const { taskId } = await context.params;
    const body = await request.json();
    const { packagingTypeCode, packingNote } = body;

    if (!packagingTypeCode) {
      return NextResponse.json(
        { success: false, error: 'Packaging type is required' },
        { status: 400 }
      );
    }

    const result = await AssemblyService.packOrder({
      taskId,
      tenantId,
      packagingTypeCode,
      packingNote,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      packingListId: result.packingListId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
