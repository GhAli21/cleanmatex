/**
 * GET /api/v1/finance/outbox
 *
 * Ops-visibility read endpoint: health counts, processor hint, filter facet
 * lists, and a paginated event list. Requires finance_outbox:view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import {
  listOutboxMonitor,
  OUTBOX_PAGE_SIZE_MAX,
  parseOutboxStatus,
  type OutboxListFilters,
} from '@/lib/services/outbox-monitor.service';

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('finance_outbox:view')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId } = authCheck;

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    OUTBOX_PAGE_SIZE_MAX,
    Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20),
  );

  const filters: OutboxListFilters = {
    status: parseOutboxStatus(searchParams.get('status')),
    eventType: searchParams.get('eventType')?.trim() || undefined,
    aggregateType: searchParams.get('aggregateType')?.trim() || undefined,
    search: searchParams.get('search')?.trim() || undefined,
    stuckOnly: searchParams.get('stuck') === '1',
    from: parseDate(searchParams.get('from')),
    to: parseDate(searchParams.get('to')),
  };

  try {
    const result = await withTenantContext(tenantId, () =>
      listOutboxMonitor(tenantId, filters, page, limit),
    );

    return NextResponse.json({
      success: true,
      data: {
        counts: result.counts,
        health: result.health,
        events: result.events,
        eventTypes: result.eventTypes,
        aggregateTypes: result.aggregateTypes,
        handlerCatalog: result.handlerCatalog,
      },
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit)),
      },
    });
  } catch (error) {
    logger.error('GET /api/v1/finance/outbox failed', error instanceof Error ? error : undefined, { tenantId });
    return NextResponse.json({ success: false, error: 'Failed to fetch outbox status' }, { status: 500 });
  }
}
