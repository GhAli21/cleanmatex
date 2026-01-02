/**
 * Assembly API - Create Exception
 * POST /api/v1/assembly/tasks/:taskId/exceptions
 * Creates an exception for missing/wrong/damaged item
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
    const {
      exceptionTypeCode,
      description,
      description2,
      severity,
      photoUrls,
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
      photoUrls,
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

