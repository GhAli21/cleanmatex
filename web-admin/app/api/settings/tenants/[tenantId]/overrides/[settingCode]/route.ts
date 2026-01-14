/**
 * DELETE /api/settings/tenants/[tenantId]/overrides/[settingCode]
 * Delete setting override
 * 
 * Query params:
 * - branchId: Optional branch ID for branch-level override
 * - userId: Optional user ID for user-level override
 * 
 * Protected endpoint (requires authentication)
 * 
 * This endpoint proxies requests to Platform HQ API (cleanmatexsaas/platform-api)
 * to delete setting overrides.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; settingCode: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { tenantId: paramTenantId, settingCode } = await params;
    
    // Resolve tenantId ('me' -> actual tenant ID)
    let tenantId: string;
    if (paramTenantId === 'me') {
      const tenant = await getCurrentTenant();
      tenantId = tenant.id;
    } else {
      tenantId = paramTenantId;
    }

    // Get branchId and userId from query params
    const branchId: string | undefined = searchParams.get('branchId') || undefined;
    const userId: string | undefined = searchParams.get('userId') || undefined;

    // Forward Authorization header from client request (if available)
    const authHeader = request.headers.get('authorization');

    // Call Platform HQ API to delete override
    await hqApiClient.deleteOverride(
      tenantId,
      settingCode,
      {
        branchId,
        userId,
        authHeader,
      }
    );

    return NextResponse.json({ message: 'Override deleted successfully' });
  } catch (error) {
    console.error('Error in delete override endpoint:', error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No authentication token')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }

    // Handle not found errors
    if (error instanceof Error && (error.message.includes('Not found') || error.message.includes('404'))) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    // Handle unauthorized errors from HQ API
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: 'Failed to delete override',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

