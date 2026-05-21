import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialReconciliation } from '@/lib/services/reconciliation.service';

/**
 * GET /api/v1/orders/[orderId]/financial-reconciliation
 *
 * Why:
 * Exposes the current order-scoped reconciliation view for finance UI and
 * support workflows without forcing a persisted batch run.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns current order-scoped reconciliation payload
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await requirePermission('reconciliation:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { orderId } = await params;

  try {
    const result = await getOrderFinancialReconciliation(tenantId, orderId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch order financial reconciliation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
