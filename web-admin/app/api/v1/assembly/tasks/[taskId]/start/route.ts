/**
 * Assembly API - Start Task
 * POST /api/v1/assembly/tasks/:taskId/start
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
    const body = await request.json().catch(() => ({}));
    const locationId =
      body && typeof body === 'object' && 'locationId' in body
        ? (body as { locationId?: string }).locationId
        : undefined;

    const result = await AssemblyService.startAssemblyTask({
      taskId,
      tenantId,
      userId,
      locationId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyStarted: Boolean(result.alreadyStarted),
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
