# 16 — Resolution Addendum (2026-07-04)

Every finding from this report was remediated by the **Order-Fin Remediation
Program** (`../Order_Fin_Remediation_2026-07/PLAN.md` + `STATUS.md`), executed
2026-07-03 → 2026-07-04, **including the full retirement of the deprecated
`org_payments_dtl_tr` ledger** (user directive: removed from the entire
codebase and DB "as if it never existed"; the table was verified empty).

Final gates: `tsc --noEmit` 0 · eslint 0 · **jest 1602/1602 (162 suites)** ·
`npm run build` exit 0 · `check:i18n` ✅ · platform-inventories drift 0/0 ·
`sync:ui-access-contract` PASS.

## Finding → resolution map

| Finding | Resolution | Phase |
|---|---|---|
| FN-01 dual payment ledger | Readers repointed to canonical (`getOrderPaymentsCanonical`, Payments tab, both order prints, tenant Payments report, ready-page context, voucher linkage); writers removed; **ledger + `org_payment_audit_log` + `org_invoice_payments_dtl.payment_id` DROPPED** (mig `0395`, guarded RESTRICT-only). AR allocations are voucher-referenced only. Codified in **ADR-055 — Single Payment Read Model**; ADR-002 marked Implemented/REMOVED. | 1, 2, 3, 5 |
| FN-02 cancel unwind missing | Interim guard → full disposition flow: `unwindOrderFinancialsOnCancel` (CAS-guarded credit reversal to source ledgers, REFUND/STORE_CREDIT/KEEP_ON_ACCOUNT routing, promo reversal, snapshot recalc, `ORDER_CANCEL_FINANCIAL_UNWIND` outbox audit); disposition gate + amount-aware cancel dialog (EN/AR); KEEP_ON_ACCOUNT gated by `orders:approve_refund`. **ADR-053**. | 1, 4 |
| FN-03 fiscal comparand suppressed | Engine reads linked `org_tax_documents_mst.total_amount` in-tx; stale comments corrected; helper docblock updated. | 6 |
| FN-04 ungated print routes | Both order print routes: `requirePermission('orders:read')` + centralized tenant context; `tenants[0]` + `as any` removed. | 1 |
| FN-05 tax decomposition | Unchanged by design — gates e-invoice go-live, not this program (ADR-052 stands; noted in TAX_ENGINE_GUIDE). | — |
| FN-06 dual cash-recon | Cash-up module fully retired (service, actions, UI, page, nav mig `0394`); drawer sessions + D-09 recon are the single cash truth. | 5 |
| FN-07 ADR numbering collision | Decision pack renamed `ADR-PACK-nnn-*`; canonical `ADR-nnn` series is authoritative; new ADRs folded in as 053/055; `ADR/README.md` regenerated as full index. | 8 |
| FN-08 dead lowercase statuses | `PAYMENT_STATUSES` + `PaymentStatus` deleted with the `_tr` type surface. | 5 |
| FN-09 duplicate type name | Row-level union renamed `OrderPaymentRowStatus`; header `OrderPaymentStatus` (order-financial.ts) unchanged. | 7 |
| FN-10 `'APPLIED'` literal | `CREDIT_APPLICATION_STATUSES.APPLIED` at the settlement write site. | 7 |
| FN-11 locale-region hardcoding | Repo-wide sweep (36 files incl. the shared money formatter): `ar-OM`/`en-OM` → region-neutral `ar`/`en`; formatter test updated to the new contract. | 7 |
| FN-12 permission literals | `lib/constants/permissions/orders-perm.ts` + `finance-perm.ts` registries (DB-mirror), with the documented tooling rule: route guards/contracts keep literals (inventory extractor resolves literals only). | 7 |
| FN-13 dead allocation branch | Found already fixed in current code (guard now reachable, documented inline) — verified, no change needed. | 7 |
| R-07 multi-currency untested | `projectBaseCurrencyAmount` exported + fixture suite (rate ≠ 1, 4-dp rounding, NaN-safety, identity bound). | 6 |
| R-08 epsilon literal | `customer-open-balance-query` literals → `SETTLEMENT_MONEY_EPSILON` (4 sites). | 6 |

## Bonus fixes surfaced during execution

- **Catalog access contracts**: 8 routes reported "missing contract" because the
  extractor can't resolve identifier-referenced page requirements — inlined
  literal requirements (`admin:manage`); platform inventories now 0-drift.
- **Prisma↔DB stale drift**: the cash-drawer-movements relation pointed at the
  legacy ledger while its DB FK (`fk_org_cdm_order_payment`, 0271) targets the
  canonical table — repointed.
- **Nav↔contract mismatch**: `billing_vouchers` sidebar entry now mirrors the
  `fin_vouchers:view` page gate.
- **Refund lifecycle**: ready-page/return-order legacy `_tr` refund/cancel
  loops removed; F-R3-class numbering was already on `fn_next_fin_doc_no`.

## Still open (tracked, out of program scope)

- FN-05 per-category tax decomposition + jurisdiction adapter (e-invoice
  program, ADR-052; needs Q6 jurisdiction/timing).
- R-02 gateway capture/callback lifecycle (when a gateway tenant is real).
- Returns auto-refund wiring into the cancel-unwind service (noted in ADR-053).
- **Migrations `0393` / `0394` / `0395` await user review + apply (local then
  remote)** — 0395 carries hard ABORT guards re-verifying the empty-table
  premise at apply time.
- Payment Modal v4 manual QA (escalation #9 + tablet) — pre-existing item.
