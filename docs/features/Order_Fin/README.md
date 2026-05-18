# Order Financial Platform

Multi-leg payments, stored value (wallet, advance, credit note), loyalty earn/redeem, promotions engine, tax configuration, cash drawer management, financial reconciliation, and domain event outbox for CleanMateX.

## Scope

This feature owns the entire financial layer of an order from totals calculation through settlement, post-settlement adjustments (refunds), and background reconciliation.

## Architecture

```
Order Calculation Service
       │
       ▼
Checkout Config Service ──→ Settlement Options
       │
       ▼
Order Settlement Service (prisma.$transaction)
  ├── Writes: org_order_charges_dtl
  ├── Writes: org_order_taxes_dtl
  ├── Writes: org_order_discounts_dtl
  ├── Routes legs by payment_nature:
  │     REAL_PAYMENT     → org_order_payments_dtl
  │     CREDIT_APPLICATION → stored-value / loyalty / gift-card services (tx)
  │     DEFERRED_SETTLEMENT → sets PENDING_COLLECTION status
  ├── Updates: org_orders_mst (payment_status snapshot)
  └── Emits: ORDER_COMPLETED via outbox.service
```

### Key ADRs

| Decision | Choice | Rationale |
|---|---|---|
| payment_nature routing | 5-way enum on org_payment_methods_cf | Single column controls all routing logic — no code changes for new methods |
| Credit-note scope V1 | Document-based only (no running customer credit balance) | Simpler mental model; advance/wallet covers balance use-cases |
| Unified payment config | org_payment_methods_cf (not per-branch tables) | Branch overrides via JSONB column, not separate rows |
| Outbox pattern | Append-only table + worker | Decouples event consumers; survives downstream failures |
| SELECT FOR UPDATE | Raw SQL on stored-value mutation paths | Prevents TOCTOU double-debit on concurrent requests |

## Directory Structure

```
docs/features/Order_Fin/
├── README.md                ← this file
├── developer_guide.md       ← service graph, flow walkthroughs, patterns
├── current_status.md        ← phase implementation status
├── progress_summary.md      ← session-by-session log
├── CHANGELOG.md             ← chronological changes
├── technical_docs/
│   ├── tech_api.md          ← full API contract for all new routes
│   └── tech_data_model.md   ← ER diagram, table descriptions, migration list
└── Order_Fin_Docs/
    ├── ORDER_FINANCIAL_PLATFORM.md
    ├── STORED_VALUE_GUIDE.md
    ├── LOYALTY_GUIDE.md
    ├── PROMOTIONS_GUIDE.md
    ├── TAX_ENGINE_GUIDE.md
    ├── RECONCILIATION_GUIDE.md
    ├── CASH_DRAWER_GUIDE.md
    └── OUTBOX_PATTERN_GUIDE.md
```

## Quick Links

- [Developer Guide](developer_guide.md)
- [API Reference](technical_docs/tech_api.md)
- [Data Model](technical_docs/tech_data_model.md)
- [Current Status](current_status.md)
- [Changelog](CHANGELOG.md)
