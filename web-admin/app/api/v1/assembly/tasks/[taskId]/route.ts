/**
 * Assembly API - Get Task
 * GET /api/v1/assembly/tasks/:taskId
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 * @param request
 * @param context
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    const { tenantId } = authCheck;
    const { taskId } = await context.params;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const task = await AssemblyService.getAssemblyTask({ taskId, tenantId });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Assembly task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: task,
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
