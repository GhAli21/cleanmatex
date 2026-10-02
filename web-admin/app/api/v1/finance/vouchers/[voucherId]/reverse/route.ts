import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cashPlacementShape } from '@/lib/validations/cash-drawer/placement-schemas';
import { requirePermission } from '@/lib/middleware/require-permission';
import { reverseBizVoucher } from '@/lib/services/voucher-reversal.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { CUSTOMER_RECEIPT_POST_ERRORS } from '@/lib/types/customer-receipt-allocation';

/**
 * Body: mandatory `reason`; optional `lineIds` (partial reversal — default is
 * every POSTED line) and explicit cash placement for the cash mirrors.
 */
const reverseBodySchema = z.object({
  reason: z.string().trim().min(1),
  lineIds: z.array(z.string().uuid()).min(1).max(200).optional(),
  ...cashPlacementShape,
});

/**
 * POST /api/v1/finance/vouchers/[voucherId]/reverse — full or partial reversal.
 * Cash-drawer ledger refusals come back as `{ success:false, error: <code> }` (422).
 * @param request JSON body matching `reverseBodySchema`
 * @param root0 route context
 * @param root0.params voucher id
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
    const parsed = reverseBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const reasonMissing = parsed.error.issues.some((i) => i.path[0] === 'reason');
      return NextResponse.json(
        { success: false, error: reasonMissing ? 'reason is required' : 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { reason, lineIds, cashDrawerId, cashDrawerSessionId, receivedByUserId } = parsed.data;
    const result = await reverseBizVoucher(tenantId, voucherId, reason, userId, {
      lineIds,
      cashDrawerId,
      cashDrawerSessionId,
      receivedByUserId,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    // CLF: the cash-drawer ledger gate raises a typed refusal with a stable
    // `code` (lib/constants/cash-drawer.ts CASH_LEDGER_ERRORS) — a client
    // error, not a server failure.
    if (err instanceof CashDrawerLedgerError) {
      return NextResponse.json({ success: false, error: err.code }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Failed to reverse voucher';
    if (message === CUSTOMER_RECEIPT_POST_ERRORS.REVERSAL_NOT_SUPPORTED) {
      return NextResponse.json({ success: false, code: message, error: message }, { status: 422 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
