/**
 * POST /api/v1/customers/link
 * Connect an existing global sys_customers_mst identity to the current tenant.
 * Cross-tenant org_other_tenant linking is permanently disallowed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { linkCustomerToTenant } from '@/lib/services/customers.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('customers:create')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { customerId, sourceType } = body ?? {};

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'customerId is required and must be a string' },
        { status: 400 }
      );
    }

    if (sourceType && sourceType !== 'sys') {
      return NextResponse.json(
        { success: false, error: 'Only global sys customer linking (sourceType="sys") is permitted' },
        { status: 403 }
      );
    }

    const result = await linkCustomerToTenant(customerId, 'sys');

    return NextResponse.json(
      {
        success: true,
        data: {
          orgCustomerId: result.orgCustomerId,
          customerId: result.customerId,
          customerCode: result.customerCode,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      'Error linking customer',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'link' }
    );

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        );
      }

      if (error.message.includes('already linked') || error.message.includes('already exists')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 409 }
        );
      }

      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to link customer' },
      { status: 500 }
    );
  }
}
