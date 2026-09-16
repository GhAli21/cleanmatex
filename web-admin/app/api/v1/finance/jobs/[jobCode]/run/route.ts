/**
 * POST /api/v1/finance/jobs/[jobCode]/run
 *
 * Manually trigger an on-demand run of a scheduled finance job.
 * Requires finance_jobs:run. Returns 409 when a run is already in flight.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  runFinanceJob,
  FINANCE_JOB_CODE_VALUES,
  isFinanceJobAlreadyRunningError,
  type FinanceJobCode,
} from '@/lib/services/finance-jobs.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobCode: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const authCheck = await requirePermission('finance_jobs:run')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { userId } = authCheck;

  const { jobCode } = await params;
  if (!FINANCE_JOB_CODE_VALUES.includes(jobCode as FinanceJobCode)) {
    return NextResponse.json({ success: false, error: 'UNKNOWN_JOB_CODE' }, { status: 400 });
  }

  try {
    const result = await runFinanceJob({
      jobCode: jobCode as FinanceJobCode,
      triggerSource: 'MANUAL',
      triggeredBy: userId,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (isFinanceJobAlreadyRunningError(error)) {
      return NextResponse.json(
        { success: false, error: 'JOB_ALREADY_RUNNING', data: { startedAt: error.startedAt } },
        { status: 409 },
      );
    }
    throw error;
  }
}
