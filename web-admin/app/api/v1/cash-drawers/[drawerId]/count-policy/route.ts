import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getDrawerCountPolicy } from '@/lib/services/cash-drawer-count-policy.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardDrawerBranch } from '@/lib/api/branch-access-guard';

/**
 * GET /api/v1/cash-drawers/[drawerId]/count-policy
 *
 * The count methods the drawer's policy allows when opening, closing and recounting — what the
 * open dialog, close wizard and recount dialog offer. A slim view for people who count the drawer
 * (`cash_drawer:view`); the full resolved policy with sources stays behind `cash_control:view`.
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params the drawer id
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ drawerId: string }> }) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;

  const { drawerId } = await params;
  const branchDenied = await guardDrawerBranch(auth, drawerId);
  if (branchDenied) return branchDenied;

  try {
    const policy = await getDrawerCountPolicy(auth.tenantId, auth.userId, drawerId);
    if (!policy) return NextResponse.json({ success: false, error: 'Drawer not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the count policy');
  }
}
