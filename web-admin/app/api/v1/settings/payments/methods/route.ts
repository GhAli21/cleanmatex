import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listEffectivePaymentMethodConfigs } from '@/lib/services/payment-config.service';

/**
 * Returns tenant payment methods with optional branch override resolution for admin settings.
 *
 * @param request Next.js route request with an optional `branchId` query param.
 * @returns Tenant payment method config rows merged with branch overrides when requested.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('payment_config:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;

  try {
    const methods = await listEffectivePaymentMethodConfigs({
      tenantId,
      branchId,
    });
    return NextResponse.json({ success: true, data: methods });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment methods';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
