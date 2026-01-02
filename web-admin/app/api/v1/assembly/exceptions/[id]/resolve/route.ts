/**
 * Assembly API - Resolve Exception
 * PATCH /api/v1/assembly/exceptions/:id/resolve
 * Resolves an assembly exception
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { id: exceptionId } = params;
    const body = await request.json();
    const { resolution } = body;

    if (!resolution) {
      return NextResponse.json(
        { success: false, error: 'Resolution is required' },
        { status: 400 }
      );
    }

    const result = await AssemblyService.resolveException({
      exceptionId,
      tenantId,
      resolution,
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

