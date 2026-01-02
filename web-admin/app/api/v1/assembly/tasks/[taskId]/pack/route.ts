/**
 * Assembly API - Pack Order
 * POST /api/v1/assembly/tasks/:taskId/pack
 * Packs order and generates packing list
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

