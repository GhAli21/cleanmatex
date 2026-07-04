# 13 — Recommended Direction

Guiding principle: the canonical engine is right — **finish the migration to it and delete the second system**. No redesign is needed; every recommendation below reduces concept count.

## 1. Ledger unification program (closes FN-01, FN-06, most of 06-matrix ❌)

Phased, low-regression:

1. **Size it:** run the [15 Q1](./15_OPEN_QUESTIONS.md) counts on prod. Decide historical-row handling (display-union vs backfill vs cutoff note).
2. **Read-side repoint** (Must-Fix 1): Payments tab, order prints, Payments report, voucher payment-linkage display → canonical tables. One payment list per order, sourced once.
3. **Write-side finish:** migrate the remaining `_tr` writers — `processPayment`/`recordPaymentTransaction` invoice/customer flows (customers, b2b, ready, internal_fin pages) — onto the voucher/AR path they already half-use (`createReceiptVoucherForPayment` exists inside the `_tr` writer; the BVM equivalents are live). Then `_tr` becomes read-only history per ADR-002.
4. **Cash-up:** retire `cashup-service` + `cashup-history.tsx` in favor of cash-drawer sessions + the D-09 recon report (or repoint to `org_cash_drawer_movements` if the screen must stay).
5. **Guard:** temporary recon query (or D-09-style report) comparing `_tr` vs canonical during the transition; delete constants (`PAYMENT_STATUSES` lowercase) and the `_tr` CRUD API surface at the end.

**Value:** restores one-truth reporting, removes a whole class of support tickets, and deletes code. This is the highest ROI item in the system.

## 2. Cancellation disposition flow (closes FN-02)

GCC/worldwide-standard shape, smallest complete version:

- Cancel dialog on a paid order shows the canonical paid/credit amounts and requires a disposition: **Refund** (routes into the existing, already-hardened refund flow) or **Store credit** (issue credit note / wallet per tenant policy — the stored-value services exist) or **Keep on account** behind `orders:approve_refund`-class permission.
- Server: one settlement-owned `unwindOrderFinancialsTx` — reverse APPLIED credit apps (write the REVERSED status that already exists in constants), create the disposition/refund rows, recalc the snapshot, audit row. Reuse; don't invent new ledgers.
- Interim guard first (Must-Fix 2) so nothing paid can be cancelled silently while the full flow is built.

## 3. Compliance runway (FN-03 now, FN-05 scheduled)

- Wire the fiscal-total comparand now (tiny).
- Schedule per-category tax decomposition + jurisdiction adapter as the ZATCA/e-invoice phase gate (ADR-052). Don't start adapters before a target jurisdiction/tenant is committed — that would be overengineering today.

## 4. Access + consistency hygiene (FN-04, FN-11, FN-12, FN-08–FN-10)

One hardening batch: permission-gate the print routes; single money/date formatter with tenant-locale region (kill `ar-OM` literals); create `lib/constants/permissions/orders-perm.ts` + `finance-perm.ts` registries and swap route literals; delete dead lowercase constants; rename the duplicate `OrderPaymentStatus`; constant-ize `'APPLIED'`. All mechanical, all low-risk, all reduce future review cost.

## 5. Governance (FN-07)

Renumber/prefix the two ADR series (`ADR-BVM-*` vs `ADR-FIN-*` or a single renumbered sequence), regenerate `ADR/README.md`, and de-duplicate the near-identical pairs. One afternoon; prevents the next agent/engineer citing the wrong decision.

## What NOT to do

- Don't build a general ledger / journal-entry layer — the voucher spine + fact tables + snapshot already deliver the auditability a laundry SaaS needs at these business sizes; a GL belongs in the future ERP-integration phase if ever.
- Don't add feature-flag kill-switches back (ADR-051 decided RBAC-as-control; nothing found this pass changes that).
- Don't invest in broad E2E before the ledger unification — it would pin wrong behavior.
- Don't redesign Payment Modal v4 — it's the strongest surface in the system; finish its manual QA and move on.

## Suggested sequencing

| Window | Work |
|---|---|
| Now (gate) | Must-Fix 1–4 + their locking tests |
| Next | Ledger write-side finish + cash-up retirement + cancellation full flow |
| Then | Hygiene batch (FN-08…FN-13, FN-11) + ADR renumber + multi-currency test fixture |
| Scheduled | E-invoice decomposition phase (own program, per ADR-052); gateway lifecycle when a gateway tenant is real |
