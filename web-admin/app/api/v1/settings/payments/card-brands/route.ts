/**
 * GET /api/v1/settings/payments/card-brands
 *
 * Returns tenant card brand configuration rows after ensuring the tenant has
 * rows for any newly introduced active HQ card brands.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listTenantCardBrands } from '@/lib/services/payment-card-brand.service';

/**
 * Lists tenant-visible card brand configuration rows for payment setup.
 */
export async function GET(_request: NextRequest) {
  const auth = await requirePermission('payment_config:view')(_request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const data = await listTenantCardBrands(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch card brands';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
