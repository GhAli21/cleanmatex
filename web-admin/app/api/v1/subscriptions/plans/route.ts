/**
 * GET /api/v1/subscriptions/plans
 * Get available subscription plans with comparison to current plan
 * Protected endpoint (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAvailablePlans, getCurrentSubscription } from '@/lib/services/subscriptions.service';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentSubscription = await getCurrentSubscription();
    const plans = await getAvailablePlans(currentSubscription.plan);

    return NextResponse.json({
      success: true,
      data: {
        plans,
        currentPlan: currentSubscription.plan,
      },
    });
  } catch (error) {
    console.error('Error fetching plans:', error);

    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}
