import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { reverseBizVoucher } from '@/lib/services/voucher-reversal.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:reverse')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { voucherId } = await params;

  try {
    const body = await request.json() as { reason: string };
    if (!body?.reason?.trim()) {
      return NextResponse.json({ success: false, error: 'reason is required' }, { status: 400 });
    }
    const result = await reverseBizVoucher(tenantId, voucherId, body.reason.trim(), userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    // CLF: the cash-drawer ledger gate raises a typed refusal with a stable
    // `code` (lib/constants/cash-drawer.ts CASH_LEDGER_ERRORS) — a client
    // error, not a server failure.
    if (err instanceof CashDrawerLedgerError) {
      return NextResponse.json({ success: false, error: err.code }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Failed to reverse voucher';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
