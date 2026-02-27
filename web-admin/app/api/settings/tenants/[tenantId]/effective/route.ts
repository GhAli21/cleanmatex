/**
 * GET /api/settings/tenants/[tenantId]/effective
 * Get effective settings with 7-layer resolution
 * 
 * Query params:
 * - branchId: Optional branch ID for branch-scoped settings
 * - userId: Optional user ID for user-scoped settings (can be 'me' for current user)
 * 
 * Protected endpoint (requires authentication)
 * 
 * This endpoint proxies requests to Platform HQ API (cleanmatexsaas/platform-api)
 * to centralize settings resolution logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { tenantId: paramTenantId } = await params;
    
    // Resolve tenantId ('me' -> actual tenant ID)
    let tenantId: string;
    if (paramTenantId === 'me') {
      const tenant = await getCurrentTenant();
      tenantId = tenant.id;
    } else {
      tenantId = paramTenantId;
    }

    // Resolve userId ('me' -> actual user ID)
    let userId: string | undefined = searchParams.get('userId') || undefined;
    if (userId === 'me') {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'No authenticated user' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // Get branchId from query params
    const branchId: string | undefined = searchParams.get('branchId') || undefined;

    // Forward Authorization header from client request (if available)
    const authHeader = request.headers.get('authorization');

    // Call Platform HQ API to resolve settings
    const resolvedSettings = await hqApiClient.getEffectiveSettings(tenantId, {
      branchId,
      userId,
      authHeader,
    });

    return NextResponse.json({ data: resolvedSettings });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('Error in effective settings endpoint:', error);

    // Handle authentication errors (missing token in web-admin)
    if (error instanceof Error && error.message.includes('No authentication token')) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          details: 'Set HQ_SERVICE_TOKEN in web-admin/.env.local or ensure the request forwards an Authorization header. See docs/HQ_SERVICE_TOKEN_GUIDE.md.',
        },
        { status: 401 }
      );
    }

    // Handle 401 / "Authentication required" from HQ API (invalid or missing token)
    if (
      error instanceof Error &&
      (details.toLowerCase().includes('authentication required') ||
        details.includes('Unauthorized') ||
        details.includes('401'))
    ) {
      return NextResponse.json(
        {
          error: 'HQ API authentication failed',
          details:
            'Platform HQ API rejected the request. Set a valid HQ_SERVICE_TOKEN in web-admin/.env.local (run "npm run generate-service-token" in cleanmatexsaas/platform-api and paste the token).',
        },
        { status: 401 }
      );
    }

    // Handle forbidden errors
    if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('403'))) {
      return NextResponse.json(
        { error: 'Access denied', details },
        { status: 403 }
      );
    }

    // Handle not found errors
    if (error instanceof Error && (error.message.includes('Not found') || error.message.includes('404'))) {
      return NextResponse.json(
        { error: 'Tenant or settings not found', details },
        { status: 404 }
      );
    }

    // Handle tenant access errors
    if (error instanceof Error && error.message.includes('No tenant access')) {
      return NextResponse.json(
        { error: 'No tenant access found', details },
        { status: 403 }
      );
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: 'Failed to fetch effective settings',
        details,
      },
      { status: 500 }
    );
  }
}

