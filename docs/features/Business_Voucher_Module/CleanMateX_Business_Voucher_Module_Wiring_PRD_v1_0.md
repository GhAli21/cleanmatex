# CleanMateX Business Voucher Module — Wiring PRD

**Document Type:** Product Requirements Document (PRD)  
**Module:** Business Voucher Wiring / Integration Layer  
**Version:** v1.0  
**Status:** Draft for Review  
**Project:** CleanMateX Business / SaaS Platform  
**Primary Scope:** Wire `org_fin_vouchers_mst` and `org_fin_voucher_trx_lines_dtl` into operational modules  
**Core Source Document Tables:** `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`  
**Operational Projections / Ledgers:**  
- `org_order_payments_dtl`
- `org_cash_drawer_movements_dtl`
- `org_wallet_txn_dtl`
- `org_advance_txn_dtl`
- `org_gift_card_txn_dtl`
- `org_credit_note_txn_dtl`
- invoice payment/collection projection
- refund projection
- expense category/payment projection
- reconciliation/audit/outbox records

---

# Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Wiring Principle](#2-wiring-principle)
- [3. Goals and Non-Goals](#3-goals-and-non-goals)
- [4. Architecture Overview](#4-architecture-overview)
- [5. Source of Truth Rules](#5-source-of-truth-rules)
- [6. Wiring Scope](#6-wiring-scope)
- [7. Required Link Columns](#7-required-link-columns)
- [8. Order Payment Wiring](#8-order-payment-wiring)
- [9. Cash Drawer Wiring](#9-cash-drawer-wiring)
- [10. Customer Advance Wiring](#10-customer-advance-wiring)
- [11. Wallet Top-Up Wiring](#11-wallet-top-up-wiring)
- [12. Gift Card Sale Wiring](#12-gift-card-sale-wiring)
- [13. Credit Note Wiring](#13-credit-note-wiring)
- [14. Invoice Collection Wiring](#14-invoice-collection-wiring)
- [15. Refund Wiring](#15-refund-wiring)
- [16. Expense / Outgoing Payment Wiring](#16-expense--outgoing-payment-wiring)
- [17. Voucher Posting Runtime Rules](#17-voucher-posting-runtime-rules)
- [18. Voucher Reversal Runtime Rules](#18-voucher-reversal-runtime-rules)
- [19. Backend Service Requirements](#19-backend-service-requirements)
- [20. API Requirements](#20-api-requirements)
- [21. UI/UX Requirements](#21-uiux-requirements)
- [22. Reconciliation Requirements](#22-reconciliation-requirements)
- [23. Migration from `org_payments_dtl_tr`](#23-migration-from-org_payments_dtl_tr)
- [24. Testing Strategy](#24-testing-strategy)
- [25. Release Plan](#25-release-plan)
- [26. Acceptance Criteria](#26-acceptance-criteria)
- [27. Implementation Checklist](#27-implementation-checklist)

---

# 1. Executive Summary

The Business Voucher Module defines:

```text
org_fin_vouchers_mst
= voucher header / official business-finance document

org_fin_voucher_trx_lines_dtl
= voucher transaction/business source lines
```

The Wiring PRD defines how those voucher transaction lines create or link to operational projections and ledgers.

The key architecture rule:

```text
Voucher transaction line is the source business-finance document line.
Operational tables are module-specific effects/projections linked back to the voucher line.
```

This means the voucher line records the official business-finance transaction, while module tables record the operational effect needed by each area.

Examples:

```text
ORDER_PAYMENT voucher line
→ creates/links org_order_payments_dtl

CASH ORDER_PAYMENT voucher line
→ creates/links org_cash_drawer_movements_dtl

WALLET_TOPUP voucher line
→ creates/links org_wallet_txn_dtl

CUSTOMER_ADVANCE_RECEIPT voucher line
→ creates/links org_advance_txn_dtl

GIFT_CARD_SALE voucher line
→ creates/links org_gift_card_txn_dtl

ORDER_REFUND voucher line
→ creates/links refund projection and cash/stored-value reversal
```

The purpose is to keep vouchers centralized without removing the value of operational tables.

---

# 2. Wiring Principle

## 2.1 Core Principle

```text
Voucher line first.
Operational effect second.
Bidirectional traceability always.
```

Every operational effect created by a voucher line must link back to:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

Every voucher line that produces an operational effect should store:

```text
source_table
source_id
```

or target-specific fields such as:

```text
order_id
invoice_id
customer_id
gift_card_id
wallet_txn_id
advance_txn_id
credit_note_id
refund_id
cash_drawer_session_id
```

## 2.2 Source Document vs Projection

| Layer | Table | Responsibility |
|---|---|---|
| Source document | `org_fin_vouchers_mst` | Voucher header |
| Source document line | `org_fin_voucher_trx_lines_dtl` | Business-finance transaction line |
| Operational projection | `org_order_payments_dtl` | Order payment fact |
| Operational control | `org_cash_drawer_movements_dtl` | Physical cash movement |
| Stored-value ledger | `org_wallet_txn_dtl`, `org_advance_txn_dtl`, etc. | Balance-changing ledger |
| Audit / async | outbox/audit records | Event and traceability |
| Reconciliation | reconciliation records | Integrity checks |

---

# 3. Goals and Non-Goals

## 3.1 Goals

The wiring layer must:

```text
1. Connect voucher transaction lines to operational modules.
2. Keep voucher lines as the central business-finance document line.
3. Preserve operational tables for fast UI, workflow, and ledger behavior.
4. Avoid direct expansion of org_payments_dtl_tr.
5. Support incoming and outgoing voucher lines.
6. Support receipts, payments, refunds, expenses, advances, wallet top-ups, gift card sales, invoice collections, and cash drawer movements.
7. Provide idempotent, transactional write flows.
8. Provide reconciliation checks between voucher lines and operational effects.
9. Allow incremental rollout without breaking existing flows.
```

## 3.2 Non-Goals

This wiring PRD does not implement:

```text
Full ERP Lite
Full GL posting
AP supplier invoice lifecycle
Bank reconciliation
Payroll
Full purchase invoice module
Complex approval workflows
```

It only wires business vouchers to current/future operational modules.

---

# 4. Architecture Overview

## 4.1 High-Level Flow

```text
User/API action
→ voucher service creates voucher header
→ voucher line service creates voucher trx line
→ wiring service creates operational projection/ledger/movement
→ voucher line stores link to operational effect
→ operational effect stores fin_voucher_id and fin_voucher_trx_line_id
→ outbox/audit/reconciliation records created
```

## 4.2 Example: Order Cash Payment

```text
org_fin_vouchers_mst
RV-001

org_fin_voucher_trx_lines_dtl
line_role = ORDER_PAYMENT
payment_method_code = CASH
amount = 10
order_id = Order-001
cash_drawer_session_id = Session-001

org_order_payments_dtl
order_id = Order-001
amount = 10
fin_voucher_trx_line_id = line.id

org_cash_drawer_movements_dtl
movement_type = CASH_SALE
amount = 10
fin_voucher_trx_line_id = line.id
```

---

# 5. Source of Truth Rules

## 5.1 Voucher Line as Business Source Document

For business-finance transaction evidence:

```text
org_fin_voucher_trx_lines_dtl is authoritative.
```

It answers:

```text
What business finance transaction line was recorded?
```

## 5.2 Operational Projection as Module Source

Operational modules own their module-specific state.

Examples:

```text
org_order_payments_dtl
= authoritative for order payment summary/projection

org_cash_drawer_movements_dtl
= authoritative for cash drawer expected cash and movement history

org_wallet_txn_dtl
= authoritative for wallet balance ledger

org_advance_txn_dtl
= authoritative for advance balance ledger

org_gift_card_txn_dtl
= authoritative for gift card balance ledger
```

## 5.3 Reconciliation Rule

Voucher lines and operational projections must reconcile.

Example:

```text
sum voucher lines with line_role=ORDER_PAYMENT and target_type=ORDER
=
sum linked org_order_payments_dtl amounts
```

---

# 6. Wiring Scope

## 6.1 In Scope

Wiring required for:

```text
Order payment
Cash drawer movement
Customer advance receipt
Wallet top-up
Gift card sale
Credit note issue/application where applicable
Invoice collection
Customer refund
Order refund
Expense payment
Supplier payment
Petty cash issue
Bank/gateway fee
```

## 6.2 Deferred Wiring

Can be later:

```text
Full AP purchase invoice payment
Full GL journal posting
Bank reconciliation
Supplier aging
Customer statement automation
```

---

# 7. Required Link Columns

## 7.1 Operational Tables Should Link Back to Voucher Lines

Recommended columns:

```text
fin_voucher_id uuid null
fin_voucher_trx_line_id uuid null
```

Add to applicable tables:

```text
org_order_payments_dtl
org_cash_drawer_movements_dtl
org_wallet_txn_dtl
org_advance_txn_dtl
org_gift_card_txn_dtl
org_credit_note_txn_dtl
invoice payment/collection table
refund projection table
expense payment table if created
```

## 7.2 Voucher Line Should Link to Operational Effect

On `org_fin_voucher_trx_lines_dtl`, use existing target fields plus:

```text
source_table text null
source_id uuid null
```

Or module-specific fields:

```text
wallet_txn_id
advance_txn_id
gift_card_txn_id
credit_note_txn_id
refund_id
cash_drawer_movement_id
order_payment_id
invoice_payment_id
```

If avoiding many columns, use:

```text
source_table
source_id
metadata
```

For core modules, explicit columns are better for performance and clarity.

---

# 8. Order Payment Wiring

## 8.1 Trigger

When voucher line is:

```text
line_role = ORDER_PAYMENT
target_type = ORDER
order_id is not null
line_status = POSTED
```

## 8.2 Required Operational Effect

Create or link:

```text
org_order_payments_dtl
```

## 8.3 Required Fields on Order Payment

```text
tenant_org_id
branch_id
order_id
customer_id
payment_method_code
org_payment_method_id
amount
currency_code
payment_status
paid_at
received_by
fin_voucher_id
fin_voucher_trx_line_id
cash_drawer_session_id
gateway_reference
bank_reference
check_number
card_brand_code
card_last4
metadata
```

## 8.4 Business Rules

```text
Only POSTED voucher lines create order payment facts.
Only line_role=ORDER_PAYMENT creates order payment projection.
Refund lines do not create positive order payments.
Duplicate projection must be prevented by unique fin_voucher_trx_line_id.
Order outstanding must be recalculated after projection creation.
```

## 8.5 Acceptance Criteria

```text
[ ] Posting an ORDER_PAYMENT voucher line creates org_order_payments_dtl.
[ ] The order payment row links to fin_voucher_id and fin_voucher_trx_line_id.
[ ] Order paid amount/outstanding updates correctly.
[ ] Duplicate post does not create duplicate order payment.
```

---

# 9. Cash Drawer Wiring

## 9.1 Trigger

When voucher line has:

```text
payment_method_code = CASH
direction = IN or OUT
cash_drawer_session_id is not null
line_status = POSTED
```

## 9.2 Required Operational Effect

Create:

```text
org_cash_drawer_movements_dtl
```

## 9.3 Movement Mapping

| Voucher Line | Cash Movement |
|---|---|
| `ORDER_PAYMENT`, direction `IN` | `CASH_SALE` |
| `CUSTOMER_ADVANCE_RECEIPT`, direction `IN` | `CASH_IN` or `ADVANCE_RECEIPT` if supported |
| `WALLET_TOPUP`, direction `IN` | `CASH_IN` or `WALLET_TOPUP` if supported |
| `GIFT_CARD_SALE`, direction `IN` | `CASH_IN` or `GIFT_CARD_SALE` if supported |
| `CUSTOMER_REFUND`, direction `OUT` | `CASH_REFUND` |
| `ORDER_REFUND`, direction `OUT` | `CASH_REFUND` |
| `PETTY_CASH_ISSUE`, direction `OUT` | `CASH_OUT` |
| `EXPENSE_PAYMENT`, direction `OUT` | `CASH_OUT` |

## 9.4 Cash Amount Rule

```text
cash drawer movement amount = voucher line amount
```

Not:

```text
tendered_amount
```

Example:

```text
line.amount = 7.500
tendered_amount = 10.000
change_returned_amount = 2.500
cash movement amount = 7.500
```

## 9.5 Acceptance Criteria

```text
[ ] Cash receipt line creates cash drawer movement.
[ ] Cash refund/payment-out line creates OUT movement.
[ ] Tendered/change values do not inflate drawer amount.
[ ] No cash movement is created without open/valid drawer session when required.
```

---

# 10. Customer Advance Wiring

## 10.1 Trigger

```text
line_role = CUSTOMER_ADVANCE_RECEIPT
target_type = CUSTOMER_ADVANCE
direction = IN
customer_id is not null
line_status = POSTED
```

## 10.2 Required Operational Effect

Create:

```text
org_advance_txn_dtl
```

or equivalent customer advance ledger.

## 10.3 Ledger Mapping

```text
txn_type = RECEIVE_ADVANCE
amount = line.amount
source_voucher_id = voucher.id
source_voucher_trx_line_id = line.id
```

## 10.4 Business Rules

```text
Advance receipt increases customer advance liability/balance.
No org_order_payments_dtl is created because no order is paid yet.
Advance application to order is a separate stored-value/credit application flow.
```

## 10.5 Acceptance Criteria

```text
[ ] Advance receipt voucher line creates advance ledger row.
[ ] Advance balance increases.
[ ] No order payment row is created.
[ ] Ledger row links back to voucher line.
```

---

# 11. Wallet Top-Up Wiring

## 11.1 Trigger

```text
line_role = WALLET_TOPUP
target_type = WALLET
direction = IN
customer_id is not null
line_status = POSTED
```

## 11.2 Required Operational Effect

Create:

```text
org_wallet_txn_dtl
```

## 11.3 Ledger Mapping

```text
txn_type = TOP_UP
amount = line.amount
source_voucher_id = voucher.id
source_voucher_trx_line_id = line.id
```

## 11.4 Business Rules

```text
Wallet top-up increases wallet balance.
No order payment row is created.
Cash/card/bank/gateway reference stays on voucher line.
```

## 11.5 Acceptance Criteria

```text
[ ] Wallet top-up voucher line creates wallet transaction.
[ ] Wallet balance increases.
[ ] Wallet transaction links back to voucher line.
[ ] No order payment projection is created.
```

---

# 12. Gift Card Sale Wiring

## 12.1 Trigger

```text
line_role = GIFT_CARD_SALE
target_type = GIFT_CARD
direction = IN
gift_card_id is not null
line_status = POSTED
```

## 12.2 Required Operational Effect

Create or update:

```text
org_gift_card_txn_dtl
```

## 12.3 Ledger Mapping

```text
txn_type = ISSUE / ACTIVATE / TOP_UP depending gift-card lifecycle
amount = line.amount
source_voucher_id = voucher.id
source_voucher_trx_line_id = line.id
```

## 12.4 Business Rules

```text
Gift card sale is not order revenue.
Gift card sale creates liability/stored value.
No org_order_payments_dtl is created.
Gift card sale should not be discount.
```

## 12.5 Acceptance Criteria

```text
[ ] Gift card sale voucher line creates gift card ledger transaction.
[ ] Gift card balance/status updates correctly.
[ ] Voucher line links to gift card.
[ ] No order payment row is created unless the line is explicitly ORDER_PAYMENT.
```

---

# 13. Credit Note Wiring

## 13.1 Trigger

Possible roles:

```text
CUSTOMER_REFUND_TO_CREDIT_NOTE
CREDIT_NOTE_ISSUE
CREDIT_NOTE_SETTLEMENT
```

If not implemented yet, keep credit note wiring in Phase 2.

## 13.2 Required Operational Effect

Create:

```text
org_credit_note_txn_dtl
```

or equivalent credit note ledger.

## 13.3 Business Rules

```text
Credit note issuance creates customer credit liability.
Credit note application to order is not a real payment.
Credit note refund/reversal must reference original voucher line when applicable.
```

## 13.4 Acceptance Criteria

```text
[ ] Credit note issue/application/reversal can link to voucher line.
[ ] Credit note ledger remains balanced.
```

---

# 14. Invoice Collection Wiring

## 14.1 Trigger

```text
line_role = INVOICE_PAYMENT
target_type = INVOICE
invoice_id is not null
direction = IN
line_status = POSTED
```

## 14.2 Required Operational Effect

Create or update:

```text
invoice payment projection
invoice paid amount snapshot
invoice outstanding amount
```

Suggested future table:

```text
org_invoice_payments_dtl
```

If not available, update invoice paid/outstanding snapshot and keep voucher line as detailed evidence.

## 14.3 Business Rules

```text
Invoice collection does not always create org_order_payments_dtl.
Only create order payment projection if invoice collection is explicitly allocated to underlying orders.
```

## 14.4 Acceptance Criteria

```text
[ ] Invoice payment voucher line updates invoice paid/outstanding.
[ ] Voucher line links to invoice.
[ ] Invoice collection report can show voucher line details.
```

---

# 15. Refund Wiring

## 15.1 Trigger

```text
voucher_type = REFUND_VOUCHER
line_type = REFUND
direction = OUT
line_role in CUSTOMER_REFUND, ORDER_REFUND, INVOICE_REFUND
line_status = POSTED
```

## 15.2 Required Operational Effect

Depending on refund type:

```text
order refund projection
cash drawer movement for cash refund
gateway refund status/reference
wallet/gift/advance/credit note reversal if stored-value refund
invoice refund/credit memo projection
```

## 15.3 Original Line Reference

Refund line should reference:

```text
reversed_line_id
```

where possible.

This enables:

```text
refund by original voucher transaction line
```

## 15.4 Business Rules

```text
Refunds do not delete original receipt lines.
Refunds create new voucher lines with direction OUT.
Refund amount cannot exceed remaining refundable amount.
Cash refund requires active cash drawer session if policy requires.
Gateway/card refund may remain PENDING until provider confirms.
```

## 15.5 Acceptance Criteria

```text
[ ] Refund voucher line references original voucher line where applicable.
[ ] Refund creates correct operational effect.
[ ] Refund updates order/invoice/customer balance where applicable.
[ ] Cash refund creates cash drawer movement.
```

---

# 16. Expense / Outgoing Payment Wiring

## 16.1 Trigger

Voucher line is:

```text
direction = OUT
line_type in PAYMENT, EXPENSE, FEE
line_role in SUPPLIER_PAYMENT, EXPENSE_PAYMENT, SHOP_RENT_PAYMENT, UTILITY_PAYMENT, EMPLOYEE_ADVANCE_PAYMENT, PETTY_CASH_ISSUE, BANK_FEE, GATEWAY_FEE
line_status = POSTED
```

## 16.2 Required Operational Effect

For V1, voucher line itself may be enough.

Optional operational projection:

```text
org_expense_payments_dtl
org_expense_summary_by_category
petty cash ledger
employee advance ledger
supplier account projection
```

## 16.3 Business Rules

```text
Expense lines require expense_category_code when target_type=EXPENSE.
Supplier payment requires supplier_id or party_name.
Employee advance/petty cash requires employee_id or party_name.
Cash outgoing lines create cash drawer OUT movement if cash drawer is used.
Bank/card outgoing lines store payment references on the voucher line.
```

## 16.4 Acceptance Criteria

```text
[ ] Payment voucher can record shop rent.
[ ] Payment voucher can record utility payment.
[ ] Payment voucher can record supplier payment.
[ ] Payment voucher can record petty cash issue.
[ ] Cash outgoing line creates cash drawer OUT movement when applicable.
```

---

# 17. Voucher Posting Runtime Rules

## 17.1 Posting Steps

When posting voucher:

```text
1. Lock voucher header.
2. Validate voucher is DRAFT/PENDING.
3. Load voucher lines.
4. Validate all required line fields.
5. Validate line role/target combinations.
6. Validate payment method requirements.
7. Validate cash drawer requirements.
8. Recalculate header totals.
9. Set voucher status to POSTED.
10. Set active line statuses to POSTED.
11. Execute wiring effects line by line.
12. Write outbox/audit records.
13. Commit transaction.
```

## 17.2 Failure Rule

If any line fails wiring:

```text
entire posting transaction fails
voucher remains unposted
no partial operational projections remain
```

## 17.3 Idempotency Rule

Posting must be idempotent:

```text
same idempotency key → same result
```

---

# 18. Voucher Reversal Runtime Rules

## 18.1 Reversal Steps

```text
1. Validate voucher/line is POSTED.
2. Validate permission.
3. Validate reversible amount/status.
4. Create reversal voucher or reversal lines.
5. Link reversal line to original line via reversed_line_id.
6. Reverse operational effects.
7. Mark original voucher/line as REVERSED or PARTIALLY_REVERSED.
8. Write audit/outbox records.
9. Commit transaction.
```

## 18.2 Reversal Effects

| Original Effect | Reversal Effect |
|---|---|
| Order payment | order refund/reversal projection |
| Cash drawer IN | cash drawer OUT |
| Wallet top-up | wallet debit/reversal |
| Advance receipt | advance debit/reversal |
| Gift card sale | gift card void/reversal |
| Invoice payment | invoice payment reversal |
| Expense payment | expense reversal/contra line |

---

# 19. Backend Service Requirements

## 19.1 Required Wiring Services

```text
voucher-posting-orchestrator.service.ts
voucher-line-wiring.service.ts
voucher-order-payment-wiring.service.ts
voucher-cash-drawer-wiring.service.ts
voucher-stored-value-wiring.service.ts
voucher-invoice-wiring.service.ts
voucher-refund-wiring.service.ts
voucher-expense-wiring.service.ts
voucher-reconciliation.service.ts
```

## 19.2 Orchestrator Responsibility

```text
validate voucher
post voucher
dispatch each line to correct wiring handler
ensure transaction boundary
ensure idempotency
ensure rollback on failure
```

## 19.3 Handler Selection

Handler selection by:

```text
line_role
target_type
direction
payment_method_code
```

Example:

```text
line_role=ORDER_PAYMENT → order payment wiring handler
payment_method_code=CASH → cash drawer wiring handler also runs
line_role=WALLET_TOPUP → wallet wiring handler
```

## 19.4 Multiple Handlers Per Line

A single voucher line may trigger more than one operational effect.

Example:

```text
ORDER_PAYMENT + CASH
→ order payment projection
→ cash drawer movement
```

This is valid.

---

# 20. API Requirements

## 20.1 Posting API

```text
POST /api/v1/finance/vouchers/[voucherId]/post
```

Must:

```text
validate voucher
post header and lines
execute wiring
return voucher with linked operational effects
```

## 20.2 Reversal API

```text
POST /api/v1/finance/vouchers/[voucherId]/reverse
POST /api/v1/finance/vouchers/[voucherId]/lines/[lineId]/reverse
```

Must:

```text
create reversal effect
link to original line
return reversal voucher/line
```

## 20.3 Linked Effects API

```text
GET /api/v1/finance/vouchers/[voucherId]/linked-effects
GET /api/v1/finance/voucher-lines/[lineId]/linked-effects
```

Response includes:

```text
order_payment
cash_drawer_movement
wallet_txn
advance_txn
gift_card_txn
credit_note_txn
invoice_payment
refund
expense_projection
outbox_events
reconciliation_status
```

## 20.4 Reconciliation API

```text
POST /api/v1/finance/vouchers/[voucherId]/reconcile
GET  /api/v1/finance/vouchers/[voucherId]/reconciliation
```

---

# 21. UI/UX Requirements

## 21.1 Voucher Detail Linked Effects Panel

Voucher detail screen must include:

```text
Linked Operational Effects
```

For each line, show:

```text
Order payment created
Cash drawer movement created
Wallet transaction created
Advance transaction created
Gift card transaction created
Invoice payment updated
Refund created
Expense recorded
```

## 21.2 Line Status and Wiring Status

Each voucher line should show:

```text
line_status
wiring_status
reconciliation_status
```

Suggested values:

```text
NOT_WIRED
WIRED
PARTIALLY_WIRED
FAILED
REVERSED
```

## 21.3 Posting Preview

Before posting, show:

```text
This voucher will create:
- 1 order payment
- 1 cash drawer movement
- 1 wallet top-up
```

This prevents hidden side effects.

## 21.4 Reversal Preview

Before reversal, show:

```text
This reversal will:
- reverse order payment
- create cash refund movement
- restore wallet balance
```

---

# 22. Reconciliation Requirements

## 22.1 Required Checks

```text
VOUCHER_TOTAL_EQUALS_LINES
ORDER_PAYMENT_LINK_EXISTS
CASH_MOVEMENT_LINK_EXISTS
WALLET_LEDGER_LINK_EXISTS
ADVANCE_LEDGER_LINK_EXISTS
GIFT_CARD_LEDGER_LINK_EXISTS
INVOICE_PAYMENT_LINK_EXISTS
REFUND_LINK_EXISTS
EXPENSE_CATEGORY_EXISTS
NO_DUPLICATE_OPERATIONAL_EFFECT
```

## 22.2 Reconciliation Status

Voucher line should have or derive:

```text
reconciliation_status = PENDING / PASSED / FAILED / WARNING
```

## 22.3 Reconciliation Report

Should show:

```text
voucher_no
line_no
line_role
expected_effect
actual_effect
status
issue_message
```

---

# 23. Migration from `org_payments_dtl_tr`

## 23.1 Migration Principle

Do not drop old table.

Phases:

```text
1. Add new voucher line table.
2. Build voucher module and wiring for new flows.
3. Backfill historical org_payments_dtl_tr rows into org_fin_voucher_trx_lines_dtl.
4. Link operational projections where possible.
5. Mark old table as legacy read-only.
6. Create compatibility view if needed.
```

## 23.2 Mapping Logic

| Old | New |
|---|---|
| `voucher_id` | `voucher_id` |
| `paid_amount` | `amount`, `net_amount` |
| `payment_method_code` | `payment_method_code` |
| `order_id` | `target_type=ORDER`, `line_role=ORDER_PAYMENT`, `order_id` |
| `invoice_id` | `target_type=INVOICE`, `line_role=INVOICE_PAYMENT`, `invoice_id` |
| `customer_id` only | `target_type=CUSTOMER_ACCOUNT`, line role decided by context |
| `gift_card_id` | `target_type=GIFT_CARD`, line role decided by context |
| `cash_drawer_session_id` | `cash_drawer_session_id` |
| `payment_terminal_id` | `payment_terminal_id` |
| references | same reference fields |
| `idempotency_key` | `idempotency_key` |

---

# 24. Testing Strategy

## 24.1 Unit Tests

```text
line role handler selection
order payment wiring
cash drawer wiring
advance wiring
wallet wiring
gift card wiring
invoice wiring
expense wiring
refund reversal
duplicate prevention
```

## 24.2 Integration Tests

```text
post order cash payment voucher
post wallet top-up voucher
post customer advance voucher
post gift card sale voucher
post invoice collection voucher
post expense payment voucher
post petty cash voucher
post refund voucher
reverse posted voucher
reconcile voucher effects
```

## 24.3 UI Tests

```text
posting preview shows effects
voucher detail shows linked effects
reversal preview shows effects
failed wiring displays error
```

---

# 25. Release Plan

## Phase 1 — Foundation Ready

```text
Voucher header and lines exist.
Manual voucher create/post works.
No external wiring except basic voucher records.
```

## Phase 2 — First Wiring

```text
Order payment wiring
Cash drawer wiring
Expense payment wiring
```

## Phase 3 — Stored Value Wiring

```text
Advance receipt
Wallet top-up
Gift card sale
Credit note
```

## Phase 4 — Invoice and Refund Wiring

```text
Invoice collection
Customer refund
Order refund
Invoice refund
```

## Phase 5 — Migration

```text
Backfill org_payments_dtl_tr
Compatibility view
Legacy read-only mode
```

---

# 26. Acceptance Criteria

The wiring module is accepted when:

```text
1. Voucher posting creates expected operational effects.
2. Each operational effect links back to voucher line.
3. Each voucher line can show linked effects.
4. Duplicate posting does not duplicate effects.
5. Cash voucher lines create correct cash drawer movements.
6. Order payment lines create org_order_payments_dtl.
7. Advance lines create advance ledger rows.
8. Wallet top-up lines create wallet ledger rows.
9. Gift card sale lines create gift card ledger rows.
10. Invoice payment lines update invoice collection state.
11. Refund lines create correct reversal effects.
12. Expense lines can record outgoing business payments.
13. Reconciliation can detect missing or duplicate effects.
14. org_payments_dtl_tr is not used for new feature expansion.
```

---

# 27. Implementation Checklist

## Database

```text
[ ] Add fin_voucher_id and fin_voucher_trx_line_id to operational tables.
[ ] Add indexes on voucher links.
[ ] Add unique constraints to prevent duplicate effects per voucher line.
[ ] Add wiring/reconciliation status if needed.
```

## Backend

```text
[ ] Create posting orchestrator.
[ ] Create wiring handlers.
[ ] Add transaction boundary.
[ ] Add idempotency.
[ ] Add reversal handlers.
[ ] Add reconciliation service.
```

## APIs

```text
[ ] Posting API executes wiring.
[ ] Reversal API executes reversal wiring.
[ ] Linked effects API.
[ ] Reconciliation API.
```

## UI

```text
[ ] Posting preview.
[ ] Linked effects panel.
[ ] Reversal preview.
[ ] Wiring/reconciliation status badges.
```

## Tests

```text
[ ] Unit tests.
[ ] Integration tests.
[ ] UI tests.
[ ] Migration/backfill tests.
```

---

# Final Product Decision

CleanMateX will use:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
```

as the central business voucher source-document model.

Operational modules remain responsible for their module-specific facts and ledgers.

All operational projections and ledgers created by voucher posting must link back to:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

This creates a clean, auditable, business-first finance foundation without forcing full ERP Lite into the current scope.
