/**
 * PATCH /api/settings/tenants/[tenantId]/overrides
 * Upsert setting override (tenant/branch/user level)
 * 
 * Body:
 * - settingCode: string (required)
 * - value: any (required)
 * - branchId?: string (optional)
 * - userId?: string (optional)
 * - overrideReason?: string (optional)
 * 
 * Protected endpoint (requires authentication)
 * 
 * This endpoint proxies requests to Platform HQ API (cleanmatexsaas/platform-api)
 * to create or update setting overrides.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId: paramTenantId } = await params;
    
    // Resolve tenantId ('me' -> actual tenant ID)
    let tenantId: string;
    if (paramTenantId === 'me') {
      const tenant = await getCurrentTenant();
      tenantId = tenant.id;
    } else {
      tenantId = paramTenantId;
    }

    // Parse request body
    const body = await request.json();
    
    if (!body.settingCode || body.value === undefined) {
      return NextResponse.json(
        { error: 'settingCode and value are required' },
        { status: 400 }
      );
    }

    // Forward Authorization header from client request (if available)
    const authHeader = request.headers.get('authorization');

    // Call Platform HQ API to upsert override
    await hqApiClient.upsertOverride(
      tenantId,
      {
        settingCode: body.settingCode,
        value: body.value,
        branchId: body.branchId,
        userId: body.userId,
        overrideReason: body.overrideReason,
      },
      {
        authHeader,
      }
    );

    return NextResponse.json({ message: 'Override created/updated successfully' });
  } catch (error) {
    console.error('Error in upsert override endpoint:', error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No authentication token')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }

    // Handle validation errors
    if (error instanceof Error && (error.message.includes('400') || error.message.includes('Bad Request'))) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.message },
        { status: 400 }
      );
    }

    // Handle unauthorized errors from HQ API
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: 'Failed to upsert override',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

