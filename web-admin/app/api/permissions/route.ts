/**
 * Permissions API Routes
 *
 * Handles permission operations:
 * - GET: List all available permissions grouped by category
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface Permission {
  permission_id: string;
  code: string;
  name: string | null;
  name2: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean;
}

/**
 * GET /api/permissions
 * Get all active permissions grouped by category
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

    // Get all active permissions
    const { data: permissions, error } = await supabase
      .from('sys_auth_permissions')
      .select('permission_id, code, name, name2, category, description, is_active')
      .eq('is_active', true)
      .order('category')
      .order('code');

    if (error) {
      console.error('Error fetching permissions:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch permissions' },
        { status: 500 }
      );
    }

    // Group permissions by category
    const grouped = (permissions || []).reduce((acc, perm) => {
      const category = perm.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);

    return NextResponse.json({
      success: true,
      data: {
        permissions: permissions || [],
        grouped: grouped,
      },
    });
  } catch (error) {
    console.error('Error in permissions API:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch permissions';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
