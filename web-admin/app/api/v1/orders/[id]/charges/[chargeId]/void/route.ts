/**
 * B18 follow-up — Order charge void.
 *
 * POST /api/v1/orders/[id]/charges/[chargeId]/void
 *
 * Voids a single `org_order_charges_dtl` line (mistaken/duplicate entry,
 * goodwill waiver). Immutable-ledger row stays, flagged `is_voided`; the
 * order's financial snapshot is recalculated in the same transaction.
 * Gated by `orders:manual_charge` — the same code migration 0411 already
 * seeded and reserved for B18's order-charge management surface.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { voidOrderCharge, OrderChargeVoidError } from '@/lib/services/order-charge.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:manual_charge')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId, chargeId } = await params;

  let reason = '';
  try {
    const body = await request.json();
    reason = typeof body?.reason === 'string' ? body.reason : '';
  } catch {
    // no body — reason stays empty, rejected below by the service.
  }

  try {
    const result = await voidOrderCharge({
      tenantId,
      orderId,
      chargeId,
      voidedBy: userId,
      reason,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    if (err instanceof OrderChargeVoidError) {
      return NextResponse.json({ success: false, error: err.code }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Failed to void charge';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
