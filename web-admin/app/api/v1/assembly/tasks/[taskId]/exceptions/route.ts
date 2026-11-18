/**
 * Assembly API - Create Exception
 * POST /api/v1/assembly/tasks/:taskId/exceptions
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
    const {
      exceptionTypeCode,
      description,
      description2,
      severity,
      assemblyItemId,
    } = body;

    if (!exceptionTypeCode || !description) {
      return NextResponse.json(
        { success: false, error: 'Exception type and description are required' },
        { status: 400 }
      );
    }

    const result = await AssemblyService.createException({
      taskId,
      tenantId,
      exceptionTypeCode,
      description,
      description2,
      severity,
      assemblyItemId,
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
      exceptionId: result.exceptionId,
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
