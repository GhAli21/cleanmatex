import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import { listVarianceDecisionQueue, VARIANCE_QUEUE_DECISION } from '@/lib/services/cash-drawer-variance-queue.service';
import { narrowBranchFilter, resolveBranchScope } from '@/lib/services/branch-access.service';
import { pageQuerySchema } from '@/lib/validations/cash-drawer/list-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

const querySchema = pageQuerySchema.extend({
  decision: z.enum(Object.values(VARIANCE_QUEUE_DECISION) as [string, ...string[]]).default(VARIANCE_QUEUE_DECISION.PENDING),
});

/**
 * GET /api/v1/cash-drawers/variance-approvals
 *
 * C3 — the variance decision queue: closed drawer sessions whose closing variance tripped their
 * threshold, filterable by decision (PENDING by default, APPROVED, REJECTED, ALL), paginated and
 * limited to the actor's permitted branches. Needs `cash_drawer:approve_variance` — the same code
 * that decides them.
 * @param request authenticated request with page/pageSize/decision query params
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:approve_variance')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await listVarianceDecisionQueue(
      tenantId,
      {
        decision: parsed.data.decision as (typeof VARIANCE_QUEUE_DECISION)[keyof typeof VARIANCE_QUEUE_DECISION],
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      },
      narrowBranchFilter(await resolveBranchScope(auth)),
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the variance approvals');
  }
}
