<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Target Architecture

## 1. Target Model

```text
Order
  → Order Items
      → Order Item Pieces
          → Order Preferences

Financial Facts:
  → Charges
  → Discounts
  → Taxes
  → Credit Applications
  → Payments
  → Refunds
  → Adjustments

Financial Proof:
  → Stored Value Ledgers
  → Accounting Vouchers
  → Audit Logs
  → Reconciliation Runs
```

## 2. Domain Ownership

| Domain | Owns |
|---|---|
| Order Core | `org_orders_mst`, `org_order_items_dtl` |
| Piece Tracking | `org_order_item_pieces_dtl`, piece history |
| Preferences | `org_order_preferences_dtl` |
| Charges | `org_order_charges_dtl` |
| Discounts | `org_order_discounts_dtl` |
| Tax | `org_order_taxes_dtl`, tax config |
| Settlement | payments, refunds, adjustments |
| Stored Value | gift card/wallet/advance/customer credit ledgers |
| Loyalty | loyalty accounts and transactions |
| Invoice / AR | invoices and invoice payments |
| Accounting | mapping rules and vouchers |
| Reconciliation | reconciliation runs/issues |

## 3. Runtime Components

```text
Frontend Apps
  Tenant Admin Web
  POS / Counter UI
  Staff App
  Driver App
  Customer App

API Layer
  Auth
  Tenant Resolver
  RBAC Guard
  Idempotency Guard
  Validation

Domain Services
  OrderCommandService
  PricingEngineService
  PromotionEvaluationService
  TaxCalculationService
  SettlementService
  StoredValueService
  InvoiceService
  ReconciliationService
  AccountingPostingService

Database
  Operational Tables
  Financial Detail Tables
  Ledger Tables
  Config Tables
  Audit Tables

Async
  Outbox Worker
  Posting Worker
  Notification Worker
  Reconciliation Worker
  Expiry Worker
```

## 4. Core Architectural Decision

Use a modular monolith first. Extract services only when scale and organizational maturity justify it.
