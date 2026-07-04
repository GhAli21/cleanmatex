# Order Financial Remediation Program — Plan (2026-07)

**Source:** `docs/features/Order_Fin/Order_Fin_Validation_Report_2026-07-03/` (findings FN-01…FN-13, R-01…R-08) + user directive 2026-07-03: implement all three improvement tiers **and fully retire `org_payments_dtl_tr` — no gaps, removed from the entire codebase and DB as if it never existed** (table confirmed empty by user).
**Tracker:** [STATUS.md](./STATUS.md) — update at every phase step.
**Migration seq at planning time:** next free = `0393` (re-verify against `supabase/migrations/` before each new file).
**Standing rules:** load the relevant skill before writing code (`/database`, `/frontend`, `/backend`, `/i18n`, `/multitenancy`, `/navigation`, `/rebuild-ui-access-contract`); create migrations then **STOP for user review/apply — never apply**; never modify existing migrations; gates per phase = `eslint 0 · tsc 0 · jest green · npm run build · check:i18n (when i18n touched)`; every phase ends with a STATUS.md update + docs refresh + `/documentation` invocation.

---

## Decisions (defaults chosen production-grade; override before the affected phase)

| ID | Decision | Default (recommended) |
|---|---|---|
| D-1 | Fate of `/dashboard/internal_fin/payments` screens (list/new/detail — all `_tr`-backed) | **Retire.** Manual payment entry is superseded by order collect-payment, AR invoice payment, and customer receipts; listing is superseded by the (repointed) Payments report + order tabs + voucher screens. Remove screens + nav (dual-write). |
| D-2 | Cancel disposition options for paid orders (validation Q3) | **Refund** (existing refund flow) or **Store credit** (credit note / wallet per tenant policy); **Keep-on-account** allowed only with `orders:approve_refund`. Auto-restore consumed gift/wallet credit on cancel. No cancellation-fee support in this program. |
| D-3 | `org_payment_audit_log` (audits only `_tr` payments; CASCADE FK to it; writer = `payment-audit.service.ts`) | **Drop table + retire service** (verify 0 rows first). Canonical trails already exist: `order-audit.service`, voucher audit + outbox, `payment_audit` metadata on canonical rows. |
| D-4 | `org_invoice_payments_dtl.payment_id` (SET-NULL FK → `_tr`, 0314) | **Drop FK + column** (verify all-NULL first). Canonical AR allocations link via voucher trx line / receipt lineage, not this column. |
| D-5 | Owner "money position" dashboard tile (Tier 2 #5) | **In scope, Phase 2**, as a card on `/dashboard/reports` (no new nav → no nav migration). Reuses D-09 recon queries. |
| D-6 | Print-route permission strictness (validation Q4) | `orders:read` for both order print data routes (no new permission → no migration). |

---

## Phase 0 — Pre-flight verification (read-only; no code)

Confirm the empty-table premise and demolition preconditions on **local + remote** (user runs, or MCP read-only):

```sql
SELECT count(*) FROM org_payments_dtl_tr;                                   -- expect 0 (both DBs)
SELECT count(*) FROM org_payment_audit_log;                                 -- expect 0 → enables D-3
SELECT count(*) FROM org_invoice_payments_dtl WHERE payment_id IS NOT NULL; -- expect 0 → enables D-4
SELECT count(*) FROM org_order_refunds_dtl WHERE original_payment_id IS NOT NULL; -- FYI (FK already canonical via 0283)
```

Also: confirm next migration seq; confirm remote apply state of `0385`–`0392` (validation Q8). ✅ Exit: all four counts recorded in STATUS.md; any non-zero count pauses the affected decision (D-3/D-4) for user review.

---

## Phase 1 — Canonical order-payment read model + reader repoint + quick guards (FN-01 read side, FN-04, FN-02 interim)

**Skills:** `/backend`, `/frontend`, `/multitenancy`.

1. **Canonical read fn:** add `getOrderPaymentsCanonical(tenantId, orderId)` reading `org_order_payments_dtl` (join method catalog; expose lifecycle status, tendered/change, gateway refs, voucher linkage). Home: `order-financial-summary.service.ts` (it already selects these rows) or a thin sibling. Export a canonical row type from `lib/types/payment.ts`; **do not reuse** the `_tr`-shaped `PaymentTransaction` for it.
2. **Repoint readers (UI):** `app/dashboard/orders/[id]/page.tsx:79` and `[id]/full/page.tsx:95` (`allPayments`) → canonical fn; adapt `orders-payments-tab-rprt.tsx` columns (uppercase lifecycle statuses via i18n labels).
3. **Repoint + gate print routes (FN-04/D-6):** rewrite `app/api/v1/orders/[id]/report/payments-rprt/route.ts` + `…/invoices-payments-rprt/route.ts`: `requirePermission('orders:read')`, centralized tenant context (kill local `getAuthContext`/`tenants[0]`/`as any`), payments from the canonical fn; response types move to `lib/types/`.
4. **Voucher linkage:** `voucher-service.ts:295-600` — replace `_tr` include/findFirst with canonical lookup (`org_order_payments_dtl.voucher_id` / trx-line linkage).
5. **FN-02 interim guard:** in the cancel transition path, block when canonical `total_paid_amount > 0` or APPLIED credit > 0 with an i18n message ("refund first"); replace `console.warn` swallowing (`workflow-service-enhanced.ts:335,339`) with surfaced warnings + audit log entry.
6. **Tests:** DB-integration — settle order → canonical payment visible via the new read fn (locks the FN-01 seam); route tests (401/403/200 + tenant scope) for both print routes; unit for the guard (paid → blocked, unpaid → allowed).
7. i18n keys for tab/status/guard message (EN+AR), `check:i18n`.

✅ Exit: order Payments tab, both prints, and voucher linkage read canonical only; prints gated; paid orders can't be cancelled silently. **No migration.** STATUS + docs.

---

## Phase 2 — Payments report on canonical + money-position tile (FN-01 reporting, D-5)

**Skills:** `/backend`, `/frontend`, `/i18n`, `/dataviz` (tile).

1. `report-service.getPaymentsReport` (:240-356) → aggregate `org_order_payments_dtl` (COMPLETED/CAPTURED/SETTLED as collected; pending/authorized bucketed separately) **plus** AR invoice payments (`org_invoice_payments_dtl`) and posted customer receipts so invoice/on-account collections stay visible after Phase 3 removes the `_tr` write path. Method breakdown from method catalog; statuses = canonical constants (kills lowercase literals `:287-288`).
2. **Money-position card** on `/dashboard/reports`: today/this-week collections by method, outstanding AR, unresolved excess, open drawer sessions — reusing `finance-reconciliation-report.service.ts` + the new report aggregates. Gate: `finance_reports:view`. No new route-tree/nav.
3. Tests: report service unit (bucketing, method rollup) + DB-integration (canonical payment appears in report window); tile render test.

✅ Exit: tenant payment reporting is canonical-only and complete. **No migration.** STATUS + docs.

---

## Phase 3 — Write-path migration + legacy screens retirement (FN-01 write side, D-1)

**Skills:** `/frontend`, `/backend`, `/navigation`, `/rebuild-ui-access-contract`.

1. **Callers off `processPayment`:** `app/dashboard/ready/[id]/page.tsx:416` (paymentKind 'invoice'), `app/dashboard/customers/[id]/page.tsx:148`, `app/dashboard/b2b/customers/[id]/page.tsx:132` → replace with the canonical equivalents: AR invoice payment API (`/api/v1/ar/invoices/[id]/payments` → `allocateArPaymentTx`) for invoice payments; customer-receipts post flow for on-account money. Reuse existing modals/components where they exist (Cmx-only).
2. **Retire `/dashboard/internal_fin/payments`** (D-1): delete list/new/detail pages + `payment-crud-actions.ts`; **navigation dual-write** — remove `billing_payments` from `web-admin/config/navigation.ts:452` **and** a `sys_components_cd` migration (next seq; `/navigation` skill). Update page-access contracts + run inventories refresh (`Mode: refresh`, surfaces nav+page).
3. **Actions cleanup:** `app/actions/payments/process-payment.ts` — remove `_tr`-backed exports (or the whole file if empty); `ready-order-actions.ts` likewise.
4. Tests: replaced flows (invoice payment from ready page → AR allocation row), contract check green.

⛔ **Migration gate:** create the nav migration then STOP for user review/apply.
✅ Exit: zero production writers of `_tr` remain (grep for `org_payments_dtl_tr.create|update` in `lib`, `app` = 0). STATUS + docs.

---

## Phase 4 — Cancellation financial disposition (FN-02 full, D-2)

**Skills:** `/backend`, `/frontend`, `/database` (if any migration), `/i18n`.

1. **`unwindOrderFinancialsTx`** (settlement-owned, same-tx composable): reverse APPLIED credit apps → `REVERSED` (constant, not literal); restore stored value (wallet/advance/gift via existing ledger services, idempotency-keyed `cancel-<orderId>-…`); route real payments per chosen disposition — **Refund** (existing `order-refund.service` initiate/approve/process, auto-approved per D-2 policy for cancel-refunds or kept maker-checker — default: keep maker-checker) or **Store credit** (issue credit note / wallet top-up); **Keep-on-account** writes an overpayment-disposition row and requires `orders:approve_refund`; then `recalculateOrderFinancialSnapshotTx` + audit row + outbox event.
2. **Promo/gift reversal goes canonical:** replace `order-cancel-service.reversePromoAndGiftForOrder` `_tr` reads (:63-79) with promo-usage-log reversal (already canonical, `reversePromoUsageTx`) + gift-card credit apps from `org_order_credit_apps_dtl`.
3. **Cancel dialog:** when canonical paid/credit > 0, show amounts + disposition choice (replaces the Phase-1 hard block); confirmation summary; EN/AR.
4. **Remove the legacy loop:** `workflow-service-enhanced.ts:322-340` (`getPaymentsForOrder`/`cancelPayment` over `_tr`) → call the unwind service.
5. **Tests:** unwind invariants (post-cancel: no APPLIED credit, payments disposed, snapshot outstanding/paid correct, stored value restored once — idempotent replay), dialog gating unit, DB-integration happy path.
6. **ADR:** write `ADR — Order Cancellation Financial Disposition` (validation report 14).
7. Permissions: reuse existing codes (no migration expected). If any new code proves necessary → dedicated permission migration + `/create-update-rbac-permission`.

✅ Exit: cancelling a paid order forces a disposition; money never disappears. STATUS + docs.

---

## Phase 5 — `org_payments_dtl_tr` full demolition (DB + code + Prisma) 🔥

**Skills:** `/database`, `/backend`, `/multitenancy`. **Precondition:** Phases 1–4 merged; Phase 0 counts all zero; grep confirms no runtime reader/writer.

1. **Code deletion:**
   - `payment-service.ts` — delete all `_tr` functions: `recordPaymentTransaction`, `processPayment`, `getPaymentsForOrder`, `getPaymentsForCustomer`, `getPaymentHistory`, `applyPaymentToInvoice` (canonical = AR allocate), `refundPayment` (canonical = `order-refund.service`), `listPayments`, `getPaymentStats`, `getPaymentById`, `updatePaymentNotes`, `cancelPayment`, `getPaymentStatus`. Keep only non-`_tr` utilities (method/type catalogs, validation) — if that's all that remains, fold them into `payment-config.service.ts` and delete the file.
   - `cashup-service.ts` + `app/actions/billing/cashup-actions.ts` + `src/features/billing/ui/cashup-history.tsx` — **retire** (FN-06). Check for a cashup nav entry; if present, dual-write removal (navigation.ts + `sys_components_cd` migration — can share Phase 5's migration seq window as a separate file).
   - `payment-audit.service.ts` — retire with `org_payment_audit_log` (D-3); remove its two `internal_fin` consumers (already deleted in Phase 3).
   - `app/actions/orders/delete-order.ts:63` — remove the `_tr` deleteMany.
   - `order-submit-orchestrator.service.ts:991-997` — rewrite the historical comment to reference the drop migration.
   - `lib/constants/payment.ts:113-121` — delete lowercase `PAYMENT_STATUSES` + `PaymentStatus` type (FN-08); delete/re-home the `_tr`-shaped `PaymentTransaction` type.
   - Tests: rewrite `payment-service.test.ts` for surviving code (or delete); update `order-cancel-service.test.ts` to the canonical reversal.
2. **Prisma:** remove the `org_payments_dtl_tr` and `org_payment_audit_log` models + back-relations (e.g. on `sys_payment_method_cd`, vouchers); regenerate client.
3. **Migration (new seq, one file, additive-destructive with manifest):**
   ```sql
   -- Guarded: ABORT if any table still has rows (defense in depth)
   -- 1. DROP FK org_payment_audit_log.payment_id → org_payments_dtl_tr; DROP TABLE org_payment_audit_log RESTRICT (D-3)
   -- 2. ALTER TABLE org_invoice_payments_dtl DROP CONSTRAINT fk_oip_pay; DROP COLUMN payment_id (D-4)
   -- 3. DROP TABLE org_payments_dtl_tr RESTRICT  (policies/indexes/CHECKs incl. chk_payments_voucher_required drop with it)
   ```
   No CASCADE anywhere (deps dropped explicitly first — satisfies the RESTRICT rule). Include a header manifest of every dropped object + rationale + "recreate = restore from migrations 0091/0096/0097/0132 history" note. **Do not touch historical migrations** (0091…0314 remain as history).
   ⛔ **STOP: user reviews + applies (local, then remote).**
4. **Acceptance (the "never existed" bar):** `grep -r "org_payments_dtl_tr" web-admin/ cmx-api/ --include=*.{ts,tsx,prisma}` → **0 hits**; repo-wide grep hits only historical migrations + docs/ADRs (which describe the removal); Prisma client regenerated without the model; full gates green; DB (post-apply) has neither table.
5. **ADR-002 update:** status → **Implemented/Removed** (drop migration cited); write the new `ADR — Single Payment Read Model`.

✅ Exit: the table and every trace of it in live code are gone. STATUS + docs.

---

## Phase 6 — Correctness wires (FN-03 + multi-currency test)

**Skills:** `/backend`, `/testing`.

1. **FN-03:** in `recalculateOrderFinancialSnapshotTx`, when `order.tax_document_id` is set, read the linked `org_tax_documents_mst` total in-tx and pass it as `taxDocumentTotalAmount` (`order-financial-write.service.ts:815-824`); delete the stale "until that table ships" comment. Unit tests: match → no warning; mismatch → `TAX_DOCUMENT_TOTAL_MISMATCH`.
2. **Multi-currency fixture (R-07):** recalc test with `currency_ex_rate = 0.26` asserting all six `base_cur_*` projections.
3. Epsilon touch-up (R-08): `customer-open-balance-query.service.ts:220` literal `0.001` → `SETTLEMENT_MONEY_EPSILON`.

✅ Exit: §16.1 control live; projections tested. **No migration.** STATUS + docs.

---

## Phase 7 — Formatting, RBAC registry, hygiene (FN-11, FN-12, FN-09, FN-10, FN-13)

**Skills:** `/frontend`, `/i18n`, `/backend`.

1. **FN-11:** `ar-invoice-print-rprt.tsx` + `ar-customer-statement-print-rprt.tsx` — delete private `formatCurrency`/`formatDate` with `'ar-OM'/'en-OM'`; use `formatMoneyAmountWithCode` + tenant-locale date formatting (region from tenant config, never a literal). Visual check EN + AR/RTL.
2. **FN-12:** create `lib/constants/permissions/orders-perm.ts` + `finance-perm.ts` (`{DOMAIN}_PERMISSIONS`, codes exactly as seeded — DB-mirror); swap route/UI literals to the constants (values unchanged → **no migration**); inventories refresh (`surface=api,page`).
3. **Hygiene:** rename `lib/constants/payment.ts:222` type → `OrderPaymentRowStatus` (FN-09; update importers); `order-settlement.service.ts:319` → `CREDIT_APPLICATION_STATUSES.APPLIED` (FN-10); remove the dead `allow_partial_last_target` branch (FN-13) with a comment pointing to the D-12 §4 analysis.

✅ Exit: one formatter, one permission registry, no duplicate money-type names. STATUS + docs.

---

## Phase 8 — Governance + program closure (FN-07, ADRs, docs)

**Skills:** `/documentation`.

1. **ADR renumber (FN-07):** split the two series in `docs/features/Order_Fin/ADR/` into `ADR-BVM-nnn` / `ADR-FIN-nnn` (file renames + in-doc title updates), merge/supersede near-duplicate pairs, regenerate `ADR/README.md` index. Fix inbound doc links (grep `ADR-0` across `docs/`).
2. **New/updated ADRs** (if not landed in-phase): Cancellation Disposition (P4), Single Payment Read Model (P5), Report/Print Access Contract (P1), Tenant Locale Document Formatting (P7); ADR-052 amendment (FN-03 closed).
3. **Validation report addendum:** add `16_RESOLUTION_ADDENDUM.md` to `Order_Fin_Validation_Report_2026-07-03/` mapping FN-xx → phase/commit/migration.
4. Final STATUS.md close-out; memory update; full-suite gates one last time.

✅ Exit: program closed, citable, drift-proof.

---

## Documentation update / refresh tasks (mandatory, per phase)

Standing rule (applies to every phase, in addition to the specific tasks below): update [STATUS.md](./STATUS.md) (phase row, gates, session log, migration ledger) **at every step**, and end every phase by invoking the `/documentation` skill to execute that phase's doc tasks. A phase is NOT complete while any of its doc tasks is open.

| Phase | Documents to update / refresh |
|---|---|
| **0** | STATUS.md pre-flight table (4 counts local+remote, seq, 0385–0392 remote state). |
| **1** | `technical_docs/tech_api.md` (print routes: new guard + canonical source + relocated response types) · `technical_docs/tech_data_model.md` (canonical order-payment read model) · `Order_Fin_Docs/ORDER_FINANCIAL_PLATFORM.md` (Payments tab source = canonical) · `Order_Fin_QA_Guide_2026-06-26.md` + `order_fin_manual_test_guide_v2.md` (Payments tab / print / cancel-guard test steps) · validation report cross-ref: mark FN-04 + FN-02-interim in the Phase-8 addendum draft. |
| **2** | `Order_Fin_Docs/RECONCILIATION_GUIDE.md` (money-position tile: what it shows, where numbers come from) · `technical_docs/tech_api.md` (payments-report source change) · reports user-facing doc section in `developer_guide.md` if it describes `getPaymentsReport`. |
| **3** | **Navigation docs are dual-write side-effects:** after the nav migration, run `npm run rebuild:platform-info-inventories` (`Mode: refresh`, `surface=navigation,page`) and commit regenerated `docs/platform/inventories/GENERATED_*.md` · update page-access contract docs (`docs/platform/ui-access-contract/` inventory refresh) · `developer_guide.md` + `Order_Fin_Docs/ORDER_FINANCIAL_PLATFORM.md`: remove internal_fin/payments references; document the canonical replacement flows (AR invoice payment, customer receipts) · feature-doc checklist per `.claude/skills/implementation/prd-rules.md` (navigation delta, removed routes, i18n keys). |
| **4** | New `ADR — Order Cancellation Financial Disposition` (in `../ADR/`) · `Order_Fin_Docs/ORDER_FINANCIAL_PLATFORM.md` + `Order_Fin_Docs/STORED_VALUE_GUIDE.md` (cancel disposition + stored-value restore semantics) · `user_guide` addition: cancelling a paid order (EN description of the 3 dispositions) · QA guides: cancellation scenarios (paid cash, credit-applied, gift-card, keep-on-account approval) · inventories refresh if any permission usage changed (`surface=api,page`). |
| **5** | 🔥 Demolition docs sweep: update `ADR-002-Deprecate-org-payments-dtl-tr.md` → status **Implemented/Removed** (cite drop migration seq) · new `ADR — Single Payment Read Model` · `technical_docs/tech_data_model.md` (remove `_tr` + `org_payment_audit_log` from the model; note `org_invoice_payments_dtl.payment_id` removal) · `technical_docs/tech_api.md` (removed payment-service functions + their replacements table) · `Order_Fin_Docs/CASH_DRAWER_GUIDE.md` (cash-up retirement → drawer sessions + D-09 recon are the only cash truth) · **repo-wide doc grep:** `grep -rl "org_payments_dtl_tr\|cashup\|internal_fin/payments" docs/ web-admin/docs/ .claude/` → annotate every live doc hit (historical reports/ADRs get a one-line "removed by <migration>" note only where misleading, others left as history) · `IMPLEMENTATION_STATUS.md` + `current_status.md` + `progress_summary.md` in `docs/features/Order_Fin/` (program milestone). |
| **6** | `Order_Fin_Docs/TAX_ENGINE_GUIDE.md` (fiscal-total check now live; when it fires) · `F-05-E-Invoicing-Foundation.md` + `ADR-052` amendment (FN-03 closed; decomposition still open) · `technical_docs/tech_data_model.md` (comparand wiring). |
| **7** | `docs/dev/unification_types_order_payment_audit.md` (renamed `OrderPaymentRowStatus`, deleted lowercase `PAYMENT_STATUSES`, permission registries as the new pattern) · `.claude/docs/settings-reference.md` only if any setting touched (default: none) · i18n note in the frontend/i18n sections of `developer_guide.md` (single money/date formatter rule for documents) · inventories refresh (`surface=api,page`) after the permission-literal → constant swap. |
| **8** | ADR folder: renumber/prefix + regenerate `../ADR/README.md` index + fix inbound links (grep `ADR-0` across `docs/`) · add `16_RESOLUTION_ADDENDUM.md` to `../Order_Fin_Validation_Report_2026-07-03/` (FN-xx → phase/commit/migration map) + one-line pointers in that report's `README.md` and `12_MUST_FIX_ITEMS.md` · final `IMPLEMENTATION_STATUS.md` / `current_status.md` / `progress_summary.md` close-out · Claude memory update (program complete) · verify `docs/features/Order_Fin/README.md` still indexes correctly. |

**Doc-task gates:** Phase 3 and Phase 5 doc tasks include regenerating platform inventories — treat `npm run check:platform-info-inventories` as part of those phases' exit gates. Phases that add/change i18n keys (1, 2, 4) include `npm run check:i18n` in their gates (already listed in the standing rules).

## Deferred (explicitly out of program)

- FN-05 tax decomposition + jurisdiction adapters — own e-invoice program (ADR-052; needs Q6 jurisdiction/timing).
- Gateway capture/callback lifecycle (R-02) — when a gateway tenant is real.
- Customer-portal statement self-service — with the portal program.
- Duplicate route pairs audit (`refund` vs `refunds`, `financial-reconcile` vs `financial-reconciliation`) — quick check can ride Phase 7 if time allows (validation Q9).

## Migration ledger (planned)

| Phase | Migration | Content |
|---|---|---|
| 3 | seq at execution | `sys_components_cd` removal of `billing_payments` nav (dual-write with navigation.ts) |
| 5 | seq at execution | drop `org_payment_audit_log` (FK first), drop `org_invoice_payments_dtl.payment_id` (FK+column), drop `org_payments_dtl_tr` — RESTRICT only, row-count guards, manifest header |
| 5 (cond.) | seq at execution | cashup nav removal if a nav entry exists |
| 4 (cond.) | only if a new permission is required | permission seed (default: none) |

Every migration: create file → **STOP → user reviews + applies (local, then remote)** → verify → continue.
