import { NextRequest, NextResponse } from 'next/server';

import { listCustomerTenantsByPhone } from '@/lib/services/customer-mobile-tenant.service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();

  try {
    const phone = request.nextUrl.searchParams.get('phone')?.trim() ?? '';

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone is required', traceId },
        { status: 400 },
      );
    }

    const tenants = await listCustomerTenantsByPhone(phone, traceId);

    return NextResponse.json(
      {
        success: true,
        traceId,
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
    logger.error(
      'Public customer tenant lookup route failed',
      error instanceof Error ? error : new Error('Unknown route error'),
      {
        feature: 'customer-mobile-tenant',
        action: 'GET /api/v1/public/customer/tenants',
        traceId,
      },
    );

    return NextResponse.json(
      {
        success: false,
        traceId,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
