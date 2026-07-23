/**
 * GET /api/v1/finance/pending-payments
 *
 * B30 — cross-order back-office worklist read endpoint: health counts
 * (pending/processing/total) plus a paginated, filterable list of
 * PENDING/PROCESSING REAL_PAYMENT legs for the current tenant.
 * Requires orders:pending_payments_view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listPendingPaymentsWorklist, type WorklistStatusFilter } from '@/lib/services/pending-payments-worklist.service';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE_MAX = 50;
const STATUS_VALUES = ['PENDING', 'PROCESSING'] as const;

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('orders:pending_payments_view')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId } = authCheck;

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(PAGE_SIZE_MAX, parseInt(searchParams.get('limit') ?? '20', 10));
  const branchId = searchParams.get('branchId') ?? undefined;
  const paymentMethodCode = searchParams.get('paymentMethodCode') ?? undefined;
  const statusRaw = searchParams.get('status');
  const status: WorklistStatusFilter = STATUS_VALUES.includes(
    statusRaw as (typeof STATUS_VALUES)[number],
  )
    ? (statusRaw as WorklistStatusFilter)
    : undefined;

  try {
    const result = await listPendingPaymentsWorklist({
      tenantId,
      page,
      limit,
      branchId,
      paymentMethodCode,
      status,
    });

    return NextResponse.json({
      success: true,
      data: { counts: result.counts, rows: result.rows },
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    logger.error('GET /api/v1/finance/pending-payments failed', error instanceof Error ? error : undefined, { tenantId });
    return NextResponse.json({ success: false, error: 'Failed to fetch pending payments worklist' }, { status: 500 });
  }
}
