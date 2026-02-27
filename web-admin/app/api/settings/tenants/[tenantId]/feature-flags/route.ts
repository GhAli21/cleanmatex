/**
 * GET /api/settings/tenants/[tenantId]/feature-flags
 * View all feature flags from Platform HQ for the current tenant context.
 *
 * Note: Currently returns global flag metadata filtered to active flags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId: paramTenantId } = await params;

    // Resolve tenantId ('me' -> actual tenant ID) even though flags are global,
    // so we respect tenant context and can extend later to tenant-specific views.
    if (paramTenantId === 'me') {
      await getCurrentTenant();
    }

    const search = new URL(request.url).searchParams.get('search') || undefined;

    const authHeader = request.headers.get('authorization');
    const flags = await hqApiClient.getFeatureFlags({
      authHeader,
      search,
    });

    return NextResponse.json({ data: flags });
  } catch (error) {
    console.error('Error in feature flags endpoint:', error);

    if (error instanceof Error && error.message.includes('No authentication token')) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          details:
            'Set HQ_SERVICE_TOKEN in web-admin/.env.local or ensure requests include an Authorization header.',
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch feature flags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

