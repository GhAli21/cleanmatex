/**
 * Roles API Routes
 *
 * Handles role management operations:
 * - GET: List all roles
 * - POST: Create custom role
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllRoles, createCustomRole } from '@/lib/services/role-service';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/roles
 * Get all roles (system + custom) for current tenant
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

    // Get all roles
    const roles = await getAllRoles();

    return NextResponse.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch roles';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles
 * Create a new custom role
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

    // Parse request body
    const body = await request.json();
    const { code, name, name2, description } = body;

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Create role
    const role = await createCustomRole({
      code,
      name,
      name2,
      description,
    });

    return NextResponse.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Error creating role:', error);
    const message = error instanceof Error ? error.message : 'Failed to create role';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
