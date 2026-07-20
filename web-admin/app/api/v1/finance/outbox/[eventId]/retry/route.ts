/**
 * POST /api/v1/finance/outbox/[eventId]/retry
 *
 * B7 ops action: manually re-queue a FAILED or DEAD_LETTERED financial
 * outbox event. Requires finance_outbox:retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { manualRetry } from '@/lib/services/outbox.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const authCheck = await requirePermission('finance_outbox:retry')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId } = authCheck;

  const { eventId } = await params;

  try {
    await manualRetry(eventId, tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Retry failed';
    const status = message === 'EVENT_NOT_FOUND_OR_NOT_RETRYABLE' ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
