/**
 * Workflow Statistics API Route
 * GET /api/dashboard/workflow-stats
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

    // Get workflow statistics
    const stats = await WorkflowService.getWorkflowStats(tenantId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('GET /api/dashboard/workflow-stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
