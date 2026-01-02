/**
 * Assembly API - Dashboard
 * GET /api/v1/assembly/dashboard
 * Gets assembly dashboard statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { AssemblyService } from '@/lib/services/assembly-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = authContext;

    const data = await AssemblyService.getAssemblyDashboard(tenantId);

    return NextResponse.json({
      success: true,
      data,
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

