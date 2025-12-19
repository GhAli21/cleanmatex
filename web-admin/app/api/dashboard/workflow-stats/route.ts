/**
 * Workflow Statistics API Route
 * GET /api/dashboard/workflow-stats
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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
