/**
 * Public Order Tracking API
 * GET /api/v1/public/orders/[tenantId]/[orderNo]
 *
 * Fully public, read-only endpoint to fetch limited, customer-facing
 * order details by tenant + order number.
 *
 * IMPORTANT:
 * - Still enforces tenant isolation by always filtering with tenant_org_id.
 * - Does NOT require authentication; anyone with the URL can access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicOrderTrackingResponse } from '@/lib/services/public-order-tracking.service';

/**
 * Returns public order detail payload by tenant and order number.
 *
 * @param _request Incoming HTTP request.
 * @param params Route context object.
 * @param params.params Route params promise containing tenantId and orderNo.
 * @returns JSON response with public order details and timeline.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string; orderNo: string }> },
) {
    const { tenantId, orderNo } = await params;
    const result = await getPublicOrderTrackingResponse(request, { tenantId, orderNo });
    return NextResponse.json(result.body, { status: result.status });
}
