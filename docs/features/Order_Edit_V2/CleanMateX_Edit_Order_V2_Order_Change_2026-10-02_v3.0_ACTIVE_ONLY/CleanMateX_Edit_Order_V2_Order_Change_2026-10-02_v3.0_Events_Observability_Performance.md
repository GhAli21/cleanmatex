# CleanMateX Edit Order V2 — Events, Observability, Performance & Support Signals

**Version:** 3.0

## 1. Outbox

Reuse the existing transactional outbox. Do not build another bus.

Before adding a new token, audit registration and consumers. If adopted, the canonical post-commit event should conceptually represent `ORDER_CHANGED` / `order.change_applied` with one stable existing naming convention, not multiple overlapping events.

**Current-code gate B06 (WP11/WP19):** these are candidate names, not registered/deployed tokens. Current constants use uppercase persisted tokens in `lib/constants/order-financial.ts:521`; neither proposed Change token exists. `outbox-processor.service.ts:89` marks events with no registered handler processed/skipped. Therefore emitting a conceptual token alone does not deliver Change history or notifications. Freeze one exact token and safe payload schema, register every required consumer, and prove registration/retry/duplicate effects before emitting/enabling it. Do not rename existing persisted tokens.

Finance transactional transport (`outbox.service.ts`) and Notification Hub delivery (`lib/notifications/adapters/outbox.ts`, `org_ntf_outbox_dtl`) are distinct existing owners. Bridge a committed Change to approved Notification Hub event/template/recipient policy through a registered post-commit consumer; do not perform notification Supabase/HTTP delivery in Apply or create a third bus. Current notification idempotency is keyed by tenant/event/channel/source/recipient (`adapters/outbox.ts:43`): qualify the source with Change ID or an approved revision suffix so two real revisions notify independently while duplicate delivery of one revision does not. Respect current consent, provider/template, quiet-hours and fallback policy; do not infer notifications work from Finance event insertion.

Required dispatch tests distinguish intentional audit-only events from required-business-consumer absence; a Change event missing its required handler is a release failure. Retryable failures must remain FAILED/retry/dead-letter, not silently processed. Support links carry Change/request identity across Finance and Notification Hub transports without broadcasting full before/after PII.

Minimum safe payload:

```text
eventId
tenantOrgId
orderId
orderChangeId
changeNo
editStateVersionAfter
sourceContext
actorUserId (if policy permits downstream)
financialOutcome
occurredAt
correlation/request id
```

Do not include full sensitive before/after snapshots in broadcast payloads. Consumers re-read tenant-safe data as needed and are idempotent.

## 2. Structured logs

Every Preview/Apply log context should include request/correlation ID, tenant ID, order ID, operation count, edit/wf versions, outcome/error code and latency. Never log payment secrets or full PII.

## 3. Metrics

Recommended counters/histograms:

- `order_change_context_requests_total`;
- `order_change_preview_total{outcome}`;
- `order_change_apply_total{outcome}`;
- `order_change_operation_total{code}`;
- `order_change_conflict_total{type}`;
- `order_change_capability_denied_total{reason}`;
- `order_change_override_total{result}`;
- `order_change_financial_outcome_total{outcome}`;
- `order_change_financial_unresolved_total{type}`;
- `order_change_legacy_write_attempt_total{path}`;
- latency histograms for context/preview/apply;
- idempotent replay counter;
- rollback/failure-stage counter.

## 4. Tracing

Use existing OpenTelemetry conventions. Trace route → context/capability → calculation → finance aggregation → transaction stages. External follow-up is a separate trace/transaction linked by Change ID/correlation ID.

## 5. Performance/SLO target

The inherited pack proposes the following targets; this review has not verified a current platform SLO authority for these numbers. Treat them as **PROPOSED**, pending an owner-approved measured budget at WP18/WP19:

- normal API p50 < 300 ms;
- p95 < 800 ms where feasible;
- Preview may have a separately measured budget if authoritative pricing/tax evaluation requires it, but must not silently skip rules to hit latency;
- availability target 99.9%;
- no external gateway/network calls in Apply transaction.

Establish real baseline/load tests before release; targets are release gates, not assumptions.

## 6. Alerts/support

Alert on sustained spikes in Apply failures, snapshot mismatch, tax/pricing dependency failures, idempotency conflicts beyond expected retry level, unresolved financial outcomes, legacy bypass attempts, or outbox handler failures.

Support lookup should allow searching Order ID / Change ID / revision / request ID and show source, actor, operations, versions, warnings/override proof summary and financial outcome without exposing secrets.
