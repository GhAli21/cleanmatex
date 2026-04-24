import { NextRequest, NextResponse } from 'next/server';

import { resolveTenantBySlug } from '@/lib/services/tenant-resolve.service';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')?.trim().toLowerCase();

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'slug query parameter is required' },
        { status: 400 },
      );
    }

    const tenant = await resolveTenantBySlug(slug);

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Laundry not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tenantOrgId: tenant.tenantOrgId,
          name: tenant.name,
          name2: tenant.name2,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
