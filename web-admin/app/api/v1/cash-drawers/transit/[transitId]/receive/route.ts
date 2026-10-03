import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getTransitBranchId, receiveTransit } from '@/lib/services/cash-transit.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardBranchIds } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/transit/[transitId]/receive — count an in-transit transfer into its
 * destination drawer (D1-4). Needs `cash_drawer:receive_transfer`; the sender may receive their own
 * transfer (permission is the only gate). A transfer settles exactly once.
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params the transfer id
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ transitId: string }> }) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:receive_transfer')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { transitId } = await params;
  const branchId = await getTransitBranchId(tenantId, transitId);
  if (branchId) {
    const denied = await guardBranchIds(auth, [branchId]);
    if (denied) return denied;
  }

  try {
    const result = await receiveTransit(tenantId, userId, transitId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to receive the transfer');
  }
}
