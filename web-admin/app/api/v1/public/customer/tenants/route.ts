import { NextRequest, NextResponse } from 'next/server';

import { listCustomerTenantsByPhone } from '@/lib/services/customer-mobile-tenant.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

/**
 * Lists available customer tenants for a provided phone number.
 *
 * @param request Incoming HTTP request with phone query parameter.
 * @returns JSON response with matching tenants or an error.
 */
export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_tenants_public_api',
    action: 'get_tenants',
    traceId,
  });

  try {
    logger.info('Customer tenants request received', baseContext);
    const phone = request.nextUrl.searchParams.get('phone')?.trim() ?? '';
    const requestContext = {
      ...baseContext,
      phone,
      hasPhone: phone.length > 0,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    logger.info('Customer tenants request parameters parsed', requestContext);

    if (!phone) {
      logger.warn('Customer tenants request rejected due to missing phone', {
        ...requestContext,
      });
      return NextResponse.json(
        { success: false, error: 'phone is required', traceId },
        { status: 400 },
      );
    }

    logger.info('Resolving customer tenants by phone', requestContext);
    const tenants = await listCustomerTenantsByPhone(phone, traceId);

    logger.info('Customer tenants request succeeded', {
      ...requestContext,
      tenantsCount: tenants.length,
    });

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
          branches: tenant.branches ?? [],
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error(
      'Public customer tenant lookup route failed',
      normalizedError,
      {
        ...baseContext,
      },
    );

    return NextResponse.json(
      {
        success: false,
        traceId,
        error: normalizedError.message,
      },
      { status: 500 },
    );
  }
}
