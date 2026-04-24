import { NextRequest, NextResponse } from 'next/server';

import { listCustomerTenantsByPhone } from '@/lib/services/customer-mobile-tenant.service';

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')?.trim() ?? '';

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone is required' },
        { status: 400 },
      );
    }

    const tenants = await listCustomerTenantsByPhone(phone);

    return NextResponse.json(
      {
        success: true,
        data: tenants.map((tenant) => ({
          tenantOrgId: tenant.tenantOrgId,
          name: tenant.name,
          name2: tenant.name2,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
        })),
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
