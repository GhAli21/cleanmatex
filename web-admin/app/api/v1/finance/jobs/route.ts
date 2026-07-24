/**
 * GET /api/v1/finance/jobs
 *
 * B19 ops read endpoint: the last run of each of the 3 registered finance
 * jobs (gift-card expiry, idempotency cleanup, ERP posting-retry).
 * Requires finance_jobs:view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listFinanceJobsLastRun } from '@/lib/services/finance-jobs.service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('finance_jobs:view')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const jobs = await listFinanceJobsLastRun();
    return NextResponse.json({ success: true, data: { jobs } });
  } catch (error) {
    logger.error('GET /api/v1/finance/jobs failed', error instanceof Error ? error : undefined);
    return NextResponse.json({ success: false, error: 'Failed to load finance jobs' }, { status: 500 });
  }
}
