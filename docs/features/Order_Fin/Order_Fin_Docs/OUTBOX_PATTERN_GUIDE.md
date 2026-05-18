# Outbox Pattern Guide — Event Types, Retry Schedule, Worker

## Why Outbox?

The transactional outbox pattern ensures domain events are published **if and only if** the business transaction commits. Direct event publishing inside a transaction can lose events if the downstream service is unavailable. With the outbox:

1. Event row is inserted atomically with the business change (same transaction)
2. A separate worker reads PENDING rows and publishes them
3. If the worker fails, the row remains PENDING and is retried on schedule

## Event Types

All event types are defined in `OUTBOX_EVENT_TYPES` constant:

| Event Type | Aggregate | Emitted By |
|---|---|---|
| `ORDER_COMPLETED` | order | order-settlement.service |
| `PAYMENT_RECEIVED` | order | collectPaymentTx |
| `REFUND_PROCESSED` | order | order-refund.service |
| `RECONCILIATION_FAILED` | reconciliation | reconciliation.service |
| `LOYALTY_EARN_QUEUED` | customer | loyalty.service |

## Emitting an Event

Always call `emitEventTx` inside an existing `prisma.$transaction`:

```typescript
import { emitEventTx } from '@/lib/services/outbox.service';

// Inside prisma.$transaction callback:
await emitEventTx(tx, tenantId, 'ORDER_COMPLETED', 'order', orderId, {
  paymentStatus, grandTotal, settled,
});
```

The function creates a row with `status='PENDING'`, `attempts=0`, `max_attempts=6`, and `next_retry_at=NOW()`.

## Retry Schedule

Exponential back-off in minutes: **1 → 5 → 15 → 60 → 240 → FAILED**

After 6 attempts (max_attempts), the row is marked `FAILED` and no longer retried. Failed events require manual intervention.

## Worker Architecture

The Supabase Edge Function (`supabase/functions/outbox-worker/index.ts`) runs on a schedule set by pg_cron (migration 0296).

**Claim batch (atomic CTE):**
```typescript
const events = await claimBatch(50);
// Sets status → PROCESSING for the claimed rows
```

**Processing loop:**
1. For each event: publish to downstream (webhook, queue, or direct service call)
2. On success: `UPDATE org_domain_events_outbox SET status='COMPLETED'`
3. On failure: `UPDATE ... SET attempts=attempts+1, status='PENDING', next_retry_at=<next>`
4. After max_attempts: `SET status='FAILED'`

**Idempotency Key:**
Pass `idempotency_key` when the same logical event might be emitted multiple times (e.g. retries from the business layer). The worker deduplicates by key.

## Monitoring

- Stuck events: reconciliation check `OUTBOX_STUCK` flags PENDING/FAILED events > 1 hour old
- FAILED events visible in admin interface (future: add alert)
- Worker logs via Supabase Edge Function logs

## Local Development

The worker does not run automatically in local dev. To process events locally:
```bash
supabase functions serve outbox-worker
# POST to http://localhost:54321/functions/v1/outbox-worker
```
