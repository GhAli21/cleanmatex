/**
 * POST /api/settings/tenants/[tenantId]/recompute
 * Recompute settings cache
 * 
 * Protected endpoint (requires authentication)
 * 
 * This endpoint proxies requests to Platform HQ API (cleanmatexsaas/platform-api)
 * to invalidate and recompute settings cache.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function POST(
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

    // Forward Authorization header from client request (if available)
    const authHeader = request.headers.get('authorization');

    // Call Platform HQ API to recompute cache
    await hqApiClient.recomputeCache(tenantId, {
      authHeader,
    });

    return NextResponse.json({ message: 'Cache invalidated successfully' });
  } catch (error) {
    console.error('Error in recompute settings endpoint:', error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No authentication token')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }

    // Handle unauthorized errors from HQ API
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: 'Failed to recompute settings cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

