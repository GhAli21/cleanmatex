/**
 * Bulk Order Status Update API Route
 * POST /api/orders/bulk-status
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant ID from user metadata
    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID not found' },
        { status: 400 }
      );
    }

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
