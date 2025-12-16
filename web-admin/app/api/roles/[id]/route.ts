/**
 * Individual Role API Routes
 *
 * Handles operations on specific roles:
 * - GET: Get role details with permissions
 * - PATCH: Update custom role
 * - DELETE: Delete custom role
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRolePermissions, updateCustomRole, deleteCustomRole } from '@/lib/services/role-service';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/roles/[id]
 * Get role details including permissions
 */
export async function GET(
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

    // Get role permissions
    const permissions = await getRolePermissions(roleId);

    return NextResponse.json({
      success: true,
      data: { permissions },
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch role';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/roles/[id]
 * Update custom role
 */
export async function PATCH(
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

    // Parse request body
    const body = await request.json();
    const { code, name, name2, description } = body;

    // Update role
    const updatedRole = await updateCustomRole(roleId, {
      code,
      name,
      name2,
      description,
    });

    return NextResponse.json({
      success: true,
      data: updatedRole,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    const message = error instanceof Error ? error.message : 'Failed to update role';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id]
 * Delete custom role
 */
export async function DELETE(
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

    // Delete role
    await deleteCustomRole(roleId);

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete role';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
