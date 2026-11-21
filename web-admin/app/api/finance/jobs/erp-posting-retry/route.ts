/**
 * POST /api/finance/jobs/erp-posting-retry
 *
 * Fixed worker ingress for one finance job. The body cannot select another job.
 * Authorization: Bearer {FINANCE_OUTBOX_SECRET}.
 * The service retries SYSTEM_ERROR journals through the posting engine.
 * A failed retry leaves the exception open.
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
    jobCode: FINANCE_JOB_CODES.ERP_POSTING_RETRY,
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
