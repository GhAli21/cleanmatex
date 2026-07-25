/**
 * Assembly API - Scan Item
 * POST /api/v1/assembly/tasks/:taskId/scan
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
    const { barcode, assemblyItemId } = body as {
      barcode?: string;
      assemblyItemId?: string;
    };

    if (assemblyItemId && typeof assemblyItemId === 'string') {
      const result = await AssemblyService.markItemSelected({
        taskId,
        tenantId,
        assemblyItemId,
        userId,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, isMatch: result.isMatch },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        itemId: result.itemId,
        isMatch: result.isMatch,
      });
    }

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Barcode or assemblyItemId is required' },
        { status: 400 }
      );
    }

    const result = await AssemblyService.scanItem({
      taskId,
      tenantId,
      barcode,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, isMatch: result.isMatch },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      itemId: result.itemId,
      isMatch: result.isMatch,
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
