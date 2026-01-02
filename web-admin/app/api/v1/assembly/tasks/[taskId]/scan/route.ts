/**
 * Assembly API - Scan Item
 * POST /api/v1/assembly/tasks/:taskId/scan
 * Scans an item barcode during assembly
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId, userId } = authContext;
    const { taskId } = params;
    const body = await request.json();
    const { barcode } = body;

    if (!barcode) {
      return NextResponse.json(
        { success: false, error: 'Barcode is required' },
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

