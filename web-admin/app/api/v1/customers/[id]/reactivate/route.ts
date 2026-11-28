/**
 * POST /api/v1/customers/[id]/reactivate
 * Reactivate an inactive customer in the current tenant with audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { reactivateCustomer } from '@/lib/services/customers.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const { id: customerId } = await params;
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const customer = await reactivateCustomer(customerId);
    return NextResponse.json(
      {
        success: true,
        data: customer,
        message: 'Customer reactivated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      'Error reactivating customer',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'reactivate' }
    );

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      if (error.message.includes('already uses')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to reactivate customer' },
      { status: 500 }
    );
  }
}
