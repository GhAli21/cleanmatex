/**
 * POST /api/finance/process-jobs
 *
 * Internal-only finance job dispatcher. Called by pg_cron via pg_net
 * from schedules posting a `job` body (see migrations 0429 + 0505 —
 * `fin_trigger_job()`). Authorization: Bearer {FINANCE_OUTBOX_SECRET}.
 *
 * All business logic lives in lib/services/finance-jobs.service.ts — this
 * route only owns auth, body validation, and the HTTP envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { runFinanceJob, FINANCE_JOB_CODE_VALUES } from '@/lib/services/finance-jobs.service';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.FINANCE_OUTBOX_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${secret}`;
}

const bodySchema = z.object({
  job: z.enum(FINANCE_JOB_CODE_VALUES as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const result = await runFinanceJob({
      jobCode: parsed.data.job as (typeof FINANCE_JOB_CODE_VALUES)[number],
      triggerSource: 'SCHEDULE',
    });
    if (result.skippedBecauseRunning) {
      return NextResponse.json({ success: true, data: result });
    }
    if (result.status === 'FAILED' || result.failedCount > 0) {
      logger.warn('Finance job run had failures', result as unknown as Record<string, unknown>);
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('Finance job dispatcher crashed', error instanceof Error ? error : undefined, {
      job: parsed.data.job,
    });
    return NextResponse.json({ success: false, error: 'JOB_PROCESSING_FAILED' }, { status: 500 });
  }
}
