/**
 * Assembly API - Get Task
 * GET /api/v1/assembly/tasks/:taskId
 * Returns assembly task details and line items for scan / manual select UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

/**
 * @param _request
 * @param root0
 * @param root0.params
 * @param root0.params.taskId
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = authContext;
    const { taskId } = params;

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
