import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialReconciliation } from '@/lib/services/reconciliation.service';

/**
 * POST /api/v1/orders/[orderId]/financial-reconcile
 *
 * Why:
 * Runs an on-demand live reconciliation check for one order without creating a
 * persisted tenant-wide reconciliation batch.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns live order reconciliation result
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  // Guard against cross-site request forgery on privileged financial actions.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('reconciliation:run')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { orderId } = await params;

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
