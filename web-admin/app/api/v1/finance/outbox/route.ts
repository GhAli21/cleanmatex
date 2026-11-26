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
import { civilInstantRange } from '@/lib/utils/operational-time';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';

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

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if ((from && !/^\d{4}-\d{2}-\d{2}/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}/.test(to))) {
    return NextResponse.json({ success: false, error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  }
  const zone = from || to ? await resolveOperationalTimeZone(tenantId, 'ledger', null) : null;
  if ((from || to) && !zone) {
    return NextResponse.json({ success: false, error: 'TIMEZONE_NOT_CONFIGURED' }, { status: 422 });
  }
  const createdRange = zone ? civilInstantRange(from, to, zone) : {};

  const filters: OutboxListFilters = {
    status: parseOutboxStatus(searchParams.get('status')),
    eventType: searchParams.get('eventType')?.trim() || undefined,
    aggregateType: searchParams.get('aggregateType')?.trim() || undefined,
    search: searchParams.get('search')?.trim() || undefined,
    stuckOnly: searchParams.get('stuck') === '1',
    from: createdRange.gte,
    to: createdRange.lt,
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
