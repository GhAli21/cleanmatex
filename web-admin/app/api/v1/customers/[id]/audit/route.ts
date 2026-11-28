/**
 * GET /api/v1/customers/[id]/audit
 * Returns tenant-scoped audit history from org_customer_audit_dtl for a customer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCustomerAuditHistory } from '@/lib/services/customers.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const expectedTenantId = request.headers.get('X-Tenant-Id');
    if (expectedTenantId && expectedTenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: 'Organization changed; reload customer details' },
        { status: 409 }
      );
    }

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const { id: customerId } = await params;
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(100, Math.max(1, rawLimit));

    const entries = await getCustomerAuditHistory(customerId, limit);
    return NextResponse.json({ success: true, data: entries }, { status: 200 });
  } catch (error) {
    logger.error(
      'Error fetching customer audit history',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'auditHistory' }
    );

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('No tenant context')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer audit history' },
      { status: 500 }
    );
  }
}
