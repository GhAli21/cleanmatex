/**
 * Overdue Orders API Route
 * GET /api/orders/overdue
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

/**
 *
 */
export async function GET() {
  try {
    // Tenant comes from the validated session, never from client-editable metadata.
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get overdue orders
    const overdueOrders = await WorkflowService.getOverdueOrders(tenantId);

    return NextResponse.json({
      success: true,
      data: overdueOrders,
      count: overdueOrders.length,
    });
  } catch (error) {
    console.error('GET /api/orders/overdue error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
