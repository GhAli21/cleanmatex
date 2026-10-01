import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getBranchPendingDepositStatus } from '@/lib/services/pending-deposit-drawer.service';

/**
 * GET /api/v1/cash-drawers/pending-deposit/status — CLF §4B.2a-B. Per-branch
 * present/missing status of the system PENDING_DEPOSIT drawer, feeding the
 * "Create pending-deposit drawer" button on the three tenant screens.
 * @param request incoming request (no query params)
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;

  const data = await getBranchPendingDepositStatus(auth.tenantId);
  return NextResponse.json({ success: true, data });
}
