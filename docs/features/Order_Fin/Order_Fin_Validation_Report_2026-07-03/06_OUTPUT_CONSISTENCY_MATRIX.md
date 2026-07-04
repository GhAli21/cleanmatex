# 06 — Output Consistency Matrix

Does each output surface agree with the canonical stored data? Canonical truth = `org_orders_mst` snapshot columns + `org_order_payments_dtl` + voucher trx lines + AR/B2B/stored-value ledgers.

| Surface | Money source | Consistent w/ canonical? | Status codes | Tenant scope | RBAC | i18n/RTL | Notes |
|---|---|---|---|---|---|---|---|
| Order **Financial** tab | canonical summary service | ✅ by construction | canonical constants | ✅ `withTenantContext` | page-gated | ✅ | reference surface |
| Order **Payments** tab | ⚠ `_tr` | ❌ **FN-01** — misses canonical payments; shows lowercase `_tr` statuses | `_tr` lowercase | ✅ | page-gated | ✅ | contradicts Financial tab on same screen |
| Order payments print | ⚠ `_tr` | ❌ FN-01 | `_tr` | ✅ (route `.eq` + service ctx) | ❌ **FN-04** none | ✅ | |
| Order invoices+payments print | ⚠ `_tr` (payment rows) | ❌ FN-01 | mixed | ✅ | ❌ FN-04 | ✅ shared money formatter, RTL-aware | |
| Tenant Payments report + CSV | ⚠ `_tr` | ❌ FN-01 — under-reports | lowercase literals (`'completed'`, `'refunded'` at `report-service.ts:287-288`) | ✅ `withTenantContext` | reports gate | ✅ | KPI/method breakdown affected |
| Orders report | `org_orders_mst` canonical columns | ✅ | canonical | ✅ | reports gate | ✅ | |
| Reconciliation ×4 (D-09) | canonical ledgers | ✅ | canonical | ✅ + explicit WHERE | `finance_reports:view` | ✅ (54 keys EN/AR) | exception thresholds by design |
| AR invoice print | AR invoice + lines | ✅ | AR statuses | ✅ | invoice perms (`invoices:print` exists) | ⚠ FN-11 locale hardcode | |
| AR customer statement print | statement rows (opening/closing/debit/credit) | ✅ | AR | ✅ | `customer_statements:view` | ⚠ FN-11 | |
| B2B statements print | b2b statements | ✅ (post-0380 detail recon exists) | canonical | ✅ | `b2b_statements:view` | ✅ | |
| Receipt voucher print | voucher | ✅ | voucher statuses | ✅ | `fin_vouchers:view` | ✅ | |
| Cash drawer session print | drawer sessions/movements | ✅ | canonical | ✅ | `cash_drawer:view` | ✅ | |
| Cash-up history | ⚠ `_tr` groupBy | ❌ FN-06 | lowercase | ✅ | billing gate | ✅ | retire or repoint |
| Gift-card liability report | gift-card ledger | ✅ | canonical | ✅ | `gift_cards:view` | ✅ | |
| Payment Modal v4 summary rail / docked bar | engine derivations over server preview (`preview-payment` / `preview-financials` → `calculateOrderTotals`) | ✅ — same calculation service as submit; payload oracle freezes the contract | canonical | ✅ | order create gate | ✅ EN/AR + RTL slide-over | |
| Collect-payment modal | canonical settlement | ✅ | canonical | `orders:collect_payment` | ✅ | ✅ | |
| Customer account receipt / allocation drawers | canonical preview services | ✅ preview-before-post | canonical | `customers:receipt_allocate` etc. | ✅ | over-allocation guard (Phase 5) |

## Consistency conclusions

1. **Everything canonical agrees with everything canonical.** The engine, the Financial tab, previews, reconciliation reports, AR/B2B documents, and the payment modal all share one calculation/summary path — the unification program did its job.
2. **Every inconsistency traces to exactly one root cause:** the un-retired `org_payments_dtl_tr` ledger (FN-01/FN-06). Fixing the readers fixes the matrix.
3. **Rounding/precision:** no output recomputes money differently from storage; prints format stored values only. The only formatting defect is locale hardcoding (FN-11), not values.
4. **Status-code casing:** user-visible lowercase statuses leak from `_tr` surfaces; canonical surfaces show canonical uppercase codes via i18n labels. Resolves with FN-01.
