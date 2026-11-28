/**
 * POST /api/v1/customers/lookup
 * Lookup-first customer identity check by exact normalized mobile phone or email.
 * Checks current tenant org_customers_mst first, then global sys_customers_mst.
 */

import { NextRequest, NextResponse } from 'next/server';
import { lookupCustomerIdentity } from '@/lib/services/customers.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!phone && !email) {
      return NextResponse.json(
        { success: false, error: 'Mobile phone or email is required for lookup' },
        { status: 400 }
      );
    }

    const result = await lookupCustomerIdentity({
      phone: phone || undefined,
      email: email || undefined,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    logger.error(
      'Error looking up customer identity',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'lookup' }
    );

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('No tenant context')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      if (error.message.includes('Invalid phone') || error.message.includes('Invalid email') || error.message.includes('required')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to lookup customer' },
      { status: 500 }
    );
  }
}
