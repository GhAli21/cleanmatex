/**
 * POST /api/v1/orders/[id]/issue
 * Create issue at ORDER / ITEM / PIECE scope (auth-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderService } from '@/lib/services/order-service';
import { CreateIssueRequestSchema } from '@/lib/validations/workflow-schema';
import { ORDER_ISSUE_SCOPE, type OrderIssueScope } from '@/lib/constants/order-issues';

/**
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:transition')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: orderId } = await params;
    const { tenantId, userId } = auth;

    const body = await request.json();
    const parsed = CreateIssueRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          errorCode: 'ISSUE_SCOPE_INVALID',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const orderItemId = parsed.data.orderItemId ?? null;
    const orderItemPieceId = parsed.data.orderItemPieceId ?? null;
    const scopeLevel = OrderService.deriveIssueScope(
      parsed.data.scopeLevel as OrderIssueScope | undefined,
      orderItemId,
      orderItemPieceId
    );

    const alsoReject =
      typeof body === 'object' &&
      body !== null &&
      (body as { alsoReject?: boolean }).alsoReject === true;

    const result = await OrderService.createIssue({
      orderId,
      tenantId,
      userId,
      issueCode: parsed.data.issueCode,
      issueText: parsed.data.issueText,
      scopeLevel,
      orderItemId:
        scopeLevel === ORDER_ISSUE_SCOPE.ORDER ? null : orderItemId,
      orderItemPieceId:
        scopeLevel === ORDER_ISSUE_SCOPE.PIECE ? orderItemPieceId : null,
      photoUrl: parsed.data.photoUrl,
      priority: parsed.data.priority || 'normal',
      alsoReject,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.issue });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
