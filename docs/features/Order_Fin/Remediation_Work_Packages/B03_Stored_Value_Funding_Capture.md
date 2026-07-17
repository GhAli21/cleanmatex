# B03 — Stored-Value Funding Capture

## Metadata
Backlog ID: B3 · Severity: CRITICAL · Classification: BLOCKS_PRODUCTION · Status: NOT_STARTED
Authoritative report sections: C3, §7, §33, §50-B3
Required decisions: [D008](00_Phase_0_Financial_Semantics/D008_Stored_Value_Funding_Treatment.md), [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: none (hard) · Blocks: [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) (funding events, impl)
Recommended phase: Seq 6

## Confirmed problem
Gift-card sale, wallet top-up, and advance receipt write stored-value ledger rows only — no tender/payment fact, no BVM voucher, no drawer movement, no GL liability (C3).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| gift-card-service.ts:314–382 | sale = card mst + SALE txn | no money capture |
| wallet/top-up/route.ts:36–43 | direct `topUpWalletTx` | no tender record; 'OMR' default |
| stored-value.service.ts:190 | advance receipt same pattern | same |
| customer-receipt-excess path | creates WALLET_TOPUP/ADVANCE voucher lines | proven target pattern |

## Required outcome
Every funding operation records tender (payment fact incl. method/status), a BVM receipt voucher line (GIFT_CARD_SALE / WALLET_TOPUP / CUSTOMER_ADVANCE_RECEIPT roles), drawer movement for drawer-required cash, all keyed (D010), currency from tenant resolution.

## Scope
Shared funding service; retrofit GC-sale action, wallet top-up route/action, advance issue; idempotency keys; tests.
**Frontend surface (rule 7):** GC-sale dialog, wallet top-up screen, and advance-receipt UI gain a tender step (method, amount, drawer session where required) and a funding receipt/print — funding without choosing how the money arrived becomes impossible in the UI as well as the API.

## Out of scope
GL liability journals (B6/B25); expiry/breakage (B19/B25); promotional credit design (D008 scope note).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES |
| Credit applications | NO |
| BVM | YES |
| Cash drawer | YES |
| Gateway or bank | POSSIBLE (card-funded top-up) |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (deferred to B6) |
| Snapshot | NO (order-independent) |
| Reconciliation | YES (funding link checks) |
| Customer receipt | YES (funding receipt) |
| Audit/outbox | YES |

## Acceptance criteria
Funding without tender is impossible via any entry point; voucher/drawer/ledger amounts reconcile 1:1; duplicate retry produces zero extra effects.

## Required tests
unit, integration, API, idempotency, concurrency, reconciliation, regression.

## Dependencies and sequencing
Independent start after D008/D010; before B6 wires funding GL events.

## Delivery surfaces

Backend services: new shared stored-value funding service (tender + voucher + ledger in one tx); retrofits gift-card-service.sellGiftCard, stored-value top-up/advance paths
Database/schema: funding ledger rows gain voucher backlinks (existing columns); assess sparse unique index on funding idempotency keys
API/endpoints: wallet top-up route + GC-sale/advance server actions gain required tender payload (methodId, amount, cashTendered, drawer/pos session, idempotencyKey)
Frontend page/screen/dialog/action: GC-sale dialog (marketing), wallet top-up screen (customer detail), advance-receipt UI — each gains a tender step with method selector, amount, drawer/session context, and a funding receipt/print action
Reusable components/helpers: reuse payment-method selector + tender input from the payment modal component family
Permissions: existing GC/wallet action guards; funding-specific codes assessed with B27
Validation: currency from tenant resolution (no literals); method availability per D9 config; drawer session OPEN when cash
i18n/RTL: EN/AR for tender step + funding receipt; RTL-safe dialogs
Accessibility: dialog focus management, labeled inputs, error announcements (existing Cmx patterns)
Audit trail: voucher + payment fact + ledger row with actor and backlinks
Observability: funding-without-voucher reconciliation check (extends stored-value link checks)
Jobs/workers: none (expiry stays B19)
Feature flag: `order_fin.sv_funding_capture` — old direct paths rejected once enabled
Rollout: service + screens behind flag → staging parity check (ledger == voucher == tender) → enable → remove legacy direct writes
Rollback: disable flag (legacy direct paths resume); captured rows remain valid

## End-to-end operational flow

1. Operator opens GC-sale / top-up / advance dialog, enters amount → tender step requires method (+ cash tendered/drawer when cash) → submit with idempotency key.
2. API validates method/config/session; service writes tender fact + BVM receipt line + ledger credit atomically; drawer movement via wiring when cash.
3. UI shows success with funding receipt link; duplicate submit replays the original result.
4. Reconciliation links ledger↔voucher↔tender; missing-link rows surface as blockers; failure mid-tx rolls back all three facts.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (action disabled with reason), duplicate-click protection (in-flight disable + idempotent replay), processing, success, retry on failure; funding history visible on the card/wallet/advance record.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: only with the full capture path (no tender-less funding remains reachable)
Required backend gates: shared funding service + all entry-point retrofits in the same release
Required decision gates: D008, D010 approved (D007 conformance)
Required verification gates: ledger==voucher==tender parity checks green on staging

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
