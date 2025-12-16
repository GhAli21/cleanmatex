/**
 * Workflow Roles Users API Route
 *
 * Get all users with their workflow role assignments
 */

import { NextResponse } from 'next/server';
import { getUserWorkflowRoleAssignments } from '@/lib/services/role-service';
import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
}

export interface UserWithWorkflowRoles extends User {
  workflow_roles: {
    id: string;
    workflow_role: string;
    is_active: boolean;
  }[];
}

/**
 * GET /api/workflow-roles/users
 * Get all users in tenant with their workflow role assignments
 */
export async function GET() {
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

    // Get all users in the tenant
    const { data: userRoles, error: userRolesError } = await supabase
      .from('org_auth_user_roles')
      .select('user_id')
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true);

    if (userRolesError) throw userRolesError;

    // Get unique user IDs
    const userIds = [...new Set(userRoles?.map(ur => ur.user_id) || [])];

    // Get user details from org_users_mst
    const { data: orgUsers, error: orgError } = await supabase
      .from('org_users_mst')
      .select('user_id, display_name')
      .in('user_id', userIds)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true);

    if (orgError) throw orgError;

    // Get user emails from auth.users (requires admin client)
    const adminSupabase = createAdminSupabaseClient();
    const { data: authUsers, error: authUsersError } = await adminSupabase.auth.admin.listUsers();
    if (authUsersError) {
      console.warn('Could not fetch user emails:', authUsersError);
    }

    // Create email lookup map
    const emailMap = new Map(
      authUsers?.users.map(u => [u.id, u.email || '']) || []
    );

    // Map to User objects with emails
    const usersWithDetails: User[] = (orgUsers || []).map(orgUser => ({
      id: orgUser.user_id,
      email: emailMap.get(orgUser.user_id) || `user-${orgUser.user_id.substring(0, 8)}`,
      display_name: orgUser.display_name,
    }));

    // Load workflow roles for each user
    const usersWithRoles: UserWithWorkflowRoles[] = [];
    for (const userItem of usersWithDetails) {
      const assignments = await getUserWorkflowRoleAssignments(userItem.id, tenantId);
      usersWithRoles.push({
        ...userItem,
        workflow_roles: assignments,
      });
    }

    return NextResponse.json({
      success: true,
      data: usersWithRoles,
    });
  } catch (error) {
    console.error('Error fetching users with workflow roles:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
