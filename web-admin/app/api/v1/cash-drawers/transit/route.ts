import { NextRequest, NextResponse } from 'next/server';

import { requireAnyPermission, requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { listTransits, sendTransit } from '@/lib/services/cash-transit.service';
import { narrowBranchFilter, resolveBranchScope } from '@/lib/services/branch-access.service';
import { sendTransitRequestSchema, transitListQuerySchema } from '@/lib/validations/cash-drawer/transit-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardDrawersBranch } from '@/lib/api/branch-access-guard';
import type { CashTransitStatus } from '@/lib/constants/cash-drawer';

/**
 * POST /api/v1/cash-drawers/transit — send cash in transit (D1-4): source drawer → the branch's
 * IN_TRANSIT holder, opening a transfer to be received at the destination or cancelled.
 * Needs `cash_drawer:transfer`; both drawers must be in the actor's branches.
 * @param request JSON body matching `sendTransitRequestSchema`
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:transfer')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const parsed = sendTransitRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const denied = await guardDrawersBranch(auth, [parsed.data.sourceDrawerId, parsed.data.destDrawerId]);
  if (denied) return denied;

  try {
    const result = await sendTransit(tenantId, userId, parsed.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to send the cash in transit');
  }
}

/**
 * GET /api/v1/cash-drawers/transit — paginated in-transit transfers (default: still on the road),
 * limited to the actor's branches. Visible to anyone who can send or receive a transfer.
 * @param request authenticated request with page/pageSize/status query params
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyPermission(['cash_drawer:transfer', 'cash_drawer:receive_transfer'])(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const parsed = transitListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await listTransits(
      tenantId,
      { status: parsed.data.status as CashTransitStatus | 'ALL', page: parsed.data.page, pageSize: parsed.data.pageSize },
      narrowBranchFilter(await resolveBranchScope(auth)),
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the in-transit transfers');
  }
}
