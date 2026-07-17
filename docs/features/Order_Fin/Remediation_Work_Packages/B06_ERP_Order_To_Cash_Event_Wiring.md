# B06 — ERP Order-to-Cash Event Wiring

## Metadata
Backlog ID: B6 · Severity: HIGH · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: H2, §12, §39, §50-B6
Required decisions: [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md), [D008](00_Phase_0_Financial_Semantics/D008_Stored_Value_Funding_Treatment.md), [D012](00_Phase_0_Financial_Semantics/D012_Revenue_Recognition_Policy.md) (partial — liability events)
Dependencies: [B04](B04_Later_Collection_BVM_Parity.md) (impl), [B03](B03_Stored_Value_Funding_Capture.md) (impl — funding facts)
Blocks: [B24](B24_AR_Allocation_Writeoff_And_Period_Controls.md), [B25](B25_Revenue_Recognition_And_Contract_Liability.md) (hard)
Recommended phase: Seq 8

## Confirmed problem
ERP-Lite engine is production-grade, but only invoice-created, expense, and petty-cash post. Payment/refund/gift-card dispatchers have no callers (DISCONNECTED); wallet top-up, advance, loyalty-liability, AR-allocation event codes don't exist (NOT_FOUND). POS money never reaches the GL (H2, §39).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| erp-lite-auto-post.service.ts:104–583 | payment/refund/GC dispatchers defined | zero callers |
| erp-lite-posting.ts:69–86 | event codes incl. ORDER_SETTLED_WALLET | missing codes for top-up/advance/allocation |
| voucher-wiring order-payment handler | writes payment facts | natural dispatch point |

## Required outcome
Policy-gated (NON_BLOCKING default) dispatch of: payment received (per method family), refund issued, gift-card events, wallet/advance funding + application, per D007 matrix and §39 target Dr/Cr sketch; new event codes seeded where NOT_FOUND; BVM↔GL reconciliation check added.

## Scope
Dispatch call-sites in wiring handlers/refund/funding services; new event-code constants + governance seeds (migration); exception-path behavior; idempotency per (doc,event,key).

## Out of scope
Revenue recognition triggers (B25); AR write-off/allocation GL specifics (B24); journal reversal service (with B13/B10 semantics).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | YES |
| Snapshot | NO |
| Reconciliation | YES (BVM↔GL check) |
| Customer receipt | NO |
| Audit/outbox | YES (posting logs) |

## Acceptance criteria
Every §39 DISCONNECTED row shows a runtime caller; trial balance reflects a full cash order lifecycle; posting failures land in exceptions without blocking settlement (per policy).

## Required tests
integration, database (seeds), accounting (balanced journals per event), idempotency, reconciliation, regression.

## Dependencies and sequencing
After B4 (voucher-driven collection facts) and B3 (funding facts); before B24/B25.

## Delivery surfaces

Backend services: dispatch call-sites in voucher wiring handlers, processRefund, funding service (B3); ErpLiteAutoPostService gains missing event builders
Database/schema: new event codes + governance package seeds (migration); no new tables
API/endpoints: none new (posting is service-internal; existing ERP preview/exception routes serve)
Frontend page/screen/dialog/action: existing ERP-Lite screens are the consumer — journals list, posting exceptions screen (retry/repost actions), finance audit views; no new page; exception screen must list the new event codes with bilingual labels
Reusable components/helpers: erp-lite-auto-post.util result handling reused
Permissions: existing ERP-Lite finance permissions; posting itself is system-actor
Validation: engine-side (governance rules, open period, balanced lines) — unchanged
i18n/RTL: EN/AR labels for new txn event codes in finance namespaces
Accessibility: NOT_APPLICABLE beyond existing exception screens
Audit trail: org_fin_post_log_tr per dispatch; exceptions to org_fin_post_exc_tr
Observability: BVM↔GL reconciliation check (new); posting failure-rate metric
Jobs/workers: posting-retry runner referenced from B19
Feature flag: per-event enable via existing HQ auto-post policy rows (BLOCKING default NON_BLOCKING)
Rollout: seed policies disabled → enable per event family on staging → trial-balance validation → production per family
Rollback: disable policy rows (engine-native switch); journals already posted remain (reverse via engine repost policy)

## End-to-end operational flow (operator: finance user)

- **Trigger:** system — a settlement, refund, or stored-value funding transaction commits; the owning service (voucher wiring handler / processRefund / funding service) invokes the ERP dispatcher for the matching event code per the tenant's auto-post policy rows. Operator trigger: finance user opens the ERP-Lite posting-exceptions screen.
- **Permissions:** dispatch itself is system-actor (no user permission). Viewing journals/exceptions and retrying/reposting require the existing ERP-Lite finance permissions; retry actions are denied 403 without them and render disabled-with-reason in the UI.
- **API/system action:** no new endpoint — dispatch is service-internal; the existing ERP preview/exception routes serve the screen; retry posts through the existing exception-retry route.
- **Backend execution:** dispatcher builds the event payload (doc id, event code, tenant, amounts) → ErpLiteAutoPostService validates governance rules, open period, and account mapping → writes a balanced journal inside the engine transaction; idempotent per `(doc, event, key)` so the same business fact can never post twice.
- **Success path:** balanced journal persisted; posting log row written; source document unaffected; BVM↔GL recon check ties voucher totals to journal totals per family.
- **Failure handling:** with NON_BLOCKING policy (default) a posting failure writes an exception row (`org_fin_post_exc_tr`) with the reason (missing mapping, closed period, unbalanced) and the sale/refund/funding flow continues; with BLOCKING policy the owning transaction fails explicitly. No partial journals — the engine writes all lines or none.
- **Retry logic:** finance user fixes the cause (mapping/period) and retries from the exceptions screen; the B19 posting-retry runner re-attempts eligible exceptions on schedule; retries reuse the original idempotency key, so a retry after a half-visible outcome cannot double-post.
- **Audit logging:** every dispatch writes `org_fin_post_log_tr` (event, doc, outcome, actor = system or retrying user); exception rows keep the failure reason and resolution trail.
- **Observability:** posting failure-rate metric per event family; BVM↔GL reconciliation check surfaces drift as a recon issue; exception-queue age visible on the screen.
- **Recovery procedures:** unresolved exceptions escalate via the recon check; a family posting systematically wrong is disabled through its policy row (engine-native switch) while facts continue accumulating; already-posted journals are corrected via the engine repost/reversal policy — never by editing journals in place.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
