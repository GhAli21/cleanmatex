import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { processEarnPoints } from '@/lib/services/loyalty.service';
import type { OutboxEventRow } from '@/lib/services/outbox.service';

interface LoyaltyEarnPayload {
  customerId?: string;
  orderAmount?: number;
}

/**
 * B7 (H7) — consumes a `LOYALTY_EARN` outbox event and actually credits the
 * loyalty ledger. `queueEarnPoints` (loyalty.service.ts) has emitted this
 * event on every qualifying order since it was written, but nothing ever
 * consumed it — points were silently never earned.
 *
 * The event payload only carries `{customerId, orderAmount}` (the emit site
 * runs inside the settlement transaction and deliberately does not resolve
 * the earn-rate there, to keep that transaction from depending on loyalty
 * config). This handler resolves the tenant's active earn rate and converts
 * `orderAmount` into `earnPoints` here, at consume time.
 *
 * A tenant with no active loyalty program is not an error — it means the
 * tenant does not use the loyalty feature, so the event is treated as
 * successfully processed with zero effect (mirrors the B15 "no config = the
 * tenant doesn't use this" policy, never a silent guess).
 * @param event claimed outbox row with event_type === 'LOYALTY_EARN'
 */
export async function processLoyaltyEarnEvent(event: OutboxEventRow): Promise<void> {
  const payload = (event.payload ?? {}) as LoyaltyEarnPayload;

  if (!payload.customerId || typeof payload.orderAmount !== 'number') {
    throw new Error(`LOYALTY_EARN event ${event.id} payload missing customerId/orderAmount`);
  }

  await withTenantContext(event.tenant_org_id, () =>
    prisma.$transaction(async (tx) => {
      const program = await tx.org_loyalty_programs_cf.findFirst({
        where: { tenant_org_id: event.tenant_org_id, is_active: true, rec_status: 1 },
      });

      if (!program) {
        logger.info('LOYALTY_EARN skipped — no active loyalty program for tenant', {
          tenantId: event.tenant_org_id,
          eventId: event.id,
        });
        return;
      }

      const earnPoints = Math.floor(payload.orderAmount! * Number(program.earn_rate_per_unit));
      if (earnPoints <= 0) {
        return;
      }

      await processEarnPoints(tx, {
        tenantId: event.tenant_org_id,
        customerId: payload.customerId!,
        orderId: event.aggregate_id,
        earnPoints,
        monetaryValue: payload.orderAmount!,
        // Deterministic per-event key — a redelivery of the same outbox event
        // must never double-credit (D010). event.id is unique per row.
        idempotencyKey: `loyalty-earn-${event.id}`,
      });
    })
  );
}
