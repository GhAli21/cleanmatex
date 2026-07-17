# B08 — Gateway Lifecycle Integration

## Metadata
Backlog ID: B8 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
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
Feature flag: per-gateway enable in org_payment_gateway_cf
Rollout: sandbox gateway on staging → shadow mode (log only) → enforce transitions
Rollback: disable per-gateway flag; legs revert to manual verification path

## End-to-end operational flow

1. Customer pays via gateway → leg created PROCESSING at settlement.
2. Gateway calls the webhook → signature verified, event deduped → transition to CAPTURED/COMPLETED (or FAILED) → snapshot recalc → order paid state updates without manual action.
3. Failure event triggers the D009 fallback flow surfaced in the B30 worklist; operator resolves with an explicit choice.
4. Duplicate webhook replays are no-ops; unmatched events alert ops.

## Safety

UI design allowed: YES · UI implementation allowed: YES (status display)
Production activation allowed: per gateway after sandbox verification; never before D001/D009 approval
Required backend gates: B30 transition service available
Required decision gates: D001, D009, D010 approved
Required verification gates: per-gateway sandbox verification (signed/replayed/malformed events) passed

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
