import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialReconciliation } from '@/lib/services/reconciliation.service';

/**
 * POST /api/v1/orders/[id]/financial-reconcile
 *
 * On-demand action: re-run the live order-scoped reconciliation checks for
 * one order. Distinct from the read-only GET counterpart below.
 *
 * Permission: `reconciliation:run` (write-equivalent because it represents
 * an explicit operator decision to refresh the check, not a passive read).
 * CSRF required.
 *
 * Returns 201 on success — semantically a "created on-demand result", not
 * 200, because the operator triggered a fresh evaluation.
 *
 * Pair semantics — paired with the GET route below:
 * @see app/api/v1/orders/[id]/financial-reconciliation/route.ts — read-only
 *      view of the same `getOrderFinancialReconciliation` payload, no CSRF,
 *      permission `reconciliation:view`. Different verbs, different
 *      permissions, semantically distinct (operator action vs UI poll).
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns live order reconciliation result with checkedAt timestamp
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard against cross-site request forgery on privileged financial actions.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('reconciliation:run')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: orderId } = await params;

  try {
    const result = await getOrderFinancialReconciliation(tenantId, orderId);
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        checkedAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Order financial reconciliation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
