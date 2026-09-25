# Financial Outbox Production Architecture Review

**Status:** Read-only architecture review and remediation proposal  
**Date:** 2026-09-25  
**Scope:** `org_domain_events_outbox`, financial processor, scheduler, consumers, operational monitor, and recovery controls  
**Implementation status:** No implementation or migration is authorized by this document.

## Executive decision

Do **not** replace the financial outbox or financial domain from zero.

The existing transactional-outbox foundation is correct: a business transaction writes an event in the same database transaction, and `claim_outbox_batch` uses `FOR UPDATE SKIP LOCKED` to avoid double claims. The production path needs a controlled evolution that introduces secure invocation, explicit event contracts, delivery leases, consumer-level outcomes, durable recovery audit, and reconciliation-led rollout.

The monitor screenshot shows an oldest pending event of **179,420 minutes** (about 124 days and 14 hours) while another event was processed at the current time. That means a worker heartbeat exists; it does not prove that every old event remains eligible or drainable.

## Review boundary and evidence

Repository evidence reviewed:

- `supabase/migrations/0292_outbox_idempotency.sql`
- `supabase/migrations/0296_pg_cron_jobs.sql`
- `supabase/migrations/0410_b07_financial_outbox_processor.sql`
- `supabase/migrations/0429_b19_expiry_and_idempotency_jobs.sql`
- `supabase/migrations/0505_fin_jobs_outbox_and_cn_expiry.sql`
- `supabase/migrations/0511_b19_loyalty_points_fifo_expiry.sql`
- `web-admin/lib/services/outbox.service.ts`
- `web-admin/lib/services/outbox-processor.service.ts`
- `web-admin/lib/services/outbox-monitor.service.ts`
- `web-admin/lib/services/order-history-consumer.service.ts`
- `web-admin/lib/services/outbox-handlers/loyalty-earn.handler.ts`
- `web-admin/lib/services/finance-jobs.service.ts`
- `web-admin/app/api/finance/process-outbox/route.ts`
- `web-admin/app/api/v1/finance/outbox/**`
- `web-admin/app/api/v1/finance/jobs/**`

Remote production reads were attempted but could not be completed because the configured Supabase MCP token was unauthorized. Therefore, all production row-level statements below are explicitly marked as repository inference unless verified by a future read-only preflight.

## Current architecture

```mermaid
flowchart LR
  C[Financial command transaction] --> E[emitEventTx]
  E --> O[(org_domain_events_outbox)]
  S[pg_cron every minute] --> T[fin_trigger_outbox_proc]
  T --> R[POST /api/finance/process-outbox]
  R --> J[runFinanceJob outbox_processor]
  J --> Q[claim_outbox_batch]
  Q --> H[Handler registry]
  H --> OH[Order-history consumer]
  H --> LE[Loyalty earn consumer]
  H --> M[Mark processed or failed]
  M --> U[Outbox Monitor and jobs hub]
```

### Current strengths

- Events are emitted inside existing financial transactions.
- The claim function uses a database lock, not an application-level read-then-write sequence.
- Retry backoff exists: 1, 5, 15, 60, and 240 minutes, then dead-lettering.
- Order-history and loyalty earn handlers have idempotency mechanisms for their current effects.
- The monitor is tenant-scoped for normal operations and exposes event details and retries.
- The finance-jobs run log prevents overlapping scheduled jobs.

## Current event emission inventory

### Scope and interpretation

This is the repository inventory of every active `emitEventTx(...)` call found under `web-admin/lib/services`. It is the current application write path to `public.org_domain_events_outbox`; it is not a live-production row count. The table expands conditional event selection and duplicate producer paths into 31 write-path rows, representing 25 unique persisted `(event_type, aggregate_type)` combinations.

All calls enter the table through [`emitEventTx`](../../../../../web-admin/lib/services/outbox.service.ts), which writes `tenant_org_id`, `event_type`, `aggregate_type`, `aggregate_id`, JSON payload, `PENDING`, `attempts = 0`, `max_attempts = 6`, and `next_retry_at = now` inside the caller's existing Prisma transaction.

**Current consumer labels:**

- **Order history — registered:** current processor invokes `consumeOrderHistoryEvent` for this type.
- **Loyalty — registered:** current processor invokes `processLoyaltyEarnEvent`.
- **No worker handler:** current processor marks the event `PROCESSED` as skipped; this does not imply that no future consumer is intended.
- **History supported, not registered:** the history consumer can map the event, but the current processor does not dispatch it. This is a confirmed contract gap.

### Exact event-type call-site index

The `emitEventTx` line is the exact call that creates the outbox row. Where an event type is selected conditionally, both the selector line and the common `emitEventTx` line are shown.

| Event type | Persisted aggregate type(s) | Exact call site(s) that create the row |
|---|---|---|
| `ORDER_COMPLETED` | `order` | [`settleOrderTx` — `order-settlement.service.ts:368`](../../../../../web-admin/lib/services/order-settlement.service.ts) |
| `LOYALTY_EARN` | `order` | [`queueEarnPoints` — `loyalty.service.ts:377`](../../../../../web-admin/lib/services/loyalty.service.ts); called by settlement at [`order-settlement.service.ts:376`](../../../../../web-admin/lib/services/order-settlement.service.ts) |
| `PAYMENT_VERIFIED` | `order_payment` | [`verifyPaymentTx` — `order-settlement.service.ts:568`](../../../../../web-admin/lib/services/order-settlement.service.ts); transition mapping [`payment-transition.service.ts:415`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_CANCELLED` | `order_payment` | Transition mapping [`payment-transition.service.ts:417`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_FAILED` | `order_payment` | Transition mapping [`payment-transition.service.ts:419`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_VOIDED` | `order_payment` | Transition mapping [`payment-transition.service.ts:421`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_REVERSED` | `order_payment` | Transition mapping [`payment-transition.service.ts:423`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_CAPTURED` | `order_payment` | Transition mapping [`payment-transition.service.ts:425`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_SETTLED` | `order_payment` | Transition mapping [`payment-transition.service.ts:426`](../../../../../web-admin/lib/services/payment-transition.service.ts) → common emit [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) |
| `PAYMENT_RECEIVED` | `order` | [`collectPaymentTx` — `order-settlement.service.ts:1042`](../../../../../web-admin/lib/services/order-settlement.service.ts) |
| `REFUND_PROCESSED` | `order_refund`, `order` | [`initiateRefund` — `order-refund.service.ts:628`](../../../../../web-admin/lib/services/order-refund.service.ts); [`approveRefund` — `:692`](../../../../../web-admin/lib/services/order-refund.service.ts); [`processRefund` — `:1113`](../../../../../web-admin/lib/services/order-refund.service.ts) |
| `STORED_VALUE_CHANGED` | `order` | [`applyOrderCreditApplication` — `order-credit-application.service.ts:351`](../../../../../web-admin/lib/services/order-credit-application.service.ts) |
| `ORDER_FINANCIAL_ADJUSTMENT_CREATED` | `order` | [`createOrderAdjustment` — `order-adjustment.service.ts:120`](../../../../../web-admin/lib/services/order-adjustment.service.ts) |
| `ORDER_CANCEL_FINANCIAL_UNWIND` | `ORDER` | [`unwindOrderFinancialsOnCancel` — `order-cancel-financials.service.ts:189`](../../../../../web-admin/lib/services/order-cancel-financials.service.ts) |
| `STORED_VALUE_FUNDING_COMPLETED` | `stored_value_funding` | [`finalizeStoredValueFundingIfReady` — `stored-value-funding.service.ts:607`](../../../../../web-admin/lib/services/stored-value-funding.service.ts) |
| `VOUCHER_POSTED_AND_WIRED` | `fin_voucher` | [`postAndWireBizVoucherInTx` — `voucher-wiring.service.ts:257`](../../../../../web-admin/lib/services/voucher-wiring.service.ts) |
| `AR_PAYMENT_ALLOCATED` | `ar_invoice` | [`allocateArPaymentTx` — `ar-invoice.service.ts:694`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`allocateArPayment` — `:2366`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_OVERPAYMENT_CREDIT_CREATED` | `ar_invoice` | [`allocateArPaymentTx` — `ar-invoice.service.ts:703`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`allocateArPayment` — `:2375`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_PAYMENT_ALLOCATION_REVERSED` | `ar_invoice` | [`reverseArPaymentAllocationTx` — `ar-invoice.service.ts:866`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`reverseArPaymentAllocation` — `:2538`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_INVOICE_ISSUED` | `ar_invoice` | [`createArInvoiceFromOrdersInTx` — `ar-invoice.service.ts:1769`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`issueArInvoice` — `:1965`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_WRITE_OFF_POSTED` | `ar_invoice` | Conditional selector in [`approveSensitiveArInvoice` — `ar-invoice.service.ts:2138`](../../../../../web-admin/lib/services/ar-invoice.service.ts) → emit [`:2143`](../../../../../web-admin/lib/services/ar-invoice.service.ts); conditional selector in [`createArAdjustment` — `:2678`](../../../../../web-admin/lib/services/ar-invoice.service.ts) → emit [`:2683`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_CREDIT_MEMO_POSTED` | `ar_invoice` | Conditional selector in [`approveSensitiveArInvoice` — `ar-invoice.service.ts:2139`](../../../../../web-admin/lib/services/ar-invoice.service.ts) → emit [`:2143`](../../../../../web-admin/lib/services/ar-invoice.service.ts); conditional selector in [`createArAdjustment` — `:2679`](../../../../../web-admin/lib/services/ar-invoice.service.ts) → emit [`:2683`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_DEBIT_NOTE_POSTED` | `ar_invoice` | Conditional selector in [`approveSensitiveArInvoice` — `ar-invoice.service.ts:2140`](../../../../../web-admin/lib/services/ar-invoice.service.ts) → emit [`:2143`](../../../../../web-admin/lib/services/ar-invoice.service.ts); conditional selector in [`createArAdjustment` — `:2680`](../../../../../web-admin/lib/services/ar-invoice.service.ts) → emit [`:2683`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `AR_INVOICE_VOIDED` | `ar_invoice` | [`voidArInvoice` — `ar-invoice.service.ts:2229`](../../../../../web-admin/lib/services/ar-invoice.service.ts) |
| `GIFT_CARD_REDEEMED` | N/A | Declared constant only: no active `emitEventTx` call was found in `web-admin/lib/services`. |

### Active application producers

| Event type persisted | Aggregate type persisted | Business trigger and producer function | Exact application write location | Aggregate ID | Payload fields written at emit site | Current processor outcome |
|---|---|---|---|---|---|---|
| `ORDER_COMPLETED` | `order` | Full settlement after financial snapshot recalculation — `settleOrderTx` | [`order-settlement.service.ts:368`](../../../../../web-admin/lib/services/order-settlement.service.ts) | `orderId` | `paymentStatus`, `grandTotal`, `settled` | Order history — registered |
| `LOYALTY_EARN` | `order` | Qualifying settled order invokes `queueEarnPoints`; emitted by `queueEarnPoints` | [`order-settlement.service.ts:376`](../../../../../web-admin/lib/services/order-settlement.service.ts) calls [`loyalty.service.ts:377`](../../../../../web-admin/lib/services/loyalty.service.ts) | `params.orderId` | `customerId`, `orderAmount` | Loyalty — registered |
| `PAYMENT_VERIFIED` | `order_payment` | Legacy verify payment flow — `verifyPaymentTx` | [`order-settlement.service.ts:568`](../../../../../web-admin/lib/services/order-settlement.service.ts) | `paymentId` | `orderId`, `paymentId`, `verifiedBy`, actor aliases, `previousStatus`, `newStatus`, `verifiedAt` | Order history — registered |
| `PAYMENT_VERIFIED` | `order_payment` | Payment transition action `VERIFY` — `transitionPaymentTx` | [`payment-transition.service.ts:415`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | `orderId`, `paymentId`, actor aliases, prior/new status, `reason`, fallback classification, timestamp | Order history — registered |
| `PAYMENT_CANCELLED` | `order_payment` | Payment transition action `CANCEL` — `transitionPaymentTx` | [`payment-transition.service.ts:417`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | Common payment-transition payload | History supported, not registered |
| `PAYMENT_FAILED` | `order_payment` | Payment transition action `FAIL_BOUNCE` — `transitionPaymentTx` | [`payment-transition.service.ts:419`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | Common payment-transition payload | History supported, not registered |
| `PAYMENT_VOIDED` | `order_payment` | Payment transition action `VOID` — `transitionPaymentTx` | [`payment-transition.service.ts:421`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | Common payment-transition payload | History supported, not registered |
| `PAYMENT_REVERSED` | `order_payment` | Payment transition action `REVERSE` — `transitionPaymentTx` | [`payment-transition.service.ts:423`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | Common payment-transition payload | History supported, not registered |
| `PAYMENT_CAPTURED` | `order_payment` | Payment transition action `CAPTURE` — `transitionPaymentTx` | [`payment-transition.service.ts:425`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | Common payment-transition payload | History supported, not registered |
| `PAYMENT_SETTLED` | `order_payment` | Payment transition action `SETTLE` — `transitionPaymentTx` | [`payment-transition.service.ts:426`](../../../../../web-admin/lib/services/payment-transition.service.ts), emitted at [`:428`](../../../../../web-admin/lib/services/payment-transition.service.ts) | `paymentId` | Common payment-transition payload | History supported, not registered |
| `PAYMENT_RECEIVED` | `order` | Payment collection after snapshot recalculation — `collectPaymentTx` | [`order-settlement.service.ts:1042`](../../../../../web-admin/lib/services/order-settlement.service.ts) | `orderId` | `collectedBy`, `totalCollected`, `paymentStatus` | No worker handler |
| `REFUND_PROCESSED` | `order_refund` | Refund initiation — `initiateRefund` | [`order-refund.service.ts:628`](../../../../../web-admin/lib/services/order-refund.service.ts) | `refund.id` | `stage=INITIATED`, refund/order IDs, order number, amount, method, reason, context/source/scope | No worker handler |
| `REFUND_PROCESSED` | `order_refund` | Refund approval — `approveRefund` | [`order-refund.service.ts:692`](../../../../../web-admin/lib/services/order-refund.service.ts) | `refundId` | `stage=APPROVED`, refund ID, order ID, approver ID | No worker handler |
| `REFUND_PROCESSED` | `order` | Refund execution — `processRefund` | [`order-refund.service.ts:1113`](../../../../../web-admin/lib/services/order-refund.service.ts) | `order.id` | `stage=PROCESSED`, refund ID, amount, method, customer, source/context, reopened due, source links, payment snapshot | No worker handler |
| `STORED_VALUE_CHANGED` | `order` | Credit application applied to an order — `applyOrderCreditApplication` | [`order-credit-application.service.ts:351`](../../../../../web-admin/lib/services/order-credit-application.service.ts) | `orderId` | `stage=APPLIED`, order ID/no, credit application ID/type, amount, payment status, outstanding amount | No worker handler |
| `ORDER_FINANCIAL_ADJUSTMENT_CREATED` | `order` | Order financial adjustment created — `createOrderAdjustment` | [`order-adjustment.service.ts:120`](../../../../../web-admin/lib/services/order-adjustment.service.ts) | `order.id` | order ID/no, adjustment ID/type, amount, currency, reason, status | No worker handler |
| `ORDER_CANCEL_FINANCIAL_UNWIND` | `ORDER` | Cancellation financial unwind — `unwindOrderFinancialsOnCancel` | [`order-cancel-financials.service.ts:189`](../../../../../web-admin/lib/services/order-cancel-financials.service.ts) | `input.orderId` | disposition, paid amount disposition, reversed credit applications, restored stored value, promotion reversals, credit note, reason, actor, warnings | No worker handler; **aggregate casing differs from all other order rows** |
| `STORED_VALUE_FUNDING_COMPLETED` | `stored_value_funding` | Gift-card, wallet, or advance funding completes — `finalizeStoredValueFundingIfReady` | [`stored-value-funding.service.ts:607`](../../../../../web-admin/lib/services/stored-value-funding.service.ts) | `voucherId` | tenant/branch/voucher, funding/target type and ID, customer, currency, funded amount, tender amounts, completion time | No worker handler |
| `VOUCHER_POSTED_AND_WIRED` | `fin_voucher` | Business voucher posted and its lines wired — `postAndWireBizVoucherInTx` | [`voucher-wiring.service.ts:257`](../../../../../web-admin/lib/services/voucher-wiring.service.ts) | `voucherId` | voucher ID/no/status, total, actor/time, wired/skipped/failed line counts | Order history — registered; no order-history row when voucher has no linked order |
| `AR_PAYMENT_ALLOCATED` | `ar_invoice` | AR payment allocation — `allocateArPaymentTx` | [`ar-invoice.service.ts:694`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, voucher ID, allocated amount, unapplied credit amount | No worker handler |
| `AR_PAYMENT_ALLOCATED` | `ar_invoice` | AR payment allocation API path — `allocateArPayment` | [`ar-invoice.service.ts:2366`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, voucher ID, allocated amount, unapplied credit amount | No worker handler |
| `AR_OVERPAYMENT_CREDIT_CREATED` | `ar_invoice` | Conditional overpayment credit after allocation — `allocateArPaymentTx` | [`ar-invoice.service.ts:703`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, voucher ID, unapplied credit amount | No worker handler |
| `AR_OVERPAYMENT_CREDIT_CREATED` | `ar_invoice` | Conditional overpayment credit in allocation API path — `allocateArPayment` | [`ar-invoice.service.ts:2375`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, voucher ID, unapplied credit amount | No worker handler |
| `AR_PAYMENT_ALLOCATION_REVERSED` | `ar_invoice` | AR allocation reversal — `reverseArPaymentAllocationTx` | [`ar-invoice.service.ts:866`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice/allocation/voucher IDs, reversed allocated and credit amounts | No worker handler |
| `AR_PAYMENT_ALLOCATION_REVERSED` | `ar_invoice` | AR allocation reversal API path — `reverseArPaymentAllocation` | [`ar-invoice.service.ts:2538`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice/allocation/voucher IDs, reversed allocated and credit amounts | No worker handler |
| `AR_INVOICE_ISSUED` | `ar_invoice` | Invoice immediately issued during order flow — `createArInvoiceFromOrdersInTx` | [`ar-invoice.service.ts:1769`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `created.id` | invoice ID/no, issued timestamp, `issued_immediately=true` | Order history — registered; no order-history row when invoice has no linked order |
| `AR_INVOICE_ISSUED` | `ar_invoice` | Existing invoice issued — `issueArInvoice` | [`ar-invoice.service.ts:1965`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, issue timestamp, actor | Order history — registered; no order-history row when invoice has no linked order |
| `AR_WRITE_OFF_POSTED` | `ar_invoice` | AR write-off adjustment created or approved — `createArAdjustment`; `approveSensitiveArInvoice` | [`ar-invoice.service.ts:2683`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`:2143`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, adjustment ID/type/amount; approval payload differs by path | No worker handler |
| `AR_CREDIT_MEMO_POSTED` | `ar_invoice` | AR credit adjustment created or approved — `createArAdjustment`; `approveSensitiveArInvoice` | [`ar-invoice.service.ts:2683`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`:2143`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, adjustment ID/type/amount; approval payload differs by path | No worker handler |
| `AR_DEBIT_NOTE_POSTED` | `ar_invoice` | AR debit adjustment created or approved — `createArAdjustment`; `approveSensitiveArInvoice` | [`ar-invoice.service.ts:2683`](../../../../../web-admin/lib/services/ar-invoice.service.ts); [`:2143`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, adjustment ID/type/amount; approval payload differs by path | No worker handler |
| `AR_INVOICE_VOIDED` | `ar_invoice` | AR invoice voided — `voidArInvoice` | [`ar-invoice.service.ts:2229`](../../../../../web-admin/lib/services/ar-invoice.service.ts) | `invoiceId` | invoice ID/no, void reason | No worker handler |

### Declared constants with no active `emitEventTx` producer found

`GIFT_CARD_REDEEMED` is declared in `OUTBOX_EVENT_TYPES` but no active application call to `emitEventTx(..., OUTBOX_EVENT_TYPES.GIFT_CARD_REDEEMED, ...)` was found in `web-admin/lib/services` during this inventory. This is a code-inventory result only; historic rows or another non-application writer must be verified from the database before assuming that the event never exists in production.

### Current consumer and monitor locations

| Concern | Exact location | Current behavior |
|---|---|---|
| Event insertion | [`outbox.service.ts:29`](../../../../../web-admin/lib/services/outbox.service.ts) | Inserts each outbox row within the existing transaction. |
| Atomic claim | [`outbox.service.ts:82`](../../../../../web-admin/lib/services/outbox.service.ts) and [`0296_pg_cron_jobs.sql:71`](../../../../../supabase/migrations/0296_pg_cron_jobs.sql) | Claims a maximum of 50 due `PENDING`/`FAILED` rows with `FOR UPDATE SKIP LOCKED`; changes them to `PROCESSING`. |
| Current worker registry | [`outbox-processor.service.ts:22`](../../../../../web-admin/lib/services/outbox-processor.service.ts) and [`:41`](../../../../../web-admin/lib/services/outbox-processor.service.ts) | Registers four history event types and `LOYALTY_EARN`. |
| History consumer support | [`order-history-consumer.service.ts:82`](../../../../../web-admin/lib/services/order-history-consumer.service.ts) | Supports ten types: the four registered types plus six payment-transition types currently not dispatched. |
| Loyalty consumer | [`outbox-handlers/loyalty-earn.handler.ts:32`](../../../../../web-admin/lib/services/outbox-handlers/loyalty-earn.handler.ts) | Resolves active program and writes earn effect using `loyalty-earn-{event.id}` idempotency key. |
| Monitor and counts | [`outbox-monitor.service.ts:408`](../../../../../web-admin/lib/services/outbox-monitor.service.ts) | Tenant-scoped counts, age, filters, related-record links, and retry eligibility. |

### Inventory conclusions

1. There are **31 active write-path rows** representing **25 persisted event-type/aggregate-type combinations** in the application inventory, plus `GIFT_CARD_REDEEMED` declared without an active producer call found.
2. Only **five event types** are registered with current worker handlers: four history types and `LOYALTY_EARN`.
3. Six active payment-transition combinations are a confirmed mismatch: the history consumer supports them, but the worker registry skips them as if they had no consumer.
4. `REFUND_PROCESSED` uses both `order_refund` and `order` aggregate types depending on lifecycle stage. Consumers must not assume one aggregate shape from event type alone.
5. `ORDER_CANCEL_FINANCIAL_UNWIND` writes `aggregate_type = 'ORDER'`, unlike all other lower-case `order` events. This can prevent aggregate-type-based monitor linking and should be assessed as a data-contract inconsistency before changing historic rows.

## Findings

### F-01 — SECURITY DEFINER worker functions need explicit execution restriction

**Severity:** Critical  
**Evidence:** `claim_outbox_batch` and `fin_trigger_outbox_proc` are declared `SECURITY DEFINER`. The related migrations do not revoke `EXECUTE` from `PUBLIC` for these functions.

PostgreSQL grants function execution to `PUBLIC` by default. Since `claim_outbox_batch` is cross-tenant and updates event status, it must never be exposed to normal RPC roles. `fin_trigger_outbox_proc` can also trigger privileged scheduler work.

**Required direction:** move privileged worker functions to a non-exposed schema, or explicitly revoke from `PUBLIC`, `anon`, and `authenticated`; grant only the controlled database/worker role. Re-verify every caller after the change.

### F-02 — Payment-history event contract is incomplete

**Severity:** Critical  
**Evidence:** the processor registry routes only `ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`, and `PAYMENT_VERIFIED` to order history. The history consumer itself supports six additional emitted payment transitions: `PAYMENT_CANCELLED`, `PAYMENT_FAILED`, `PAYMENT_VOIDED`, `PAYMENT_REVERSED`, `PAYMENT_CAPTURED`, and `PAYMENT_SETTLED`.

The processor marks an event with no registered handler as processed. Those six events can therefore become `PROCESSED` without the intended order-history materialization.

**Required direction:** establish one typed event-consumer contract as the source of truth. Every emitted event must be one of:

1. required delivery to one or more named consumers;
2. explicitly documented, audited no-op; or
3. rejected/dead-lettered as an unsupported event type.

Before correcting routing, run a tenant-scoped reconciliation for historical auto-processed payment events and create only safe compensating history effects.

### F-03 — An old PENDING event may be permanently ineligible

**Severity:** High  
**Evidence:** the claim query accepts only `PENDING` or `FAILED` rows where `next_retry_at <= NOW()`. The original schema permits `next_retry_at` to be `NULL`.

The current emitter sets a due time, but legacy rows or direct writes can have no due time. A `PENDING` row with `next_retry_at IS NULL` is never claimed. This is the strongest repository-based explanation for the screenshot's very old pending event while the latest processor tick remains current.

**Required direction:** replace nullable retry eligibility with a mandatory `available_at` for all non-terminal delivery states. Do not bulk-change historic rows blindly; first reconcile each affected business effect.

### F-04 — PROCESSING has no lease or safe crash recovery

**Severity:** High  
**Evidence:** current state has no `claimed_at`, `lease_owner`, `lease_expires_at`, or attempt execution record. The claim query cannot reclaim `PROCESSING` rows.

A worker crash after a successful claim can strand a row indefinitely. The monitor calls a processing row stuck based on its creation time, which is not the time it entered processing.

**Required direction:** use a lease state. A worker claims a delivery with an owner token and expiry; completion/failure updates require that same token; another worker can reclaim only after expiry.

### F-05 — Parent-event completion is insufficient for multi-consumer delivery

**Severity:** High  
**Evidence:** one parent event can fan out to multiple handlers, but the current parent row has one status and one retry count.

If handler A succeeds and handler B fails, retrying the parent invokes A again. Existing handlers happen to be idempotent, but this contract is unsafe for future tax, GL, notification, or external integrations.

**Required direction:** retain the immutable parent event and add one delivery record per required consumer. Each delivery has its own lease, attempts, result, and terminal status. A parent completes only when all required deliveries complete.

### F-06 — Global manual runs should not be tenant-admin actions

**Severity:** High  
**Evidence:** `POST /api/v1/finance/jobs/[jobCode]/run` invokes the global `runFinanceJob()` path. The outbox worker claims across tenants, while `finance_jobs:run` is granted to tenant-facing operational roles.

**Required direction:** only the system scheduler or an HQ/system operator may execute a global drain. A tenant operator may request a bounded tenant-scoped recovery, subject to rate limiting, explicit event selection, and audit.

### F-07 — Manual recovery is not a complete financial audit trail

**Severity:** High  
**Evidence:** a manual retry resets attempts, error message, and due time but does not persist actor, reason, approval, previous state, or recovery correlation ID in the outbox domain.

**Required direction:** add immutable recovery-action records. For material event classes, require reason, preflight result, optional dual approval, and reconciliation outcome before requeueing.

### F-08 — Monitoring uses the wrong operational time basis

**Severity:** Medium  
**Evidence:** stuck detection uses `created_at` for pending, failed, and processing rows. Old failed rows may still be waiting within backoff; newly claimed old rows can appear stuck immediately.

**Required direction:** measure due age from `available_at`, active lease age from `leased_at`, and health from the last successful scheduler run plus delivery throughput/failures.

### F-09 — Configurable max attempts is not authoritative

**Severity:** Medium  
**Evidence:** `max_attempts` is persisted, but retry escalation is governed by a fixed in-code delay array rather than the stored event value.

**Required direction:** define retry policy by named policy code and snapshot the selected policy/version onto a delivery at creation. The worker must use that snapshot, not a mutable implicit default.

## Target production architecture

```mermaid
flowchart LR
  CMD[Financial command] --> TX[Single DB transaction]
  TX --> EVT[(Immutable financial event)]
  EVT --> DEL[(Consumer delivery rows)]
  SCH[System scheduler] --> WRK[Dedicated finance worker]
  WRK --> DEL
  DEL --> LEASE[Lease owner and expiry]
  LEASE --> CON[Idempotent consumer transaction]
  CON --> FX[(Business effect or consumer inbox)]
  CON --> OUT[Structured delivery outcome]
  OUT --> OBS[Metrics, alerting, monitor]
  OBS --> REC[Permissioned recovery and reconciliation]
```

### Event envelope

The event remains immutable and includes:

- `event_id`
- `tenant_org_id`
- `event_type`
- `event_version`
- `aggregate_type` and `aggregate_id`
- business idempotency key
- causation ID and correlation ID
- occurred-at timestamp
- payload classification and schema version
- immutable payload snapshot

The business idempotency key is not the outbox row ID. It is derived from the business operation so an accidental duplicate emission cannot create a second economic effect.

### Delivery ledger

Create a delivery record for every required consumer. It contains:

- parent event ID and consumer code
- delivery state: `READY`, `LEASED`, `RETRY_SCHEDULED`, `SUCCEEDED`, `DEAD_LETTERED`, or `CANCELLED`
- `available_at`, `leased_at`, `lease_expires_at`, and `lease_owner`
- attempt number and retry-policy snapshot
- error code, safe operator message, and protected diagnostic detail
- completed timestamp and effect/inbox reference

The delivery unique key is `(event_id, consumer_code)`. Each consumer writes its own idempotency/inbox key in the same transaction as its effect.

### Worker boundary

Use a separately deployed finance-worker process or service identity. It may continue to use PostgreSQL polling and `FOR UPDATE SKIP LOCKED`; Kafka, RabbitMQ, or a second queue is not required at the current stage.

The scheduler only wakes the worker or validates its heartbeat. It should not be the worker itself, and it must capture HTTP failure outcomes. The worker must be deployable independently of web requests, use bounded concurrency, renew leases for long work, and expose structured metrics.

### Consumer contract

Maintain one declarative contract containing:

- each event type and schema version
- expected producer(s)
- required consumers and delivery criticality
- idempotency/effect key
- retry policy and terminal handling
- payload classification and retention rule
- reconciliation query or invariant

Compile-time tests must fail if a producer emits an event without a contract or a required consumer is absent from the worker registry.

## Recovery policy

### Immediate incident procedure

1. Take a read-only tenant-scoped inventory of old pending, expired processing, failed, dead-lettered, and auto-processed events.
2. Classify each row: effect already exists, safely replayable, requires business repair, intentionally no-op, or unknown.
3. Verify financial source-of-truth facts first: voucher, ledger, invoice, payment, loyalty transaction, and order-history effect as applicable.
4. Requeue only rows with a documented expected effect and verified idempotency.
5. Never mark a row processed merely to remove it from the dashboard.
6. For unknown or unsafe rows, dead-letter with a diagnosis and create an operator work item.

### Alerting SLOs

- processor heartbeat older than three minutes
- scheduled request failure or unauthorized response
- due delivery older than the event-class SLA
- expired lease count above zero
- dead-letter growth by consumer/error code
- handler failure rate and latency
- unhandled event contract violation
- reconciliation mismatch between event outcome and financial effect

## Phased implementation plan

### Phase 0 — Production preflight and freeze

- Restore read-only remote database access.
- Produce tenant-scoped evidence for the screenshot tenant and platform aggregate totals.
- Temporarily disable bulk retry for unknown/dead-lettered financial event classes.
- Record a recovery disposition for every affected historical row.

**Exit criterion:** no historic event is modified without a verified financial effect classification.

### Phase 1 — Immediate security and authority hardening

- Restrict execution of `SECURITY DEFINER` worker functions.
- Separate system-worker authority from tenant operator authority.
- Remove global worker execution from tenant-facing `Run Now`.
- Add scheduler HTTP-result observability and secret-rotation runbook.

**Exit criterion:** no public or tenant-facing path can claim or trigger global outbox work.

### Phase 2 — Event-contract correctness

- Correct handler registration for all intended payment-history events.
- Mark existing intentional no-op events explicitly in the contract.
- Fail unknown event types safely instead of silently auto-processing them.
- Reconcile and repair historical missing history effects through a controlled, idempotent procedure.

**Exit criterion:** every emitted event type has a tested required-delivery or explicit no-op classification.

### Phase 3 — Leases and delivery-level state

- Add delivery ledger, lease ownership, retry-policy snapshot, and recovery audit tables.
- Dual-write new events to parent plus delivery records.
- Introduce worker compare-and-set completion and expired-lease reclaim.
- Retain compatibility reads until all active work uses delivery records.

**Exit criterion:** crash, duplicate-delivery, concurrent-worker, poison-event, and recovery tests pass.

### Phase 4 — Dedicated worker cutover

- Deploy the worker independently from web request serving.
- Shadow-process or compare outcomes without applying duplicate effects.
- Canary by low-risk tenant cohort, then expand with SLO gates.
- Retire the legacy direct processor route only after reconciliation is green.

**Exit criterion:** stable throughput, no expired leases, and reconciled financial effects through at least one normal operating cycle.

### Phase 5 — Retention and operating maturity

- Archive processed payloads under approved financial/privacy retention rules.
- Keep immutable audit metadata and delivery outcomes for the required period.
- Publish operator runbook, dashboard definitions, alert ownership, and incident drill scenarios.

**Exit criterion:** support, finance, and engineering teams can diagnose and recover an event without direct database modification.

## Required validation before rollout

- Database tests for locking, lease reclaim, state transitions, and function grants.
- Consumer tests for duplicate delivery and duplicate emission.
- Integration tests for every producer/consumer contract pair.
- Tenant-isolation tests for monitor, recovery, and tenant-scoped processing.
- Failure injection: worker killed after claim, after effect/before acknowledgement, during lease renewal, and during concurrent manual requests.
- Reconciliation tests against vouchers, payment legs, AR, loyalty, and order history.
- Load test for expected per-minute event volume and backlog drain time.
- Security review of all privileged functions, scheduler routes, secrets, and operational permissions.

## Decisions still required

1. Which financial consumers are critical enough to block parent completion?
2. Which recovery operations require finance-manager approval versus HQ/system approval?
3. What are the event-class SLOs for history, loyalty, tax, GL, and external integrations?
4. What retention period and payload redaction rules apply by jurisdiction and event class?
5. Which deployment runtime will own the dedicated worker: the future `cmx-api` service or a separately deployed worker service?

## Related documents

- [Outbox Pattern Guide](../OUTBOX_PATTERN_GUIDE.md)
- [Finance Jobs Hub](../FINANCE_JOBS_HUB.md)
- [B07 Financial Outbox Processor](../../Remediation_Work_Packages/B07_Financial_Outbox_Processor.md)
- [Financial Idempotency and Lineage](../../Remediation_Work_Packages/00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
