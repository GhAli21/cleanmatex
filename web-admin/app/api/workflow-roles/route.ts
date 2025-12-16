/**
 * Workflow Roles API Routes
 *
 * Handles workflow role management operations:
 * - GET: Get users with their workflow role assignments
 * - POST: Assign workflow role to user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserWorkflowRoleAssignments, assignWorkflowRoleToUser } from '@/lib/services/role-service';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/workflow-roles?userId={userId}
 * Get workflow role assignments for a user
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant from user's tenants
    const { data: tenants, error: tenantError } = await supabase.rpc('get_user_tenants');
    if (tenantError || !tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: 'No tenant access found' },
        { status: 403 }
      );
    }
    const tenantId = tenants[0].tenant_id;

    // Get userId from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get workflow role assignments
    const assignments = await getUserWorkflowRoleAssignments(userId, tenantId);

    return NextResponse.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    console.error('Error fetching workflow role assignments:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch workflow role assignments';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow-roles
 * Assign workflow role to user
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant from user's tenants
    const { data: tenants, error: tenantError } = await supabase.rpc('get_user_tenants');
    if (tenantError || !tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: 'No tenant access found' },
        { status: 403 }
      );
    }
    const tenantId = tenants[0].tenant_id;

    // Parse request body
    const body = await request.json();
    const { user_id, workflow_role } = body;

    // Validate required fields
    if (!user_id || !workflow_role) {
      return NextResponse.json(
        { success: false, error: 'user_id and workflow_role are required' },
        { status: 400 }
      );
    }

    // Assign workflow role
    const assignment = await assignWorkflowRoleToUser({
      user_id,
      tenant_org_id: tenantId,
      workflow_role,
    });

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error('Error assigning workflow role:', error);
    const message = error instanceof Error ? error.message : 'Failed to assign workflow role';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
