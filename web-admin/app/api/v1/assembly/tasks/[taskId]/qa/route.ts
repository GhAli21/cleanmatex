/**
 * Assembly API - Perform QA
 * POST /api/v1/assembly/tasks/:taskId/qa
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
    const { decisionTypeCode, qaNote, qaPhotoUrl } = body;

    if (!decisionTypeCode) {
      return NextResponse.json(
        { success: false, error: 'Decision type is required' },
        { status: 400 }
      );
    }

    const result = await AssemblyService.performQA({
      taskId,
      tenantId,
      decisionTypeCode,
      qaNote,
      qaPhotoUrl,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
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
