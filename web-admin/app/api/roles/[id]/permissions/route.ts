/**
 * Role Permissions API Routes
 *
 * Handles permission assignment to roles:
 * - PUT: Update permissions for a role
 */

import { NextRequest, NextResponse } from 'next/server';
import { assignPermissionsToRole, removePermissionsFromRole, getRolePermissions } from '@/lib/services/role-service';
import { createClient } from '@/lib/supabase/server';

/**
 * PUT /api/roles/[id]/permissions
 * Update permissions for a role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const roleId = params.id;
    const body = await request.json();
    const { permissionCodes } = body;

    if (!Array.isArray(permissionCodes)) {
      return NextResponse.json(
        { success: false, error: 'permissionCodes must be an array' },
        { status: 400 }
      );
    }

    // Get current permissions
    const currentPermissionCodes = await getRolePermissions(roleId);

    // Get permission IDs for the codes
    const { data: allPermissions, error: permError } = await supabase
      .from('sys_auth_permissions')
      .select('permission_id, code')
      .eq('is_active', true);

    if (permError || !allPermissions) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch permissions' },
        { status: 500 }
      );
    }

    const codeToIdMap = new Map(
      allPermissions.map(p => [p.code, p.permission_id])
    );

    // Get permission IDs for new permissions
    const newPermissionIds = permissionCodes
      .map(code => codeToIdMap.get(code))
      .filter((id): id is string => !!id);

    // Get permission IDs for permissions to remove
    const toRemove = currentPermissionCodes.filter(
      code => !permissionCodes.includes(code)
    );
    const removePermissionIds = toRemove
      .map(code => codeToIdMap.get(code))
      .filter((id): id is string => !!id);

    // Remove permissions that are no longer assigned
    if (removePermissionIds.length > 0) {
      await removePermissionsFromRole(roleId, removePermissionIds);
    }

    // Assign new permissions
    if (newPermissionIds.length > 0) {
      await assignPermissionsToRole(roleId, newPermissionIds);
    }

    // Return updated permissions
    const updatedPermissions = await getRolePermissions(roleId);

    return NextResponse.json({
      success: true,
      data: {
        permissions: updatedPermissions,
      },
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    const message = error instanceof Error ? error.message : 'Failed to update role permissions';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
