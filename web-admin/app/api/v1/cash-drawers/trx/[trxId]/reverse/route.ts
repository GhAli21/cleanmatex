import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { reverseDrawerTrx } from '@/lib/services/cash-drawer-trx.service';
import { reverseDrawerTrxRequestSchema } from '@/lib/validations/cash-drawer/trx-schemas';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { guardDrawerTrxBranch } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/cash-drawers/trx/[trxId]/reverse
 *
 * CLF §4B.7 — reverses a custody transaction: a new `REVERSAL` header whose
 * lines mirror the original with direction swapped, stamped at new ledger
 * sequences taken now (never retroactively). A reason is mandatory.
 * @param request JSON body matching `reverseDrawerTrxRequestSchema`
 * @param root0 route params
 * @param root0.params the transaction to reverse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trxId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:transfer')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { trxId } = await params;
  const branchDenied = await guardDrawerTrxBranch(auth, trxId);
  if (branchDenied) return branchDenied;
  const body = await request.json().catch(() => null);
  const parsed = reverseDrawerTrxRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await reverseDrawerTrx(tenantId, userId, trxId, parsed.data.reasonCode);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to reverse the drawer transaction');
  }
}
