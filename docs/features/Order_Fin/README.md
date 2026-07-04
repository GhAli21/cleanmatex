# Order Financial Platform

Multi-leg payments, stored value (wallet, advance, credit note), loyalty earn/redeem, promotions engine, tax configuration, cash drawer management, POS session management, financial reconciliation, and domain event outbox for CleanMateX.

## Scope

This feature owns the entire financial layer of an order from totals calculation through settlement, post-settlement adjustments (refunds), and background reconciliation.

## Architecture

### Phase 1B — Submit Order via BVM Wiring (current)

```
POST /api/v1/orders/submit-order
       │
       ▼
submit-order/route.ts  (thin shell — CSRF, auth, parse, idempotency)
       │
       ▼
order-submit-orchestrator.service.ts
  ├── tx1: createOrder + invoice + promo + gift card
  ├── Checkout Config (COALESCE D9 from sys+org payment method tables)
  ├── buildSettlementPlan()   ← pure classification, no DB writes
  ├── validateSettlementPlan() ← drawer open, tendered ≥ amount, gateway config, reference
  ├── [if shouldCreateReceiptVoucher]
  │     ├── createBizVoucher()
  │     ├── addVoucherLine() × N  (REAL_PAYMENT + CREDIT_APPLICATION legs)
  │     └── postAndWireBizVoucher()
  │           └── wiring handlers → org_order_payments_dtl, org_order_credit_apps_dtl,
  │                                  org_cash_drawer_movements_dtl
  ├── settleOrder(wiringMode: true)
  │     ├── Writes: org_order_charges_dtl, org_order_taxes_dtl, org_order_discounts_dtl
  │     ├── Debits: wallet, advance, credit-note, loyalty (stored value)
  │     ├── SKIPS: org_order_payments_dtl create (wiring already did it)
  │     ├── SKIPS: org_order_credit_apps_dtl create (wiring already did it)
  │     └── Updates: org_orders_mst snapshot
  └── Returns: SubmitOrderResult { order, voucher?, effects, warnings }
```

### Legacy path (frozen — not served)
```
POST /api/v1/orders/_legacy_create-with-payment  ← Next.js does NOT route _-prefixed folders
```

### Pre-Phase 1B (reference only)
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
| Canonical order submission path (Phase 1B) | `submit-order` only; `create-with-payment` frozen | One path to maintain; orchestrator reusable by any caller |
| Idempotency ownership (Phase 1B D11) | Route owns full lifecycle; orchestrator is stateless | Orchestrator stays pure/testable; route guards against replay |
| D9 payment status config (Phase 1B) | COALESCE(org.col, sys.col) — sys defaults, org overrides | Config-driven status without code changes; tenant overrides possible |
| POS session ownership (Phase 1) | User-owned, one active per tenant+user | Keeps user session, terminal context, and drawer reconciliation cleanly separated |
| POS session navigation (Phase 3) | `/dashboard/internal_fin/pos-sessions` with DB seed migration `0399` | Keeps sidebar and `sys_components_cd` in sync |

## Directory Structure

```
docs/features/Order_Fin/
├── README.md                            ← this file
├── developer_guide.md                   ← service graph, flow walkthroughs, patterns
├── IMPLEMENTATION_STATUS.md             ← canonical phase + stabilization status (supersedes current_status.md)
├── current_status.md                    ← legacy pointer to IMPLEMENTATION_STATUS.md
├── progress_summary.md                  ← session-by-session log
├── CHANGELOG.md                         ← chronological changes
├── POS_Session_Management_V1.md         ← POS Session v1 source-of-truth spec
├── ADR_submit_order_canonical_path.md   ← Phase 1B canonical orchestrator decision
├── bvm_wiring_phase1a_implementation.md ← Phase 1A outcomes
├── bvm_wiring_phase1b_implementation.md ← Phase 1B outcomes (+ 2026-05-28 stabilization addendum)
├── BVM_PHASE_2_ENTRY_PLAN.md            ← next phase entry plan
├── Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md  ← settlement program (complete)
├── Pending_Payment_Settlement_Follow_Ups.md                          ← post-plan backlog
├── HQ_Fin_Settlement_Sys_Catalogs_Implementation_Guide.md            ← cleanmatexsaas HQ catalog CRUD spec
├── technical_docs/
│   ├── tech_api.md                      ← full API contract for all new routes
│   ├── tech_data_model.md               ← ER diagram, table descriptions, migration list
│   ├── tech_settlement_catalogs.md      ← overpayment + allocation catalogs
│   └── tech_customer_receipt_allocation.md
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

Related ADRs in sibling features:
- `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` — `org_invoice_mst` is a receivable-only document; cash sales no longer produce AR ledger debits. Cross-references this folder's submit-order orchestrator gate.

## Quick Links

- [POS Session Management v1](POS_Session_Management_V1.md)
- [ADR-054 — User-Owned POS Sessions](ADR/ADR-054-User-Owned-POS-Sessions.md)
- [Payment Settlement Plan](Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) (complete)
- [Pending Follow-Ups](Pending_Payment_Settlement_Follow_Ups.md)
- [HQ sys_ Catalogs Guide](HQ_Fin_Settlement_Sys_Catalogs_Implementation_Guide.md) (implement in cleanmatexsaas)
- [Settlement Catalogs (tech)](technical_docs/tech_settlement_catalogs.md)
- [Customer Receipt Allocation (tech)](technical_docs/tech_customer_receipt_allocation.md)
- [Developer Guide](developer_guide.md)
- [API Reference](technical_docs/tech_api.md)
- [Data Model](technical_docs/tech_data_model.md)
- [Implementation Status](IMPLEMENTATION_STATUS.md)
- [BVM Phase 2 Entry Plan](BVM_PHASE_2_ENTRY_PLAN.md)
- [ADR — Canonical Submit Path](ADR_submit_order_canonical_path.md)
- [ADR — AR Invoice Receivable-Only](../AR_Invoice/ADR_ar_invoice_is_receivable_only.md)
- [Changelog](CHANGELOG.md)
