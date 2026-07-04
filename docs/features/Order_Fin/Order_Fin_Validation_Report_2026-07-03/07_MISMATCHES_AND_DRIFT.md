# 07 — Mismatches and Drift

Code ↔ DB ↔ constants ↔ docs drift found this pass.

## Code ↔ ADR drift

| Item | Evidence | Direction |
|---|---|---|
| ADR-002 "no new writes to `org_payments_dtl_tr`" vs live writer | `payment-service.ts:1096` (+ refund :1793, updates :1395/2425/2504) still write it from customer/b2b/ready/internal_fin flows | FN-01 — either finish the deprecation or amend the ADR with an explicit "invoice/customer payments remain on `_tr` until X" scope |
| ADR-002 canonical read model vs `_tr` readers | 7 reader sites ([02](./02_IMPLEMENTATION_MAP.md)) | FN-01 |
| ADR-010 order-details UI separation vs Payments tab source | Payments tab shows `_tr` rows next to canonical Financial tab | FN-01 |

## Code ↔ code (stale comments / dead paths)

| Item | Evidence |
|---|---|
| "until that table ships" comment vs shipped `org_tax_documents_mst` | `order-financial-write.service.ts:815-824` vs `supabase/migrations/0341_tax_documents_master_and_lines.sql` + `order-financial-summary.service.ts:410` (FN-03) |
| Dead constant `PAYMENT_STATUSES` (lowercase) — 0 references; write site uses `'completed'` literal | `lib/constants/payment.ts:113-121` vs `payment-service.ts:1113` (FN-08) |
| Dead branch `allow_partial_last_target=false` | `runAutoAllocationAlgorithm` (customer-receipt allocation) — carried F-AA1 (FN-13) |

## Constants ↔ DB mirror check

| Constant | DB value | Verdict |
|---|---|---|
| `ORDER_PAYMENT_LIFECYCLE_STATUSES` buckets | `org_order_payments_dtl.payment_status` UPPERCASE | ✅ mirror |
| `ORDER_PAYMENT_STATUS` header values | `org_orders_mst.payment_status` | ✅ mirror |
| `REFUND_STATUSES` | `org_order_refunds_dtl.refund_status` | ✅ mirror |
| `VOUCHER_LINE_PAYMENT_STATUS` | voucher line column | ✅ mirror |
| `PAYMENT_METHODS.INVOICE = 'CREDIT_INVOICE'` | DB stores `CREDIT_INVOICE`; alias normalized at boundaries | ✅ mirror w/ documented alias |
| Overpayment resolution codes | `sys_fin_overpay_res_cd` FK-governed since 0378 | ✅ DB-enforced |
| `PAYMENT_STATUSES` lowercase | `org_payments_dtl_tr.status` lowercase | ✅ values mirror, but constant unused (FN-08) |
| `'APPLIED'` literal | `org_order_credit_apps_dtl.application_status` | value ✅, discipline ❌ (FN-10) |

## Type-level drift

- Duplicate exported type name `OrderPaymentStatus` (`lib/constants/payment.ts:222` vs `lib/constants/order-financial.ts:539`) — different unions under one name (FN-09). Rename the row-level one (e.g. `OrderPaymentRowStatus`) or re-export from a single home per the unification doc (`docs/dev/unification_types_order_payment_audit.md`).

## Docs ↔ implementation

- `Payment_Modal_v4_Engine_Architecture.md` — accurate against the file tree inspected (shell/container/simple-view/hooks/reusables all present). ✅
- Prior-report status log (`24_IMPLEMENTATION_STATUS.md`) — all spot-checked claims held (refund fixes, type-debt zero, retired modals as `.tsx.bak`). ✅
- ADR index integrity — broken by the dual-numbering collision (FN-07); several ADRs exist in near-duplicate pairs (e.g. `ADR-004-BVM-Owns-Operational-Financial-Effects.md` vs `ADR-004-business-voucher-wiring-owns-effects.md`), risking divergent edits.

## Locale/formatting drift

- Shared `formatMoneyAmountWithCode` (`lib/money/format-money`) vs private `formatCurrency` with `'ar-OM'/'en-OM'` in the two AR prints (FN-11). One formatter should win; region must come from tenant locale config, never a literal.
