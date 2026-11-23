import 'server-only';

import type { Prisma } from '@prisma/client';
import { reconcileOrderLoyaltyEarnTx } from '@/lib/services/loyalty.service';
import type { DomainEventRow } from '@/lib/types/domain-event';

interface LoyaltyEarnPayload {
  trigger?: string;
  sourceId?: string;
}

/**
 * The `loyalty_earn` reaction to `LOYALTY_EARN_RECALC_REQUESTED` (emitted by `reconcileOrderLoyaltyEarn`):
 * brings the order's earned points to its target (D27). The event carries no amounts: the order
 * and the ledger are read at consume time, inside the reaction transaction with the order row locked.
 *
 * The ledger row's idempotency key is `loyalty-<trigger>-<sourceId>`, so a redelivery never
 * posts twice. Events without a trigger fall back to a per-event key.
 * @param tx the reaction transaction
 * @param event event row with event_type === 'LOYALTY_EARN_RECALC_REQUESTED'; aggregate_id = order id
 */
export async function processLoyaltyEarnEvent(tx: Prisma.TransactionClient, event: DomainEventRow): Promise<void> {
  const payload = (event.payload ?? {}) as LoyaltyEarnPayload;
  const idempotencyKey = payload.trigger && payload.sourceId
    ? `loyalty-${payload.trigger}-${payload.sourceId}`
    : `loyalty-earn-${event.id}`;

  await reconcileOrderLoyaltyEarnTx(tx, {
    tenantId: event.tenant_org_id,
    orderId: event.aggregate_id,
    idempotencyKey,
  });
}
