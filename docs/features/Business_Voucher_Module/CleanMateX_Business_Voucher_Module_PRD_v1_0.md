# CleanMateX Business Voucher Module — Full PRD

**Document Type:** Product Requirements Document (PRD)  
**Module:** Business Voucher Module  
**Version:** v1.0  
**Status:** Draft for Review  
**Project:** CleanMateX Business / SaaS Platform  
**Primary Scope:** Business finance vouchers for receipts, payments, refunds, adjustments, and transfers  
**Core Tables:** `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`  
**Related Future/Legacy Table:** `org_payments_dtl_tr` as legacy/migration source only  
**Related Operational Projection:** `org_order_payments_dtl`  
**Core Tables:**
- org_fin_vouchers_mst
- org_fin_voucher_trx_lines_dtl

Related Operational Projections / Ledgers:
- org_order_payments_dtl
- org_cash_drawer_movements_dtl
- org_wallet_txn_dtl
- org_advance_txn_dtl
- org_gift_card_txn_dtl
- org_credit_note_txn_dtl
- invoice collection/payment projection
- expense category/payment projection
- refund projection
- reconciliation/audit/outbox records

---

# Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Background and Problem Statement](#2-background-and-problem-statement)
- [3. Product Vision](#3-product-vision)
- [4. Goals and Non-Goals](#4-goals-and-non-goals)
- [5. Scope](#5-scope)
- [6. Core Business Concepts](#6-core-business-concepts)
- [7. Users and Personas](#7-users-and-personas)
- [8. Business Use Cases](#8-business-use-cases)
- [9. Functional Requirements](#9-functional-requirements)
- [10. Voucher Types, Line Types, Line Roles, and Direction](#10-voucher-types-line-types-line-roles-and-direction)
- [11. Data Model Requirements](#11-data-model-requirements)
- [12. Backend Service Requirements](#12-backend-service-requirements)
- [13. API Requirements](#13-api-requirements)
- [14. UI/UX Requirements](#14-uiux-requirements)
- [15. Business Rules and Validation](#15-business-rules-and-validation)
- [16. Runtime Flows](#16-runtime-flows)
- [17. Security, RBAC, and Audit](#17-security-rbac-and-audit)
- [18. Reporting Requirements](#18-reporting-requirements)
- [19. Integration Requirements](#19-integration-requirements)
- [20. Migration and Compatibility](#20-migration-and-compatibility)
- [21. Non-Functional Requirements](#21-non-functional-requirements)
- [22. Testing and Acceptance Criteria](#22-testing-and-acceptance-criteria)
- [23. Release Plan](#23-release-plan)
- [24. Risks and Open Decisions](#24-risks-and-open-decisions)
- [25. Implementation Checklist](#25-implementation-checklist)

---

# 1. Executive Summary

The Business Voucher Module provides a unified business-finance transaction foundation for CleanMateX.

It introduces a clean model:

```text
org_fin_vouchers_mst
= voucher header / official business-finance document

org_fin_voucher_trx_lines_dtl
= voucher transaction/business lines
```

This module will replace the future need for specialized transaction tables such as:

```text
org_payments_dtl_tr
org_outgoing_payments_dtl_tr
org_payment_allocations_dtl
```

The module supports both incoming and outgoing business transactions:

```text
Customer receipts
Order payments
Invoice collections
Customer advance receipts
Wallet top-ups
Gift card sales
Customer refunds
Supplier payments
Expense payments
Shop rent payments
Petty cash issues
Employee advances
Cash/bank/internal transfers
Fees
Adjustments
```

This is a business-first finance module, not full ERP Lite. It is designed to be clean enough to support future ERP/accounting posting, AP, AR, GL, and reconciliation without forcing those modules into the current scope.

---

# 2. Background and Problem Statement

CleanMateX currently has or discusses multiple financial transaction patterns:

```text
Order payments
Pay on collection
Partial invoice payments
Customer advances
Wallet top-ups
Gift card sales
Customer refunds
Expenses
Supplier payments
Petty cash
Rent/utilities payments
```

The existing `org_payments_dtl_tr` table already overlaps with many responsibilities of a voucher transaction line. It includes fields such as:

```text
voucher_id
order_id
invoice_id
customer_id
payment_method_code
paid_amount
cash_drawer_session_id
payment_terminal_id
gateway references
bank/check/card references
tendered_amount
change_returned_amount
idempotency_key
```

However, it is incoming-payment oriented and contains old order calculation fields such as:

```text
subtotal
discount_amount
manual_discount_amount
promo_discount_amount
gift_card_applied_amount
tax_amount
vat_amount
```

These fields make it less suitable as the long-term clean transaction-line model.

The Business Voucher Module solves this by defining one universal voucher header and one universal voucher transaction-line table.

---

# 3. Product Vision

The Business Voucher Module should become the central business transaction document layer in CleanMateX.

It should allow business users to record, view, audit, and manage money-related transactions in a consistent way.

The vision:

```text
One voucher engine for receipt, payment, refund, adjustment, and transfer business transactions.
```

The module should support today’s business needs while keeping the platform ready for future finance expansion.

---

# 4. Goals and Non-Goals

## 4.1 Goals

The module must:

```text
1. Provide a unified voucher header and transaction-line model.
2. Support incoming receipts and outgoing payments.
3. Support customer/order/invoice/advance/wallet/gift-card/payment use cases.
4. Support expenses such as shop rent, utilities, supplies, petty cash, and supplier payments.
5. Preserve existing order-level payment facts through org_order_payments_dtl.
6. Replace future expansion of org_payments_dtl_tr.
7. Allow phased migration from org_payments_dtl_tr.
8. Provide clean APIs, services, UI screens, validation, permissions, audit, and tests.
9. Stay business-facing and not become full GL/ERP Lite in this phase.
```

## 4.2 Non-Goals

This module will not initially implement:

```text
Full ERP Lite
Full Accounts Payable
Full General Ledger posting engine
Full Chart of Accounts mapping
Purchase invoice lifecycle
Vendor aging
Bank reconciliation
Tax filing
Full journal voucher/debit-credit posting
Payroll
Inventory costing
```

The module should be compatible with these future capabilities, but not implement them now.

---

# 5. Scope

## 5.1 In Scope

```text
Voucher header CRUD
Voucher transaction line CRUD
Receipt voucher
Payment voucher
Refund voucher
Adjustment voucher
Transfer voucher
Incoming and outgoing money direction
Customer receipt
Order payment voucher line
Invoice payment voucher line
Customer advance receipt
Wallet top-up
Gift card sale
Customer refund
Supplier payment
Expense payment
Shop rent payment
Utility payment
Petty cash issue
Employee advance payment
Bank/gateway/cash/check/card references
Cash tendered/change handling
Status lifecycle
Posting/finalization
Cancellation
Reversal
Audit
RBAC
Reports
APIs
UI
Tests
Migration path from org_payments_dtl_tr
```

## 5.2 Out of Scope for V1

```text
Full AP module
Full GL posting
Automatic debit/credit journal entries
Bank reconciliation
Supplier statement
Purchase invoice module
Approval workflow engine beyond simple permission/status control
Multi-currency realized gain/loss posting
Complex tax filing
```

---

# 6. Core Business Concepts

## 6.1 Voucher Header

A voucher header represents the official business-finance document.

Examples:

```text
Receipt Voucher RV-0001
Payment Voucher PV-0001
Refund Voucher RF-0001
Adjustment Voucher ADJ-0001
Transfer Voucher TR-0001
```

Table:

```text
org_fin_vouchers_mst
```

## 6.2 Voucher Transaction Line

A voucher transaction line represents one business transaction line inside the voucher.

Examples:

```text
Cash received for order
Bank transfer received for invoice
Cash paid for shop rent
Cash issued to employee as petty cash
Card payment received for gift card sale
Cash refund returned to customer
```

Table:

```text
org_fin_voucher_trx_lines_dtl
```

## 6.3 Direction

Direction defines money movement orientation:

```text
IN       = money received
OUT      = money paid out
NEUTRAL  = adjustment/transfer/internal movement
```

## 6.4 Line Type

Line type defines the high-level nature of the line:

```text
RECEIPT
PAYMENT
REFUND
EXPENSE
ADVANCE
TRANSFER
ADJUSTMENT
FEE
ROUNDING
```

## 6.5 Line Role

Line role defines the precise business meaning:

```text
ORDER_PAYMENT
INVOICE_PAYMENT
CUSTOMER_ADVANCE_RECEIPT
WALLET_TOPUP
GIFT_CARD_SALE
SUPPLIER_PAYMENT
EXPENSE_PAYMENT
SHOP_RENT_PAYMENT
UTILITY_PAYMENT
EMPLOYEE_ADVANCE_PAYMENT
PETTY_CASH_ISSUE
CUSTOMER_REFUND
ORDER_REFUND
INVOICE_REFUND
CASH_ADJUSTMENT
BANK_FEE
GATEWAY_FEE
ROUNDING_ADJUSTMENT
```

## 6.6 Target Type

Target type defines what the line applies to:

```text
ORDER
INVOICE
CUSTOMER_ADVANCE
WALLET
GIFT_CARD
CREDIT_NOTE
CUSTOMER_ACCOUNT
SUPPLIER_ACCOUNT
EMPLOYEE_ACCOUNT
EXPENSE
CASH_DRAWER
BANK_ACCOUNT
NONE
```

---

# 7. Users and Personas

## 7.1 Cashier / Front Desk Staff

Responsibilities:

```text
Collect order payments
Collect pay-on-collection balances
Record customer receipts
Issue customer refunds if allowed
Handle cash drawer-related voucher lines
```

## 7.2 Branch Manager

Responsibilities:

```text
Review branch vouchers
Approve/cancel/reverse certain vouchers
Monitor cash and payment activity
Review expenses and petty cash
```

## 7.3 Accountant / Finance User

Responsibilities:

```text
Review all vouchers
Audit receipt/payment lines
Track expenses
Monitor customer advances
Prepare future accounting posting
Run finance reports
```

## 7.4 System Admin / Tenant Admin

Responsibilities:

```text
Configure permissions
Configure voucher numbering
Configure payment methods
Control branch-level access
```

## 7.5 Business Owner

Responsibilities:

```text
Monitor cash inflows/outflows
Review rent/utilities/supplier payments
Track daily receipts
Review refunds and adjustments
```

---

# 8. Business Use Cases

## 8.1 Order Payment During Creation

A customer creates an order and pays immediately.

Voucher:

```text
voucher_type = RECEIPT_VOUCHER
```

Line:

```text
direction = IN
line_type = RECEIPT
line_role = ORDER_PAYMENT
target_type = ORDER
```

Creates:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
org_order_payments_dtl
cash drawer movement if cash
```

## 8.2 Order Payment on Collection

Customer created order earlier and pays at pickup.

Same voucher/line pattern as order payment.

## 8.3 Invoice Collection

A customer pays part or all of an invoice.

Line:

```text
line_role = INVOICE_PAYMENT
target_type = INVOICE
```

## 8.4 Customer Advance Receipt

Customer gives money in advance without selecting an order.

Line:

```text
line_role = CUSTOMER_ADVANCE_RECEIPT
target_type = CUSTOMER_ADVANCE
```

Creates or updates advance ledger.

## 8.5 Wallet Top-Up

Customer tops up wallet.

Line:

```text
line_role = WALLET_TOPUP
target_type = WALLET
```

Creates wallet ledger transaction.

## 8.6 Gift Card Sale

Customer buys gift card.

Line:

```text
line_role = GIFT_CARD_SALE
target_type = GIFT_CARD
```

Creates gift card transaction.

## 8.7 Customer Refund

Business refunds customer.

Voucher:

```text
voucher_type = REFUND_VOUCHER
```

Line:

```text
direction = OUT
line_type = REFUND
line_role = CUSTOMER_REFUND / ORDER_REFUND / INVOICE_REFUND
```

## 8.8 Supplier Payment

Business pays supplier.

Voucher:

```text
voucher_type = PAYMENT_VOUCHER
```

Line:

```text
direction = OUT
line_type = PAYMENT
line_role = SUPPLIER_PAYMENT
target_type = SUPPLIER_ACCOUNT
```

## 8.9 Shop Rent Payment

Business pays shop rent.

Line:

```text
direction = OUT
line_type = EXPENSE
line_role = SHOP_RENT_PAYMENT
target_type = EXPENSE
expense_category_code = RENT
```

## 8.10 Utility Payment

Business pays utility bill.

Line:

```text
direction = OUT
line_type = EXPENSE
line_role = UTILITY_PAYMENT
target_type = EXPENSE
expense_category_code = UTILITIES
```

## 8.11 Petty Cash Issue

Business gives cash to employee.

Line:

```text
direction = OUT
line_type = PAYMENT
line_role = PETTY_CASH_ISSUE
target_type = EMPLOYEE_ACCOUNT
```

## 8.12 Bank/Gateway Fee

Business records bank or gateway fee.

Line:

```text
direction = OUT
line_type = FEE
line_role = BANK_FEE / GATEWAY_FEE
```

---

# 9. Functional Requirements

## 9.1 Voucher Header Management

The system must allow authorized users to:

```text
create voucher
edit draft voucher
view voucher
list vouchers
filter vouchers
post voucher
cancel voucher
reverse voucher
print voucher
export voucher
```

## 9.2 Voucher Line Management

The system must allow authorized users to:

```text
add voucher transaction line
edit draft line
delete draft line
view line
reverse line
link line to target
validate line role/target/payment method
```

## 9.3 Voucher Status Management

The system must support status transitions:

```text
DRAFT → POSTED
DRAFT → CANCELLED
POSTED → REVERSED
POSTED → PARTIALLY_REVERSED
```

Optional future statuses:

```text
PENDING
APPROVED
POSTING_FAILED
```

## 9.4 Voucher Numbering

The system must generate voucher numbers by:

```text
tenant
branch
voucher_type
date/year/month
sequence
```

Example:

```text
RV-2026-000001
PV-2026-000001
RF-2026-000001
ADJ-2026-000001
TR-2026-000001
```

## 9.5 Totals Recalculation

The system must recalculate voucher totals from active lines.

Header total must equal sum of non-cancelled, non-reversed lines.

## 9.6 Cash Handling

For cash lines:

```text
payment_method_code = CASH
cash_drawer_session_id required when business policy requires cash drawer
tendered_amount can be greater than amount
change_returned_amount = tendered_amount - amount
cash drawer movement amount = amount, not tendered_amount
```

## 9.7 Payment Method References

Voucher lines must support:

```text
cash
card
bank transfer
check
gateway
manual
```

Reference fields:

```text
bank_reference
gateway_reference
gateway_transaction_id
check_number
check_bank
check_date
card_brand_code
card_last4
auth_code
payment_terminal_id
```

## 9.8 Reversal

The system must support voucher and line reversal.

A reversal must:

```text
preserve original line
create reversal reference
record reversed_by, reversed_at, reversal_reason
not delete posted financial history
```

## 9.9 Idempotency

Voucher creation and posting must support idempotency for API calls.

---

# 10. Voucher Types, Line Types, Line Roles, and Direction

## 10.1 Voucher Types

Required V1:

```text
RECEIPT_VOUCHER
PAYMENT_VOUCHER
REFUND_VOUCHER
ADJUSTMENT_VOUCHER
TRANSFER_VOUCHER
```

## 10.2 Directions

Required V1:

```text
IN
OUT
NEUTRAL
```

## 10.3 Line Types

Required V1:

```text
RECEIPT
PAYMENT
REFUND
EXPENSE
ADVANCE
TRANSFER
ADJUSTMENT
FEE
ROUNDING
```

## 10.4 Line Roles

Required V1 incoming roles:

```text
ORDER_PAYMENT
INVOICE_PAYMENT
CUSTOMER_ADVANCE_RECEIPT
WALLET_TOPUP
GIFT_CARD_SALE
CUSTOMER_CREDIT_RECEIPT
```

Required V1 outgoing roles:

```text
SUPPLIER_PAYMENT
EXPENSE_PAYMENT
SHOP_RENT_PAYMENT
UTILITY_PAYMENT
EMPLOYEE_ADVANCE_PAYMENT
PETTY_CASH_ISSUE
CUSTOMER_REFUND
ORDER_REFUND
INVOICE_REFUND
```

Required V1 adjustment/fee roles:

```text
CASH_ADJUSTMENT
ROUNDING_ADJUSTMENT
GATEWAY_FEE
BANK_FEE
```

## 10.5 Target Types

Required V1:

```text
ORDER
INVOICE
CUSTOMER_ADVANCE
WALLET
GIFT_CARD
CREDIT_NOTE
CUSTOMER_ACCOUNT
SUPPLIER_ACCOUNT
EMPLOYEE_ACCOUNT
EXPENSE
CASH_DRAWER
BANK_ACCOUNT
NONE
```

---

# 11. Data Model Requirements

## 11.1 `org_fin_vouchers_mst`

### Purpose

Voucher header.

### Required logical columns

```text
id
tenant_org_id
branch_id
voucher_no
voucher_type
voucher_status
posting_status
voucher_date
voucher_datetime
direction
party_type
customer_id
supplier_id
employee_id
party_name
currency_code
currency_ex_rate
subtotal_amount
discount_amount
tax_amount
fee_amount
total_amount
paid_amount
refunded_amount
outstanding_amount
source_module
source_ref_type
source_ref_id
description
notes
metadata
approved_at
approved_by
posted_at
posted_by
reversed_at
reversed_by
reversal_reason
idempotency_key
rec_status
rec_order
rec_notes
created_at
created_by
created_info
updated_at
updated_by
updated_info
```

### Required constraints

```text
unique tenant voucher_no
unique tenant idempotency_key when not null
voucher_type valid set
voucher_status valid set
posting_status valid set
direction valid set
amounts non-negative
rec_status valid set
```

## 11.2 `org_fin_voucher_trx_lines_dtl`

### Purpose

Universal voucher business transaction line.

### Required logical columns

```text
id
tenant_org_id
branch_id
voucher_id
line_no
direction
line_type
line_role
target_type

order_id
invoice_id
customer_id
supplier_id
employee_id
party_name

gift_card_id
wallet_txn_id
advance_txn_id
credit_note_id
refund_id

expense_category_code
cost_center_id

payment_method_code
org_payment_method_id
branch_payment_method_id
payment_terminal_id

cash_drawer_id
cash_drawer_session_id

gateway_code
gateway_transaction_id
gateway_reference
bank_reference

check_number
check_bank
check_date

card_brand_code
card_last4
auth_code

amount
tax_amount
fee_amount
discount_amount
net_amount

tendered_amount
change_returned_amount

currency_code
currency_ex_rate

line_status
payment_status

due_date
paid_at
received_by

source_table
source_id

reversed_line_id
reversed_at
reversed_by
reversal_reason

reference_no
description
metadata

idempotency_key

rec_status
rec_order
rec_notes
created_at
created_by
created_info
updated_at
updated_by
updated_info
```

### Required constraints

```text
unique tenant voucher_id line_no
unique tenant idempotency_key when not null
direction valid set
line_type valid set
line_role valid set
target_type valid set
line_status valid set
payment_status valid set when not null
amounts non-negative
card_last4 max length 4
rec_status valid set
```

## 11.3 Target Validation Rules

Service-level validation must enforce:

```text
ORDER_PAYMENT requires target_type=ORDER and order_id
INVOICE_PAYMENT requires target_type=INVOICE and invoice_id
CUSTOMER_ADVANCE_RECEIPT requires customer_id
WALLET_TOPUP requires customer_id and wallet target/ledger
GIFT_CARD_SALE requires gift_card_id
SUPPLIER_PAYMENT requires supplier_id or party_name
EXPENSE_PAYMENT requires expense_category_code
SHOP_RENT_PAYMENT requires expense_category_code=RENT or equivalent
UTILITY_PAYMENT requires expense_category_code=UTILITIES or equivalent
PETTY_CASH_ISSUE requires employee_id or party_name
CUSTOMER_REFUND requires customer_id or order_id
ORDER_REFUND requires order_id and reversed_line_id/source reference when applicable
```

---

# 12. Backend Service Requirements

## 12.1 Services

Required services:

```text
voucher.service.ts
voucher-line.service.ts
voucher-number.service.ts
voucher-validation.service.ts
voucher-reversal.service.ts
voucher-reporting.service.ts
voucher-permission.service.ts
```

## 12.2 `voucher.service.ts`

Responsibilities:

```text
create voucher header
update draft voucher
post voucher
cancel voucher
reverse voucher
get voucher
list vouchers
recalculate voucher totals
validate voucher before posting
```

Methods:

```ts
createVoucher(input)
updateVoucher(voucherId, input)
postVoucher(voucherId)
cancelVoucher(voucherId, reason)
reverseVoucher(voucherId, reason)
getVoucherById(voucherId)
listVouchers(filters)
recalculateVoucherTotals(voucherId)
```

## 12.3 `voucher-line.service.ts`

Responsibilities:

```text
create voucher line
update draft line
delete draft line
reverse line
validate role/target
validate amount
validate payment method
validate cash drawer requirements
```

Methods:

```ts
addLine(voucherId, input)
updateLine(lineId, input)
deleteDraftLine(lineId)
reverseLine(lineId, reason)
listLines(voucherId)
validateLine(input)
```

## 12.4 `voucher-number.service.ts`

Responsibilities:

```text
generate unique voucher number
support branch/year/month sequence
prevent duplicate numbers
```

## 12.5 `voucher-validation.service.ts`

Responsibilities:

```text
validate voucher status transition
validate line role/target combination
validate totals
validate cash drawer session
validate payment method
validate posted voucher immutability
validate party requirements
```

## 12.6 `voucher-reversal.service.ts`

Responsibilities:

```text
create reversal voucher
reverse entire voucher
reverse selected line
link reversal to original line
update original status
emit audit/outbox event
```

## 12.7 `voucher-reporting.service.ts`

Responsibilities:

```text
voucher list report
receipt report
payment report
expense report
refund report
cash movement report
daily voucher summary
```

---

# 13. API Requirements

## 13.1 Voucher APIs

```text
GET    /api/v1/finance/vouchers
POST   /api/v1/finance/vouchers
GET    /api/v1/finance/vouchers/[voucherId]
PATCH  /api/v1/finance/vouchers/[voucherId]
POST   /api/v1/finance/vouchers/[voucherId]/post
POST   /api/v1/finance/vouchers/[voucherId]/cancel
POST   /api/v1/finance/vouchers/[voucherId]/reverse
```

## 13.2 Voucher Line APIs

```text
GET    /api/v1/finance/vouchers/[voucherId]/lines
POST   /api/v1/finance/vouchers/[voucherId]/lines
PATCH  /api/v1/finance/vouchers/[voucherId]/lines/[lineId]
DELETE /api/v1/finance/vouchers/[voucherId]/lines/[lineId]
POST   /api/v1/finance/vouchers/[voucherId]/lines/[lineId]/reverse
```

## 13.3 Reporting APIs

```text
GET /api/v1/finance/vouchers/reports/summary
GET /api/v1/finance/vouchers/reports/receipts
GET /api/v1/finance/vouchers/reports/payments
GET /api/v1/finance/vouchers/reports/expenses
GET /api/v1/finance/vouchers/reports/refunds
```

## 13.4 Lookup APIs

```text
GET /api/v1/finance/vouchers/lookups/types
GET /api/v1/finance/vouchers/lookups/line-roles
GET /api/v1/finance/vouchers/lookups/expense-categories
```

---

# 14. UI/UX Requirements

## 14.1 Navigation

Add module under:

```text
Finance → Vouchers
```

Screens:

```text
Voucher List
Create Voucher
Voucher Details
Voucher Line Editor
Voucher Reports
```

## 14.2 Voucher List Screen

Columns:

```text
Voucher No
Voucher Type
Direction
Date
Branch
Party
Total Amount
Currency
Voucher Status
Posting Status
Created By
Actions
```

Filters:

```text
date range
branch
voucher type
direction
party type
customer
supplier/employee/party
status
payment method
amount range
```

Actions:

```text
view
edit draft
post
cancel
reverse
print
export
```

## 14.3 Create Voucher Screen

Sections:

```text
Header information
Party information
Voucher lines
Totals summary
Notes/attachments
Actions
```

Header fields:

```text
voucher type
branch
date
party type
customer/supplier/employee/party name
currency
description
```

Line editor fields:

```text
direction
line type
line role
target type
target reference
payment method
amount
cash drawer session
bank/card/check/gateway references
expense category
notes
```

## 14.4 Voucher Detail Screen

Panels:

```text
Header Summary
Party Details
Totals
Transaction Lines
Payment References
Linked Documents
Audit Timeline
Actions
```

## 14.5 Voucher Line Table

Columns:

```text
Line No
Direction
Line Type
Line Role
Target Type
Target Reference
Payment Method
Amount
Status
Reference
Actions
```

## 14.6 UX Rules

```text
Draft vouchers can be edited.
Posted vouchers cannot be edited.
Posted vouchers can only be reversed.
Invalid line-role/target combinations must be blocked before save.
Cash lines must show tendered/change fields.
Expense lines must show expense category.
Supplier/employee/party fields depend on party type.
```

---

# 15. Business Rules and Validation

## 15.1 Header Total Rule

```text
voucher.total_amount = sum(active line.amount)
```

Active lines exclude:

```text
CANCELLED
REVERSED
```

## 15.2 One Line One Meaning Rule

Each voucher line must represent one business meaning:

```text
one direction
one line_type
one line_role
one target_type
one amount
one target reference where required
```

## 15.3 Posted Immutability

Posted voucher and lines cannot be edited.

Correction requires:

```text
reversal
adjustment voucher
new voucher
```

## 15.4 Cash Rule

For cash lines:

```text
if cash drawer is required:
cash_drawer_session_id is required
```

Cash drawer movement amount must equal line amount, not tendered amount.

## 15.5 Direction Consistency

```text
RECEIPT_VOUCHER usually direction IN
PAYMENT_VOUCHER usually direction OUT
REFUND_VOUCHER usually direction OUT
ADJUSTMENT_VOUCHER can be IN, OUT, or NEUTRAL
TRANSFER_VOUCHER can use NEUTRAL or paired IN/OUT lines
```

## 15.6 Expense Line Rule

Expense lines must include:

```text
expense_category_code
party_type or party_name
payment_method_code
amount
```

## 15.7 Reference Rule

Payment methods may require references:

```text
BANK_TRANSFER requires bank_reference
CHECK requires check_number/check_bank/check_date
CARD may require auth_code/terminal
PAYMENT_GATEWAY requires gateway_reference or gateway_transaction_id
CASH may require cash_drawer_session_id
```

---

# 16. Runtime Flows

## 16.1 Create Draft Voucher

```text
1. User opens create voucher.
2. System validates permission.
3. User enters header.
4. User adds lines.
5. System validates lines.
6. System recalculates totals.
7. System saves voucher as DRAFT.
```

## 16.2 Post Voucher

```text
1. User clicks Post.
2. System validates permission.
3. System validates header and lines.
4. System recalculates totals.
5. System validates payment references.
6. System changes voucher_status to POSTED.
7. System changes line_status to POSTED.
8. System emits outbox/audit events.
```

## 16.3 Cancel Draft Voucher

```text
1. User cancels voucher.
2. System verifies voucher is not posted.
3. System changes status to CANCELLED.
4. System stores reason.
```

## 16.4 Reverse Posted Voucher

```text
1. User requests reversal.
2. System validates permission.
3. System creates reversal references.
4. System marks original voucher or lines as REVERSED/PARTIALLY_REVERSED.
5. System creates reversal voucher/lines if configured.
6. System updates linked projections/ledgers if already wired.
```

## 16.5 Create Expense Payment Voucher

```text
1. User selects PAYMENT_VOUCHER.
2. User selects party type.
3. User adds EXPENSE line.
4. User selects expense category.
5. User enters payment method and amount.
6. User posts voucher.
```

## 16.6 Create Customer Receipt Voucher

```text
1. User selects RECEIPT_VOUCHER.
2. User selects customer.
3. User adds receipt line.
4. User selects target, such as ORDER or INVOICE.
5. User enters payment method and amount.
6. User posts voucher.
```

---

# 17. Security, RBAC, and Audit

## 17.1 Permissions

Required permissions:

```text
finance:vouchers:view
finance:vouchers:create
finance:vouchers:update
finance:vouchers:post
finance:vouchers:cancel
finance:vouchers:reverse
finance:vouchers:delete_draft
finance:vouchers:print
finance:vouchers:export
finance:vouchers:reports

finance:voucher_lines:create
finance:voucher_lines:update
finance:voucher_lines:delete_draft
finance:voucher_lines:reverse

finance:expenses:create
finance:expenses:approve
finance:refunds:create
finance:refunds:approve
```

## 17.2 Audit

Audit must track:

```text
created
updated
posted
cancelled
reversed
line added
line updated
line removed
line reversed
```

Audit fields:

```text
created_by
updated_by
posted_by
reversed_by
approved_by
created_info
updated_info
metadata
```

## 17.3 Tenant Isolation

Every query must include:

```text
tenant_org_id
```

Branch access must be enforced where applicable.

---

# 18. Reporting Requirements

## 18.1 Voucher Summary Report

Columns:

```text
voucher_no
voucher_type
direction
date
branch
party
total_amount
currency
status
created_by
posted_by
```

## 18.2 Receipts Report

Filters:

```text
date range
branch
customer
payment method
line_role
```

## 18.3 Payments/Expenses Report

Filters:

```text
date range
branch
expense category
supplier/employee/party
payment method
```

## 18.4 Refund Report

Filters:

```text
date range
branch
customer
refund type
status
```

## 18.5 Cash Drawer Voucher Lines Report

Shows voucher lines linked to cash drawer sessions.

## 18.6 Expense Category Report

Shows total expense by category.

---

# 19. Integration Requirements

## 19.1 Order Payments

Later wiring:

```text
voucher line → org_order_payments_dtl
```

Order payment projection should link using:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

## 19.2 Cash Drawer

Cash drawer movement should link using:

```text
fin_voucher_id
fin_voucher_trx_line_id
```

## 19.3 Wallet / Advance / Gift Card / Credit Note

Ledger tables should link using:

```text
source_voucher_id
source_voucher_trx_line_id
```

## 19.4 Invoice

Invoice payment table or invoice paid amounts should link to voucher lines.

## 19.5 Legacy Payments

`org_payments_dtl_tr` should become migration source / legacy compatibility.

---

# 20. Migration and Compatibility

## 20.1 Migration Strategy

Do not drop old table.

Phases:

```text
1. Create org_fin_voucher_trx_lines_dtl.
2. Add safe extensions to org_fin_vouchers_mst if needed.
3. Build voucher APIs/services/UI.
4. Use new model for manually created vouchers.
5. Backfill org_payments_dtl_tr into voucher trx lines.
6. Add compatibility view if needed.
7. Wire order/cash/stored-value modules incrementally.
8. Stop direct writes to org_payments_dtl_tr later.
```

## 20.2 Legacy Mapping

| `org_payments_dtl_tr` | `org_fin_voucher_trx_lines_dtl` |
|---|---|
| `voucher_id` | `voucher_id` |
| `paid_amount` | `amount`, `net_amount` |
| `payment_method_code` | `payment_method_code` |
| `order_id` | `order_id`, `target_type=ORDER`, `line_role=ORDER_PAYMENT` |
| `invoice_id` | `invoice_id`, `target_type=INVOICE`, `line_role=INVOICE_PAYMENT` |
| `customer_id` | `customer_id` |
| `gift_card_id` | `gift_card_id` |
| `cash_drawer_id` | `cash_drawer_id` |
| `cash_drawer_session_id` | `cash_drawer_session_id` |
| `payment_terminal_id` | `payment_terminal_id` |
| `gateway_reference` | `gateway_reference` |
| `bank_reference` | `bank_reference` |
| `check_number` | `check_number` |
| `check_bank` | `check_bank` |
| `check_date` | `check_date` |
| `card_brand_code` | `card_brand_code` |
| `card_last4` | `card_last4` |
| `auth_code` | `auth_code` |
| `idempotency_key` | `idempotency_key` |
| `metadata` | `metadata` |

---

# 21. Non-Functional Requirements

## 21.1 Performance

The module should support:

```text
voucher list search under 1 second for normal tenant data
indexed date/status/branch/customer queries
paginated results
server-side filtering
```

## 21.2 Reliability

```text
all posting/reversal operations transactional
idempotency for create/post where needed
no silent partial posting
```

## 21.3 Auditability

```text
posted vouchers immutable
reversals preserve original records
audit trail available from UI
```

## 21.4 Maintainability

```text
line_type/line_role/target_type centralized as constants or code tables
validation rules centralized
services separated by responsibility
```

## 21.5 Localization

UI labels must support:

```text
English
Arabic
```

---

# 22. Testing and Acceptance Criteria

## 22.1 Unit Tests

Required:

```text
voucher number generation
voucher total recalculation
line validation
role/target validation
cash tender/change validation
status transition validation
posted voucher immutability
```

## 22.2 Integration Tests

Required:

```text
create receipt voucher
create payment voucher
create refund voucher
create expense voucher
post voucher
cancel draft voucher
reverse posted voucher
add multiple lines
reject invalid target
reject editing posted voucher
idempotent create
```

## 22.3 UI Tests

Required:

```text
voucher list loads
create voucher form validates
line editor validates role/target
post action works
cancel action works
reverse action works
filters work
```

## 22.4 Acceptance Criteria

The module is accepted when:

```text
1. Users can create draft vouchers.
2. Users can add multiple transaction lines.
3. Voucher totals recalculate from active lines.
4. Users can post vouchers.
5. Posted vouchers cannot be edited.
6. Users can cancel draft vouchers.
7. Users can reverse posted vouchers.
8. Receipt and payment vouchers are both supported.
9. Expense payment vouchers are supported.
10. Cash/card/bank/check/gateway references are supported.
11. Cash tendered/change is handled correctly.
12. Voucher list, detail, and line UI exist.
13. Voucher APIs exist and are protected by permissions.
14. Voucher reports exist at least in summary form.
15. org_payments_dtl_tr is not expanded further for new business needs.
```

---

# 23. Release Plan

## Phase 1 — Foundation

```text
DB table
services
APIs
basic UI
unit tests
```

## Phase 2 — Business Voucher Operations

```text
receipt voucher
payment voucher
expense voucher
refund voucher
posting
cancellation
reversal
reports
```

## Phase 3 — Integration Wiring

```text
order payments
cash drawer
customer advances
wallet top-up
gift card sale
invoice collection
refunds
```

## Phase 4 — Legacy Migration

```text
backfill org_payments_dtl_tr
compatibility views
read-path transition
deprecate direct writes
```

---

# 24. Risks and Open Decisions

## 24.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Table becomes too generic | Confusion and bad data | Strict line_type, line_role, target_type validation |
| Migration breaks existing payment flows | Production risk | Additive migration and phased wiring |
| UI becomes too complex | User adoption risk | Use dynamic forms by voucher type/role |
| Posted voucher edited accidentally | Audit risk | Enforce immutability |
| Cash drawer mismatch | Finance risk | Retained cash validation and tests |

## 24.2 Open Decisions

```text
Should voucher posting immediately affect linked modules or only after wiring phase?
Should supplier master be added now or use party_name initially?
Should expense categories be sys_* or org_*?
Should approval workflow exist in V1 or only status permissions?
Should voucher number sequence be branch-level or tenant-level?
```

Recommended V1 answers:

```text
Posting affects only voucher module until wiring phase.
Use party_name initially if supplier master is not ready.
Expense categories should be org_* with optional sys templates later.
No complex approval workflow in V1.
Voucher numbering should support tenant-level first, branch-level optional.
```

---

# 25. Implementation Checklist

## Database

```text
[ ] Inspect current org_fin_vouchers_mst.
[ ] Add missing safe header columns if needed.
[ ] Create org_fin_voucher_trx_lines_dtl.
[ ] Add indexes.
[ ] Add constraints.
[ ] Add RLS policies.
[ ] Add seed/code values for voucher types, line types, line roles, target types.
```

## Backend

```text
[ ] Create voucher service.
[ ] Create voucher line service.
[ ] Create number generation service.
[ ] Create validation service.
[ ] Create reversal service.
[ ] Create reporting service.
[ ] Add permissions.
[ ] Add tests.
```

## APIs

```text
[ ] Voucher list API.
[ ] Voucher create API.
[ ] Voucher detail API.
[ ] Voucher update API.
[ ] Voucher post API.
[ ] Voucher cancel API.
[ ] Voucher reverse API.
[ ] Voucher line APIs.
[ ] Voucher report APIs.
```

## UI

```text
[ ] Voucher list screen.
[ ] Create voucher screen.
[ ] Voucher detail screen.
[ ] Line editor.
[ ] Post/cancel/reverse actions.
[ ] Voucher reports.
[ ] Localization.
```

## QA

```text
[ ] Unit tests.
[ ] Integration tests.
[ ] UI tests.
[ ] Permission tests.
[ ] Regression tests against existing payment flows.
```

---

# Final Product Decision

CleanMateX should implement the Business Voucher Module using:

```text
org_fin_vouchers_mst
org_fin_voucher_trx_lines_dtl
```

This module will support both incoming and outgoing business finance transactions.

`org_payments_dtl_tr` should become a legacy/migration source and should not be expanded for new business needs.

`org_order_payments_dtl` remains the order-level payment projection/fact table and will later link to voucher transaction lines.

This gives CleanMateX a clean business finance foundation without forcing full ERP Lite into the current scope.
