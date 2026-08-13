/**
 * Public Order Confirmation API
 * POST /api/v1/public/orders/[tenantId]/[orderNo]/confirm-received
 *
 * Customer confirms receipt via public tracking link (no login).
 * V2: CONFIRM_DELIVERY via WorkflowEngine + system actor UUID.
 * The public tracking service executes the configured workflow action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkPublicConfirmReceivedRateLimit } from '@/lib/middleware/rate-limit';
import { confirmPublicOrderReceivedResponse } from '@/lib/services/public-order-tracking.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; orderNo: string }> },
) {
  try {
    const rateLimited = await checkPublicConfirmReceivedRateLimit(request);
    if (rateLimited) return rateLimited;

    const { tenantId, orderNo } = await params;
    const result = await confirmPublicOrderReceivedResponse(request, { tenantId, orderNo });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
