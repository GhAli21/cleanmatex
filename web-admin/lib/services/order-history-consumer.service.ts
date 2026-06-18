import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { OUTBOX_EVENT_TYPES, type OutboxEventType } from '@/lib/constants/order-financial';
import { Prisma } from '@prisma/client';

/**
 * BVM Wiring Phase 5 — Order History consumer
 *
 * Subscribes to the BVM outbox events that should land as audit
 * trail rows on `org_order_history`:
 *
 * | Outbox event              | Aggregate     | History action_type        |
 * |---------------------------|---------------|----------------------------|
 * | ORDER_COMPLETED           | order         | ORDER_COMPLETED            |
 * | VOUCHER_POSTED_AND_WIRED  | fin_voucher   | VOUCHER_POSTED_AND_WIRED   |
 * | AR_INVOICE_ISSUED         | ar_invoice    | AR_INVOICE_ISSUED          |
 * | PAYMENT_VERIFIED          | order_payment | PAYMENT_VERIFIED           |
 *
 * Design invariants (PRD §22 + Phase 5 resume doc):
 *
 *  1. **Asynchronous.** History rows are written by the outbox worker
 *     AFTER the order/voucher/invoice transaction commits. The submit-order
 *     transaction is never enlarged for audit writes.
 *  2. **Idempotent.** Every write upserts on the partial unique index
 *     `(tenant_org_id, outbox_event_id)` introduced by migration 0330.
 *     Re-claiming a FAILED outbox row never produces duplicate history.
 *  3. **Tenant-safe.** Every Prisma call runs inside `withTenantContext`
 *     so RLS enforces tenant isolation. Each `where` clause additionally
 *     filters by `tenant_org_id` explicitly.
 *  4. **Aggregate-aware.** Voucher and AR-invoice events do not carry
 *     the order id directly; the consumer resolves it via
 *     `org_fin_vouchers_mst.order_id` / `org_invoice_mst.order_id`.
 *     Events whose order linkage cannot be resolved (manual voucher with
 *     no linked order; multi-order AR invoice) are skipped silently —
 *     they belong to the voucher / invoice audit surfaces, not the order
 *     timeline.
 *  5. **DB-mirror.** The three action_type strings exactly match the
 *     OUTBOX_EVENT_TYPES constant values and the `chk_history_action_type`
 *     CHECK enum (mig 0330).
 *
 * @see lib/services/outbox.service.ts — emitEventTx / claimBatch contracts
 * @see supabase/migrations/0330_phase5_order_history_bvm_action_types.sql
 */

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Minimal projection of an outbox row that the consumer needs to write
 * a history entry. Matches the shape returned by `outbox.claimBatch`.
 */
export interface OutboxEventForHistory {
  id: string;
  tenant_org_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Prisma.JsonValue;
  created_at: Date;
}

/**
 * Aggregate per-event outcome for the worker loop.
 *
 * `WRITTEN` covers both first-time inserts and idempotent re-runs because
 * Prisma `upsert` does not distinguish the two — the unique constraint
 * makes the retry path a no-op at the DB level.
 */
export type ConsumeOutcome =
  | { status: 'WRITTEN'; historyId: string }
  | { status: 'SKIPPED_NOT_ORDER_LINKED' }
  | { status: 'SKIPPED_UNSUPPORTED_EVENT' };

/** Sentinel set of event types the consumer reacts to. */
const HISTORY_EVENT_TYPES = new Set<OutboxEventType>([
  OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
  OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
  OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
  OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
]);

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Process a single outbox event into an `org_order_history` row.
 *
 * Always safe to re-call with the same event — the unique constraint
 * on `(tenant_org_id, outbox_event_id)` collapses the second write into
 * a no-op (SKIPPED_DUPLICATE outcome).
 *
 * @param event Outbox row claimed by the worker.
 * @returns Outcome describing what happened. Worker uses this to decide
 *          markProcessed vs. markFailed.
 *
 * @example
 * ```ts
 * const events = await claimBatch(50);
 * for (const event of events) {
 *   try {
 *     await consumeOrderHistoryEvent(event);
 *     await markProcessed(event.id);
 *   } catch (err) {
 *     await markFailed(event.id, String(err));
 *   }
 * }
 * ```
 */
export async function consumeOrderHistoryEvent(
  event: OutboxEventForHistory,
): Promise<ConsumeOutcome> {
  // Fast filter — only react to BVM history events. Other event types
  // (PAYMENT_RECEIVED, REFUND_ISSUED, etc.) are owned by their own
  // consumers and are not order-timeline rows.
  if (!HISTORY_EVENT_TYPES.has(event.event_type as OutboxEventType)) {
    return { status: 'SKIPPED_UNSUPPORTED_EVENT' };
  }

  // Tenant resolved from the event row, not from session — the worker
  // runs out of any user session. RLS is still enforced because
  // withTenantContext seeds the AsyncLocalStorage scope.
  return withTenantContext(event.tenant_org_id, async (tenantOrgId) => {
    const mapped = await mapEventToHistoryRow(tenantOrgId, event);
    if (!mapped) {
      return { status: 'SKIPPED_NOT_ORDER_LINKED' };
    }

    // Idempotent upsert keyed on the partial unique index.
    // `update: {}` makes the upsert truly idempotent — no field gets
    // overwritten on the retry path, so a row that was hand-edited
    // (e.g. payload backfill) cannot be clobbered.
    const row = await prisma.org_order_history.upsert({
      where: {
        // Composite unique key from mig 0330: uq_history_outbox_event
        tenant_org_id_outbox_event_id: {
          tenant_org_id: tenantOrgId,
          outbox_event_id: event.id,
        },
      },
      update: {},
      create: mapped,
      select: { id: true },
    });

    return { status: 'WRITTEN', historyId: row.id };
  });
}

/**
 * Convenience wrapper that processes a batch produced by `claimBatch`.
 * Returns a per-event outcome list so the worker can mark each event
 * processed or failed individually. Non-history events in the batch are
 * returned as SKIPPED_UNSUPPORTED_EVENT and SHOULD still be marked
 * processed by the worker (they were claimed by their own consumer
 * earlier in the chain — this consumer is a no-op for them).
 *
 * @param events Batch of claimed outbox rows.
 * @returns Outcome list aligned 1:1 with `events`.
 *
 * @example
 * ```ts
 * const events = await claimBatch(50);
 * const outcomes = await consumeOrderHistoryBatch(events);
 * await Promise.all(outcomes.map((o, i) =>
 *   o.status === 'WRITTEN' || o.status === 'SKIPPED_DUPLICATE'
 *     ? markProcessed(events[i].id)
 *     : Promise.resolve(),
 * ));
 * ```
 */
export async function consumeOrderHistoryBatch(
  events: OutboxEventForHistory[],
): Promise<ConsumeOutcome[]> {
  const results: ConsumeOutcome[] = [];
  for (const event of events) {
    results.push(await consumeOrderHistoryEvent(event));
  }
  return results;
}

// ─── Internal mapping ──────────────────────────────────────────────────────

/**
 * Translate an outbox event into the literal `org_order_history.create`
 * payload. Returns `null` when the event does not (or cannot) map to an
 * order — voucher events with no linked order, AR-invoice events for
 * multi-order invoices, etc.
 *
 * Tenant resolved from the AsyncLocalStorage context for the helper
 * lookups; RLS scopes them automatically.
 * @param tenantOrgId
 * @param event
 */
async function mapEventToHistoryRow(
  tenantOrgId: string,
  event: OutboxEventForHistory,
): Promise<Prisma.org_order_historyUncheckedCreateInput | null> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  switch (event.event_type as OutboxEventType) {
    case OUTBOX_EVENT_TYPES.ORDER_COMPLETED: {
      // The aggregate IS the order — no resolution needed.
      return {
        tenant_org_id: tenantOrgId,
        order_id: event.aggregate_id,
        action_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
        from_value: null,
        to_value: extractToValue(payload, 'paymentStatus') ?? 'COMPLETED',
        payload: serialisePayload(event, payload),
        done_by: extractActor(payload),
        done_at: event.created_at,
        outbox_event_id: event.id,
      };
    }

    case OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED: {
      // Voucher events emit aggregate_id = voucher id. Resolve to its
      // linked order — manual financial vouchers with NULL order_id are
      // outside the order-timeline scope and skipped.
      const voucher = await prisma.org_fin_vouchers_mst.findFirst({
        where: { id: event.aggregate_id, tenant_org_id: tenantOrgId },
        select: { id: true, order_id: true, voucher_no: true },
      });
      if (!voucher?.order_id) return null;

      return {
        tenant_org_id: tenantOrgId,
        order_id: voucher.order_id,
        action_type: OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
        from_value: null,
        to_value: voucher.voucher_no ?? extractToValue(payload, 'voucher_no'),
        payload: serialisePayload(event, payload),
        done_by: extractActor(payload, 'posted_by'),
        done_at: event.created_at,
        outbox_event_id: event.id,
      };
    }

    case OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED: {
      // AR invoice events emit aggregate_id = invoice id. Resolve to the
      // linked order via `org_invoice_mst.order_id` — multi-order
      // invoices have NULL order_id and surface only on the AR audit.
      const invoice = await prisma.org_invoice_mst.findFirst({
        where: { id: event.aggregate_id, tenant_org_id: tenantOrgId },
        select: { id: true, order_id: true, invoice_no: true },
      });
      if (!invoice?.order_id) return null;

      return {
        tenant_org_id: tenantOrgId,
        order_id: invoice.order_id,
        action_type: OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
        from_value: null,
        to_value: invoice.invoice_no ?? extractToValue(payload, 'invoice_no'),
        payload: serialisePayload(event, payload),
        done_by: extractActor(payload, 'issued_by'),
        done_at: event.created_at,
        outbox_event_id: event.id,
      };
    }

    case OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED: {
      // Payment-verify events emit aggregate_id = payment row id. Resolve
      // back to the order via `org_order_payments_dtl.order_id`. The
      // payment row is the source of truth — payload duplicates the
      // order id for diagnostics but the consumer trusts the DB lookup.
      // Returning null guards against hard-deleted payment rows so the
      // worker can mark the event processed without blocking the queue.
      const paymentId = event.aggregate_id;
      const payment = await prisma.org_order_payments_dtl.findFirst({
        where: { id: paymentId, tenant_org_id: tenantOrgId },
        select: { id: true, order_id: true, payment_method_code: true },
      });
      if (!payment?.order_id) return null;

      return {
        tenant_org_id: tenantOrgId,
        order_id: payment.order_id,
        action_type: OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
        // Status transition snapshot: the verify endpoint can only flip
        // PENDING → COMPLETED, so these literals are stable across rows.
        from_value: extractToValue(payload, 'previousStatus') ?? 'PENDING',
        to_value: extractToValue(payload, 'newStatus') ?? 'COMPLETED',
        payload: serialisePayload(event, {
          ...payload,
          payment_method_code: payment.payment_method_code,
        }),
        done_by: extractActor(payload, 'verified_by'),
        done_at: event.created_at,
        outbox_event_id: event.id,
      };
    }

    default:
      return null;
  }
}

/**
 * Pull a string `to_value` from the event payload. Returns null when
 * the requested key is missing or non-string — the history row column
 * is nullable so it's fine to leave blank.
 * @param payload
 * @param key
 */
function extractToValue(payload: Record<string, unknown>, key: string): string | null {
  const raw = payload[key];
  return typeof raw === 'string' ? raw : null;
}

/**
 * Resolve the actor (`done_by`) for the history row. Looks at common
 * payload keys (`posted_by`, `issued_by`, generic `actor_id`). Returns
 * null when the event has no actor — the trigger-emitted ORDER_CREATED
 * uses auth.uid() but worker-processed events run outside any session.
 * @param payload
 * @param primaryKey
 */
function extractActor(payload: Record<string, unknown>, primaryKey?: string): string | null {
  const candidates = [primaryKey, 'posted_by', 'issued_by', 'actor_id', 'user_id'].filter(
    (k): k is string => typeof k === 'string',
  );
  for (const k of candidates) {
    const v = payload[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * Wrap the raw outbox payload alongside identifying metadata so the
 * timeline UI can render a richer expandable detail block without
 * extra DB calls.
 * @param event
 * @param payload
 */
function serialisePayload(
  event: OutboxEventForHistory,
  payload: Record<string, unknown>,
): Prisma.InputJsonValue {
  return {
    ...payload,
    source: 'outbox',
    event_type: event.event_type,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
  };
}
