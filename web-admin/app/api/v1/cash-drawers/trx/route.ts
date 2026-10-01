import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { postDrawerTrx, listDrawerTrx } from '@/lib/services/cash-drawer-trx.service';
import { postDrawerTrxRequestSchema } from '@/lib/validations/cash-drawer/trx-schemas';
import { drawerTrxListQuerySchema } from '@/lib/validations/cash-drawer/list-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import type { CashDrawerTrxType } from '@/lib/constants/cash-drawer';

/**
 * POST /api/v1/cash-drawers/trx
 *
 * CLF §4B.7 — posts a custody (operational) transaction between drawers
 * (float issue, cash drop, drawer-to-drawer, driver handover, deposit prep).
 * Only `USER_SELECTABLE_TRX_TYPES` are postable here; `CLOSE_DISPOSITION` and
 * `REVERSAL` are system-only.
 * @param request JSON body matching `postDrawerTrxRequestSchema`
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:transfer')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = postDrawerTrxRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await postDrawerTrx(tenantId, userId, {
      trxTypeCode: parsed.data.trxTypeCode as CashDrawerTrxType,
      branchId: parsed.data.branchId,
      lines: parsed.data.lines,
      reasonCode: parsed.data.reasonCode,
      notes: parsed.data.notes,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to post the drawer transaction');
  }
}

/**
 * GET /api/v1/cash-drawers/trx — paginated, filterable custody-transaction history.
 * @param request authenticated request with page/pageSize/drawerId/trxTypeCode/dateFrom/dateTo query params
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:transfer')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = drawerTrxListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await listDrawerTrx(tenantId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load drawer transactions');
  }
}
