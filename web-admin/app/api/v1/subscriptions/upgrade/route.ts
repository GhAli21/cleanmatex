/**
 * POST /api/v1/subscriptions/upgrade
 * Upgrade subscription to a paid plan
 * Protected endpoint (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { upgradeSubscription } from '@/lib/services/subscriptions.service';
import type { SubscriptionUpgradeRequest } from '@/lib/types/tenant';

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.user_metadata?.tenant_org_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata.tenant_org_id;
    const upgradeRequest: SubscriptionUpgradeRequest = await request.json();

    // Validate required fields
    if (!upgradeRequest.planCode || !upgradeRequest.billingCycle) {
      return NextResponse.json(
        { error: 'planCode and billingCycle are required' },
        { status: 400 }
      );
    }

    // Validate billing cycle
    if (!['monthly', 'yearly'].includes(upgradeRequest.billingCycle)) {
      return NextResponse.json(
        { error: 'billingCycle must be "monthly" or "yearly"' },
        { status: 400 }
      );
    }

    // Validate plan code
    const validPlans = ['starter', 'growth', 'pro', 'enterprise'];
    if (!validPlans.includes(upgradeRequest.planCode)) {
      return NextResponse.json(
        { error: `Invalid plan code. Valid options: ${validPlans.join(', ')}` },
        { status: 400 }
      );
    }

    // Perform upgrade
    const updatedSubscription = await upgradeSubscription(tenantId, upgradeRequest);

    // Get updated tenant with new feature flags
    const { data: tenant } = await supabase
      .from('org_tenants_mst')
      .select('feature_flags')
      .eq('id', tenantId)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        subscription: updatedSubscription,
        featureFlags: tenant?.feature_flags,
      },
      message: `Successfully upgraded to ${upgradeRequest.planCode} plan`,
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);

    const errorMessage = error instanceof Error ? error.message : 'Upgrade failed';

    // Check for specific error types
    if (errorMessage.includes('downgrade')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
