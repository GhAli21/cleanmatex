/**
 * Assembly API - Create Task
 * POST /api/v1/assembly/tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('orders:transition')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    const { tenantId, userId } = authCheck;
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const result = await AssemblyService.createAssemblyTask({
      orderId,
      tenantId,
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
      taskId: result.taskId,
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
