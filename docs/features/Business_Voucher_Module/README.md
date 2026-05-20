# Business Voucher Module (BVM)

**Status:** Production-ready — all phases complete as of 2026-05-20
**Plan:** `C:\Users\JHNLP\.claude\plans\always-don-t-ignore-claude-md-moonlit-snowglobe.md`

---

## Overview

The Business Voucher Module (BVM) unifies all business-finance transactions in CleanMateX under a single, clean voucher header + transaction-line model. It replaces the narrow `org_payments_dtl_tr` table (incoming-payment-only) with a universal transaction layer that covers receipts, payments, refunds, adjustments, and transfers.

**Core concepts:**
- **Voucher header** (`org_fin_vouchers_mst`) — one record per business transaction (e.g., "Cash receipt from customer for order #001")
- **Transaction lines** (`org_fin_voucher_trx_lines_dtl`) — one or more lines per voucher, each with a `line_role` (e.g., `ORDER_PAYMENT`, `EXPENSE_PAYMENT`)
- **Two independent status axes** — `voucher_status` (business lifecycle) and `posting_status` (GL accounting layer, managed by future GL service)
- **Cashier restrictions** — enforced at the service layer: cashiers may only create `RECEIPT_VOUCHER` with a limited set of line roles

---

## Voucher Types

| Code | Description | Direction |
|---|---|---|
| `RECEIPT_VOUCHER` | Money coming in (customer payments, advance receipts) | IN |
| `PAYMENT_VOUCHER` | Money going out (supplier payments, expenses) | OUT |
| `REFUND_VOUCHER` | Refunds to customers | OUT |
| `ADJUSTMENT_VOUCHER` | Corrections and write-offs | NEUTRAL |
| `TRANSFER_VOUCHER` | Internal fund movements between drawers/accounts | NEUTRAL |

---

## Status Model

### Business Lifecycle (`voucher_status`)
```
DRAFT → POSTED → REVERSED
DRAFT → CANCELLED
POSTED → PARTIALLY_REVERSED → REVERSED
```

### Accounting GL (`posting_status`) — managed by future GL service
```
NOT_POSTED → POSTED
NOT_POSTED → POSTING_FAILED
```

> **Important:** BVM Phase 1 posting sets only `voucher_status`. It never touches `posting_status`.

---

## Cashier Restrictions

Cashiers have `fin_vouchers:create` and `fin_vouchers:post` but are restricted at the service layer:

**Allowed for cashier:**
- Voucher type: `RECEIPT_VOUCHER` only
- Line roles: `ORDER_PAYMENT`, `CUSTOMER_ADVANCE_RECEIPT`, `WALLET_TOPUP`, `GIFT_CARD_SALE`, `CUSTOMER_CREDIT_RECEIPT`

**Requires `branch_manager`+:** `PAYMENT_VOUCHER`, `REFUND_VOUCHER`, all expense and supplier line roles

---

## Implementation Status

| Layer | Status |
|---|---|
| Database (migrations 0300–0307) | ✅ Complete |
| Prisma schema | ✅ Complete |
| Constants & types | ✅ Complete |
| Services (6 new) | ✅ Complete |
| Server actions | ✅ Complete |
| API routes | ✅ Complete |
| Feature module UI | ✅ Complete |
| Finance dashboard pages | ✅ Complete |
| Navigation (dual-write) | ✅ Complete |
| i18n (EN + AR) | ✅ Complete |
| Tests (53 passing) | ✅ Complete |

---

## Quick Links

- [Developer Guide](developer_guide.md) — full implementation reference (services, API, DB, permissions)
- [PRD](CleanMateX_Business_Voucher_Module_PRD_v1_0.md)
- [Wiring PRD](CleanMateX_Business_Voucher_Module_Wiring_PRD_v1_0.md)
- [Decision Pack](CleanMateX_Business_Voucher_Batch_0_Decision_Pack_v2_Approved.md)
- [CHANGELOG](CHANGELOG.md)
