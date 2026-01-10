/**
 * GET /api/settings/tenants/[tenantId]/effective
 * Get effective settings with 7-layer resolution
 * 
 * Query params:
 * - branchId: Optional branch ID for branch-scoped settings
 * - userId: Optional user ID for user-scoped settings (can be 'me' for current user)
 * 
 * Protected endpoint (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Resolve tenantId ('me' -> actual tenant ID)
    let tenantId: string;
    if (params.tenantId === 'me') {
      const tenant = await getCurrentTenant();
      tenantId = tenant.id;
    } else {
      tenantId = params.tenantId;
    }

    // Resolve userId ('me' -> actual user ID)
    let userId: string | null = searchParams.get('userId') || null;
    if (userId === 'me') {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized: No authenticated user' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // Get branchId from query params
    const branchId: string | null = searchParams.get('branchId') || null;

    // Call the database function to resolve all settings
    const { data, error } = await supabase.rpc('fn_stng_resolve_all_settings', {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error resolving settings:', error);
      return NextResponse.json(
        { error: 'Failed to resolve settings', details: error.message },
        { status: 500 }
      );
    }

    // Transform the response to match the client's expected format
    const resolvedSettings = (data || []).map((row: any) => ({
      stngCode: row.stng_code,
      stngValue: row.stng_value_jsonb,
      stngSourceLayer: row.stng_source_layer,
      stngSourceId: row.stng_source_id,
      computedAt: row.stng_computed_at,
    }));

    return NextResponse.json({ data: resolvedSettings });
  } catch (error) {
    console.error('Error in effective settings endpoint:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes('No tenant access')) {
      return NextResponse.json(
        { error: 'No tenant access found' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch effective settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

