import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  NOT_RELEASED_PICKUP_SUMMARY,
  PICKUP_RELEASE_STATES,
  type PickupReleaseSummary,
} from '@/lib/types/pickup-release';

interface PickupReleaseRow {
  order_id: string;
  id: string;
  release_status: string;
  released_at: Date | string | null;
  fulfilled_at: Date | string | null;
}

function serializeTimestamp(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toPickupReleaseSummary(row: PickupReleaseRow): PickupReleaseSummary {
  const releaseStatus = row.release_status.trim().toLowerCase();
  return {
    state:
      releaseStatus === 'released'
        ? PICKUP_RELEASE_STATES.AVAILABLE_FOR_PICKUP
        : PICKUP_RELEASE_STATES.FULFILLED,
    releaseId: row.id,
    releasedAt: serializeTimestamp(row.released_at),
    fulfilledAt: serializeTimestamp(row.fulfilled_at),
  };
}

/**
 * Reads the most relevant pickup release for each tenant-owned order.
 *
 * An open release takes precedence over an older fulfilment record because it
 * represents the current physical handover state. The workflow status now
 * records `ready_for_pickup`; this read model retains release timestamps and
 * handles legacy release rows during the migration rollout.
 */
export async function getPickupReleaseSummaries(input: {
  tenantId: string;
  orderIds: string[];
}): Promise<Map<string, PickupReleaseSummary>> {
  const orderIds = [...new Set(input.orderIds.filter(Boolean))];
  const summaries = new Map<string, PickupReleaseSummary>();
  for (const orderId of orderIds) {
    summaries.set(orderId, { ...NOT_RELEASED_PICKUP_SUMMARY });
  }

  if (orderIds.length === 0) return summaries;

  const rows = await prisma.$queryRaw<PickupReleaseRow[]>(Prisma.sql`
    SELECT DISTINCT ON (r.order_id)
      r.order_id,
      r.id,
      r.release_status,
      r.released_at,
      r.fulfilled_at
    FROM public.org_wf_release_mst r
    WHERE r.tenant_org_id = ${input.tenantId}::uuid
      AND r.order_id IN (${Prisma.join(orderIds.map((orderId) => Prisma.sql`${orderId}::uuid`))})
      AND r.release_type = 'pickup'
      AND COALESCE(r.rec_status, 1) = 1
    ORDER BY
      r.order_id,
      CASE r.release_status
        WHEN 'released' THEN 0
        WHEN 'fulfilled' THEN 1
        ELSE 2
      END,
      r.released_at DESC NULLS LAST,
      r.id DESC
  `);

  for (const row of rows) {
    summaries.set(row.order_id, toPickupReleaseSummary(row));
  }

  return summaries;
}

/** Returns one tenant-scoped pickup release summary for detail and public reads. */
export async function getPickupReleaseSummary(input: {
  tenantId: string;
  orderId: string;
}): Promise<PickupReleaseSummary> {
  const summaries = await getPickupReleaseSummaries({
    tenantId: input.tenantId,
    orderIds: [input.orderId],
  });
  return summaries.get(input.orderId) ?? { ...NOT_RELEASED_PICKUP_SUMMARY };
}
