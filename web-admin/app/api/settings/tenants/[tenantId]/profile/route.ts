/**
 * GET /api/settings/tenants/[tenantId]/profile
 * Get tenant profile information
 * 
 * Protected endpoint (requires authentication)
 * 
 * Returns the tenant's assigned system profile information.
 * This reads directly from the tenant table (not a settings resolution).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const supabase = await createClient();
    const { tenantId: paramTenantId } = await params;
    
    // Resolve tenantId ('me' -> actual tenant ID)
    let tenantId: string;
    if (paramTenantId === 'me') {
      const tenant = await getCurrentTenant();
      tenantId = tenant.id;
    } else {
      tenantId = paramTenantId;
    }

    // Get tenant with profile information
    const { data: tenant, error } = await supabase
      .from('org_tenants_mst')
      .select('stng_profile_code, stng_profile_version_applied, stng_profile_locked')
      .eq('id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching tenant profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tenant profile', details: error.message },
        { status: 500 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get profile name if profile code exists
    let profileName: string | undefined;
    if (tenant.stng_profile_code) {
      const { data: profile } = await supabase
        .from('sys_stng_profiles_mst')
        .select('stng_profile_name')
        .eq('stng_profile_code', tenant.stng_profile_code)
        .eq('is_active', true)
        .single();

      profileName = profile?.stng_profile_name;
    }

    // Return profile info in expected format
    return NextResponse.json({
      stng_profile_code: tenant.stng_profile_code || undefined,
      stng_profile_name: profileName,
      stng_profile_version_applied: tenant.stng_profile_version_applied || undefined,
      stng_profile_locked: tenant.stng_profile_locked || false,
    });
  } catch (error) {
    console.error('Error in tenant profile endpoint:', error);

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
        error: 'Failed to fetch tenant profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

