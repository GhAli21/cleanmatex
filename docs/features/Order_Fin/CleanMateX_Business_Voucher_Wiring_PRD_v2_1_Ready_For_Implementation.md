# CleanMateX Business Voucher Wiring PRD

**Document Type:** Product Requirements Document (PRD)  
**Module:** Business Voucher Wiring / Operational Integration Layer  
**Version:** v2.1  
**Status:** Phase 1A Complete — Phases 2–5 Pending  
**Project:** CleanMateX Business / SaaS Platform  
**Primary Scope:** Wire Business Voucher transaction lines into Order Fin, order payments, order credit applications, cash drawer, stored-value ledgers, full AR invoice payments, refunds, expenses, reconciliation, and linked-effects UI.  
**Core Source Document Tables:** `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`  
**Operational Tables / Ledgers:** `org_order_payments_dtl`, `org_order_credit_apps_dtl`, `org_order_refunds_dtl`, `org_cash_drawer_movements_dtl`, `org_wallet_txn_dtl`, `org_advance_txn_dtl`, `org_gift_card_txn_dtl`, `org_credit_note_txn_dtl`, `org_invoice_payments_dtl`, `org_customer_ar_ledger_dtl`, refund projection, expense/outgoing payment projection, reconciliation/audit/outbox records.

---

# Table of Contents

- [0. Implementation Context](#0-implementation-context)
- [1. Executive Summary](#1-executive-summary)
- [2. Product Objective](#2-product-objective)
- [3. Goals and Non-Goals](#3-goals-and-non-goals)
- [4. Architecture Principles](#4-architecture-principles)
- [5. Source of Truth Rules](#5-source-of-truth-rules)
- [6. Wiring Phases](#6-wiring-phases)
- [7. Required Schema Additions](#7-required-schema-additions)
- [8. Status and State Model](#8-status-and-state-model)
- [9. Posting Orchestrator Requirements](#9-posting-orchestrator-requirements)
- [10. Order Payment Wiring](#10-order-payment-wiring)
- [11. Cash Drawer Wiring](#11-cash-drawer-wiring)
- [12. Customer Advance Wiring](#12-customer-advance-wiring)
- [13. Wallet Top-Up Wiring](#13-wallet-top-up-wiring)
- [14. Gift Card Sale Wiring](#14-gift-card-sale-wiring)
- [15. Credit Note Wiring](#15-credit-note-wiring)
- [16. Invoice Collection Wiring](#16-invoice-collection-wiring)
- [17. Refund Wiring](#17-refund-wiring)
- [18. Expense and Outgoing Payment Wiring](#18-expense-and-outgoing-payment-wiring)
- [19. Gateway Payment Wiring](#19-gateway-payment-wiring)
- [20. Reversal Wiring](#20-reversal-wiring)
- [21. Linked Effects API and UI](#21-linked-effects-api-and-ui)
- [22. Reconciliation Requirements](#22-reconciliation-requirements)
- [23. Backend Service Requirements](#23-backend-service-requirements)
- [24. API Requirements](#24-api-requirements)
- [25. UI/UX Requirements](#25-uiux-requirements)
- [26. RBAC and Security](#26-rbac-and-security)
- [27. Idempotency and Transaction Safety](#27-idempotency-and-transaction-safety)
- [28. Migration and Legacy Compatibility](#28-migration-and-legacy-compatibility)
- [29. Reporting Requirements](#29-reporting-requirements)
- [30. Testing Strategy](#30-testing-strategy)
- [31. Acceptance Criteria](#31-acceptance-criteria)
- [32. Implementation Checklist](#32-implementation-checklist)
- [33. Final Product Decision](#33-final-product-decision)

---

# 0. Implementation Context

Business Voucher foundation and Order Fin foundation are already implemented. This PRD assumes these capabilities already exist:

```text
Business Voucher:
- voucher header and transaction line tables
- voucher line status and wiring_status
- voucher create/list/detail/post/cancel/reverse behavior
- voucher UI and permissions

Order Fin:
- order financial snapshot
- canonical uppercase payment_status handling with legacy normalization
- order payment rows
- order credit application rows
- order refund rows
- partial later collection allowed by default
- gift card/wallet/advance/credit note separated from discount
```

This PRD moves the system from:

```text
voucher document-only posting
```

to:

```text
voucher posting with operational effects/projections.
```

## 0.1 Required Update in v2.1

This PRD is now aligned with the finalized Submit Order flow.

Immediate implementation must include:

```text
ORDER_PAYMENT → org_order_payments_dtl
ORDER_CREDIT_APPLICATION → org_order_credit_apps_dtl
CASH ORDER_PAYMENT → org_cash_drawer_movements_dtl
```

This is now called:

```text
Wiring Phase 1A — Order Submit Critical Wiring
```

`ORDER_CREDIT_APPLICATION` cannot be deferred if Submit Order supports gift card, wallet, customer advance, credit note, customer credit, or loyalty value legs.


---

# 1. Executive Summary

The Business Voucher Wiring Layer connects voucher transaction lines to operational modules.

Central rule:

```text
org_fin_voucher_trx_lines_dtl is the business-finance source document line.
Operational tables are module-specific effects, ledgers, projections, or summaries linked back to that voucher line.
```

Examples:

```text
ORDER_PAYMENT voucher line
→ creates org_order_payments_dtl
→ recalculates order paid/outstanding
→ creates cash drawer movement if payment_method_code = CASH

ORDER_CREDIT_APPLICATION voucher line
→ creates org_order_credit_apps_dtl
→ recalculates order credit_applied/outstanding
→ does not create org_order_payments_dtl
→ does not increase total_paid_amount

CUSTOMER_ADVANCE_RECEIPT voucher line
→ creates org_advance_txn_dtl

WALLET_TOPUP voucher line
→ creates org_wallet_txn_dtl

GIFT_CARD_SALE voucher line
→ creates org_gift_card_txn_dtl

ORDER_REFUND voucher line
→ creates org_order_refunds_dtl
→ reverses cash/stored-value/gateway effects where applicable

EXPENSE_PAYMENT voucher line
→ creates expense/outgoing payment projection if available
→ creates cash drawer OUT movement if payment_method_code = CASH
```

Traceability chain:

```text
Voucher → Voucher Line → Operational Effect → Reconciliation
```

---

# 2. Product Objective

After this wiring implementation, when an authorized user posts a voucher:

```text
the voucher becomes final,
its transaction lines become final,
each applicable line creates the correct operational effect exactly once,
and all effects can be traced back to the voucher line.
```

Users must be able to open a voucher and see:

```text
what each line did,
which operational records were created,
whether reconciliation passed,
and what will be reversed if reversal is requested.
```

---

# 3. Goals and Non-Goals

## 3.1 Goals

```text
1. Wire voucher lines to operational modules in controlled phases.
2. Preserve voucher lines as source-document evidence.
3. Create operational effects idempotently.
4. Recalculate affected operational snapshots.
5. Expose linked effects in UI and APIs.
6. Support order payments, cash drawer, advances, wallet, gift cards, credit notes, invoices, refunds, and expenses.
7. Enforce gateway confirmation policy.
8. Enforce refund lineage policy.
9. Provide reconciliation checks.
10. Avoid expanding org_payments_dtl_tr.
```

## 3.2 Non-Goals

```text
Full ERP Lite
Full GL posting
AP purchase invoice lifecycle
bank reconciliation
supplier aging
payroll
inventory costing
full tax filing
settlement header/leg persistence
```

Expense and supplier-payment wiring in this phase is business-payment recording only, not full AP.

---

# 4. Architecture Principles

## 4.1 Voucher Line First

```text
Every operational effect created during posting must originate from one voucher transaction line.
```

## 4.1.1 Submit Order Non-Duplication Rule

When Business Voucher wiring is active, Submit Order must not directly create these effect rows as independent writes:

```text
org_order_payments_dtl
org_order_credit_apps_dtl
org_cash_drawer_movements_dtl
```

Submit Order must create:

```text
settlement plan
receipt voucher header
voucher transaction lines
```

Voucher wiring must create:

```text
ORDER_PAYMENT → org_order_payments_dtl
ORDER_CREDIT_APPLICATION → org_order_credit_apps_dtl
CASH ORDER_PAYMENT → org_cash_drawer_movements_dtl
```

This prevents duplicate effects, incorrect order paid/outstanding amounts, and reconciliation failures.


## 4.2 Operational Effect Second

Operational tables remain responsible for module-specific facts:

```text
order payment
cash drawer movement
wallet ledger
advance ledger
gift card ledger
credit note ledger
invoice payment
refund record
expense projection
```

## 4.3 Bidirectional Traceability

Every operational effect must link back to:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

The voucher line must show linked effects through explicit IDs or linked-effects query.

## 4.4 No Duplicate Effects

One voucher line must not create the same operational effect twice.

Enforce through:

```text
unique operational effect per fin_voucher_trx_line_id where applicable
idempotency keys
transaction boundary
reconciliation checks
```

## 4.5 Phased Wiring

Approved implementation sequence:

```text
Wiring Phase 1A: Order payment + order credit application + cash drawer
Wiring Phase 2: Customer advance + wallet + gift card + credit note standalone ledgers
Wiring Phase 3: Full AR invoice collection + refunds
Wiring Phase 4: Expense/outgoing payment projections
Wiring Phase 5: Legacy org_payments_dtl_tr backfill/compatibility
```

---

# 5. Source of Truth Rules

## 5.1 Voucher Source Document

For business-finance document evidence:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
```

are authoritative.

## 5.2 Order Fin Source

For order-specific operational financial view:

```text
org_orders_mst
org_order_payments_dtl
org_order_credit_apps_dtl
org_order_refunds_dtl
```

are authoritative.

## 5.3 Cash Control Source

For physical cash control:

```text
org_cash_drawer_movements_dtl
```

is authoritative.

## 5.4 Stored-Value Ledger Source

For balances:

```text
org_wallet_txn_dtl
org_advance_txn_dtl
org_gift_card_txn_dtl
org_credit_note_txn_dtl
```

are authoritative.

## 5.5 Reconciliation Rule

Voucher line amount and operational effect amount must reconcile according to line role.

Examples:

```text
ORDER_PAYMENT voucher line amount = linked org_order_payments_dtl amount
cash drawer movement amount = voucher line amount, not tendered_amount
```

---

# 6. Wiring Phases

## 6.1 Phase 1A — Order Submit Critical Wiring

Wire:

```text
ORDER_PAYMENT
ORDER_CREDIT_APPLICATION
CASH movement for IN/OUT voucher lines
```

Targets:

```text
org_order_payments_dtl
org_order_credit_apps_dtl
org_cash_drawer_movements_dtl
```

Phase 1A is the minimum production scope for Submit Order if the order screen supports:

```text
cash/card/bank/check/gateway payments
gift card
wallet
customer advance
credit note
customer credit
loyalty value
```

If `ORDER_CREDIT_APPLICATION` is not implemented, Submit Order must reject credit/stored-value legs until the handler is available.
```

## 6.2 Phase 2 — Stored Value

Wire:

```text
CUSTOMER_ADVANCE_RECEIPT
WALLET_TOPUP
GIFT_CARD_SALE
CREDIT_NOTE_ISSUE / CREDIT_NOTE_SETTLEMENT if implemented
```

Targets:

```text
org_advance_txn_dtl
org_wallet_txn_dtl
org_gift_card_txn_dtl
org_credit_note_txn_dtl
```

## 6.3 Phase 3 — Invoice and Refunds

Wire:

```text
INVOICE_PAYMENT
ORDER_REFUND
CUSTOMER_REFUND
INVOICE_REFUND
```

Targets:

```text
invoice payment projection
org_order_refunds_dtl
refund projection
cash drawer refund movement
gateway refund update
stored-value reversal ledgers
```

## 6.4 Phase 4 — Expenses and Outgoing Payments

Wire:

```text
EXPENSE_PAYMENT
SUPPLIER_PAYMENT
SHOP_RENT_PAYMENT
UTILITY_PAYMENT
PETTY_CASH_ISSUE
EMPLOYEE_ADVANCE_PAYMENT
BANK_FEE
GATEWAY_FEE
```

Targets:

```text
expense payment projection if implemented
cash drawer OUT movement if CASH
employee advance ledger if implemented
supplier account projection if implemented
```

## 6.5 Phase 5 — Legacy Backfill

Backfill:

```text
org_payments_dtl_tr → org_fin_voucher_trx_lines_dtl
```

and optionally create compatibility views.

---

# 7. Required Schema Additions

## 7.1 Phase 1A Links

```text
org_order_payments_dtl.fin_voucher_id
org_order_payments_dtl.fin_voucher_trx_line_id

org_order_credit_apps_dtl.fin_voucher_id
org_order_credit_apps_dtl.fin_voucher_trx_line_id

org_cash_drawer_movements_dtl.fin_voucher_id
org_cash_drawer_movements_dtl.fin_voucher_trx_line_id
```

Recommended Phase 1A uniqueness rules, after checking existing data:

```text
unique org_order_payments_dtl.fin_voucher_trx_line_id where not null
unique org_order_credit_apps_dtl.fin_voucher_trx_line_id where not null
unique org_cash_drawer_movements_dtl(fin_voucher_trx_line_id, movement_type) where fin_voucher_trx_line_id is not null
```


## 7.2 Phase 2 Links

```text
org_wallet_txn_dtl.source_voucher_id
org_wallet_txn_dtl.source_voucher_trx_line_id

org_advance_txn_dtl.source_voucher_id
org_advance_txn_dtl.source_voucher_trx_line_id

org_gift_card_txn_dtl.source_voucher_id
org_gift_card_txn_dtl.source_voucher_trx_line_id

org_credit_note_txn_dtl.source_voucher_id
org_credit_note_txn_dtl.source_voucher_trx_line_id
```

## 7.3 Phase 3 Links

```text
invoice payment table.fin_voucher_id
invoice payment table.fin_voucher_trx_line_id

org_order_refunds_dtl.fin_voucher_id
org_order_refunds_dtl.fin_voucher_trx_line_id
org_order_refunds_dtl.original_fin_voucher_trx_line_id
```

## 7.4 Phase 4 Links

```text
expense payment projection.fin_voucher_id
expense payment projection.fin_voucher_trx_line_id
```

## 7.5 Unique Constraints

Where one voucher line creates one operational effect:

```text
unique(fin_voucher_trx_line_id)
```

Examples:

```text
org_order_payments_dtl
org_order_credit_apps_dtl
org_wallet_txn_dtl
org_advance_txn_dtl
org_gift_card_txn_dtl
```

For cash drawer movements:

```text
unique(fin_voucher_trx_line_id, movement_type)
```

or equivalent, because future reversal/contra patterns may need separate movement types.

---

# 8. Status and State Model

## 8.1 Voucher Header

```text
DRAFT
POSTED
CANCELLED
REVERSED
PARTIALLY_REVERSED
```

## 8.2 Accounting Posting Status

Business wiring does not mean GL posting.

Use:

```text
posting_status = NOT_POSTED
```

unless actual GL posting exists.

## 8.3 Voucher Line Status

```text
DRAFT
POSTED
CANCELLED
REVERSED
FAILED
```

## 8.4 Wiring Status

```text
NOT_WIRED
WIRED
PARTIALLY_WIRED
FAILED
REVERSED
```

## 8.5 Order-Level Payment Status

Use approved uppercase canonical statuses:

```text
UNPAID
PENDING_COLLECTION
PARTIALLY_PAID
PAID
OVERPAID
REFUND_PENDING
PARTIALLY_REFUNDED
REFUNDED
CANCELLED
FAILED
```

## 8.6 Payment-Row Status

Use payment-row lifecycle:

```text
PENDING
PROCESSING
AUTHORIZED
COMPLETED
FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 9. Posting Orchestrator Requirements

## 9.1 Posting Steps with Wiring

```text
1. Begin DB transaction.
2. Lock voucher header.
3. Validate voucher can be posted.
4. Load active voucher lines.
5. Validate all line role/target requirements.
6. Validate payment method requirements.
7. Validate cash drawer session requirements.
8. Recalculate voucher totals.
9. Set voucher header status to POSTED.
10. Set line_status = POSTED for active lines.
11. Dispatch line to wiring handlers.
12. Create operational effects idempotently.
13. Recalculate affected operational snapshots.
14. Mark voucher line wiring_status.
15. Write outbox/audit records.
16. Run or queue reconciliation.
17. Commit transaction.
```

## 9.2 Failure Rule

Default strict V1 mode:

```text
If any required operational effect fails, rollback the entire posting.
```

Optional partial wiring mode is not approved for V1 unless explicitly required.

## 9.3 Handler Selection

Handler selection uses:

```text
line_role
target_type
direction
payment_method_code
gateway_code
```

A single line may trigger multiple handlers.

Example:

```text
ORDER_PAYMENT + CASH
→ order payment handler
→ cash drawer handler
```

---

# 10. Order Payment Wiring

## 10.1 Trigger

```text
line_role = ORDER_PAYMENT
target_type = ORDER
order_id is not null
direction = IN
line_status = POSTED
```

## 10.2 Effect

Create:

```text
org_order_payments_dtl
```

## 10.3 Mapping

| Voucher Line | Order Payment |
|---|---|
| `tenant_org_id` | `tenant_org_id` |
| `branch_id` | `branch_id` |
| `order_id` | `order_id` |
| `customer_id` | `customer_id` |
| `payment_method_code` | `payment_method_code` |
| `org_payment_method_id` | `org_payment_method_id` |
| `amount` | `amount` |
| `currency_code` | `currency_code` |
| `paid_at` | `paid_at` |
| `received_by` | `received_by` |
| `cash_drawer_session_id` | `cash_drawer_session_id` |
| `payment_terminal_id` | `payment_terminal_id` |
| `gateway_code` | gateway field if exists |
| `gateway_reference` | `gateway_reference` |
| `bank_reference` | `bank_reference` |
| `check_number` | `check_number` |
| `card_brand_code` | `card_brand_code` |
| `card_last4` | `card_last4` |
| `voucher_id` | `fin_voucher_id` |
| `id` | `fin_voucher_trx_line_id` |

## 10.4 Payment Status Rule

```text
CASH → COMPLETED
CARD terminal → COMPLETED only if terminal/provider confirms
BANK_TRANSFER → PENDING unless manually verified
CHECK → PENDING or RECEIVED/COMPLETED based on tenant policy
GATEWAY → PENDING / PROCESSING until provider confirms
```

Only completed real payments increase:

```text
total_paid_amount
```

## 10.5 Partial Later Collection Rule

Later collection can be partial by default.

Resolution:

```text
1. default allowed
2. tenant setting override if configured
3. branch override later
```

If collection amount is less than outstanding:

```text
create payment row
reduce outstanding
keep order payment_status = PARTIALLY_PAID or PENDING_COLLECTION
```

Order becomes:

```text
PAID
```

only when outstanding reaches zero.

## 10.6 Acceptance Criteria

```text
[ ] ORDER_PAYMENT creates exactly one order payment row.
[ ] Payment row links to voucher line.
[ ] Gateway order payment remains pending until confirmed.
[ ] Completed payment recalculates total_paid_amount and outstanding.
[ ] Duplicate posting does not duplicate payment row.
[ ] Partial collection is allowed by default.
```

---

# 10A. Order Credit Application Wiring

## 10A.1 Trigger

```text
line_role = ORDER_CREDIT_APPLICATION
target_type = ORDER
order_id is not null
direction = NEUTRAL
line_status = POSTED
```

## 10A.2 Effect

Create:

```text
org_order_credit_apps_dtl
```

This table records non-real-payment value applied to reduce the order outstanding amount.

Examples:

```text
GIFT_CARD
WALLET
CUSTOMER_ADVANCE
CREDIT_NOTE
CUSTOMER_CREDIT
LOYALTY_VALUE
MANUAL_CREDIT
```

## 10A.3 Mapping

| Voucher Line | Order Credit Application |
|---|---|
| `tenant_org_id` | `tenant_org_id` |
| `branch_id` | `branch_id` |
| `order_id` | `order_id` |
| `customer_id` | `customer_id` |
| `metadata.credit_type` or `credit_type` | `credit_type` |
| `source_table` | `source_table` |
| `source_id` | `source_id` |
| `amount` | `amount` |
| `currency_code` | `currency_code` |
| `currency_ex_rate` | `currency_ex_rate` |
| `applied_at` | `applied_at` |
| `applied_by` | `applied_by` |
| `voucher_id` | `fin_voucher_id` |
| `id` | `fin_voucher_trx_line_id` |

## 10A.4 Business Rules

```text
ORDER_CREDIT_APPLICATION does not create org_order_payments_dtl.
ORDER_CREDIT_APPLICATION does not increase total_paid_amount.
ORDER_CREDIT_APPLICATION increases total_credit_applied_amount.
ORDER_CREDIT_APPLICATION reduces outstanding_amount.
ORDER_CREDIT_APPLICATION is not a discount.
ORDER_CREDIT_APPLICATION must validate source balance before applying.
```

## 10A.5 Source Balance Rules

Before creating the effect row, validate:

```text
gift card balance is enough
wallet balance is enough
customer advance balance is enough
credit note balance is enough
customer credit balance is enough
source belongs to same tenant/customer unless policy explicitly allows transfer
source is active and usable
```

## 10A.6 Acceptance Criteria

```text
[ ] ORDER_CREDIT_APPLICATION creates exactly one order credit application row.
[ ] Credit application row links to voucher line.
[ ] Credit application does not create order payment row.
[ ] Credit application does not appear in discounts.
[ ] Credit application recalculates total_credit_applied_amount and outstanding.
[ ] Duplicate posting does not duplicate credit application row.
```

---

# 11. Cash Drawer Wiring

## 11.1 Trigger

```text
payment_method_code = CASH
cash_drawer_session_id is not null
line_status = POSTED
direction in IN, OUT
```

## 11.2 Effect

Create:

```text
org_cash_drawer_movements_dtl
```

## 11.3 Movement Mapping

| Voucher Line Context | Movement Type |
|---|---|
| `ORDER_PAYMENT`, `IN` | `CASH_SALE` |
| `CUSTOMER_ADVANCE_RECEIPT`, `IN` | `CASH_IN` or `ADVANCE_RECEIPT` |
| `WALLET_TOPUP`, `IN` | `CASH_IN` or `WALLET_TOPUP` |
| `GIFT_CARD_SALE`, `IN` | `CASH_IN` or `GIFT_CARD_SALE` |
| `CUSTOMER_REFUND`, `OUT` | `CASH_REFUND` |
| `ORDER_REFUND`, `OUT` | `CASH_REFUND` |
| `PETTY_CASH_ISSUE`, `OUT` | `CASH_OUT` |
| `EXPENSE_PAYMENT`, `OUT` | `CASH_OUT` |
| `SHOP_RENT_PAYMENT`, `OUT` | `CASH_OUT` |
| `UTILITY_PAYMENT`, `OUT` | `CASH_OUT` |

## 11.4 Retained Cash Rule

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
cash drawer movement amount = 7.500
```

## 11.5 Drawer Session Rule

If cash drawer is required:

```text
cash_drawer_session_id is required
session must be open
session must belong to tenant/branch/user scope
```

## 11.6 Acceptance Criteria

```text
[ ] Cash IN line creates cash drawer IN movement.
[ ] Cash OUT line creates cash drawer OUT movement.
[ ] Tendered/change does not inflate movement amount.
[ ] Closed drawer session is rejected.
[ ] Duplicate posting does not duplicate cash movement.
```

---

# 12. Customer Advance Wiring

## 12.1 Trigger

```text
line_role = CUSTOMER_ADVANCE_RECEIPT
target_type = CUSTOMER_ADVANCE
direction = IN
customer_id is not null
line_status = POSTED
```

## 12.2 Effect

Create:

```text
org_advance_txn_dtl
```

## 12.3 Mapping

```text
txn_type = RECEIVE_ADVANCE
amount = line.amount
customer_id = line.customer_id
source_voucher_id = voucher.id
source_voucher_trx_line_id = line.id
```

## 12.4 Rules

```text
Advance receipt increases customer advance balance.
No org_order_payments_dtl is created.
If cash, cash drawer movement is also created.
```

## 12.5 Acceptance Criteria

```text
[ ] Advance ledger row is created.
[ ] Balance increases.
[ ] Voucher line links to advance transaction.
[ ] No order payment row is created.
```

---

# 13. Wallet Top-Up Wiring

## 13.1 Trigger

```text
line_role = WALLET_TOPUP
target_type = WALLET
direction = IN
customer_id is not null
line_status = POSTED
```

## 13.2 Effect

Create:

```text
org_wallet_txn_dtl
```

## 13.3 Mapping

```text
txn_type = TOP_UP
amount = line.amount
customer_id = line.customer_id
source_voucher_id = voucher.id
source_voucher_trx_line_id = line.id
```

## 13.4 Rules

```text
Wallet top-up increases wallet balance.
No org_order_payments_dtl is created.
If cash, cash drawer movement is also created.
```

## 13.5 Acceptance Criteria

```text
[ ] Wallet ledger row is created.
[ ] Wallet balance increases.
[ ] Voucher line links to wallet transaction.
[ ] No order payment row is created.
```

---

# 14. Gift Card Sale Wiring

## 14.1 Trigger

```text
line_role = GIFT_CARD_SALE
target_type = GIFT_CARD
direction = IN
gift_card_id is not null
line_status = POSTED
```

## 14.2 Effect

Create/update:

```text
org_gift_card_txn_dtl
```

## 14.3 Mapping

```text
txn_type = ISSUE / ACTIVATE / TOP_UP depending lifecycle
amount = line.amount
gift_card_id = line.gift_card_id
source_voucher_id = voucher.id
source_voucher_trx_line_id = line.id
```

## 14.4 Rules

```text
Gift card sale creates stored value/liability.
Gift card sale is not order revenue.
Gift card sale is not discount.
No org_order_payments_dtl is created unless there is a separate ORDER_PAYMENT line.
If cash, cash drawer movement is also created.
```

## 14.5 Acceptance Criteria

```text
[ ] Gift card transaction is created.
[ ] Gift card status/balance updates correctly.
[ ] Voucher line links to gift card effect.
[ ] Gift card sale is not written as discount.
```

---

# 15. Credit Note Wiring

## 15.1 Trigger

Possible approved roles:

```text
CREDIT_NOTE_ISSUE
CREDIT_NOTE_SETTLEMENT
CUSTOMER_REFUND_TO_CREDIT_NOTE
```

## 15.2 Effect

Create:

```text
org_credit_note_txn_dtl
```

## 15.3 Rules

```text
Credit note issuance creates customer credit.
Credit note application to an order is a credit application, not a real payment.
Refund to credit note requires original source lineage if available.
```

## 15.4 Acceptance Criteria

```text
[ ] Credit note ledger row is created.
[ ] Credit note balance updates.
[ ] Voucher line links to credit note transaction.
```

---

# 16. Invoice Collection Wiring

## 16.1 Trigger

```text
line_role = INVOICE_PAYMENT
target_type = INVOICE
invoice_id is not null
direction = IN
line_status = POSTED
```

## 16.2 Effect

Create/update full AR invoice payment records:

```text
org_invoice_payments_dtl
org_customer_ar_ledger_dtl
org_invoice_mst.paid_amount
org_invoice_mst.outstanding_amount
org_invoice_mst.status
```

Recommended AR movement:

```text
movement_type = INVOICE_PAYMENT
credit_amount = paid amount
voucher_id = receipt voucher id
voucher_trx_line_id = receipt voucher line id
```

If invoice collection is allocated to underlying orders, then additional allocation/projection can be created later.

## 16.3 Rules

```text
Invoice payment does not automatically create org_order_payments_dtl.
Invoice payment creates org_invoice_payments_dtl and AR ledger movements.
Only create order payment projections if explicit order allocation exists.
If the invoice is linked to orders, update order invoice/settlement status only through approved allocation logic.
```

## 16.4 Acceptance Criteria

```text
[ ] Invoice paid/outstanding updates.
[ ] Voucher line links to invoice payment projection.
[ ] No order payment row is created unless explicitly allocated.
```

---

# 17. Refund Wiring

## 17.1 Trigger

```text
voucher_type = REFUND_VOUCHER
line_type = REFUND
direction = OUT
line_role in CUSTOMER_REFUND, ORDER_REFUND, INVOICE_REFUND
line_status = POSTED
```

## 17.2 Required References

For normal refund:

```text
original_payment_id
```

or:

```text
original_credit_app_id
```

or future:

```text
original_fin_voucher_trx_line_id / reversed_line_id
```

Manual exception refund requires:

```text
orders:refunds:manual_exception
mandatory reason
audit record
```

## 17.3 Effect

Depending on target:

```text
org_order_refunds_dtl
invoice refund projection
cash drawer OUT movement
gateway refund request/status
wallet/advance/gift/card/credit-note reversal
```

## 17.4 Rules

```text
Refund cannot exceed refundable amount.
Refund does not delete original payment/credit line.
Refund creates new OUT voucher line.
Cash refund requires open cash drawer if configured.
Gateway refund remains PENDING until provider confirms.
```

## 17.5 Acceptance Criteria

```text
[ ] Refund creates refund projection.
[ ] Refund references original source where available.
[ ] Manual exception refund requires permission.
[ ] Cash refund creates cash drawer OUT movement.
[ ] Gateway refund does not complete until provider confirms.
```

---

# 18. Expense and Outgoing Payment Wiring

## 18.1 Trigger

```text
direction = OUT
line_type in PAYMENT, EXPENSE, FEE
line_role in SUPPLIER_PAYMENT, EXPENSE_PAYMENT, SHOP_RENT_PAYMENT, UTILITY_PAYMENT, EMPLOYEE_ADVANCE_PAYMENT, PETTY_CASH_ISSUE, BANK_FEE, GATEWAY_FEE
line_status = POSTED
```

## 18.2 Effect

Depending on implemented modules:

```text
expense payment projection
cash drawer OUT movement for cash
employee advance ledger
supplier account projection
bank/gateway fee report
```

## 18.3 Rules

```text
Expense line requires expense_category_code when target_type = EXPENSE.
Supplier payment requires supplier_id or party_name.
Employee advance/petty cash requires employee_id or party_name.
Cash outgoing line creates cash drawer OUT movement if cash drawer is used.
This is not full AP.
This is not GL posting.
```

## 18.4 Acceptance Criteria

```text
[ ] Expense voucher records outgoing payment.
[ ] Rent/utilities/supplier/petty cash roles work.
[ ] Cash outgoing line creates cash drawer OUT movement.
[ ] No AP/GL side effects are created.
```

---

# 19. Gateway Payment Wiring

## 19.1 Gateway Line Creation

Gateway-capable lines must start as:

```text
payment_status = PENDING / PROCESSING
line_status = POSTED or PENDING depending current module model
wiring_status = PARTIALLY_WIRED or WIRED_PENDING_CONFIRMATION if supported
```

If `WIRED_PENDING_CONFIRMATION` does not exist, use:

```text
wiring_status = WIRED
payment_status = PENDING / PROCESSING
```

and rely on payment_status for external provider lifecycle.

## 19.2 Completion Path

Gateway completion requires one of:

```text
provider webhook
provider lookup
approved manual verification
```

## 19.3 Rules

```text
Gateway line does not increase completed paid amount until confirmed.
Failed gateway line does not reduce outstanding.
Cancelled gateway line does not reduce outstanding.
Authorized but not captured does not count as completed unless tenant/provider policy says authorization equals capture.
```

## 19.4 Required API/Event

Use existing gateway route if implemented, otherwise add:

```text
POST /api/v1/payments/gateways/[gateway]/webhook
POST /api/v1/finance/voucher-lines/[lineId]/confirm-gateway-payment
```

## 19.5 Acceptance Criteria

```text
[ ] Gateway payment starts pending/processing.
[ ] Provider confirmation updates payment row to COMPLETED.
[ ] Paid/outstanding recalculates after confirmation.
[ ] Failed callback keeps outstanding open.
```

---

# 20. Reversal Wiring

## 20.1 Reversal Source

A reversal must reference:

```text
reversed_line_id
```

or:

```text
original_fin_voucher_trx_line_id
```

## 20.2 Reversal Effect Matrix

| Original Effect | Reversal Effect |
|---|---|
| order payment | order refund/reversal projection |
| cash drawer IN | cash drawer OUT |
| cash drawer OUT | cash drawer IN / reversal movement |
| wallet top-up | wallet debit/reversal |
| advance receipt | advance debit/reversal |
| gift card sale | gift card void/reversal if allowed |
| credit note issue | credit note reversal |
| invoice payment | invoice payment reversal |
| expense payment | contra expense/reversal projection |

## 20.3 Rules

```text
Original line remains immutable.
Reversal line records opposite business effect.
Operational effects are reversed, not deleted.
```

---

# 21. Linked Effects API and UI

## 21.1 Linked Effects API

Required:

```text
GET /api/v1/finance/vouchers/[voucherId]/linked-effects
GET /api/v1/finance/voucher-lines/[lineId]/linked-effects
```

Response example:

```json
{
  "voucherId": "uuid",
  "lineId": "uuid",
  "wiringStatus": "WIRED",
  "reconciliationStatus": "PASSED",
  "effects": [
    {
      "effectType": "ORDER_PAYMENT",
      "tableName": "org_order_payments_dtl",
      "recordId": "uuid",
      "amount": "10.000",
      "status": "COMPLETED"
    }
  ]
}
```

## 21.2 UI Panel

Voucher detail should show:

```text
Linked Effects
Wiring Status
Reconciliation Status
Effect Type
Effect Record
Amount
Status
Created At
Error if failed
```

## 21.3 Posting Preview

Before posting, show expected effects:

```text
This voucher will create:
- 1 order payment
- 1 cash drawer movement
```

## 21.4 Reversal Preview

Before reversal, show reversal effects:

```text
This reversal will:
- create order refund projection
- create cash drawer OUT movement
```

---

# 22. Reconciliation Requirements

## 22.1 Required Checks

```text
VOUCHER_TOTAL_EQUALS_LINES
ORDER_PAYMENT_LINK_EXISTS
ORDER_PAYMENT_AMOUNT_MATCHES_LINE
CASH_MOVEMENT_LINK_EXISTS
CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT
WALLET_LEDGER_LINK_EXISTS
ADVANCE_LEDGER_LINK_EXISTS
GIFT_CARD_LEDGER_LINK_EXISTS
CREDIT_NOTE_LEDGER_LINK_EXISTS
INVOICE_PAYMENT_LINK_EXISTS
REFUND_LINK_EXISTS
EXPENSE_PROJECTION_LINK_EXISTS
NO_DUPLICATE_OPERATIONAL_EFFECT
GATEWAY_STATE_VALID
ORDER_CREDIT_APPLICATION_LINK_EXISTS
ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE
ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS
ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS
PIECE_EXTRA_PRICE_INCLUDED_ONCE
PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE
ORDER_PIECES_MATCH_CHARGES
ORDER_PREFERENCES_MATCH_CHARGES
ORDER_CHARGES_MATCH_SNAPSHOT
```

## 22.2 Reconciliation Status

```text
PENDING
PASSED
FAILED
WARNING
```

## 22.3 Reconciliation Behavior

```text
Run after posting.
Run after reversal.
Allow manual rerun from UI.
Do not auto-correct in V1.
Report exceptions clearly.
```

---

# 23. Backend Service Requirements

## 23.1 Required Services

```text
voucher-posting-orchestrator.service.ts
voucher-line-wiring.service.ts
voucher-order-payment-wiring.service.ts
voucher-order-credit-application-wiring.service.ts
voucher-cash-drawer-wiring.service.ts
voucher-stored-value-wiring.service.ts
voucher-invoice-wiring.service.ts
voucher-refund-wiring.service.ts
voucher-expense-wiring.service.ts
voucher-gateway-confirmation.service.ts
voucher-reversal-wiring.service.ts
voucher-reconciliation.service.ts
voucher-linked-effects.service.ts
```

## 23.2 Orchestrator Responsibilities

```text
validate voucher
post voucher
dispatch line handlers
create effects transactionally
mark wiring status
write audit/outbox
trigger reconciliation
```

## 23.3 Handler Contract

Each handler must implement:

```text
canHandle(line)
validate(line)
wire(line, tx)
reverse(line, tx)
getLinkedEffect(line)
reconcile(line)
```

---

# 24. API Requirements

## 24.1 Posting

```text
POST /api/v1/finance/vouchers/[voucherId]/post
```

Request example:

```json
{
  "mode": "WIRE_OPERATIONAL_EFFECTS",
  "idempotencyKey": "string"
}
```

## 24.2 Linked Effects

```text
GET /api/v1/finance/vouchers/[voucherId]/linked-effects
GET /api/v1/finance/voucher-lines/[lineId]/linked-effects
```

## 24.3 Reconciliation

```text
POST /api/v1/finance/vouchers/[voucherId]/reconcile
GET  /api/v1/finance/vouchers/[voucherId]/reconciliation
```

## 24.4 Reversal

```text
POST /api/v1/finance/vouchers/[voucherId]/reverse
POST /api/v1/finance/voucher-lines/[lineId]/reverse
```

## 24.5 Gateway Confirmation

```text
POST /api/v1/finance/voucher-lines/[lineId]/confirm-gateway-payment
```

or existing gateway webhook route.

---

# 25. UI/UX Requirements

## 25.1 Posting Preview

Before posting a voucher, show:

```text
voucher lines
expected effects
cash drawer impact
order impact
stored-value impact
gateway pending states
warnings
```

## 25.2 Linked Effects Panel

Show per line:

```text
effect type
effect table
effect record
status
amount
created time
reconciliation result
```

## 25.3 Error UX

If wiring fails:

```text
show failed line
show error message
show no partial effects were committed
allow retry after correction
```

## 25.4 Gateway UX

Gateway lines should clearly show:

```text
PENDING
PROCESSING
AUTHORIZED
COMPLETED
FAILED
CANCELLED
```

## 25.5 Reversal UX

Show before reversal:

```text
original line
linked effects to reverse
resulting reversal effects
permission requirements
```

---

# 26. RBAC and Security

Required permissions:

```text
finance:vouchers:post
finance:vouchers:reverse
finance:vouchers:reconcile
finance:voucher_lines:reverse
finance:voucher_lines:confirm_gateway_payment
orders:refunds:manual_exception
```

Rules:

```text
cashier cannot post outgoing expense/supplier/petty cash vouchers unless explicitly allowed
manual exception refund requires orders:refunds:manual_exception
gateway confirmation requires finance/payment admin permission
reconciliation rerun requires finance role
```

---

# 27. Idempotency and Transaction Safety

## 27.1 Idempotency

Use:

```text
voucher posting idempotency key
voucher line id
unique effect constraints
```

## 27.2 Transaction Boundary

For strict V1:

```text
voucher post + operational effects must be in one transaction where possible
```

For external gateway callbacks:

```text
confirmation update is a separate idempotent transaction
```

## 27.3 Duplicate Prevention

Examples:

```text
org_order_payments_dtl unique(fin_voucher_trx_line_id)
org_cash_drawer_movements_dtl unique(fin_voucher_trx_line_id, movement_type)
wallet ledger unique(source_voucher_trx_line_id, txn_type)
```

---

# 28. Migration and Legacy Compatibility

## 28.1 Legacy Rule

Do not expand:

```text
org_payments_dtl_tr
```

## 28.2 Backfill Later

Backfill after new wiring is stable.

## 28.3 Backfill Mapping

| Legacy Field | New Voucher Line |
|---|---|
| `voucher_id` | `voucher_id` |
| `paid_amount` | `amount` |
| `payment_method_code` | `payment_method_code` |
| `order_id` | `target_type=ORDER`, `line_role=ORDER_PAYMENT` |
| `invoice_id` | `target_type=INVOICE`, `line_role=INVOICE_PAYMENT` |
| `customer_id` | `customer_id` |
| `gift_card_id` | `gift_card_id` |
| `cash_drawer_session_id` | `cash_drawer_session_id` |
| `gateway_reference` | `gateway_reference` |
| `bank_reference` | `bank_reference` |
| `check_number` | `check_number` |
| `idempotency_key` | `idempotency_key` |

## 28.4 Compatibility View

Optional:

```text
org_payments_dtl_tr_vw
```

only if old reports need old shape.

---

# 29. Reporting Requirements

Reports:

```text
voucher linked effects report
voucher reconciliation report
order payments by voucher line
cash drawer movements by voucher line
stored-value receipts by voucher line
refunds by voucher line
gateway pending confirmations
expense/outgoing payment vouchers
wiring failures report
```

---

# 30. Testing Strategy

## 30.1 Unit Tests

```text
handler selection
line validation
order payment mapping
order credit application mapping
cash movement mapping
stored value mapping
gateway pending/confirmed
refund lineage
reversal mapping
reconciliation checks
```

## 30.2 Integration Tests

```text
post order cash payment voucher
post order card/gateway payment voucher
post order gift card/wallet/advance/credit-note application voucher
post wallet top-up voucher
post customer advance voucher
post gift card sale voucher
post invoice collection voucher
post cash refund voucher
post expense cash-out voucher
reverse posted voucher
reconcile voucher effects
```

## 30.3 Regression Tests

```text
partial later collection still works
PAY_ON_COLLECTION default remains
gift card is not discount
gift card/wallet/advance/credit-note application creates org_order_credit_apps_dtl, not org_order_payments_dtl
gateway failed does not mark paid
manual exception refund permission enforced
payment config route/schema mismatch fixed
```

---

# 31. Acceptance Criteria

The wiring implementation is accepted when:

```text
1. Posting a wired voucher creates expected operational effects.
2. Each operational effect links to voucher header and voucher trx line.
3. Voucher linked-effects API returns created effects.
4. UI shows linked effects and reconciliation status.
5. Duplicate posting does not duplicate effects.
6. Cash movement amount equals retained amount.
7. Order payment rows respect gateway pending/confirmed policy.
8. ORDER_CREDIT_APPLICATION rows create org_order_credit_apps_dtl and do not create org_order_payments_dtl.
9. Partial later collection remains allowed by default.
10. Stored-value receipts create ledgers but not order payments.
11. Gift card sale is not discount.
12. Refunds preserve original lineage.
13. Manual exception refund requires explicit permission.
14. Reconciliation detects missing/duplicate/mismatched effects.
15. Legacy org_payments_dtl_tr is not expanded.
```

---

# 32. Implementation Checklist

## Phase 1A — Order Payment + Order Credit Application + Cash Drawer

**Status: COMPLETE — 2026-05-22**  
Migration 0318 + 0319 applied. Build passing clean. All handlers, orchestrator, and UI in production.

```text
[x] Add voucher links to org_order_payments_dtl.
    → fin_voucher_id, fin_voucher_trx_line_id added (migration 0303).
    → uq_ord_pay_vch_line sparse unique index on fin_voucher_trx_line_id.

[x] Add voucher links to org_order_credit_apps_dtl.
    → fin_voucher_id, fin_voucher_trx_line_id added (migration 0318).
    → uq_credit_app_vch_line sparse unique index on fin_voucher_trx_line_id.
    → idx_credit_app_fin_voucher index on fin_voucher_id.

[x] Add voucher links to org_cash_drawer_movements_dtl.
    → fin_voucher_id, fin_voucher_trx_line_id added (migration 0303).
    → uq_cd_mov_vch_line sparse unique index on fin_voucher_trx_line_id.

[x] Add unique constraints.
    → See above. All three operational tables have sparse unique constraints.

[x] Create order payment wiring handler.
    → lib/services/wiring/order-payment-wiring.handler.ts

[x] Create order credit application wiring handler.
    → lib/services/wiring/order-credit-application-wiring.handler.ts
    → Uses dedicated fin_voucher_id / fin_voucher_trx_line_id columns (not metadata).

[x] Create cash drawer wiring handler.
    → lib/services/wiring/cash-drawer-wiring.handler.ts
    → movement_type = CASH_SALE for ORDER_PAYMENT/IN.
    → Uses line.amount (not tendered_amount) per PRD §11.4.

[x] Update posting orchestrator.
    → lib/services/voucher-wiring.service.ts — postAndWireBizVoucher().
    → Atomic transaction: post + wire + outbox + audit.
    → POST /api/v1/finance/vouchers/[voucherId]/post updated to call postAndWireBizVoucher.

[x] Guard settlement service against double-write.
    → lib/services/order-settlement.service.ts — wiringMode?: boolean guard added.
    → Default false — all existing callers (create-with-payment, collect-payment) unaffected.
    → PENDING Phase 1B: Submit Order must pass wiringMode: true and route through voucher lines.

[ ] Update Submit Order to create voucher lines and not direct-write payment/credit rows.
    → DEFERRED to Phase 1B. create-with-payment still direct-writes via settleOrder().
    → wiringMode guard in place; integration requires Phase 1B work.

[x] Update linked effects API.
    → GET /api/v1/finance/vouchers/[voucherId]/linked-effects
    → GET /api/v1/finance/voucher-lines/[lineId]/linked-effects

[x] Update UI linked effects panel.
    → WiringStatusBadge, VoucherLinkedEffectsPanel, VoucherPostPreviewDialog components.
    → Wiring status column added to voucher line table.
    → Voucher detail page fetches and displays linked effects when POSTED.

[ ] Add unit / integration tests.
    → Not yet written. Covered by testing scenarios in BVM_WIRING_PHASE1A_GUIDE.md.
```

## Phase 1B — Submit Order Integration (Deferred)

**Status: NOT STARTED**

```text
[ ] create-with-payment route passes wiringMode: true to settleOrder().
[ ] settleOrder() skips direct writes to org_order_payments_dtl and org_order_credit_apps_dtl.
[ ] Submit Order builds settlement plan → creates receipt voucher header → creates voucher lines.
[ ] Voucher wiring path creates all operational effects.
[ ] End-to-end integration tests for order submit via voucher path.
[ ] Regression: existing direct-write path disabled once voucher path verified.
```

## Phase 2 — Stored Value

**Status: NOT STARTED**

```text
[ ] Add source_voucher_id, source_voucher_trx_line_id to org_advance_txn_dtl.
[ ] Add source_voucher_id, source_voucher_trx_line_id to org_wallet_txn_dtl.
[ ] Add source_voucher_id, source_voucher_trx_line_id to org_gift_card_txn_dtl.
[ ] Add source_voucher_id, source_voucher_trx_line_id to org_credit_note_txn_dtl.
[ ] Create customer-advance wiring handler (CUSTOMER_ADVANCE_RECEIPT → org_advance_txn_dtl).
[ ] Create wallet top-up wiring handler (WALLET_TOPUP → org_wallet_txn_dtl).
[ ] Create gift card sale wiring handler (GIFT_CARD_SALE → org_gift_card_txn_dtl).
[ ] Create credit note wiring handler.
[ ] Register handlers in WIRING_HANDLERS registry.
[ ] Extend linked effects API + UI panel for stored-value effects.
[ ] Add balance update tests.
[ ] Add no-order-payment tests for all stored-value roles.
```

## Phase 3 — Invoice + Refund

**Status: NOT STARTED**

```text
[ ] Add fin_voucher_id, fin_voucher_trx_line_id to invoice payment table.
[ ] Add fin_voucher_id, fin_voucher_trx_line_id, original_fin_voucher_trx_line_id to org_order_refunds_dtl.
[ ] Create invoice payment wiring handler (INVOICE_PAYMENT → org_invoice_payments_dtl + AR ledger).
[ ] Create refund wiring handler (ORDER_REFUND / CUSTOMER_REFUND → org_order_refunds_dtl).
[ ] Refund handler: cash drawer OUT, gateway reversal, stored-value reversal.
[ ] Add refund lineage validation (original_payment_id or original_credit_app_id required).
[ ] Add manual exception refund permission (orders:refunds:manual_exception).
[ ] Extend linked effects panel for invoice and refund effects.
[ ] Add refund lineage tests.
[ ] Gateway refund stays PENDING until provider confirms.
```

## Phase 4 — Expense / Outgoing Payments

**Status: NOT STARTED**

```text
[ ] Define expense payment projection table if not yet implemented.
[ ] Create expense/outgoing payment wiring handlers:
    EXPENSE_PAYMENT, SUPPLIER_PAYMENT, SHOP_RENT_PAYMENT, UTILITY_PAYMENT,
    PETTY_CASH_ISSUE, EMPLOYEE_ADVANCE_PAYMENT, BANK_FEE, GATEWAY_FEE.
[ ] Each CASH outgoing line creates cash drawer OUT movement (movement_type = CASH_OUT).
[ ] Add expense_category_code validation for EXPENSE target_type.
[ ] Add supplier_id / party_name validation for supplier payments.
[ ] Add cash OUT tests.
[ ] Confirm no AP/GL side effects.
```

## Phase 5 — Reconciliation and Backfill

**Status: NOT STARTED**

```text
[ ] Implement reconciliation check engine (all checks listed in §22.1).
[ ] POST /api/v1/finance/vouchers/[voucherId]/reconcile
[ ] GET  /api/v1/finance/vouchers/[voucherId]/reconciliation
[ ] Reconciliation status on voucher detail UI.
[ ] Allow manual rerun from UI.
[ ] Backfill org_payments_dtl_tr → org_fin_voucher_trx_lines_dtl (requires approval + data audit).
[ ] Create org_payments_dtl_tr_vw compatibility view if old reports require old shape.
```

---

# 33. Final Product Decision

CleanMateX will now move from Business Voucher foundation to Business Voucher operational wiring.

Approved wiring direction:

```text
Voucher line is the source document line.
Operational tables store module-specific effects.
All effects link back to voucher line.
Wiring happens in controlled phases.
```

Immediate recommended implementation:

```text
Wiring Phase 1A:
ORDER_PAYMENT + ORDER_CREDIT_APPLICATION + CASH_DRAWER
```

Do not start with all modules at once, but do not defer `ORDER_CREDIT_APPLICATION` if Submit Order supports gift card, wallet, customer advance, credit note, customer credit, or loyalty value legs.
