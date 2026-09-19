import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getLoyaltyAccount,
  getCustomerTier,
  getLoyaltyTransactions,
  getLoyaltyExpirySummary,
  syncAvailableLoyaltyPoints,
} from '@/lib/services/loyalty.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Corrected 2026-09-17 (B19 follow-up): 'loyalty:view' is not a seeded
  // permission code — this route 403'd for every role since it was written.
  // 'loyalty:view_customer_points' is the real code (seeded, broadly granted).
  const auth = await requirePermission('loyalty:view_customer_points')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: customerId } = await params;

  try {
    const account = await getLoyaltyAccount(tenantId, customerId);
    const spendable = account
      ? await syncAvailableLoyaltyPoints(tenantId, account.id, Number(account.points_balance))
      : null;
    const [tier, transactions, expirySummary] = await Promise.all([
      account
        ? getCustomerTier(tenantId, spendable?.spendablePoints ?? Number(account.points_balance))
        : Promise.resolve(null),
      account ? getLoyaltyTransactions(tenantId, account.id) : Promise.resolve([]),
      account ? getLoyaltyExpirySummary(tenantId, account.id) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        account: account
          ? {
              ...account,
              points_balance: spendable?.spendablePoints ?? account.points_balance,
            }
          : account,
        tier,
        transactions,
        expirySummary,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch loyalty account';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
