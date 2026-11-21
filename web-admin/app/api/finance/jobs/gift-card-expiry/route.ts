/**
 * POST /api/finance/jobs/gift-card-expiry
 *
 * Fixed worker ingress for one finance job. The body cannot select another job.
 * Authorization matches the existing finance dispatcher: Bearer {FINANCE_OUTBOX_SECRET}.
 * The service writes the EXPIRE ledger row and asks the posting engine for the journal.
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
    jobCode: FINANCE_JOB_CODES.GIFT_CARD_EXPIRY,
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
