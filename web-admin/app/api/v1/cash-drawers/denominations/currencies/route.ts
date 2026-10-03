import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { listCountableCurrencies } from '@/lib/services/cash-denomination-control.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/cash-drawers/denominations/currencies
 *
 * C1-1b — the currencies this tenant can count cash in and for which HQ publishes denominations
 * (the picker of the denomination admin). Needs `cash_control:view`.
 * @param request authenticated request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_control:view')(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ success: true, data: await listCountableCurrencies(auth.tenantId) });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the currencies');
  }
}
