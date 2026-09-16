/**
 * POST /api/v1/finance/outbox/retry-bulk
 *
 * Re-queue matching FAILED/DEAD_LETTERED events (explicit ids, or the
 * current filter, capped). Requires finance_outbox:retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import { bulkRetryOutbox, parseOutboxStatus } from '@/lib/services/outbox-monitor.service';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).max(50).optional(),
  filters: z.object({
    status: z.enum([
      OUTBOX_STATUSES.PENDING,
      OUTBOX_STATUSES.PROCESSING,
      OUTBOX_STATUSES.PROCESSED,
      OUTBOX_STATUSES.FAILED,
      OUTBOX_STATUSES.DEAD_LETTERED,
    ]).optional(),
    eventType: z.string().min(1).optional(),
    aggregateType: z.string().min(1).optional(),
    search: z.string().min(1).optional(),
    stuckOnly: z.boolean().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const authCheck = await requirePermission('finance_outbox:retry')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId } = authCheck;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const result = await withTenantContext(tenantId, () =>
      bulkRetryOutbox(tenantId, {
        ids: parsed.data.ids,
        filters: parsed.data.filters
          ? {
              ...parsed.data.filters,
              status: parseOutboxStatus(parsed.data.filters.status ?? null),
            }
          : undefined,
      }),
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('POST /api/v1/finance/outbox/retry-bulk failed', error instanceof Error ? error : undefined, {
      tenantId,
    });
    return NextResponse.json({ success: false, error: 'Retry failed' }, { status: 500 });
  }
}
