import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialReconciliation } from '@/lib/services/reconciliation.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
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
