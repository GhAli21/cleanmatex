import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getCashDrawerCatalogs } from '@/lib/services/cash-drawer-catalogs.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/cash-drawers/catalogs
 *
 * CLF §4B.7 — drawer types, custody trx types, close dispositions, post-close
 * statuses, and count types in one bilingual call (global `sys_*` catalogs,
 * no tenant scoping). Backs the close wizard, the drawer config form, and the
 * drawer-transaction dialog.
 * @param request authenticated request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const catalogs = await getCashDrawerCatalogs();
    return NextResponse.json({ success: true, data: catalogs });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load cash-drawer catalogs');
  }
}
