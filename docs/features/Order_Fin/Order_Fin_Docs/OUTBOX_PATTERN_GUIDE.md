# Outbox Pattern Guide — Event Types, Retry Schedule, Worker

> **Current processor (B07, 2026-09-17):** events are consumed by `processOutboxBatch()` via pg_cron `fin-outbox-processor` → `POST /api/finance/process-outbox` (bearer `FINANCE_OUTBOX_SECRET`). Terminal poison status is `DEAD_LETTERED`, not `FAILED`. Ops + Scheduled Jobs: `/dashboard/internal_fin/outbox` — [FINANCE_JOBS_HUB.md](FINANCE_JOBS_HUB.md). The 0296 edge function `outbox-worker` is retired (unscheduled in 0410).

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

Exponential back-off in minutes: **1 → 5 → 15 → 60 → 240 → DEAD_LETTERED**

After 6 attempts (`max_attempts`), the row is marked `DEAD_LETTERED` and no longer retried automatically. Operators re-queue from Outbox Monitor (`finance_outbox:retry`).

## Worker Architecture

**Current (B07):** pg_cron `fin-outbox-processor` (every minute) → `POST /api/finance/process-outbox` (bearer `FINANCE_OUTBOX_SECRET`) → `runFinanceJob('outbox_processor')` → `processOutboxBatch()`. Jobs hub: [FINANCE_JOBS_HUB.md](FINANCE_JOBS_HUB.md).

The 0296 Edge Function `supabase/functions/outbox-worker/index.ts` is **retired** (cron unscheduled in 0410).

**Claim batch (atomic):**
```typescript
const events = await claimBatch(50)
// claim_outbox_batch RPC — FOR UPDATE SKIP LOCKED
```

**Processing loop:**
1. For each event: dispatch to registered handlers (`order-history`, `loyalty-earn`)
2. On success: status `PROCESSED`
3. On failure: `attempts+1`, status `FAILED`, `next_retry_at` = next backoff
4. After max_attempts: status `DEAD_LETTERED`

**Idempotency:** handlers use deterministic keys (e.g. `loyalty-earn-${event.id}`). Replaying a completed event is a no-op.

## Monitoring

- Outbox Monitor KPIs: pending / processing / failed / dead-lettered / processed-24h
- Processor last-run, cron health, and history on the Scheduled Jobs card
- Reconciliation check `OUTBOX_STUCK` (B20) flags old PENDING/FAILED events when that check is wired

## Local Development

The processor does not run unless pg_cron can reach the app with `FINANCE_OUTBOX_SECRET` set. For a one-off drain:

```http
POST /api/finance/process-outbox
Authorization: Bearer <FINANCE_OUTBOX_SECRET>
```

Or **Run Now** on Outbox Processor (`finance_jobs:run`).
