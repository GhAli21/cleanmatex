import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getVarianceByCashierReport } from '@/lib/services/cash-drawer-variance-report.service';
import { narrowBranchFilter, resolveBranchScope } from '@/lib/services/branch-access.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const querySchema = z
  .object({
    dateFrom: dateOnly,
    dateTo: dateOnly,
    branchId: z.string().uuid().optional(),
    cashierId: z.string().uuid().optional(),
  })
  .refine((q) => q.dateFrom <= q.dateTo, { message: 'dateFrom must not be after dateTo', path: ['dateFrom'] });

/**
 * GET /api/v1/cash-drawers/variance-report
 *
 * C4 — cash variance by cashier: per cashier and currency, the count of closed drawer sessions in
 * the date range, total / mean / absolute variance and the shortage-versus-overage split. Needs
 * `cash_drawer:view_reports` and is limited to the actor's permitted branches (`branchId` can only
 * narrow that scope, never widen it).
 * @param request authenticated request with dateFrom/dateTo and optional branchId/cashierId
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view_reports')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }
  const { branchId, ...filter } = parsed.data;

  try {
    const report = await getVarianceByCashierReport(
      tenantId,
      filter,
      narrowBranchFilter(await resolveBranchScope(auth), branchId),
    );
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the cash variance report');
  }
}
