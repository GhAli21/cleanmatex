/**
 * POST /api/v1/orders/[id]/payments/[paymentId]/verify
 *
 * Verify button on the order payments tab. Flips a PENDING/PROCESSING
 * `REAL_PAYMENT` leg to COMPLETED.
 *
 * CLF W10: delegates to the canonical VERIFY transition
 * (`transitionPaymentTx`, the same service the pending-payments worklist
 * uses). The former `verifyPaymentTx` flipped the status but never recognised
 * a cash leg in the drawer ledger — a cash payment verified here stayed
 * PENDING in the drawer and the close showed a false shortage. VERIFY
 * recognises the cash line (gate, DEFERRED mode), recalculates the order
 * header and emits `PAYMENT_VERIFIED`.
 *
 * Contract kept for the existing UI: no body required; response `data` keeps
 * the legacy fields (`paymentId`, `previousStatus`, `newStatus`, `verifiedAt`,
 * `orderPaymentStatus`, `outstanding`, `flipped`). The idempotency key is
 * derived from the payment id — VERIFY is idempotent by nature (a replay after
 * COMPLETED is a no-op), so one key per payment is correct.
 *
 * Permission: `orders:verify_payment` (migration 0332). CSRF enforced.
 * Errors: `{ success: false, error, code }`; cash-drawer ledger refusals and
 * transition errors carry a stable `code`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { transitionPaymentTx } from '@/lib/services/payment-transition.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { PAYMENT_TRANSITION_ACTIONS } from '@/lib/constants/order-financial';

const ERROR_STATUS: Record<string, number> = {
  PAYMENT_NOT_FOUND: 404,
  NOT_REAL_PAYMENT_LEG: 422,
  ILLEGAL_TRANSITION: 409,
  PAYMENT_TRANSITION_RACE_DETECTED: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

/**
 * @param request CSRF-protected POST from the order payments tab
 * @param root0 route context
 * @param root0.params `{ id: orderId, paymentId }`
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:verify_payment')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId, paymentId } = await params;

  try {
    const result = await transitionPaymentTx({
      orderId,
      paymentId,
      tenantId,
      actorId: userId,
      action: PAYMENT_TRANSITION_ACTIONS.VERIFY,
      idempotencyKey: `order_payment_verify:${paymentId}`,
    });
    return NextResponse.json(
      {
        success: true,
        data: {
          paymentId: result.paymentId,
          previousStatus: result.previousStatus,
          newStatus: result.newStatus,
          verifiedAt: result.transitionedAt,
          orderPaymentStatus: result.orderPaymentStatus,
          outstanding: result.outstanding,
          flipped: result.flipped,
          cashRecognized: result.deferredCashMovementCreated,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof CashDrawerLedgerError) {
      return NextResponse.json({ success: false, code: err.code, error: err.code }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'PAYMENT_TRANSITION_FAILED';
    const status = ERROR_STATUS[message];
    return NextResponse.json(
      { success: false, code: status ? message : undefined, error: message },
      { status: status ?? 422 },
    );
  }
}
