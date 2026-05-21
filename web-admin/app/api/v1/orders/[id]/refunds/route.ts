import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  getOrderRefunds,
  initiateRefund,
  REFUND_SCOPES,
} from '@/lib/services/order-refund.service';
import { REFUND_METHODS, REFUND_REASON_CODES } from '@/lib/constants/order-financial';

const schema = z.object({
  amount: z.number().positive(),
  reason: z.enum([
    REFUND_REASON_CODES.DUPLICATE,
    REFUND_REASON_CODES.QUALITY,
    REFUND_REASON_CODES.CANCELLED,
    REFUND_REASON_CODES.OVERCHARGE,
    REFUND_REASON_CODES.OTHER,
  ]),
  method: z.enum([
    REFUND_METHODS.CASH,
    REFUND_METHODS.WALLET,
    REFUND_METHODS.CREDIT_NOTE,
    REFUND_METHODS.ORIGINAL_METHOD,
  ]),
  notes: z.string().optional(),
  currencyCode: z.string().min(1),
  originalPaymentId: z.string().uuid().optional(),
  originalCreditAppId: z.string().uuid().optional(),
  refundScope: z.enum([REFUND_SCOPES.STANDARD, REFUND_SCOPES.MANUAL_EXCEPTION]).optional(),
  approvalRequired: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(120).optional(),
});

/**
 * GET /api/v1/orders/[id]/refunds
 *
 * Why:
 * Returns the order refund ledger from the canonical Order Fin lifecycle so
 * financial history can be reviewed without joining multiple legacy surfaces.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns order refund ledger payload
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:view_financial_breakdown')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: orderId } = await params;

  try {
    const refunds = await getOrderRefunds(tenantId, orderId);
    return NextResponse.json({ success: true, data: refunds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch refunds';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/v1/orders/[id]/refunds
 *
 * Why:
 * Exposes the canonical plural refund initiation endpoint while enforcing the
 * live Batch 0 RBAC model and manual-exception safeguards.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns standardized refund initiation response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard against cross-site request forgery on privileged financial writes.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:process_refund')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.refundScope === REFUND_SCOPES.MANUAL_EXCEPTION) {
    const allowed = await hasPermissionServer('orders:refunds_manual_exception');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: orders:refunds_manual_exception' },
        { status: 403 }
      );
    }
  }

  try {
    const refund = await initiateRefund(tenantId, {
      orderId,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      method: parsed.data.method,
      notes: parsed.data.notes,
      currencyCode: parsed.data.currencyCode,
      requestedBy: userId,
      originalPaymentId: parsed.data.originalPaymentId,
      originalCreditAppId: parsed.data.originalCreditAppId,
      refundScope: parsed.data.refundScope,
      approvalRequired: parsed.data.approvalRequired,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: refund }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund initiation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
