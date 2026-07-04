# 03 — Report / Document Inventory

Every finance-facing generated output found (`*-rprt.tsx` convention + print routes). **Source** = where the money numbers come from. ⚠ = reads the deprecated `_tr` ledger (FN-01).

## Order-scoped outputs

| Output | Component | Data source | Verdict |
|---|---|---|---|
| Order Financial tab | `src/features/orders/ui/orders-financial-tab-rprt.tsx` | canonical (`getOrderFinancialAction` → `order-financial-summary.service.ts`) | ✅ canonical |
| Order Payments tab | `src/features/orders/ui/orders-payments-tab-rprt.tsx` | ⚠ `org_payments_dtl_tr` via `app/dashboard/orders/[id]/full/page.tsx:95` | ❌ FN-01 |
| Order payments A4 print | `src/features/orders/ui/order-payments-print-rprt.tsx` + `app/api/v1/orders/[id]/report/payments-rprt/route.ts` | ⚠ `_tr` (`getPaymentsForOrder`) | ❌ FN-01 + FN-04 (no RBAC) |
| Order invoices+payments print | `src/features/orders/ui/order-invoices-payments-print-rprt.tsx` + `…/report/invoices-payments-rprt/route.ts` | ⚠ `_tr` for payment rows | ❌ FN-01 + FN-04 |
| Order history print | `src/features/orders/ui/order-history-print-rprt.tsx` | order history tables | ✅ (non-money) |
| Vouchers tab | `orders-vouchers-tab-rprt.tsx` | voucher master/lines | ✅ canonical |
| Receipts tab | `orders-receipts-tab-rprt.tsx` | receipts | ✅ |
| Invoices tab | `orders-invoices-tab-rprt.tsx` | AR invoice tables | ✅ |

## Tenant-level reports (`/dashboard/reports`)

| Output | Component | Data source | Verdict |
|---|---|---|---|
| Payments report (KPIs, by-method, table, export) | `payments-report-{charts,table}-rprt.tsx` | ⚠ `report-service.getPaymentsReport` → `org_payments_dtl_tr` (:268) | ❌ FN-01 — under-reports canonical payments |
| Orders report | `orders-report-{charts,table}-rprt.tsx` | `org_orders_mst` aggregates | ✅ (header canonical fields) |
| Invoices report | `invoices-report-{charts,table}-rprt.tsx` | AR invoice tables | ✅ |
| Customers report | `customer-report-{charts,table}-rprt.tsx` | customer aggregates | ✅ |
| Revenue breakdown | `revenue-breakdown-charts-rprt.tsx` | order aggregates | ✅ |
| Export dropdown (CSV/XLS) | `export-dropdown-rprt.tsx` | serializes the on-screen dataset | inherits source verdict |

## Reconciliation reports (D-09, `/dashboard/reports/reconciliation`)

| Report | Source | Verdict |
|---|---|---|
| Unallocated excess / stored-value liability | wallet + advance + credit-note balances (Prisma, tenant-scoped) | ✅ |
| B2B statement payment recon | header vs Σ `org_b2b_statement_payments_dtl` (raw SQL) | ✅ |
| Overpayment disposition recon | `org_fin_overpay_disp_dtl` | ✅ |
| Cash drawer movement recon | sessions + movements | ✅ |

All four: `requirePermission('finance_reports:view')`, `withTenantContext` + explicit `tenant_org_id`, CSV export via `lib/utils/report-csv.ts`. Verified in code + prior-pass runtime smoke.

## AR / B2B / billing documents

| Output | Component | Data source | Notes |
|---|---|---|---|
| AR invoice print | `src/features/ar/ui/ar-invoice-print-rprt.tsx` | AR invoice + lines | ✅ source; ⚠ FN-11: local `formatCurrency` hardcodes `ar-OM`/`en-OM` (:10-17); `quantity.toFixed(4)` (:109) |
| AR customer statement print | `src/features/ar/ui/ar-customer-statement-print-rprt.tsx` | statement header/lines (opening/closing balance :57-61, debit/credit :87) | ✅ source; ⚠ FN-11 same locale hardcoding |
| B2B statements print | `src/features/b2b/ui/b2b-statements-print-rprt.tsx` | b2b statements | ✅ |
| Receipt voucher print | `src/features/billing/ui/billing-receipt-voucher-print-rprt.tsx` | voucher | ✅ |
| Cash drawer session print | `src/features/billing/ui/cash-drawer-session-print-rprt.tsx` | drawer session/movements | ✅ |
| Gift-card liability report | `src/features/marketing/ui/gift-cards-liability-rprt.tsx` | gift-card ledger | ✅ |
| Cash-up history | `src/features/billing/ui/cashup-history.tsx` | ⚠ `cashup-service` → `_tr` groupBy (:51) | ❌ FN-06 |

## Formatting/i18n conventions observed

- **Good pattern:** `order-invoices-payments-print-rprt.tsx` — shared `formatMoneyAmountWithCode` (`lib/money/format-money`), `useRTL()`, `useLocale()`, negative amounts rendered with explicit `−` prefix.
- **Divergent pattern (FN-11):** both AR prints define private `formatCurrency`/`formatDate` with hardcoded `'ar-OM'`/`'en-OM'` — wrong region formatting for non-Omani tenants and a duplicate of the shared money formatter. Violates the project rule "no default value for … any locale-related field" in spirit.
- i18n coverage: AR prints use `useTranslations` throughout (28 and 18 call sites respectively); no hardcoded English labels found in the sampled bodies.

## Bypass check (report logic vs business rules)

The D-09 reports and canonical tabs are read-only over stored rows — no recomputation that could contradict the engine. The ⚠ surfaces above don't *bypass* business rules; they read a ledger the rules no longer maintain, which is worse: they present authoritative-looking but incomplete data.
