/**
 * POST /api/finance/process-outbox
 *
 * Internal-only financial outbox processor (B7). Called by pg_cron every
 * minute via pg_net (see migration 0410 — `fin-outbox-processor` job).
 * Authorization: Bearer {FINANCE_OUTBOX_SECRET}
 *
 * Delegates to runFinanceJob(outbox_processor) so every tick is visible
 * on the jobs hub (run log, overlap guard, idle-tick prune).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
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

  try {
    const result = await runFinanceJob({
      jobCode: FINANCE_JOB_CODES.OUTBOX_PROCESSOR,
      triggerSource: 'SCHEDULE',
    });
    if (result.skippedBecauseRunning) {
      return NextResponse.json({ success: true, data: result });
    }
    if (result.status === 'FAILED' || result.failedCount > 0) {
      logger.warn('Financial outbox batch had failures', result as unknown as Record<string, unknown>);
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('Financial outbox processor crashed', error instanceof Error ? error : undefined);
    return NextResponse.json({ success: false, error: 'Outbox processing failed' }, { status: 500 });
  }
}
