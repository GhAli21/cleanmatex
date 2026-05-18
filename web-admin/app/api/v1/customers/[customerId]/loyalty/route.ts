import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getLoyaltyAccount, getCustomerTier } from '@/lib/services/loyalty.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requirePermission('loyalty:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { customerId } = await params;

  try {
    const account = await getLoyaltyAccount(tenantId, customerId);
    const tier = account
      ? await getCustomerTier(tenantId, Number(account.points_balance))
      : null;

    return NextResponse.json({
      success: true,
      data: {
        account,
        tier,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch loyalty account';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
