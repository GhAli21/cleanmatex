/**
 * GET /api/settings/tenants/[tenantId]/explain/[settingCode]
 * Explain setting resolution (full trace)
 * 
 * Query params:
 * - branchId: Optional branch ID for branch-scoped settings
 * - userId: Optional user ID for user-scoped settings (can be 'me' for current user)
 * 
 * Protected endpoint (requires authentication)
 * 
 * This endpoint proxies requests to Platform HQ API (cleanmatexsaas/platform-api)
 * to get detailed resolution trace for a setting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; settingCode: string }> }
) {
  try {
    const supabase = await createClient();
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

    // Resolve userId ('me' -> actual user ID)
    let userId: string | undefined = searchParams.get('userId') || undefined;
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
    const branchId: string | undefined = searchParams.get('branchId') || undefined;

    // Forward Authorization header from client request (if available)
    const authHeader = request.headers.get('authorization');

    // Call Platform HQ API to explain setting resolution
    const explainTrace = await hqApiClient.explainSetting(
      tenantId,
      settingCode,
      {
        branchId,
        userId,
        authHeader,
      }
    );

    return NextResponse.json(explainTrace);
  } catch (error) {
    console.error('Error in explain settings endpoint:', error);

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

    // Handle not found errors
    if (error instanceof Error && (error.message.includes('Not found') || error.message.includes('404'))) {
      return NextResponse.json(
        { error: 'Setting or tenant not found' },
        { status: 404 }
      );
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: 'Failed to explain setting resolution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

