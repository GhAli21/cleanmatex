/**
 * Server Actions: Customer Loyalty
 *
 * getCustomerLoyaltyDetail — account, recent transaction history, and
 * upcoming-expiry summary for the customer detail page's Loyalty tab (B19
 * follow-up — this tab previously showed a hardcoded balance and a static
 * "No transactions yet" placeholder, wired to nothing).
 */

'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getLoyaltyAccount,
  getCustomerTier,
  getLoyaltyTransactions,
  getLoyaltyExpirySummary,
  syncAvailableLoyaltyPoints,
  type LoyaltyTransactionView,
  type LoyaltyExpirySummary,
} from '@/lib/services/loyalty.service';

export interface CustomerLoyaltyDetail {
  account: {
    id: string;
    pointsBalance: number;
    lifetimeEarned: number;
  } | null;
  tier: { id: string; tierName: string; tierName2: string | null } | null;
  transactions: LoyaltyTransactionView[];
  expirySummary: LoyaltyExpirySummary | null;
}

export interface GetCustomerLoyaltyDetailResult {
  success: boolean;
  data?: CustomerLoyaltyDetail;
  error?: string;
}

/**
 * @param customerId
 */
export async function getCustomerLoyaltyDetail(
  customerId: string,
): Promise<GetCustomerLoyaltyDetailResult> {
  try {
    const { tenantId } = await getAuthContext();

    const account = await getLoyaltyAccount(tenantId, customerId);
    const spendable = account
      ? await syncAvailableLoyaltyPoints(tenantId, account.id, Number(account.points_balance))
      : null;
    const [tier, transactions, expirySummary] = await Promise.all([
      account ? getCustomerTier(tenantId, spendable?.spendablePoints ?? Number(account.points_balance)) : Promise.resolve(null),
      account ? getLoyaltyTransactions(tenantId, account.id) : Promise.resolve([]),
      account ? getLoyaltyExpirySummary(tenantId, account.id) : Promise.resolve(null),
    ]);

    return {
      success: true,
      data: {
        account: account
          ? {
              id: account.id,
              pointsBalance: spendable?.spendablePoints ?? Number(account.points_balance),
              lifetimeEarned: Number(account.lifetime_earned),
            }
          : null,
        tier: tier
          ? { id: tier.id, tierName: tier.name, tierName2: tier.name2 ?? null }
          : null,
        transactions,
        expirySummary,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load loyalty account';
    return { success: false, error: message };
  }
}
