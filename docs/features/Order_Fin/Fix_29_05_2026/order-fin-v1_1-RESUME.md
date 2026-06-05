# Order Fin v1.1 — RESUME doc (post `/clear`)

**Last update:** 2026-06-05
**Plan file:** [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md)
**Status tracker:** [order-fin-v1_1-implementation-status.md](order-fin-v1_1-implementation-status.md)
**Predecessor (Codex v4 already shipped):** [Order_Fin_Canonical_Semantics_Implementation_Notes.md](Order_Fin_Canonical_Semantics_Implementation_Notes.md)

> **Purpose:** This doc is the only thing a fresh Claude session needs (besides the plan, status tracker, and codebase) to continue the Order Fin v1.1 rollout end-to-end. Read this first.

---

## 0. Hard rules to honor (do NOT skip)

These are from `CLAUDE.md` + memory + the locked plan. Treat as gates, not suggestions:

1. **Skills first.** Before writing each domain's code, load the relevant skill: `/database` for SQL/migrations, `/multitenancy` for `org_*` queries, `/backend` for services, `/frontend` for UI, `/i18n` for translations, `/code-documentation` for inline comments, `/storybook` for new Cmx primitives, `/testing` for tests.
2. **Never apply migrations.** Create the `.sql` file → STOP → wait for the user to apply → only then continue.
3. **Never amend existing migration files.** Always next-sequence number.
4. **Constants mirror DB strings exactly.** Same case, same separators (e.g. DB value `'APPLIED'` → constant `APPLIED: 'APPLIED'`).
5. **Permission codes are two-part `resource:action`.** Every new permission needs a DB seed in the same migration.
6. **TEXT not VARCHAR.** `DROP ... CASCADE` banned — `RESTRICT` only.
7. **Multi-tenant.** Every query filters `tenant_org_id`. RLS on every new `org_*` table.
8. **Bilingual.** Any UI text gets EN + AR + RTL.
9. **Cmx components only** (`@ui/*`). Never raw HTML / shadcn.
10. **After every phase:** `npm run typecheck`, `npm run check:i18n` (only if labels changed), `npm run build`, targeted Jest. Then write the phase deliverable doc + update the status tracker. Mark the phase row Done in `order-fin-v1_1-implementation-status.md`.

The **5 plan-locked precision edits** (already baked into the plan; do NOT regress):
- generic target discrimination stays on `org_fin_voucher_trx_lines_dtl.target_type/target_id`; do **not** add `payment_target_type` to `org_order_payments_dtl`, which remains ORDER-only
- credit-app `application_status` enum = `PENDING, RESERVED, PROCESSING, APPLIED, FAILED, CANCELLED, REVERSED, EXPIRED` (8 values)
- `refund_source_type` enum = `REAL_PAYMENT_REFUND, GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE, MANUAL_EXCEPTION` (7 values; no generic STORED_VALUE_RESTORE)
- `TAX_INCLUSIVE` identity is `total = net_before_tax + rounding` (tax already in the inclusive price; do NOT add tax again)
- Phase 10 removed (legacy DROP already shipped via 0335)

---

## 1. Where we are right now

| Phase | Status | Notes |
|---|---|---|
| 0 — Plan adoption + status tracker | ✓ Done | 2026-06-04 |
| 1 — P0 tax-doc warning fix | ✓ Done | 2026-06-04 — see `phase-01-p0-tax-doc-warning-fix.md` |
| 2 — Tax-base decomposition columns | ✓ Done | 2026-06-04 — migration 0336 applied — see `phase-02-tax-base-decomposition.md` |
| **3 — ORDER-only payment validation + credit-app lifecycle** | **✓ Done** | 2026-06-04 — migration 0337 applied — see `phase-03-payment-target-and-credit-lifecycle.md` |
| 4 — Base-currency snapshot | ✓ Done | 2026-06-05 — migration 0338 applied — see `phase-04-base-currency-snapshot.md` |
| 5 — Tax-inclusive pricing (ADR-017) | ✓ Done | 2026-06-05 — migration 0339 applied — see `phase-05-tax-inclusive-pricing-build.md` |
| 6 — Refund source-lineage + reopens-due (ADR-030) | ✓ Done | 2026-06-05 — migration 0340 applied — see `phase-06-refund-source-lineage-and-reopen-due.md` |
| 7 — Tax-document full lifecycle | ✓ Done | 2026-06-05 — migration 0341 applied — see `phase-07-tax-document-lifecycle.md` |
| 8 — UI consolidation | Pending | no migration |
| 9 — Legacy reader sanity grep (passive) | Pending | no migration; Codex v4 audit already certified clean — this is just a permanent CI grep gate |
| 11 — `/documentation` skill refresh + Codex deferred coverage | Pending | no migration; closeout |

Phase 10 was removed (legacy DROP shipped via 0335).

---

## 2. Phase 4 shipped / Phase 5 handoff

### 2.1 Migration / final design state

[`supabase/migrations/0337_payment_target_and_credit_app_lifecycle.sql`](../../../supabase/migrations/0337_payment_target_and_credit_app_lifecycle.sql) — **applied 2026-06-04**

The corrected Phase 3 decision is now locked:

- Do **not** add `payment_target_type` to `org_order_payments_dtl`.
- Keep `org_order_payments_dtl` for ORDER real payments only.
- Use `org_fin_voucher_trx_lines_dtl.target_type` + `target_id` as the generic discriminator.
- Enforce the invariants in code and reconciliation:
  - `ORDER_PAYMENT` voucher lines must create `org_order_payments_dtl`
  - `INVOICE_PAYMENT` voucher lines must **not** create `org_order_payments_dtl`
  - `ORDER_CREDIT_APPLICATION` voucher lines must create `org_order_credit_apps_dtl`

Effective Phase 3 schema/runtime outcome:
- `org_order_credit_apps_dtl` has `application_status TEXT NOT NULL DEFAULT 'APPLIED'` with the 8-state lifecycle
- `org_orders_mst` has `pending_credit_application_amount` and `failed_credit_application_amount` (`DECIMAL(19,4) NOT NULL DEFAULT 0`)
- `org_order_payments_dtl` remains ORDER-only; generic target lineage stays on voucher lines

### 2.2 What Phase 3 shipped

Phase 3 code/documentation is complete and validated:

1. Prisma schema updated for `application_status` and the two new order-header amount columns.
2. Credit-app lifecycle status constants/types added and read/write models extended.
3. `order-financial-write.service.ts` now derives:
   - `total_credit_applied_amount` from `APPLIED`
   - `pending_credit_application_amount` from `PENDING/RESERVED/PROCESSING`
   - `failed_credit_application_amount` from `FAILED/CANCELLED/EXPIRED`
   - `credit_reversed_amount` from `REVERSED`
4. Voucher-line handlers now validate `target_type='ORDER'` and `target_id=order_id` for ORDER settlement and ORDER credit-application flows.
5. Reconciliation checks added:
   - `PAYMENT_TARGET_VS_ORDER_TOTALS`
   - `CREDIT_APP_LIFECYCLE_CONSISTENCY`
6. EN/AR labels and targeted tests landed.
7. Validation gates passed: `prisma generate`, `typecheck`, `check:i18n`, targeted Jest, `build`.

### 2.3 Phase 4 shipped

[`supabase/migrations/0338_order_fin_base_currency_snapshot.sql`](../../../supabase/migrations/0338_order_fin_base_currency_snapshot.sql) — **applied 2026-06-05**.

Effective Phase 4 schema/runtime outcome:
- `org_orders_mst` has nullable `base_cur_currency_code`
- `org_orders_mst` has six `base_cur_*` reporting snapshot amounts:
  - `base_cur_total_amount`
  - `base_cur_tax_amount`
  - `base_cur_paid_amount`
  - `base_cur_credit_applied_amount`
  - `base_cur_outstanding_amount`
  - `base_cur_ar_receivable_amount`
- Numeric `base_cur_*` amounts are projected as `transaction_amount * currency_ex_rate`
- `base_cur_currency_code` remains nullable because the source-of-truth is HQ-managed `TENANT_CURRENCY` consumed via HQ API
- Reconciliation checks added:
  - `BASE_CURRENCY_RATE_PRESENT`
  - `BASE_VS_ORDER_AMOUNT_CONSISTENCY`
- Validation gates passed: `prisma generate`, `typecheck`, `check:i18n`, targeted Jest, `build`

### 2.4 Phase 5 shipped

All Phase 5 deliverables complete (2026-06-05):
- Prisma schema updated (org_tenants_mst + org_branches_mst pricing mode columns).
- `TAX_PRICING_MODES`, `EXTRA_PRICE_PRICING_MODES` constants + `PRICING_MODE_CONSISTENCY` recon check name added.
- `TaxPricingMode`, `ExtraPricePricingMode` types + `taxPricingModeAtCalculation` in snapshot type.
- `pricing-mode-resolver.service.ts` created.
- `order-financial-write.service.ts`: TAX_INCLUSIVE branch in `resolveCanonicalTotalAmount`, `extractTaxFromInclusive` exported, snapshot version 5, audit field `taxPricingModeAtCalculation`.
- `checkPricingModeConsistency` recon check added to `order-checks.ts`.
- EN + AR i18n keys added.
- 12 Jest unit tests green.
- `prisma generate`, `tsc --noEmit`, `check:i18n`, `build` all green.
- Phase doc: `phase-05-tax-inclusive-pricing-build.md`.

### 2.5 Phase 6 shipped

All Phase 6 deliverables complete (2026-06-05):
- Migration 0340 applied — `refund_source_type` (7-value CHECK, NOT NULL) + `reopens_due_amount` (DECIMAL NOT NULL ≤ refund_amount) added to `org_order_refunds_dtl`; backfilled from method/metadata heuristics; `MANUAL_EXCEPTION` fallback with review query.
- `REFUND_SOURCE_TYPES` constants + `RefundSourceType` type added.
- `RefundFactRow` type and `classifyRefunds` exported from write service; canonical `refund_source_type` path wired; legacy heuristic fallback retained; `refundReopensDueAmount` sourced from `reopens_due_amount` column.
- `REFUND_SOURCE_LINEAGE_CLASSIFICATION` (WARNING) and `REFUND_REOPENS_DUE_BOUND` (BLOCKER) recon checks added.
- EN + AR i18n keys added under `OrderFinancial.refunds.sourceTypeLabels` + `reopensDueAmount`.
- 21 Jest unit tests green; `prisma generate`, `tsc --noEmit`, `check:i18n`, targeted Jest, `build` all green.
- Phase doc: `phase-06-refund-source-lineage-and-reopen-due.md`. ADR-030 flipped to Implemented.

### 2.6 Phase 7 shipped

All Phase 7 deliverables complete (2026-06-05):
- Migration 0341 applied — 4 tables: `org_tax_documents_mst` (immutability trigger `trg_tax_doc_immutable`), `org_tax_doc_lines_dtl`, `org_tax_doc_seq_counters` (row-locked `SELECT … FOR UPDATE` allocator), `org_tax_doc_triggers_cfg`. `currency_ex_rate DECIMAL(10,6)` + `base_currency_code TEXT` per ADR-039 convention. 5 permissions seeded. Backfill from legacy `tax_document_*` header fields.
- Prisma schema updated for all 4 models; back-relations added to `org_orders_mst`, `org_order_taxes_dtl`, `org_tenants_mst`; `prisma generate` green.
- `tax-document-sequence.service.ts`: `allocateTaxDocumentSequence` (INSERT ON CONFLICT + SELECT FOR UPDATE + UPDATE), `formatTaxDocumentNo` (prefix + 6-digit zero-pad).
- `tax-document-decision.service.ts` (pure — no DB, no `server-only`): `decideTaxDocumentIssuance` decision matrix, `decideCorrectionDocumentType` (netDelta → DEBIT_NOTE/CREDIT_NOTE/null).
- `tax-document-write.service.ts`: `createTaxDocumentTx`, `issueTaxDocumentTx`, `createAndIssueTaxDocument`, `supersedeTaxDocument`, `getTaxDocumentTriggerConfigs`.
- 3 recon checks added to `order-checks.ts`: `RECON_TAX_DOC_SEQUENCE_GAPS` (WARNING), `RECON_TAX_DOC_IMMUTABILITY` (BLOCKER), `RECON_TAX_DOC_VS_ORDER_TOTALS` (WARNING).
- `taxDocuments` namespace added to EN + AR (status, type, triggerEvent, field labels).
- 33 Jest unit tests green; tsc (Phase 7 files) + i18n parity green.
- Phase doc: `phase-07-tax-document-lifecycle.md`.

### 2.7 Next action

Continue **Phase 8** next (UI consolidation — no migration required):

1. Load `/frontend`, `/i18n`, `/storybook` skills.
2. Surface all new fields from Phases 2–7 in `web-admin/src/features/orders/ui/order-financial/`.
3. Extract `order-tax-base-buckets.tsx` and `tax-document-lifecycle-timeline.tsx` components.
4. Add `.stories.tsx` per `/storybook` standards (RTL + a11y).
5. Run `npm run check:i18n` + `npm run build`.

---

## 3. Phases 4 – 11 — execute in order after Phase 3

Read the corresponding section of the plan file ([order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md)) before each phase. Same rhythm: load skills → create migration → STOP for user apply → wire code → tests → gates → deliverable doc → status update.

| Phase | Migration | Key files |
|---|---|---|
| **4 — Base-currency snapshot** | `0338_order_fin_base_currency_snapshot.sql` | `web-admin/lib/services/order-financial-write.service.ts` (project amounts via stored `currency_ex_rate` — historical rate only, never re-fetch; resolve `base_cur_currency_code` from HQ-managed `TENANT_CURRENCY`); `lib/services/order-financial-summary.service.ts`; types/constants/mapper/view model. |
| **5 — Tax-inclusive pricing (ADR-017)** | `0339_tax_pricing_mode_config.sql` (created, and reviewed/applied by user) | Tenant + branch settings columns; new `web-admin/lib/services/pricing-mode-resolver.service.ts`; calculator branch (TAX_EXCLUSIVE keeps `total = net_before_tax + tax + rounding`; TAX_INCLUSIVE uses `total = net_before_tax + rounding` and extracts taxable/tax from the inclusive price — do NOT add tax twice). New permissions `tenant_settings:update_pricing_mode` and `branch_settings:update_pricing_mode` seeded same migration. Feature flag `FF_TAX_INCLUSIVE_PRICING` gates UI surface for soak. Phase 2 buckets get populated for the first time here. Flip ADR-017 status to Implemented in the phase doc. |
| **6 — Refund source-lineage + reopens-due (ADR-030)** | `0340_refund_source_lineage_and_reopen_due.sql` | `org_order_refunds_dtl` + `refund_source_type` (7-value CHECK, no generic STORED_VALUE_RESTORE) + `source_payment_id UUID REFERENCES org_order_payments_dtl(id) ON DELETE RESTRICT` + `reopens_due_amount`. Backfill from `refund_method_code` + metadata; emit a review query for rows that can't be classified — do NOT silently guess. Refund handlers populate the new columns; write service replaces the `refundReopensDueAmount = 0` constants with real sums. MANUAL_EXCEPTION requires permission + reason per ADR-030. Flip ADR-030 status to Implemented. |
| **7 — Tax-document full lifecycle** | `0341_tax_documents_master_and_lines.sql` | New tables `org_tax_documents_mst` (status, document_type, sequence_number unique per tenant+document_type+fiscal_year, supersedes_id self-FK), `org_tax_documents_lines_dtl`, `org_tax_document_triggers_cfg`. DB-level UPDATE guard preventing mutation of ISSUED status. New services: `tax-document-decision.service.ts`, `tax-document-write.service.ts`, `tax-document-sequence.service.ts` (row-locked allocator with `SELECT ... FOR UPDATE`). Wire the Phase 1 helper `evaluateTaxDocumentTotalMismatch` with the real `tax_document.total_amount`. New permissions seeded same migration. **Cross-project coordination required** — cleanmatexsaas onboarding invoices must use a separate document_type namespace so allocators don't collide. Riskiest phase — request finance sign-off + 2-week soak. |
| **8 — UI consolidation** | none | Surface ALL new fields in `web-admin/src/features/orders/ui/order-financial/*` using `@ui/*` Cmx primitives only. Extracted components: `order-tax-base-buckets.tsx`, `tax-document-lifecycle-timeline.tsx`. Add `*.stories.tsx` per `/storybook` standards (RTL + a11y). `npm run check:i18n` + `npm run build`. |
| **9 — Legacy reader sanity grep (passive)** | none | Permanent CI grep gate that fails the build if `vat_amount`, `promo_discount_amount`, `gift_card_applied_amount`, `net_receivable_amount`, `service_charge_type`, `subtotal`/`discount`/`tax`/`total`/`paid_amount`/`service_charge` ever re-enter `web-admin/` as direct column reads on `org_orders_mst`. MCP-confirm columns absent via `list_tables`. Codex v4 audit (2026-06-02) already certified clean — this is just the safety net. |
| **11 — Documentation refresh + Codex deferred coverage** | none | `/documentation` skill. Refresh `PRD.md`, `ADR-017` (Implemented), `ADR-030` (Implemented), `CHANGELOG.md`, `brief_test_guide_01.md`, `IMPLEMENTATION_STATUS.md`, `Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md` (mark P0/P1 items closed with phase refs). Close out Codex's deferred coverage: broader write-service + reconciliation regression suite covering every warning code; optionally rename remaining application-level compatibility aliases (`total`, `paid_amount`, `subtotal`, `tax`) in response/view-model contracts. |

---

## 4. Key files to know

### Schema / migrations
- `supabase/migrations/0333_order_fin_canonical_columns_and_audit_fields.sql` — canonical columns (applied)
- `supabase/migrations/0334_order_fin_backfill_repair_and_validation.sql` — backfill (applied)
- `supabase/migrations/0335_order_fin_legacy_field_drop.sql` — legacy DROP (applied)
- `supabase/migrations/0336_order_fin_tax_base_decomposition.sql` — Phase 2 (applied 2026-06-04)
- `supabase/migrations/0337_payment_target_and_credit_app_lifecycle.sql` — Phase 3 (applied 2026-06-04; final behavior keeps `org_order_payments_dtl` ORDER-only and uses voucher-line target lineage)
- `supabase/migrations/0338_order_fin_base_currency_snapshot.sql` — Phase 4 (applied 2026-06-05; final `base_cur_*` names)

### Write path
- `web-admin/lib/services/order-financial-write.service.ts` — `recalculateOrderFinancialSnapshotTx()` is the only allowed writer of canonical financial snapshot columns
- `web-admin/lib/services/voucher-wiring.service.ts` + handlers under `lib/services/wiring/*`
- `web-admin/lib/services/payment-service.ts`, `lib/services/invoice-service.ts`, `lib/services/ar-invoice.service.ts`, `lib/services/order-service.ts`, `lib/services/order-cancel-service.ts` — already migrated to canonical fields by Codex v4 (do NOT reintroduce legacy reads)

### Read path
- `web-admin/lib/services/order-financial-summary.service.ts` — `getOrderFinancialSummary()`
- `web-admin/lib/utils/order-financial-effective-snapshot.ts` — read-time fallback helper
- `web-admin/lib/utils/order-financial-tax-document-mismatch.ts` — Phase 1 helper; Phase 7 will wire its `taxDocumentTotalAmount` argument
- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`
- `web-admin/src/features/orders/model/order-financial-summary-view.ts`

### UI (Phase 8 target)
- `web-admin/src/features/orders/ui/order-financial/*.tsx` — all 7 panels + warning banner

### Constants / types (single source of truth)
- `web-admin/lib/constants/order-financial.ts`
- `web-admin/lib/types/order-financial.ts`

### Reconciliation
- `web-admin/lib/services/reconciliation/order-checks.ts`
- `web-admin/lib/services/reconciliation.service.ts`

### Tests
- `web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts`
- `web-admin/__tests__/utils/order-financial-tax-document-mismatch.test.ts`
- `web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts`
- `web-admin/__tests__/services/reconciliation/check-modules.test.ts`

### Docs (this folder)
- The plan, status tracker, this RESUME doc
- `phase-01-p0-tax-doc-warning-fix.md` (done)
- `phase-02-tax-base-decomposition.md` (done)
- `phase-03-*.md` through `phase-11-*.md` (to be written)

---

## 5. Cmx component reuse (Phase 8 reminder)

Reuse only — do NOT create new primitives:
- `@ui/data-display`: `CmxDescriptionList`, `CmxStatusBadge`, `CmxTable`, `CmxMoney`, `CmxCard`
- `@ui/foundations`: `CmxStack`, `CmxGrid`
- `@ui/feedback`: `CmxBanner`
- `@ui/forms`: `CmxRadioGroup` (Phase 5 settings page)
- `@ui/overlays`: `CmxDrawer`, `CmxDialog` (Phase 7 issue/supersede dialogs)

Extract from existing financial panels (with Storybook):
- `order-tax-base-buckets.tsx`
- `tax-document-lifecycle-timeline.tsx`

---

## 6. Cross-project coordination

- **Phase 4** (base-currency): `base_cur_currency_code` source-of-truth is HQ-managed tenant settings (`TENANT_CURRENCY`) consumed via HQ API. Do not duplicate or DB-query `sys_stng_*` directly.
- **Phase 5** (tax-inclusive): if SaaS surfaces self-service pricing settings, schema/keys must align.
- **Phase 7** (tax-document): SaaS tenant-onboarding invoices must use a separate `document_type` namespace so the sequence allocator can never collide with operational invoices.

---

## 7. How to drive this from a fresh session

**Phases 0–7 are ALL shipped.** Next session starts at Phase 8.

### Entry checklist for the fresh session

1. Read this file (§0 hard rules, §1 phase table, §2.7 next action).
2. Read the plan for Phase 8+: [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md).
3. Read the status tracker: [order-fin-v1_1-implementation-status.md](order-fin-v1_1-implementation-status.md).
4. Confirm: the status tracker should show Phases 0–7 all **Done**. If any row is still "Pending", do NOT skip it.

### Phase 8 — UI consolidation (start here, no migration)

Goal: surface ALL new fields from Phases 2–7 in the existing order-financial UI panels.

**Files to touch:**
- `web-admin/src/features/orders/ui/order-financial/` — existing panels (check each one for missing fields)
- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts` — mapper
- `web-admin/src/features/orders/model/order-financial-summary-view.ts` — view model
- New components to extract: `order-tax-base-buckets.tsx`, `tax-document-lifecycle-timeline.tsx`
- Stories: `order-tax-base-buckets.stories.tsx`, `tax-document-lifecycle-timeline.stories.tsx`

**Rules:**
- Load `/frontend`, `/i18n`, `/storybook` skills before writing any UI code.
- Cmx components only (`@ui/primitives`, `@ui/data-display`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/navigation`).
- Every new visible text must have EN + AR key under `taxDocuments.*` or existing `orders.financial.*` namespaces.
- Stories must cover all variants + RTL + a11y per `/storybook` skill.
- Gate: `npm run check:i18n` + `npm run build` must pass. Fix all errors before marking Done.

**New fields to surface (from Phases 2–7):**
| Field group | Source | Where to show |
|---|---|---|
| Tax-base buckets (taxable / non-taxable / exempt / zero-rated / out-of-scope) | Phase 2 | `order-tax-summary.tsx` or new `order-tax-base-buckets.tsx` |
| Credit-app lifecycle status | Phase 3 | `order-credits-panel.tsx` |
| Base-currency snapshot (6 `base_cur_*` amounts + rate) | Phase 4 | `order-settlement-panel.tsx` or separate base-currency row |
| Tax pricing mode (TAX_EXCLUSIVE / TAX_INCLUSIVE) | Phase 5 | `order-tax-summary.tsx` |
| Refund source type labels + reopens-due amount | Phase 6 | `order-refunds-panel.tsx` |
| Tax document status / type / doc no / issued-at | Phase 7 | `order-tax-document-panel.tsx` — use `taxDocuments.*` i18n keys |

### Phase 9 — Legacy reader sanity grep (passive CI gate)

Goal: add a CI grep that fails the build if any removed column name re-enters `web-admin/` as a direct DB column read on `org_orders_mst`.

**Banned identifiers to grep for:**
`vat_amount`, `promo_discount_amount`, `gift_card_applied_amount`, `net_receivable_amount`, `service_charge_type` and any of `subtotal`/`discount`/`tax`/`total`/`paid_amount`/`service_charge` when used as a direct `.` access on an `org_orders_mst` row.

**Approach:** Add a custom ESLint rule **or** a `scripts/check-legacy-columns.js` script called from `package.json`'s `check:legacy` target, then add it to the CI pipeline (`pre-build` or a dedicated lint step).

MCP-confirm the columns are absent: use `supabase_local` `list_tables` or `execute_sql` to verify `org_orders_mst` column list does NOT include those names before wiring the grep gate.

Gate: the script must run and exit 0 on a clean codebase. Write a deliverable doc `phase-09-legacy-reader-sanity.md`.

### Phase 11 — Documentation refresh + Codex deferred coverage

Goal: close out all open documentation items and add the deferred regression suite.

**Docs to update (in `docs/features/Order_Fin/`):**
- `PRD.md` — mark enterprise v1.1 items as shipped
- `ADR-017` (`ADR-017-Tax-Inclusive-Pricing.md`) — flip status to `Implemented (2026-06-05)`
- `ADR-030` (`ADR-030-Refund-Source-Lineage.md`) — already flipped; verify
- `ADR-039` (`ADR-039-Multi-Currency-Snapshots.md`) — mark Phase 4 as implemented
- `CHANGELOG.md` — add v1.1 entry covering all phases
- `brief_test_guide_01.md` — update QA steps with Phase 7 tax-document issuance flow
- `Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md` — mark P0/P1 items closed with phase refs

**Deferred regression coverage (from Codex v4):**
- Broader write-service tests: every reconciliation warning code covered with a Jest test
- Reconciliation regression suite: test each check function in `order-checks.ts` with fixture data
- Optional: rename remaining application-level compatibility aliases (`total`, `paid_amount`, `subtotal`, `tax`) in response/view-model contracts — only if the breaking-API window is open

**Gate:** `npm run build` green. Phase doc `phase-11-documentation-refresh.md`. Update status tracker to mark Phase 11 Done — that closes the entire Order Fin v1.1 program.
