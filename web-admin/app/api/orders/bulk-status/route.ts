/**
 * Bulk Order Status Update API Route
 * POST /api/orders/bulk-status
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/lib/types/workflow';
import { resolveWorkflowEngineV2Enabled } from '@/lib/config/workflow-engine-v2.server';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderIds, toStatus, notes } = body;

    // Validation
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderIds array is required' },
        { status: 400 }
      );
    }

    if (!toStatus) {
      return NextResponse.json(
        { success: false, error: 'toStatus is required' },
        { status: 400 }
      );
    }

    if (orderIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 orders per batch' },
        { status: 400 }
      );
    }

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

    // P3: bulk raw status flips retired when Workflow Engine V2 is on.
    if (await resolveWorkflowEngineV2Enabled(tenantId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bulk status update is disabled for Workflow Engine V2. Use per-order POST /api/v1/orders/{id}/actions.',
          code: 'ENGINE_V2_USE_ACTIONS',
        },
        { status: 410 },
      );
    }

    // Bulk status change using WorkflowService
    const result = await WorkflowService.bulkChangeStatus({
      orderIds,
      tenantId,
      toStatus: toStatus as OrderStatus,
      userId: user.id,
      userName: user.user_metadata?.display_name || user.email || 'Unknown',
      notes,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        successCount: result.successCount,
        failureCount: result.failureCount,
        results: result.results,
      },
      message: `Updated ${result.successCount} of ${orderIds.length} orders`,
    });
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
