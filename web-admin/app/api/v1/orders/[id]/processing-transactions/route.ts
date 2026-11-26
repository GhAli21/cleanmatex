/**
 * GET /api/v1/orders/[id]/processing-transactions
 * List chronological processing transaction batches (org_prc_trx_mst + org_prc_trx_dtl).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { ProcessingTrxService } from '@/lib/services/processing-trx-service';
import {
  PRC_TRX_TARGET_LEVELS,
  type PrcTrxTargetLevel,
} from '@/lib/constants/processing-trx';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TARGET_LEVELS = new Set<string>(Object.values(PRC_TRX_TARGET_LEVELS));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const limitParam = Number(sp.get('limit') ?? '50');
    const limit = Number.isFinite(limitParam) ? limitParam : 50;

    const rawLevel = sp.get('targetLevel')?.trim().toUpperCase();
    const targetLevel =
      rawLevel && VALID_TARGET_LEVELS.has(rawLevel)
        ? (rawLevel as PrcTrxTargetLevel)
        : undefined;

    const transType = sp.get('transType')?.trim().toUpperCase() || undefined;

    const result = await ProcessingTrxService.listOrderTransactions(tenantId, id, {
      limit,
      targetLevel,
      transType,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to list transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.transactions ?? [],
    });
  } catch (error) {
    log.error(
      '[API] GET /orders/[id]/processing-transactions error',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load processing transactions' },
      { status: 500 }
    );
  }
}
