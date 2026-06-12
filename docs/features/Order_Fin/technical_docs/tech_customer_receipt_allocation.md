# Customer Receipt Allocation — Technical Reference

**Status:** Production (Approved_By_Jh, 2026-06-11)  
**Catalogs:** [tech_settlement_catalogs.md](./tech_settlement_catalogs.md)  
**Pending work:** [Pending_Payment_Settlement_Follow_Ups.md](../Pending_Payment_Settlement_Follow_Ups.md)

## Services

| Service | Role |
|---------|------|
| `customer-receipt-allocation.service.ts` | Auto/manual allocation algorithms |
| `customer-receipt-allocation-policy.service.ts` | Tenant policy resolution |
| `customer-open-balance-query.service.ts` | Eligible targets (AR, B2B, POC orders) |
| `customer-receipt-allocation-preview.service.ts` | Preview CRUD + confirm/posted status |
| `customer-receipt-allocation-validator.service.ts` | 15-rule validation gate |
| `customer-receipt-excess-executor.service.ts` | TX apply preview + disposition |
| `customer-receipt-posting.service.ts` | Standalone account receipt post |
| `b2b-statement-payment.service.ts` | B2B statement balance apply |
| `wiring/invoice-payment-wiring.handler.ts` | BVM invoice payment wiring |
| `wiring/statement-payment-wiring.handler.ts` | BVM statement payment wiring |

## API Routes

- `POST /api/v1/customer-receipts/allocation/preview-auto`
- `POST /api/v1/customer-receipts/allocation/preview-manual`
- `POST /api/v1/customer-receipts/allocation/post` (confirmOnly)
- `POST /api/v1/customer-receipts/post` (standalone receipt)
- `POST /api/v1/orders/{id}/payments` (later collection + overpayment)
- `GET /api/v1/customers/{id}/open-balances`

## Permissions

- `orders:overpayment_allocate` — modal allocation preview/confirm
- `orders:overpayment_dispose` — advance/credit disposition
- `orders:collect_payment` — later collection
- `customers:receipt_allocate` — standalone account receipt (migration 0358)

## UI

- Payment Modal V4 — extra receipt card + allocation drawers
- `OrderCollectPaymentModal` — order detail + ready screen POC collection
- `/dashboard/customers/account-receipt` — standalone screen (nav 0359)

## Migrations (review before apply)

- `0358_permissions_customer_receipt_allocate.sql`
- `0359_nav_customers_account_receipt.sql`
- `0360_order_fin_phase6_legacy_cleanup.sql` — legacy disp table align + overpaid_amount backfill + catalog comments

## Phase 6 (legacy cleanup)

- Removed silent `supports_overpayment` retention bypass in `settlement-overpayment.ts`
- Unresolved excess = gross excess minus cash change capacity (not all-or-nothing)
- Payment Modal V4 aligned with server metrics
- `RETURN_CHANGE` (allocation fallback) documented as distinct from `RETURN_CASH_CHANGE` (overpayment resolution) — see settlement catalogs doc
