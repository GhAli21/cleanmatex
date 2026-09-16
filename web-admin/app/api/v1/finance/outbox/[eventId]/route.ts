/**
 * GET /api/v1/finance/outbox/[eventId]
 *
 * Full event detail (payload, related links, sibling events on the same
 * aggregate). Requires finance_outbox:view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { getOutboxMonitorEvent } from '@/lib/services/outbox-monitor.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const authCheck = await requirePermission('finance_outbox:view')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId } = authCheck;
  const { eventId } = await params;

  try {
    const event = await withTenantContext(tenantId, () =>
      getOutboxMonitorEvent(tenantId, eventId),
    );
    if (!event) {
      return NextResponse.json({ success: false, error: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    logger.error('GET /api/v1/finance/outbox/[eventId] failed', error instanceof Error ? error : undefined, {
      tenantId,
      eventId,
    });
    return NextResponse.json({ success: false, error: 'Failed to fetch outbox event' }, { status: 500 });
  }
}
