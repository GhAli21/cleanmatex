/**
 * BVM Wiring — Phase 6 Sub-item 1
 *
 * POST /api/v1/orders/[id]/payments/[paymentId]/verify
 *
 * Flips a single PENDING `REAL_PAYMENT` leg on `org_order_payments_dtl`
 * to COMPLETED after a gateway / bank confirms funds. Emits a
 * `PAYMENT_VERIFIED` outbox event so the Phase 5 order-history consumer
 * persists an audit row asynchronously.
 *
 * Why a dedicated permission:
 * Verifying a deferred payment is a financial control distinct from
 * collecting cash at the counter. The route enforces
 * `orders:verify_payment` (seeded by migration 0332) which defaults to
 * super_admin, tenant_admin, admin, and branch_manager only.
 *
 * CSRF: enforced via `validateCSRF` because this is a state-changing
 * POST executed from the order-detail UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { verifyPaymentTx } from '@/lib/services/order-settlement.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  // CSRF first: cheap, no DB hit. Mirrors collect-payment route.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  // Permission middleware resolves tenantId from JWT and userId from
  // the verified session. Both feed verifyPaymentTx directly so the
  // service never depends on session-resolved tenant context.
  const auth = await requirePermission('orders:verify_payment')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId, paymentId } = await params;

  try {
    const result = await verifyPaymentTx({
      orderId,
      paymentId,
      tenantId,
      verifiedBy: userId,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
