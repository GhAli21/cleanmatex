import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { cancelTransit, getTransitBranchId } from '@/lib/services/cash-transit.service';
import { cancelTransitRequestSchema } from '@/lib/validations/cash-drawer/transit-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardBranchIds } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/transit/[transitId]/cancel — return an in-transit transfer's cash to
 * its source drawer (D1-4) with a mandatory reason. Needs `cash_drawer:transfer`; a transfer
 * settles exactly once.
 * @param request JSON body `{ reason }`
 * @param root0 route params
 * @param root0.params the transfer id
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ transitId: string }> }) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:transfer')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const parsed = cancelTransitRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const { transitId } = await params;
  const branchId = await getTransitBranchId(tenantId, transitId);
  if (branchId) {
    const denied = await guardBranchIds(auth, [branchId]);
    if (denied) return denied;
  }

  try {
    const result = await cancelTransit(tenantId, userId, transitId, parsed.data.reason);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to cancel the transfer');
  }
}
