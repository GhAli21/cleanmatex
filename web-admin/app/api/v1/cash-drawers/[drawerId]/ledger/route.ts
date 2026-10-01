import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { getDrawerLedgerPage } from '@/lib/services/cash-drawer-ledger/cash-drawer-balance.service';
import { drawerLedgerQuerySchema } from '@/lib/validations/cash-drawer/list-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

/**
 * GET /api/v1/cash-drawers/[drawerId]/ledger
 *
 * CLF §4B.7, CLF-8-7 Ledger tab — paginated unified ledger (finance cash
 * recognitions + custody transactions) for one drawer, newest first.
 * @param request authenticated request with page/pageSize query params
 * @param root0 route params
 * @param root0.params drawer id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> },
) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { drawerId } = await params;
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = drawerLedgerQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await getDrawerLedgerPage(tenantId, drawerId, parsed.data.page, parsed.data.pageSize);
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        rows: result.rows.map((r) => ({ ...r, ledgerSeq: r.ledgerSeq.toString(), amount: r.amount.toFixed(4) })),
      },
    });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the drawer ledger');
  }
}
