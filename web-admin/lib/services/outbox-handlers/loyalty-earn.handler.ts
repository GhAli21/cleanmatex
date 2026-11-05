import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { reconcileOrderLoyaltyEarnTx } from '@/lib/services/loyalty.service';
import type { OutboxEventRow } from '@/lib/services/outbox.service';

interface LoyaltyEarnPayload {
  trigger?: string;
  sourceId?: string;
}

/**
 * Consumes a `LOYALTY_EARN` outbox event (emitted by `reconcileOrderLoyaltyEarn`) and brings
 * the order's earned points to its target (D27). The event carries no amounts: the order
 * and the ledger are read at consume time, inside one transaction with the order row locked.
 *
 * The ledger row's idempotency key is `loyalty-<trigger>-<sourceId>`, so a redelivery never
 * posts twice. Events without a trigger fall back to a per-event key.
 * @param event claimed outbox row with event_type === 'LOYALTY_EARN'; aggregate_id = order id
 */
export async function processLoyaltyEarnEvent(event: OutboxEventRow): Promise<void> {
  const payload = (event.payload ?? {}) as LoyaltyEarnPayload;
  const idempotencyKey = payload.trigger && payload.sourceId
    ? `loyalty-${payload.trigger}-${payload.sourceId}`
    : `loyalty-earn-${event.id}`;

  await withTenantContext(event.tenant_org_id, () =>
    prisma.$transaction((tx) =>
      reconcileOrderLoyaltyEarnTx(tx, {
        tenantId: event.tenant_org_id,
        orderId: event.aggregate_id,
        idempotencyKey,
      })
    )
  );
}
