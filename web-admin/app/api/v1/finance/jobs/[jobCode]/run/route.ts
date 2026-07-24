/**
 * POST /api/v1/finance/jobs/[jobCode]/run
 *
 * B19 ops action: manually trigger an on-demand run of a scheduled finance
 * job outside its normal schedule. Requires finance_jobs:run.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { runFinanceJob, FINANCE_JOB_CODE_VALUES, type FinanceJobCode } from '@/lib/services/finance-jobs.service';

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

  const result = await runFinanceJob({
    jobCode: jobCode as FinanceJobCode,
    triggerSource: 'MANUAL',
    triggeredBy: userId,
  });

  return NextResponse.json({ success: true, data: result });
}
