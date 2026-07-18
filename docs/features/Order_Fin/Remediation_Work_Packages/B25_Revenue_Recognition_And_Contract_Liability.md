# B25 — Revenue Recognition and Contract Liability

## Metadata
Backlog ID: B25 · Severity: LOW→HIGH at GA · Classification: FUTURE_ENTERPRISE · Status: NOT_STARTED
Authoritative report sections: §37, §39 target sketch, §50-B25
Required decisions: [D012](00_Phase_0_Financial_Semantics/D012_Revenue_Recognition_Policy.md) (APPROVED (Expert) 2026-07-18 — IFRS 15 validated-completion model; the accounting-owner sign-off survives only as the implementation control for enabling an entity-specific over-time period-end adjustment), [D008](00_Phase_0_Financial_Semantics/D008_Stored_Value_Funding_Treatment.md) (APPROVED (Expert) 2026-07-18)
Dependencies: [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) (hard) · Blocks: —
Recommended phase: Seq 13

## Confirmed problem
No revenue-recognition event exists for cash/POS orders at any lifecycle point; payment receipt, receivable, contract liability, tax liability, and revenue earned are not separated; GC/wallet/advance/loyalty liabilities have no postings (§37 five-layer table).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| §39 | ORDER_REVENUE_RECOGNIZED has no event code | recognition family absent |
| gift-card getTotalGiftCardLiability | report-only read | no liability journal |
| AR path | ORDER_INVOICED only revenue-shaped journal | cash orders never recognize |

## Required outcome
D012-approved triggers implemented as ERP events: deferred revenue/contract liability on prepayment and stored-value funding, recognition at the approved fulfillment trigger, release/breakage events, reversal on refund/cancel/amendment per D003/D011.

## Scope
Event codes + governance seeds, trigger call-sites (workflow transition hooks), recognition schedule storage assessment, reversal events.

## Out of scope
IFRS 15 policy itself (D012); FX (B26); statutory reporting.

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | POSSIBLE (tax-point alignment) |
| ERP-Lite GL | YES (core deliverable) |
| Snapshot | NO |
| Reconciliation | YES (liability vs ledger checks) |
| Customer receipt | NO |
| Audit/outbox | YES |

## Acceptance criteria
Prepaid order shows liability at payment and revenue at the approved trigger; GC sale→redemption→expiry produces liability→release→breakage journals; trial balance ties to operational ledgers.

## Required tests
accounting (journal matrix), integration (lifecycle triggers), reconciliation, regression.

## Dependencies and sequencing
Strictly after D012 approval and B6.

## Delivery surfaces

Backend services: recognition/liability/release/breakage event builders + workflow-transition trigger hooks; recognition schedule storage (assess)
Database/schema: event codes + governance seeds (migration); possible recognition schedule table (target-state, D012-dependent)
API/endpoints: none new (engine-internal posting; existing ERP reporting routes)
Frontend page/screen/dialog/action: existing ERP-Lite reporting screens extended — liability balances (GC/wallet/advance/loyalty) and recognized-vs-deferred revenue views; no operator action (system-posted)
Reusable components/helpers: B6 dispatch plumbing
Permissions: finance reporting permissions (existing)
Validation: engine-side balancing; D012 trigger legality
i18n/RTL: EN/AR for new event/report labels
Accessibility: existing report tables
Audit trail: posting logs per event; policy version noted in journal metadata
Observability: liability-vs-ledger recon checks; trial-balance tie-out
Jobs/workers: period-end recognition job if D012 chooses time-based triggers (B19 infra)
Feature flag: per-event policy rows (engine-native)
Rollout: after D012 approval + B6; one liability family at a time (GC first)
Rollback: disable policy rows; posted journals reversed via engine repost policy

## End-to-end operational flow (finance user)

- **Trigger:** system — lifecycle transitions fire the D012-approved recognition triggers: prepayment/stored-value funding posts contract liability; the approved fulfillment trigger (e.g. delivery transition) posts recognition; refund/cancel/amendment posts the defined reversal; expiry posts breakage (B19 job when time-based). Operator trigger: finance user opens the liability and recognized-vs-deferred reports.
- **Permissions:** posting is system-actor via the B6 dispatch plumbing; reports are gated by existing finance reporting permissions; there is no operator action that creates recognition journals by hand.
- **API/system action:** none new — engine-internal posting through B6; existing ERP reporting routes serve the extended views.
- **Backend execution:** event builders produce balanced liability/recognition/release/breakage journals per the D012 policy matrix; each posting is idempotent per `(doc, event, key)`; recognition schedules (if D012 selects time-based triggers) are stored and consumed by the period-end job.
- **Success path:** trial balance ties to operational ledgers; reports show deferred vs recognized correctly per family (GC/wallet/advance/loyalty); a full GC sale→redemption→expiry lifecycle shows liability→release→breakage.
- **Failure handling:** posting failures follow the B6 exception path (NON_BLOCKING default — operations never stall on a recognition event); malformed policy/mapping surfaces as an exception with reason, not a silent skip.
- **Retry logic:** B19 posting-retry re-attempts eligible exceptions with the original idempotency key; manual retry from the ERP exceptions screen after fixing mapping/period.
- **Audit logging:** posting logs per event with the D012 policy version noted in journal metadata, so every journal is traceable to the policy that produced it.
- **Observability:** liability-vs-ledger recon checks per family; trial-balance tie-out check; recognition backlog metric when schedules exist (unrecognized past-trigger amounts alert).
- **Recovery procedures:** wrong-policy postings are reversed via the engine repost/reversal policy (never edited); a family posting incorrectly is disabled via its policy row while facts accumulate; policy changes require a superseding D012 version, then re-enable family by family (GC first).

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
