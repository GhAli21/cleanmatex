# CleanMateX Business Voucher — Batch 0 Decision Pack v2

**Document Type:** Decision Pack  
**Version:** v2.1 Approved  
**Status:** Approved  
**Project:** CleanMateX Business / SaaS Platform  
**Module:** Business Voucher / Order Finance / Payment Foundation  
**Approval Status:** Approved  
**Approval Date:** 2026-05-20  
**Approved By:** Project Owner  
**Supersedes:** `CleanMateX_Order_Financial_Batch_0_Decision_Pack.md`  
**Reason for v2:** The architecture direction has changed from “`org_order_*` as the primary financial anchor” to a cleaner business-voucher model using `org_fin_vouchers_mst` + `org_fin_voucher_trx_lines_dtl`.

---

# Table of Contents

- [0. Purpose](#0-purpose)
- [1. Decision Summary](#1-decision-summary)
- [2. Decision Principles](#2-decision-principles)
- [3. D-001 — Business Voucher Source Document Model](#3-d-001--business-voucher-source-document-model)
- [4. D-002 — Operational Projection / Ledger Linking Policy](#4-d-002--operational-projection--ledger-linking-policy)
- [5. D-003 — Legacy `org_payments_dtl_tr` Transition](#5-d-003--legacy-org_payments_dtl_tr-transition)
- [6. D-004 — Persisted Settlement Header/Leg Tables](#6-d-004--persisted-settlement-headerleg-tables)
- [7. D-005 — Retail Default Payment Behavior](#7-d-005--retail-default-payment-behavior)
- [8. D-006 — `PAY_ON_DELIVERY` in V1](#8-d-006--pay_on_delivery-in-v1)
- [9. D-007 — Refund Lineage Requirement](#9-d-007--refund-lineage-requirement)
- [10. D-008 — Gift Card Classification Policy](#10-d-008--gift-card-classification-policy)
- [11. D-009 — Gateway Completion Policy](#11-d-009--gateway-completion-policy)
- [12. D-010 — Required Reconciliation Scope Before Production](#12-d-010--required-reconciliation-scope-before-production)
- [13. D-011 — Business Voucher Wiring Scope](#13-d-011--business-voucher-wiring-scope)
- [14. D-012 — Incoming and Outgoing Voucher Coverage](#14-d-012--incoming-and-outgoing-voucher-coverage)
- [15. Consolidated Approval Record](#15-consolidated-approval-record)
- [16. Implementation Impact by Decision](#16-implementation-impact-by-decision)
- [17. Out of Scope for Batch 0](#17-out-of-scope-for-batch-0)
- [18. Exit Criteria for Batch 0](#18-exit-criteria-for-batch-0)
- [19. Final Recommendation](#19-final-recommendation)

---

# 0. Purpose

This document freezes the business and technical decisions required before implementing the CleanMateX Business Voucher module.

This batch contains:

```text
decisions only
no code changes
no migrations
no source-code edits
no UI implementation
no API implementation
no destructive schema changes
```

The objective is to approve the new voucher model before engineering starts implementation.

The new locked direction is:

```text
org_fin_vouchers_mst
= business-finance voucher header / source document header

org_fin_voucher_trx_lines_dtl
= business-finance voucher transaction lines / source document lines

operational tables
= module-specific effects, projections, ledgers, and summaries linked back to voucher lines
```

The old Batch 0 file remains useful historically, but it is no longer the correct decision baseline because it positioned `org_order_*` as the primary financial anchor and treated `org_payments_dtl_tr` as the legacy payment transition path. The new model makes the voucher header/line pair the business-finance source-document layer.

---

# 1. Decision Summary

| Decision ID | Decision | Recommended Option | Blocking? | Owner | Status |
|---|---|---|---|---|---|
| D-001 | Should CleanMateX use `org_fin_vouchers_mst` + `org_fin_voucher_trx_lines_dtl` as the central business-finance source-document model? | Yes. Use voucher header + voucher transaction lines as the central business voucher model. | Yes | Solution Architect + Finance Lead + Backend Lead | Approved |
| D-002 | How should operational modules relate to voucher transaction lines? | Keep operational tables as module-specific projections/ledgers linked back to voucher lines. | Yes | Solution Architect + Backend Lead + Module Owners | Approved |
| D-003 | What is the transition policy for `org_payments_dtl_tr`? | Stop expanding it. Use it as legacy compatibility/migration source only. | Yes | Solution Architect + Backend Lead + Finance Lead | Approved |
| D-004 | Should persisted settlement header/leg tables be added now? | No. Defer settlement header/leg persistence. Voucher lines become the business source-document line for now. | Yes | Solution Architect + Finance Lead | Approved |
| D-005 | Should retail default be `PAY_ON_COLLECTION` or current `CASH`? | Keep current `CASH` until operations/product explicitly approves a change. | Yes | Product Owner + Operations Lead | Approved |
| D-006 | Should `PAY_ON_DELIVERY` be supported in V1? | No for V1 unless delivery operations require it before go-live. | Yes | Product Owner + Operations Lead | Approved |
| D-007 | Is payment-row-level refund linkage enough, or is original voucher-line linkage required? | Move toward voucher-line refund lineage for new voucher flows; preserve current payment-row linkage during transition. | Yes | Finance Lead + Backend Lead | Approved |
| D-008 | Should gift card be removed from discount lines and shown only as credit/stored-value application? | Yes. Gift card is stored value/liability redemption, not a commercial discount. | Yes | Finance Product Owner + Backend Lead + Frontend Lead | Approved |
| D-009 | Should gateway payments be treated as completed only after external confirmation? | Yes. Gateway lines remain pending until externally confirmed. | Yes | Finance Systems Lead + Backend Lead | Approved |
| D-010 | Which reconciliation checks are required before production? | Add targeted minimum checks for voucher lines, operational projections, retained cash, gateway state, and credit/stored-value completeness. | Yes | Finance Operations Lead + Backend Lead | Approved |
| D-011 | Should the voucher module be built first, then wired to other modules incrementally? | Yes. Build voucher foundation first; wire orders/cash/stored-value/invoices/refunds/expenses later in controlled batches. | Yes | Solution Architect + Backend Lead + Frontend Lead | Approved |
| D-012 | Should one voucher model cover both incoming receipts and outgoing payments/expenses? | Yes. Use one voucher engine with `voucher_type`, `direction`, `line_type`, and `line_role`; do not create separate outgoing payment tables. | Yes | Solution Architect + Finance Lead | Approved |

---

# 2. Decision Principles

The implementation must follow these principles:

```text
1. Business voucher model first.
2. Voucher header and voucher transaction lines are the business-finance source document.
3. Operational tables remain useful; they are not replaced.
4. Operational tables link back to voucher transaction lines.
5. Do not create duplicate payment/allocation/outgoing-payment tables.
6. Do not expand org_payments_dtl_tr for new business needs.
7. Use additive migration only.
8. Build voucher backend/API/UI first.
9. Wire existing modules incrementally.
10. Preserve current working flows until new flows are tested.
11. Do not force ERP Lite/AP/GL into this phase.
```

---

# 3. D-001 — Business Voucher Source Document Model

## Question

Should CleanMateX use:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
```

as the central business-finance source-document model?

## Options

| Option | Description |
|---|---|
| Option A | Keep using `org_payments_dtl_tr` as the main payment transaction table. |
| Option B | Use `org_order_*` as the primary finance anchor and treat vouchers as secondary. |
| Option C | Use `org_fin_vouchers_mst` + `org_fin_voucher_trx_lines_dtl` as the business-finance source document model. |

## Recommended Option

```text
Option C — Use org_fin_vouchers_mst + org_fin_voucher_trx_lines_dtl as the central business-finance source-document model.
```

## Why

This model supports both current and future business cases:

```text
customer receipt
order payment
invoice collection
customer advance
wallet top-up
gift card sale
customer refund
expense payment
supplier payment
shop rent payment
utility payment
petty cash issue
adjustment
cash/bank/internal transfer
```

It avoids creating separate transaction tables for every type of business payment.

## Business Impact

Positive:

```text
clean finance document structure
single place to view receipts/payments/refunds/expenses
better auditability
better reporting
better future ERP readiness
```

## Technical Impact

Requires:

```text
new org_fin_voucher_trx_lines_dtl table
safe extension of org_fin_vouchers_mst if needed
voucher services
voucher APIs
voucher UI
voucher line validation
posting/reversal logic
reconciliation logic
```

## Risk if Undecided

Engineering will continue to debate whether to expand:

```text
org_payments_dtl_tr
org_order_payments_dtl
future outgoing payment tables
allocation tables
settlement tables
```

This will create more architecture churn.

## Implementation Implication

Build:

```text
Business Voucher Module
Business Voucher APIs
Business Voucher UI
Voucher Transaction Line Service
Voucher Posting/Reversal Service
```

before wiring existing order/payment flows.

## What Not To Do

Do not:

```text
expand org_payments_dtl_tr
create org_outgoing_payments_dtl_tr
create org_payment_allocations_dtl
create separate receipt voucher and payment voucher table families
```

## Approval Statement

Approved option:

```text
Use org_fin_vouchers_mst + org_fin_voucher_trx_lines_dtl as the central business-finance source-document model.
```

Status:

```text
Approved
```

---

# 4. D-002 — Operational Projection / Ledger Linking Policy

## Question

How should operational modules relate to voucher transaction lines?

## Options

| Option | Description |
|---|---|
| Option A | Replace operational tables with voucher transaction lines. |
| Option B | Keep operational tables separate and unlinked. |
| Option C | Keep operational tables as module-specific effects/projections/ledgers linked back to voucher transaction lines. |

## Recommended Option

```text
Option C — Operational tables remain module-specific projections/ledgers linked back to voucher transaction lines.
```

## Why

Voucher lines are the business source document, but operational modules still need their own optimized facts and ledgers.

Examples:

```text
org_order_payments_dtl
= order-level payment fact

org_cash_drawer_movements_dtl
= cash drawer movement/control

org_wallet_txn_dtl
= wallet balance ledger

org_advance_txn_dtl
= customer advance ledger

org_gift_card_txn_dtl
= gift card ledger

org_credit_note_txn_dtl
= credit note ledger

invoice payment projection
= invoice paid/outstanding

refund projection
= refund lifecycle

reconciliation/outbox/audit
= control and async traceability
```

## Required Linking Rule

Every operational effect produced from a voucher line should store:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

Every voucher line should be able to show its linked effect.

## Business Impact

Users can view finance from both perspectives:

```text
Voucher view:
What business finance document was posted?

Operational view:
How did this order/cash drawer/wallet/gift card/invoice change?
```

## Technical Impact

Add link columns where needed:

```text
org_order_payments_dtl.fin_voucher_id
org_order_payments_dtl.fin_voucher_trx_line_id

org_cash_drawer_movements_dtl.fin_voucher_id
org_cash_drawer_movements_dtl.fin_voucher_trx_line_id

org_wallet_txn_dtl.source_voucher_id
org_wallet_txn_dtl.source_voucher_trx_line_id

org_advance_txn_dtl.source_voucher_id
org_advance_txn_dtl.source_voucher_trx_line_id

org_gift_card_txn_dtl.source_voucher_id
org_gift_card_txn_dtl.source_voucher_trx_line_id

org_credit_note_txn_dtl.source_voucher_id
org_credit_note_txn_dtl.source_voucher_trx_line_id
```

Apply only where the target table exists and the module is in scope.

## Risk if Undecided

The voucher line could become disconnected from operational effects, creating reconciliation gaps.

## What Not To Do

Do not remove useful operational tables.

Do not force every UI/report to query only voucher lines.

## Approval Statement

Approved option:

```text
Operational tables remain module-specific projections/ledgers linked to voucher transaction lines.
```

Status:

```text
Approved
```

---

# 5. D-003 — Legacy `org_payments_dtl_tr` Transition

## Question

What is the transition policy for `org_payments_dtl_tr`?

## Options

| Option | Description |
|---|---|
| Option A | Continue expanding `org_payments_dtl_tr`. |
| Option B | Drop it immediately. |
| Option C | Keep it as legacy compatibility/migration source; stop expanding it for new business features. |

## Recommended Option

```text
Option C — Keep org_payments_dtl_tr as legacy compatibility/migration source only.
```

## Why

`org_payments_dtl_tr` overlaps heavily with voucher-line responsibilities, but it is not clean enough as the long-term transaction-line model because it is incoming-payment oriented and includes legacy order pricing/tax/discount fields.

## Business Impact

Existing flows remain safe while new architecture moves forward.

## Technical Impact

Implementation must:

```text
not drop org_payments_dtl_tr
not expand it for new feature logic
map existing rows into voucher transaction lines later
optionally create compatibility view later
```

## Risk if Undecided

Developers may continue adding fields and flows to `org_payments_dtl_tr`, making migration harder.

## What Not To Do

Do not:

```text
drop org_payments_dtl_tr now
add outgoing-payment logic to org_payments_dtl_tr
```

## Approval Statement

Approved option:

```text
org_payments_dtl_tr is legacy/migration source and must not be expanded for new voucher features.
```

Status:

```text
Approved
```

---

# 6. D-004 — Persisted Settlement Header/Leg Tables org_order_settlements_mst , org_order_settlement_legs_dtl

## Question

Should persisted settlement header/leg tables be added now?

## Options

| Option | Description |
|---|---|
| Option A | Add settlement header/leg tables now. |
| Option B | Defer settlement persistence and use voucher lines as the current business source-document line. |
| Option C | Never add settlement header/leg tables. |

## Recommended Option

```text
Option B — Defer settlement persistence and use voucher transaction lines as the current business source-document line.
```

## Why

Voucher lines now cover the business-document requirement for receipts, payments, refunds, advances, wallet top-ups, gift card sales, invoice collections, and expenses.

Settlement header/leg persistence may still be useful later for checkout-session UX or payment orchestration, but it is not required before building the voucher module.

## Business Impact

Avoids unnecessary architecture expansion now.

## Technical Impact

Do not implement settlement header/leg tables in this batch.

If needed later, settlement tables can reference voucher lines.

## Risk if Undecided

Scope creep: teams may try to build both settlement legs and voucher trx lines at the same time.

## Approval Statement

Approved option:

```text
Defer settlement header/leg tables. Build voucher header/transaction lines first.
```

Status:

```text
Approved
```

---

# 7. D-005 — Retail Default Payment Behavior

## Question

Should retail default to `PAY_ON_COLLECTION` or current `CASH`?

## Options

| Option | Description |
|---|---|
| Option A | Default retail to `PAY_ON_COLLECTION`. |
| Option B | Keep current `CASH`. |
| Option C | Make default configurable by tenant/branch later. |

## Recommended Option

```text
Option B — Keep current `PAY_ON_COLLECTION` until operations/product explicitly approves a change.
```

## Alternative Strong Operational Recommendation

Laundry operations often naturally default to:

```text
PAY_ON_COLLECTION
```

if most walk-in customers pay at pickup.

## Business Impact

This is a cashier workflow policy, not a database architecture issue.

## Technical Impact

No voucher implementation should be blocked by this.

## Risk if Undecided

Checkout behavior may vary by developer assumption.

## Approval Statement

Approved option:

```text
Keep `PAY_ON_COLLECTION` now; switch to `CASH` later only if operations explicitly approves.
```

Status:

```text
Approved
```

---

# 8. D-006 — `PAY_ON_DELIVERY` in V1

## Question

Should `PAY_ON_DELIVERY` be supported in V1?

## Options

| Option | Description |
|---|---|
| Option A | Support now. |
| Option B | Exclude from V1. |
| Option C | Add as configurable later. |

## Recommended Option

```text
Option B — Exclude from V1 unless delivery operations require it before go-live.
```

## Why

It increases workflow and payment-policy scope.

## Technical Impact

Voucher model can support it later as:

```text
line_role = ORDER_PAYMENT
target_type = ORDER
with delivery collection context
```

but no special V1 implementation is required.

## Approval Statement

Approved option:

```text
No PAY_ON_DELIVERY in V1 unless operations approves it as required.
```

Status:

```text
Approved
```

---

# 9. D-007 — Refund Lineage Requirement

## Question

Is payment-row-level refund linkage enough, or is original voucher-line linkage required?

## Options

| Option | Description |
|---|---|
| Option A | Payment-row linkage only. |
| Option B | Voucher-line refund lineage for new voucher flows. |
| Option C | Settlement-leg lineage now. |

## Recommended Option

```text
Option B — For new voucher flows, refunds should reference original voucher transaction lines.
```

## Transition Policy

During migration:

```text
Preserve existing payment-row refund linkage.
Add voucher-line linkage for new voucher-based flows.
Do not force immediate rewrite of existing refunds.
```

## Why

Voucher-line lineage is cleaner because voucher lines are now the business source-document lines.

## Business Impact

Better auditability:

```text
Which original receipt/payment line was refunded?
How much remains refundable?
Which refund voucher reversed it?
```

## Technical Impact

Add:

```text
reversed_line_id
reversal_reason
reversed_at
reversed_by
```

to voucher transaction lines.

Refund projection may also link to:

```text
fin_voucher_id
fin_voucher_trx_line_id
original_fin_voucher_trx_line_id
```

## Approval Statement

Approved option:

```text
Use voucher-line refund lineage for new voucher flows; preserve old linkage during transition.
```

Status:

```text
Approved
```

---

# 10. D-008 — Gift Card Classification Policy

## Question

Should gift card be removed from discount lines and shown only as credit/stored-value application?

## Options

| Option | Description |
|---|---|
| Option A | Keep mixed presentation. |
| Option B | Move fully to credit/stored-value treatment. |
| Option C | Display both but separate clearly. |

## Recommended Option

```text
Option B — Gift card should be treated as stored value/liability, not discount.
```

## Voucher Model Impact

Gift card sale:

```text
voucher_type = RECEIPT_VOUCHER
line_role = GIFT_CARD_SALE
direction = IN
target_type = GIFT_CARD
```

Gift card redemption against order is not a commercial discount. It should be wired through stored-value application/order credit application logic.

## Business Impact

Correct finance classification:

```text
Gift card sale creates liability.
Gift card redemption reduces liability.
Gift card is not revenue discount.
```

## Approval Statement

Approved option:

```text
Gift cards are stored value/liability, not discounts.
```

Status:

```text
Approved
```

---

# 11. D-009 — Gateway Completion Policy

## Question

Should gateway payments be treated as completed only after external confirmation?

## Options

| Option | Description |
|---|---|
| Option A | Mark completed immediately after local voucher post. |
| Option B | Keep pending until external confirmation. |
| Option C | Method-specific behavior. |

## Recommended Option

```text
Option B — Gateway payment voucher lines remain pending until external confirmation.
```

## Voucher Model Impact

Gateway voucher line may be:

```text
line_status = PENDING
payment_status = PROCESSING / AUTHORIZED / COMPLETED / FAILED
```

Do not treat it as completed business receipt until gateway confirms.

## Business Impact

Prevents recorded receipt from overstating actual captured money.

## Approval Statement

Approved option:

```text
Gateway payment completion requires external confirmation.
```

Status:

```text
Approved
```

---

# 12. D-010 — Required Reconciliation Scope Before Production

## Question

Which reconciliation checks are required before production?

## Recommended Option

Targeted minimum reconciliation:

```text
VOUCHER_TOTAL_EQUALS_LINES
VOUCHER_LINE_HAS_REQUIRED_OPERATIONAL_EFFECT
ORDER_PAYMENT_LINK_EXISTS
CASH_MOVEMENT_LINK_EXISTS
STORED_VALUE_LEDGER_LINK_EXISTS
GATEWAY_STATE_VALID
CREDIT_APPLICATION_COMPLETENESS
NO_DUPLICATE_OPERATIONAL_EFFECT
RETAINED_CASH_EQUALS_CASH_MOVEMENT
```

## Business Impact

Gives production confidence without building full ERP reconciliation.

## Technical Impact

Add reconciliation service/report around voucher lines and linked operational records.


## Approved Implementation Note

For the foundation-only Business Voucher phase, reconciliation must first validate voucher header/line integrity:

```text
VOUCHER_TOTAL_EQUALS_LINES
NO_INVALID_LINE_STATUS
NO_DUPLICATE_VOUCHER_LINE_IDEMPOTENCY
BUSINESS_POSTED_NOT_ACCOUNTING_POSTED
```

Operational-effect reconciliation checks such as `ORDER_PAYMENT_LINK_EXISTS`, `CASH_MOVEMENT_LINK_EXISTS`, and `STORED_VALUE_LEDGER_LINK_EXISTS` become active after the respective wiring batches are implemented.

## Approval Statement

Approved option:

```text
Use targeted voucher-line-to-operational-effect reconciliation before production.
```

Status:

```text
Approved
```

---

# 13. D-011 — Business Voucher Wiring Scope

## Question

Should the voucher module be built first and wired to other modules later?

## Options

| Option | Description |
|---|---|
| Option A | Build voucher foundation first, then wire modules incrementally. |
| Option B | Build voucher and wire everything immediately. |
| Option C | Wire existing modules first, then create voucher UI/backend. |

## Recommended Option

```text
Option A — Build voucher module first, then wire modules incrementally.
```

## Why

This avoids unstable cross-module refactoring.

## Recommended Sequence

```text
1. Build voucher tables/services/APIs/UI.
2. Test voucher module independently.
3. Wire order payments.
4. Wire cash drawer.
5. Wire expenses/outgoing payments.
6. Wire advances/wallet/gift cards.
7. Wire invoices/refunds.
8. Backfill org_payments_dtl_tr.
```


## Approved Implementation Note

The immediate implementation batch is Business Voucher foundation only:

```text
Build DB, services, APIs, UI, permissions, reports, posting/reversal, and standalone tests.
Do not create operational effects yet.
Do not wire order payments, cash drawer, wallet, advances, gift cards, invoices, refunds, or expenses in the foundation batch.
```

## Approval Statement

Approved option:

```text
Build voucher foundation first; wire operational modules incrementally.
```

Status:

```text
Approved
```

---

# 14. D-012 — Incoming and Outgoing Voucher Coverage

## Question

Should one voucher model cover both incoming receipts and outgoing payments/expenses?

## Options

| Option | Description |
|---|---|
| Option A | Separate receipt voucher tables and payment voucher tables. |
| Option B | One voucher header/line model with `voucher_type`, `direction`, `line_type`, and `line_role`. |
| Option C | Keep incoming only for now; add outgoing table later. |

## Recommended Option

```text
Option B — One voucher engine for incoming receipts and outgoing payments/expenses.
```

## Why

It supports:

```text
RECEIPT_VOUCHER
PAYMENT_VOUCHER
REFUND_VOUCHER
ADJUSTMENT_VOUCHER
TRANSFER_VOUCHER
```

without duplicating the same logic across multiple table families.

## Covered Business Cases

Incoming:

```text
customer receipt
order payment
invoice collection
customer advance receipt
wallet top-up
gift card sale
```

Outgoing:

```text
customer refund
supplier payment
expense payment
shop rent payment
utility payment
employee advance
petty cash issue
bank/gateway fee
```

## What Not To Do

Do not create:

```text
org_receipt_vouchers_mst
org_payment_vouchers_mst
org_outgoing_payments_dtl_tr
```

## Approval Statement

Approved option:

```text
Use one voucher model for both incoming and outgoing business transactions.
```

Status:

```text
Approved
```

---

# 15. Consolidated Approval Record

| Decision ID | Final Status | Approved By | Date | Notes |
|---|---|---|---|---|
| D-001 | Approved |  |  |  |
| D-002 | Approved |  |  |  |
| D-003 | Approved |  |  |  |
| D-004 | Approved |  |  |  |
| D-005 | Approved |  |  |  |
| D-006 | Approved |  |  |  |
| D-007 | Approved |  |  |  |
| D-008 | Approved |  |  |  |
| D-009 | Approved |  |  |  |
| D-010 | Approved |  |  |  |
| D-011 | Approved |  |  |  |
| D-012 | Approved |  |  |  |

---

# 16. Implementation Impact by Decision

| Decision ID | If Approved, Next Batch Impact |
|---|---|
| D-001 | Establishes voucher header/line model as the business-finance source document. |
| D-002 | Requires operational tables to link back to voucher transaction lines. |
| D-003 | Prevents further expansion of `org_payments_dtl_tr`; shifts new work to voucher lines. |
| D-004 | Prevents building settlement header/leg tables now. |
| D-005 | Avoids retail default churn while voucher foundation is built. |
| D-006 | Keeps delivery payment scope out of V1 unless operations requires it. |
| D-007 | Sets refund lineage direction around voucher transaction lines. |
| D-008 | Fixes gift card classification as stored value/liability, not discount. |
| D-009 | Requires gateway state-aware voucher line behavior. |
| D-010 | Defines minimum production reconciliation checks. |
| D-011 | Confirms voucher-first, wiring-second implementation sequencing. |
| D-012 | Avoids duplicate incoming/outgoing payment table families. |

---

# 17. Out of Scope for Batch 0

Batch 0 does not include:

```text
source-code changes
database migrations
table creation
table deletion
route implementation
UI build
service implementation
report build
legacy data backfill
order payment wiring
cash drawer wiring
stored value wiring
invoice/refund wiring
full ERP Lite
GL posting
AP module
bank reconciliation
```

---

# 18. Exit Criteria for Batch 0

Batch 0 is complete when:

```text
1. D-001 through D-012 have final statuses.
2. No blocking decision remains ambiguous.
3. Approved decisions are recorded in this document.
4. Implementation team can proceed to Business Voucher Foundation implementation.
```

Final statuses:

```text
All decisions D-001 through D-012 are Approved.
```

---

# 19. Final Recommendation

The following decisions are approved and unblock the voucher foundation:

```text
D-001 Business Voucher Source Document Model
D-002 Operational Projection / Ledger Linking Policy
D-003 Legacy org_payments_dtl_tr Transition
D-011 Business Voucher Wiring Scope
D-012 Incoming and Outgoing Voucher Coverage
```

Finance classification and controls are approved:

```text
D-007 Refund Lineage Requirement
D-008 Gift Card Classification Policy
D-009 Gateway Completion Policy
D-010 Required Reconciliation Scope
```

Operational policy decisions are approved as follows:

```text
D-005 Retail Default Payment Behavior
D-006 PAY_ON_DELIVERY in V1
```

Settlement persistence is approved as deferred:

```text
D-004 Persisted Settlement Header/Leg Tables
```

Final locked direction:

```text
Build the Business Voucher module first.

Use:
- org_fin_vouchers_mst
- org_fin_voucher_trx_lines_dtl

Then wire:
- order payments
- cash drawer
- wallet
- advances
- gift cards
- credit notes
- invoices
- refunds
- expenses

Do not expand org_payments_dtl_tr.
Do not create org_payment_allocations_dtl.
Do not create org_outgoing_payments_dtl_tr.
Do not build full ERP Lite now.
