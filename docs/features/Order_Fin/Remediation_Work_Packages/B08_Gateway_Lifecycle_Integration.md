# B08 — Gateway Lifecycle Integration

## Metadata
Backlog ID: B8 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: IMPLEMENTED (2026-07-24, uncommitted; migration `0426_b08_gateway_lifecycle_integration.sql` APPLIED (owner, 2026-07-24) to local + remote, verified)
Authoritative report sections: §31 (card/gateway), §6, §50-B8
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D009](00_Phase_0_Financial_Semantics/D009_Pending_Payment_Failure_Fallback.md), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) (impl — shares transition service)
Blocks: — · Recommended phase: Seq 9

## Confirmed problem
No gateway callback/webhook exists; legs park in PENDING/PROCESSING with manual verify as the only exit; PROCESSING has no completion path at all; capture/void/refund/chargeback/payout/fee lifecycles are NOT_FOUND (§31).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement-planner.service.ts:36 | gateway legs → PROCESSING | unverifiable (verify accepts PENDING only) |
| sys_payment_gateway_cd / org_payment_gateway_cf | config-only | no runtime integration |
| §31 matrix | AUTH/CAPTURE/REFUND/CHARGEBACK NOT_FOUND | full family absent |

**Correction found during implementation (2026-07-24):** `org_payment_gateway_cf` does not exist anywhere in this codebase — confirmed by a repo-wide grep across `supabase/migrations/**` and `prisma/schema.prisma` (zero matches). It is referenced only in two stale JSDoc `@throws` comments (`order-settlement-planner.service.ts`, `order-submit-orchestrator.service.ts`) and one dead Jest mock — all three were left as-is (not this package's scope to chase down every stale reference; flagged here for a future B29-style sweep). The real per-tenant gateway config table is `org_payment_methods_cf` (migration 0269), whose `gateway_config` JSONB column already documents the `*_webhook_secret`-suffixed key convention this package reuses (`webhook_secret`) — no new config table was created.

## Required outcome
Webhook/callback route with signature verification + event dedup (D010), driving D001 transitions (AUTHORIZED→CAPTURED→SETTLED, FAILED, VOIDED); gateway refund execution surface for B9; duplicate-event protection; reconciliation of gateway state vs leg state.

## Scope
Callback route(s), gateway adapter contract, transition wiring, event log.

## Out of scope
Chargebacks/payouts/fees/reserves ([B26](B26_Enterprise_FX_Bank_Gateway_And_ECL.md)); worklist UI (B30).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (status transitions) |
| Credit applications | NO |
| BVM | POSSIBLE (line status sync) |
| Cash drawer | NO |
| Gateway or bank | YES |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (via B6 events) |
| Snapshot | YES (paid recognition timing) |
| Reconciliation | YES (GATEWAY_STATE_VALID real data) |
| Customer receipt | POSSIBLE |
| Audit/outbox | YES |

## Acceptance criteria
Gateway confirmation completes a leg without manual verify; duplicate webhook processes once; failed capture triggers D009 fallback flow.

## Required tests
API (signed/replayed/malformed events), integration, idempotency, concurrency, regression.

## Dependencies and sequencing
Shares the transition service with B30 — sequence after it or co-design.

## Delivery surfaces

Backend services: gateway adapter contract + webhook handler service driving D001 transitions; signature verification per gateway config
Database/schema: gateway event log table (dedup by provider event id) — assess at design
API/endpoints: POST /api/v1/payments/gateway/[gatewayCode]/webhook (public, signed); internal status-sync endpoint for manual pull
Frontend page/screen/dialog/action: no new page — gateway leg status renders in the B30 worklist and order Financial tab (status chips: PROCESSING/CAPTURED/FAILED); manual re-sync action on the leg row
Reusable components/helpers: transition service shared with B30/B10; status chip component reuse
Permissions: webhook = signature-authenticated system actor; manual re-sync behind `orders:verify_payment`-family code (B27)
Validation: signature, schema per gateway, amount/currency match to leg, event dedup
i18n/RTL: EN/AR for gateway statuses and failure reasons
Accessibility: status not conveyed by color alone
Audit trail: event log row per webhook incl. raw reference; transition audit per D001
Observability: webhook failure/dedup counters; unmatched-event alert
Jobs/workers: optional reconciliation pull job for gateways without webhooks (B19 infra)
Feature flag: none — no flag needed. No live path creates an AUTHORIZED leg today (see dormancy note below), so shipping the webhook route + CAPTURE/SETTLE actions changes nothing observable until a tenant configures `webhook_secret` in `org_payment_methods_cf.gateway_config` for a gateway_code — that per-tenant config IS the activation switch (an unconfigured secret means REJECTED_SIGNATURE for every event, a safe default-off).
Rollout: no sandbox gateway exists to stage against — see Safety block for the honest production-activation gate.
Rollback: unset `webhook_secret` in the tenant's `org_payment_methods_cf.gateway_config` row; the route then rejects all events for that tenant (REJECTED_SIGNATURE) and legs revert to the pre-existing manual VERIFY/FAIL_BOUNCE path.

**Dormancy note (recorded 2026-07-24, not part of the original spec):** no gateway configuration anywhere in this codebase creates a payment leg at `AUTHORIZED` — `resolveDefaultStatus()` in `order-settlement-planner.service.ts` only ever returns PENDING/PROCESSING/COMPLETED for a gateway leg. So the AUTHORIZED→CAPTURED→SETTLED sub-lifecycle this package builds (D001's approved graph, explicitly assigned to B08 as "gateway sub-lifecycle mapping") is real, tested, and reachable, but dormant on every live path today. Today's only real gateway path (PROCESSING) is driven straight through the EXISTING VERIFY/FAIL_BOUNCE actions by the new webhook — same precedent as B03's SV_FUNDING `PROCESSING` status ("reserve the room, ship no dead branch on the live path").

## End-to-end operational flow

1. Customer pays via gateway → leg created PROCESSING at settlement (today's only real creation path — see Safety/Dormancy note).
2. Gateway calls `POST /api/v1/payments/gateway/[gatewayCode]/webhook` → raw body parsed by the registered `GatewayAdapter` → event row inserted into `sys_gw_webhook_events_tr` (dedup key `(gateway_code, provider_event_id)`, a unique-violation short-circuits to `DUPLICATE`) → leg resolved by `gateway_transaction_id`/`gateway_reference` (deliberate cross-tenant lookup, the one documented exception to the tenant-filter rule, since the tenant is unknown before this match) → tenant's `webhook_secret` resolved from `org_payment_methods_cf.gateway_config` and the signature verified over the exact raw bytes → `transitionPaymentTx` dispatched with the D001-legal action for (outcome, current status) → status flips, snapshot recalc, outbox event emitted → order paid state updates without manual action.
3. A `PAYMENT_FAILED` event auto-selects `RETRY_TENDER` (D009 default for "gateway failure before confirmation") and calls the existing FAIL_BOUNCE action — no new fallback logic, reuses B30's classification engine.
4. Duplicate webhook replays are no-ops (`DUPLICATE`, zero new effects). Unmatched events (`UNMATCHED`) are logged with full context for ops but never guess a tenant/leg. An operator can additionally manually re-sync a stuck AUTHORIZED/CAPTURED leg via the same `PaymentTransitionDialog`/worklist used for VERIFY/CANCEL/VOID (no separate "pull" endpoint — B08's own scope decision, see Completion evidence).

## Safety

UI design allowed: YES · UI implementation allowed: YES (status display) — IMPLEMENTED
Production activation allowed: per gateway after real sandbox verification; **no real gateway (Stripe/HyperPay/PayTabs) is integrated in this codebase — only catalog rows exist** — so "sandbox verification" cannot literally happen until a real vendor account is connected. The webhook route, dedup, and D001 transition wiring are production-correct and fully tested against the generic normalized envelope (`genericHmacGatewayAdapter`) today; production activation for a REAL provider additionally requires: (1) a vendor-specific `GatewayAdapter` implementation translating that provider's payload into the normalized shape (registry change in `gateway-webhook-adapter.ts`, not a route/service rewrite), (2) that provider's real sandbox verification (signed/replayed/malformed events) before going live, (3) `webhook_secret` configured in the tenant's `org_payment_methods_cf.gateway_config`.
Required backend gates: B30 transition service available — MET (B30 shipped, extended here)
Required decision gates: D001, D009, D010 approved — MET
Required verification gates: per-gateway sandbox verification (signed/replayed/malformed events) — **N/A until a real vendor is connected** (see above); this package's own test suite covers signed/wrong-secret/tampered/missing-signature/malformed-schema/duplicate-event cases against the generic adapter.

## Completion evidence
Migration: `0426_b08_gateway_lifecycle_integration.sql` — **APPLIED (owner, 2026-07-24) to local + remote, verified via `mcp__supabase_remote_db` read-only queries** (all 4 actor-audit columns present on `org_order_payments_dtl`; `sys_gw_webhook_events_tr` table present; `chk_history_action_type` extended with `PAYMENT_CAPTURED`/`PAYMENT_SETTLED`). Owner also regenerated Supabase types.
Implementation files: `lib/services/gateway/gateway-webhook-adapter.ts` (new — contract + generic HMAC adapter + registry), `lib/services/gateway-webhook.service.ts` (new — orchestration: gateway lookup → parse → dedup → resolve leg → verify signature → dispatch transition), `app/api/v1/payments/gateway/[gatewayCode]/webhook/route.ts` (new — public signed webhook), `lib/constants/order-financial.ts` (CAPTURE/SETTLE actions + PAYMENT_CAPTURED/PAYMENT_SETTLED outbox events), `lib/services/payment-transition.service.ts` (extended — CAPTURE/SETTLE dispatch, nullable `actorId` for webhook-driven transitions, deferred GL post on CAPTURE mirroring VERIFY), `lib/services/order-history-consumer.service.ts` (extended — PAYMENT_CAPTURED/PAYMENT_SETTLED history mapping), `app/api/v1/finance/pending-payments/[paymentId]/transition/route.ts` (CAPTURE/SETTLE added to the action enum + permission map, reusing `orders:verify_payment`), `src/features/billing/ui/payment-transition-dialog.tsx` (CAPTURE/SETTLE variants, no-reason-required), `src/features/orders/ui/order-financial/order-payments-credits-tables.tsx` (status badges + manual re-sync buttons for AUTHORIZED/CAPTURED legs), `lib/services/pending-payments-worklist.service.ts` + `app/api/v1/finance/pending-payments/route.ts` + `src/features/billing/ui/pending-payments-worklist-page.tsx` (AUTHORIZED/CAPTURED added to the worklist statuses/counts/actions), `prisma/schema.prisma` (hand-mirrored), i18n (`messages/en(ar)/billing.json`, `messages/en(ar)/orders/detail.json`).
Tests: `__tests__/services/gateway-webhook-adapter.test.ts` (new, 12 tests — parse + signature verification), `__tests__/services/gateway-webhook.service.test.ts` (new, 12 tests — not-found/malformed/duplicate/unmatched/signature-rejected/happy-path VERIFY+CAPTURE/D009-fallback/unsupported-outcome), `__tests__/services/payment-transition.service.test.ts` (+6 CAPTURE/SETTLE cases, existing VOID/REVERSE/VERIFY/CANCEL/FAIL_BOUNCE suites untouched and still passing), `__tests__/services/order-history-consumer.service.test.ts` (unchanged, still passing — generic case-fallthrough covers the 2 new event types with no new logic needed).
**Gates ALL GREEN:** tsc clean · eslint 0 (project-wide) · targeted jest 66/66 (4 touched suites) · full jest **230/230 suites, 2228/2228 tests — zero known failures** · `npm run build` ✓ (exit 0; `/api/v1/payments/gateway/[gatewayCode]/webhook` confirmed compiled in the route manifest) · `check:i18n` ✓ (pre-existing benign EN=AR placeholder warnings only, unrelated to B8).
Commit: — (uncommitted) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
