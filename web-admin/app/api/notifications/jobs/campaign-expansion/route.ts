/**
 * POST /api/notifications/jobs/campaign-expansion
 *
 * Fixed worker ingress for one campaign pass. The body cannot select another job.
 * Authorization matches the existing campaign route. The pass keeps the
 * 10-campaign and 50-target limits, consent, quiet hours, and idempotency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isOutboxRequestAuthorized } from '@lib/notifications/outbox-auth';
import { runCampaignExpansion } from '../../process-campaigns/route';

export async function POST(request: NextRequest) {
  if (!(await isOutboxRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const stats = await runCampaignExpansion();
  return NextResponse.json({ success: true, ...stats });
}
