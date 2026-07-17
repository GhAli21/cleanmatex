# B26 — Enterprise FX, Bank, Gateway, and ECL

## Metadata
Backlog ID: B26 · Severity: LOW · Classification: FUTURE_ENTERPRISE · Status: NOT_STARTED
Authoritative report sections: §31 (chargebacks/payouts), §40 (safe/bank), §42 (FX), §36 (ECL), §50-B26
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D012](00_Phase_0_Financial_Semantics/D012_Revenue_Recognition_Policy.md)
Dependencies: [B08](B08_Gateway_Lifecycle_Integration.md) (impl) · Blocks: —
Recommended phase: Seq 13

## Confirmed problem
Entire enterprise families are NOT_FOUND: FX rate management/history/gain-loss, chargebacks (all states), gateway payouts/fees/reserves, safe drops/cash pickups/bank deposits, bank reconciliation, check clearing sub-lifecycle, ECL/bad-debt recovery.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| org_orders_mst.currency_ex_rate | single projection rate, default 1 | no rate table/history |
| §40 controls table | safe/bank rows NOT_FOUND | cash leaves drawer into nothing |
| §31 gateway family | payouts/fees/chargebacks NOT_FOUND | settlement economics invisible |

## Required outcome (target-state umbrella — split before implementation)
Sub-packages to be carved out when scheduled: (a) exchange-rate service + realized FX G/L; (b) chargeback lifecycle on B10 reversal semantics (per D003 v2, chargebacks/bounces reopen due via payment-status change); (c) gateway payout/fee ingestion + clearing reconciliation; (d) safe/bank deposit movements completing the cash chain; (e) check deposit/clear/bounce; (f) ECL/aging-based provisioning on AR.

## Umbrella rule (binding)

**B26 is a planning umbrella only. No implementation of any kind — code, migrations, APIs, screens, jobs, or tests — may occur under B26 until its FX, gateway settlement, chargeback, bank reconciliation, safe/deposit, and ECL areas are each split into a separate implementation package** with its own decisions, evidence, Delivery surfaces, safety gates, and owner. Work discovered to be proceeding under the B26 ID is a governance defect and must stop.

## Scope
Umbrella tracking only; each sub-item becomes its own package with decisions/evidence before work starts.

## Out of scope
Everything until split; no sub-item may be implemented under this ID (see Umbrella rule).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | POSSIBLE (FX) |
| Payment facts | POSSIBLE |
| Credit applications | NO |
| BVM | POSSIBLE (transfer vouchers) |
| Cash drawer | POSSIBLE (safe chain) |
| Gateway or bank | YES |
| Tax documents | NO |
| ERP-Lite GL | YES |
| Snapshot | POSSIBLE |
| Reconciliation | YES (bank/gateway recon) |
| Customer receipt | NO |
| Audit/outbox | YES |

## Acceptance criteria
Defined per carved-out sub-package; this umbrella closes when all sub-packages exist with owners.

## Required tests
Per sub-package.

## Dependencies and sequencing
Post-GA hardening; (b)/(c) after B8, (f) after B24.

## Delivery surfaces

Backend services: defined per carved-out sub-package (rate service, chargeback lifecycle, payout/fee ingestion, safe/bank chain, check clearing, ECL provisioning)
Database/schema: per sub-package (rate table + history, chargeback table, payout/fee tables, deposit movements, clearing states, provision table) — target-state recommendations
API/endpoints: per sub-package
Frontend page/screen/dialog/action: NOT_APPLICABLE at umbrella level
Reason: tracking umbrella only — no implementation may occur under this ID (scope rule); each sub-package defines its own screens (rate admin, chargeback queue, bank recon workspace, safe-transfer actions, ECL report) when carved out
Existing consumer: none yet
Operational visibility: umbrella closes when every sub-item exists as its own package with an owner
Failure detection: master-index review at each planning pass
Recovery method: NOT_APPLICABLE (no runtime)
Reusable components/helpers: — (defined per sub-package)
Permissions: per sub-package (rate override + backdated codes flagged in §43)
Validation: defined per carved-out sub-package
i18n/RTL: defined per carved-out sub-package
Accessibility: defined per carved-out sub-package
Audit trail: defined per carved-out sub-package
Observability: defined per carved-out sub-package
Jobs/workers: defined per carved-out sub-package
Feature flag: per sub-package
Rollout: post-GA hardening; (b)/(c) after B8, (f) after B24
Rollback: per sub-package

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
