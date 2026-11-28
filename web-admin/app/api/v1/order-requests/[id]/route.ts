import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getStaffOrderRequestDetail,
  OrderRequestConversionError,
  triageStaffOrderRequest,
} from '@/lib/services/order-request-conversion.service';
import { logger } from '@/lib/utils/logger';

const triageSchema = z.object({
  statusCode: z.enum(['IN_REVIEW', 'AWAITING_CUSTOMER', 'DECLINED', 'CANCELLED']).optional(),
  branchVerificationStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
  reason: z.string().trim().max(400).nullable().optional(),
});

/**
 * GET /api/v1/order-requests/[id]
 * Loads one customer Fast Quick Drop request for staff review or POS New Order
 * pre-fill (`/dashboard/orders/new?requestId=<id>`).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const detail = await getStaffOrderRequestDetail(auth.tenantId, id);
    if (!detail) {
      return NextResponse.json(
        { success: false, errorCode: 'REQUEST_NOT_FOUND', error: 'Order request not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: detail }, { status: 200 });
  } catch (error) {
    logger.error(
      'Staff order request detail GET failed',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId: auth.tenantId, feature: 'staff_order_requests' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load customer order request' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/order-requests/[id]
 * Applies staff triage status or branch verification updates (`IN_REVIEW`,
 * `AWAITING_CUSTOMER`, `DECLINED`, `CANCELLED`). Gated under `orders:create`.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission('orders:create')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const parsed = triageSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'validation_failed',
          error: 'Invalid triage payload',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const updated = await triageStaffOrderRequest({
      tenantOrgId: auth.tenantId,
      requestId: id,
      staffUserId: auth.userId,
      statusCode: parsed.data.statusCode,
      branchVerificationStatus: parsed.data.branchVerificationStatus,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof OrderRequestConversionError) {
      const status = error.code === 'REQUEST_NOT_FOUND' ? 404 : 409;
      return NextResponse.json(
        { success: false, errorCode: error.code, error: error.message },
        { status },
      );
    }
    logger.error(
      'Staff order request triage PATCH failed',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId: auth.tenantId, feature: 'staff_order_requests' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update customer order request' },
      { status: 500 },
    );
  }
}
