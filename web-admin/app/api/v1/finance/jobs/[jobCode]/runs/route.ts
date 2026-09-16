/**
 * GET /api/v1/finance/jobs/[jobCode]/runs
 *
 * Recent run history for one finance job. Requires finance_jobs:view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  listFinanceJobRuns,
  FINANCE_JOB_CODE_VALUES,
  type FinanceJobCode,
} from '@/lib/services/finance-jobs.service';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobCode: string }> },
) {
  const authCheck = await requirePermission('finance_jobs:view')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { jobCode } = await params;
  if (!FINANCE_JOB_CODE_VALUES.includes(jobCode as FinanceJobCode)) {
    return NextResponse.json({ success: false, error: 'UNKNOWN_JOB_CODE' }, { status: 400 });
  }

  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 30;

  try {
    const runs = await listFinanceJobRuns(jobCode as FinanceJobCode, limit);
    return NextResponse.json({ success: true, data: { runs } });
  } catch (error) {
    logger.error('GET /api/v1/finance/jobs/[jobCode]/runs failed', error instanceof Error ? error : undefined, {
      jobCode,
    });
    return NextResponse.json({ success: false, error: 'Failed to load job runs' }, { status: 500 });
  }
}
