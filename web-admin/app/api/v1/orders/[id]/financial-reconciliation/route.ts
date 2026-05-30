import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialReconciliation } from '@/lib/services/reconciliation.service';

/**
 * GET /api/v1/orders/[id]/financial-reconciliation
 *
 * Read-only view of the current order-scoped reconciliation result. Powers
 * the finance UI panels and support read-paths.
 *
 * Permission: `reconciliation:view` (read-only).
 * No CSRF (GET).
 *
 * Pair semantics — paired with the POST route below:
 * @see app/api/v1/orders/[id]/financial-reconcile/route.ts — on-demand
 *      action that re-runs the same checks. Different verb (POST), different
 *      permission (`reconciliation:run`), CSRF required, returns 201 with a
 *      `checkedAt` timestamp. Same underlying
 *      `getOrderFinancialReconciliation` service call, but the verb encodes
 *      the operator's intent (refresh vs poll).
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns current order-scoped reconciliation payload
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('reconciliation:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: orderId } = await params;

  try {
    const result = await getOrderFinancialReconciliation(tenantId, orderId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch order financial reconciliation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
