/**
 * POST /api/v1/subscriptions/cancel
 * Cancel subscription (schedules downgrade at end of billing period)
 * Protected endpoint (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cancelSubscription } from '@/lib/services/subscriptions.service';
import type { SubscriptionCancelRequest } from '@/lib/types/tenant';

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
    const cancelRequest: SubscriptionCancelRequest = await request.json();

    // Validate required fields
    if (!cancelRequest.reason) {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      );
    }

    // Cancel subscription
    const updatedSubscription = await cancelSubscription(tenantId, cancelRequest);

    return NextResponse.json({
      success: true,
      data: {
        subscription: updatedSubscription,
        message: `Subscription will be canceled on ${updatedSubscription.end_date}. You'll be downgraded to the Free plan.`,
      },
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);

    const errorMessage = error instanceof Error ? error.message : 'Cancellation failed';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
