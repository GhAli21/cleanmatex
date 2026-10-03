import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getCurrencyDenominations } from '@/lib/services/cash-drawer-catalogs.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/currencies/[code]/denominations
 *
 * CLF §4B.7, CLF-8-1 `CmxDenominationCounter` — active, in-circulation
 * denominations for one currency (global `sys_currency_denominations_cd`, no
 * tenant scoping). Gated on `cash_drawer:view` rather than left fully
 * unauthenticated, consistent with the rest of the CLF surface;
 * `org_currency_denom_cf` tenant overrides (C1-1b) are applied for the caller's tenant.
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params ISO currency code
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;

  try {
    // The tenant's own grid: switched-off denominations are left out and its order is applied (C1-1b).
    const rows = await getCurrencyDenominations(code.toUpperCase(), auth.tenantId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load currency denominations');
  }
}
