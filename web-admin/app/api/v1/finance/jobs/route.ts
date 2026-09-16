/**
 * GET /api/v1/finance/jobs
 *
 * Catalog + last run + cron health for the finance jobs hub.
 * Requires finance_jobs:view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listFinanceJobs } from '@/lib/services/finance-jobs.service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('finance_jobs:view')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const jobs = await listFinanceJobs();
    return NextResponse.json({ success: true, data: { jobs } });
  } catch (error) {
    logger.error('GET /api/v1/finance/jobs failed', error instanceof Error ? error : undefined);
    return NextResponse.json({ success: false, error: 'Failed to load finance jobs' }, { status: 500 });
  }
}
