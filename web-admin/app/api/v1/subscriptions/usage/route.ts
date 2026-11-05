/**
 * GET /api/v1/subscriptions/usage
 * Get current usage metrics with limits and warnings
 * Protected endpoint (requires authentication)
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getUsageMetrics } from '@/lib/services/usage-tracking.service';

/**
 *
 */
export async function GET() {
  try {
    // Tenant comes from the validated session, never from client-editable metadata.
    const auth = await getAuthContext();

    // Get usage metrics
    const metrics = await getUsageMetrics(auth.tenantId);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage metrics';
    if (errorMessage === 'Unauthorized' || errorMessage.startsWith('No tenant access')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    console.error('Error fetching usage metrics:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
