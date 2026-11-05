/**
 * Bulk Order Status Update API Route
 * POST /api/orders/bulk-status
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('orders:update')(request);
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json(
      {
        success: false,
        error:
          'Bulk status updates are retired. Use per-order POST /api/v1/orders/{id}/actions.',
        code: 'USE_WORKFLOW_ACTIONS',
      },
      { status: 410 },
    );
  } catch (error) {
    console.error('POST /api/orders/bulk-status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
