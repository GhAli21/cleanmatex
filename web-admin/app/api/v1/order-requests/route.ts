import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/middleware/require-permission';
import { listStaffOrderRequests } from '@/lib/services/order-request-conversion.service';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/v1/order-requests
 * Lists customer-originated Fast Quick Drop requests for staff review.
 * Tenant scope is resolved strictly from the authenticated staff session;
 * gated under existing `orders:read` permission (Option 1).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const pageRaw = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
    const limitRaw = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
    const limit = Number.isNaN(limitRaw) ? 20 : Math.min(50, Math.max(1, limitRaw));

    const result = await listStaffOrderRequests(auth.tenantId, {
      status,
      page,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.items,
        meta: {
          page,
          limit,
          total: result.total,
          pendingCount: result.pendingCount,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(
      'Staff order requests list failed',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId: auth.tenantId, feature: 'staff_order_requests' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load customer order requests' },
      { status: 500 },
    );
  }
}
