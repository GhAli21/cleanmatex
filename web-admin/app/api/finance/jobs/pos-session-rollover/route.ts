/**
 * POST /api/finance/jobs/pos-session-rollover
 *
 * Fixed worker ingress for one finance job. The body cannot select another job.
 * Authorization: Bearer {FINANCE_OUTBOX_SECRET}.
 * The service applies the branch business day and rollover policy, then notifies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FINANCE_JOB_CODES, runFinanceJob } from '@/lib/services/finance-jobs.service';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.FINANCE_OUTBOX_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runFinanceJob({
    jobCode: FINANCE_JOB_CODES.POS_SESSION_ROLLOVER,
    triggerSource: 'SCHEDULE',
  });

  return NextResponse.json({
    success: result.status !== 'FAILED',
    data: {
      status: result.status,
      processedCount: result.processedCount,
      failedCount: result.failedCount,
      skippedBecauseRunning: result.skippedBecauseRunning === true,
    },
  });
}
