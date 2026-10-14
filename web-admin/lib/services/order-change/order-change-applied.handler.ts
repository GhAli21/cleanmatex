/**
 * Confirms an applied Change row after the commercial transaction commits.
 * A missing row retries. This handler does not collect, refund, or post finance.
 */

import { prisma } from '@/lib/db/prisma';

export interface OrderChangeAppliedEvent {
  tenant_org_id: string;
  aggregate_id: string;
  payload: unknown;
}

async function findAppliedChange(tenantId: string, changeId: string): Promise<{ id: string } | null> {
  return prisma.org_order_changes_mst.findFirst({
    where: { id: changeId, tenant_org_id: tenantId },
    select: { id: true },
  });
}

export async function confirmOrderChangeApplied(
  event: OrderChangeAppliedEvent,
  findChange: (tenantId: string, changeId: string) => Promise<{ id: string } | null> = findAppliedChange,
): Promise<void> {
  const payload = event.payload as { orderId?: unknown } | null;
  if (!payload || typeof payload.orderId !== 'string' || payload.orderId.length === 0) {
    throw new Error('ORDER_CHANGE_APPLIED_PAYLOAD_INVALID');
  }
  const row = await findChange(event.tenant_org_id, event.aggregate_id);
  if (!row) throw new Error('ORDER_CHANGE_APPLIED_ROW_MISSING');
}
