<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Reconciliation Strategy

## 1. Purpose

Ensure financial correctness across:

- order summary
- financial detail tables
- stored-value ledgers
- invoices
- accounting postings

## 2. Mandatory Reconciliations

```text
Charges
Discounts
Taxes
Credits
Payments
Invoices
Gift Card Ledger
Wallet Ledger
Customer Credit Ledger
Advance Ledger
Loyalty Ledger
Accounting Posting
```

## 3. Core Equations

```text
sum(charges) = total_charges_amount
sum(discounts) = total_discount_amount
sum(taxes) = total_tax_amount
sum(credits) = total_credit_applied_amount
sum(payments) = total_paid_amount

gross + charges - discounts = net_before_tax
net_before_tax + tax = grand_total
grand_total - credits = net_receivable
net_receivable - payments - invoice_ar = outstanding
```

## 4. Severity

| Severity | Action |
|---|---|
| INFO | Log only |
| WARNING | Review |
| BLOCKER | Prevent switch-read/posting |

## 5. Reconciliation Tables

```text
org_fin_reconciliation_runs_mst
org_fin_reconciliation_issues_dtl
```
