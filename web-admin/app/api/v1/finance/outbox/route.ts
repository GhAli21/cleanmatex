/**
 * GET /api/v1/finance/outbox
 *
 * B7 ops-visibility read endpoint: health counts (pending/processing/failed/
 * dead-lettered/processed-last-24h) plus a paginated, filterable list of
 * financial outbox events for the current tenant. Requires finance_outbox:view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE_MAX = 50;
const STATUS_VALUES = ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTERED'] as const;

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('finance_outbox:view')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId } = authCheck;

  const { searchParams } = request.nextUrl;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(PAGE_SIZE_MAX, parseInt(searchParams.get('limit') ?? '20', 10));
  const statusFilterRaw = searchParams.get('status');
  const statusFilter = STATUS_VALUES.includes(statusFilterRaw as (typeof STATUS_VALUES)[number])
    ? (statusFilterRaw as (typeof STATUS_VALUES)[number])
    : undefined;

  try {
    const result = await withTenantContext(tenantId, async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [pending, processing, failed, deadLettered, processedLast24h, total, events] = await Promise.all([
        prisma.org_domain_events_outbox.count({ where: { tenant_org_id: tenantId, status: 'PENDING' } }),
        prisma.org_domain_events_outbox.count({ where: { tenant_org_id: tenantId, status: 'PROCESSING' } }),
        prisma.org_domain_events_outbox.count({ where: { tenant_org_id: tenantId, status: 'FAILED' } }),
        prisma.org_domain_events_outbox.count({ where: { tenant_org_id: tenantId, status: 'DEAD_LETTERED' } }),
        prisma.org_domain_events_outbox.count({
          where: { tenant_org_id: tenantId, status: 'PROCESSED', processed_at: { gte: dayAgo } },
        }),
        prisma.org_domain_events_outbox.count({
          where: { tenant_org_id: tenantId, ...(statusFilter ? { status: statusFilter } : {}) },
        }),
        prisma.org_domain_events_outbox.findMany({
          where: { tenant_org_id: tenantId, ...(statusFilter ? { status: statusFilter } : {}) },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, event_type: true, aggregate_type: true, aggregate_id: true,
            status: true, attempts: true, max_attempts: true, next_retry_at: true,
            processed_at: true, error_message: true, created_at: true,
          },
        }),
      ]);

      return {
        counts: { pending, processing, failed, deadLettered, processedLast24h },
        events,
        total,
      };
    });

    return NextResponse.json({
      success: true,
      data: { counts: result.counts, events: result.events },
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    logger.error('GET /api/v1/finance/outbox failed', error instanceof Error ? error : undefined, { tenantId });
    return NextResponse.json({ success: false, error: 'Failed to fetch outbox status' }, { status: 500 });
  }
}
