<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# PRD: Order Financial Platform

## 1. Objective

Build a production-grade financial platform for CleanMateX order checkout, settlement, credits, payments, tax, invoice, reconciliation, and accounting posting.

## 2. Goals

- Normalize financial facts.
- Preserve checkout stability.
- Support multi-payment.
- Support gift card/wallet/customer credit/advance.
- Support VAT/tax.
- Support invoice/AR.
- Support audit and reconciliation.

## 3. Non-Goals

- Microservice rewrite.
- Frontend redesign.
- Big-bang DB replacement.

## 4. Functional Requirements

### FR-001 Server Totals

System must calculate totals server-side and reject mismatches.

### FR-002 Charges

System must store charge rows separately.

### FR-003 Discounts

System must store discount rows separately.

### FR-004 Taxes

System must store historical tax snapshots.

### FR-005 Credits

System must apply stored value through credit application rows.

### FR-006 Payments

System must support multiple real payment rows.

### FR-007 Invoice / AR

System must support invoice creation and AR allocation.

### FR-008 Reconciliation

System must reconcile summary/detail/ledger records.

## 5. Acceptance Criteria

- Existing checkout continues to work.
- AMOUNT_MISMATCH behavior remains.
- New details dual-write successfully.
- Reconciliation has no blockers.
- Feature-flag read switch is possible.
