/**
 * Individual Workflow Role Assignment API Routes
 *
 * Handles operations on specific workflow role assignments:
 * - DELETE: Remove workflow role from user
 */

import { NextRequest, NextResponse } from 'next/server';
import { removeWorkflowRoleFromUser } from '@/lib/services/role-service';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/workflow-roles/[id]
 * Remove workflow role assignment
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

    const assignmentId = params.id;

    // Remove workflow role
    await removeWorkflowRoleFromUser(assignmentId);

    return NextResponse.json({
      success: true,
      message: 'Workflow role removed successfully',
    });
  } catch (error) {
    console.error('Error removing workflow role:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove workflow role';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
