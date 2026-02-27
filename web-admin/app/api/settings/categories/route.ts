import { NextRequest, NextResponse } from 'next/server';
import { hqApiClient } from '@/lib/api/hq-api-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');

    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const isActiveParam = searchParams.get('isActive');
    const search = searchParams.get('search') || undefined;

    const isActive =
      isActiveParam !== null && isActiveParam !== ''
        ? isActiveParam === 'true'
        : undefined;

    const result = await hqApiClient.getSettingsCategories({
      limit: limit ?? undefined,
      offset: offset ?? undefined,
      isActive,
      search,
      authHeader,
    });

    // Platform HQ returns a paged object { data, total, limit, offset }
    return NextResponse.json({ data: result.data ?? [] });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('Error in settings categories endpoint:', error);

    if (
      details.toLowerCase().includes('authentication required') ||
      details.includes('No authentication token') ||
      details.includes('401')
    ) {
      return NextResponse.json(
        {
          error: 'HQ API authentication failed',
          details:
            'Platform HQ API rejected the request. Set a valid HQ_SERVICE_TOKEN in web-admin/.env.local (run "npm run generate-service-token" in cleanmatexsaas/platform-api and paste the token).',
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch settings categories',
        details,
      },
      { status: 500 },
    );
  }
}

