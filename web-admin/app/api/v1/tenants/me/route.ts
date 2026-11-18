/**
 * GET /api/v1/tenants/me - Get current tenant details (requires authentication)
 *
 * Read-only on purpose. The organization profile is written only through the
 * permission- and CSRF-guarded settings routes (`/api/v1/settings/general`,
 * `/api/v1/settings/branding`) and the logo through File Util. A generic PATCH
 * here wrote the raw request body into org_tenants_mst (any column) and was removed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/services/tenants.service';
import { getCurrentSubscription } from '@/lib/services/subscriptions.service';
import { getUsageMetrics } from '@/lib/services/usage-tracking.service';

/**
 * GET /api/v1/tenants/me
 * Returns current tenant details with subscription and usage info
 * @param _request
 */
export async function GET(_request: NextRequest) {
  try {
    // Get tenant data first (simplified approach)
    const tenant = await getCurrentTenant();

    // Try to get subscription data (with error handling)
    let subscription = null;
    let usage = null;
    
    try {
      subscription = await getCurrentSubscription();
    } catch (subError) {
      console.warn('Subscription data not available:', subError instanceof Error ? subError.message : 'Unknown error');
    }

    try {
      usage = await getUsageMetrics(tenant.id);
    } catch (usageError) {
      console.warn('Usage data not available:', usageError instanceof Error ? usageError.message : 'Unknown error');
    }

    // Combine into response
    const response = {
      ...tenant,
      ...(subscription && {
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          trialEnds: subscription.trial_ends,
          ordersLimit: subscription.orders_limit,
          ordersUsed: subscription.orders_used,
          usagePercentage: Math.round(
            (subscription.orders_used / subscription.orders_limit) * 100
          ),
        },
      }),
      ...(usage && { usage }),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Error fetching tenant:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch tenant details' },
      { status: 500 }
    );
  }
}
