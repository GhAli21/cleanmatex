# Order Financial v1.1 — Full Alignment Implementation Plan

> **Plan-mode workflow file.** On approval (Phase 0), copy/move this to:
> `f:\jhapp\cleanmatex\docs\features\Order_Fin\Fix_29_05_2026\order-fin-v1_1-full-alignment-implementation-plan.md`
> per project rule (plans live alongside PRD/ADR/STATUS, not in `~/.claude/plans`).

---

## Context

Two canonical specs describe a v1.1 enterprise calculation model:

- `docs/features/Order_Fin/Fix_29_05_2026/Full-non-simplified-calculation-rule-set.md`
- `docs/features/Order_Fin/Fix_29_05_2026/CleanMateX_Order_Fin_Calculation_Algorithms_Full_v1_1.md`

A June 2, 2026 audit ([Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md](../../../docs/features/Order_Fin/Fix_29_05_2026/Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md)) confirms the codebase implements the **core canonical runtime correctly** (sale-total stays independent of settlement; gift cards are credits not discounts; PAY_ON_COLLECTION is non-AR; outstanding/overpaid formulas correct; canonical snapshot/hash/trace already wired). Migrations 0271 → 0335 have added all primary canonical columns.

**Remaining gaps (this plan closes ALL of them — user approved full v1.1 scope):**

- **P0** — Tax-document mismatch warning in `order-financial-write.service.ts` compares `ar_receivable_amount` to `total_amount`; spec says compare to fiscal sale total. Produces false warnings on partially-paid CREDIT_INVOICE orders.
- **P1** — Tax-base decomposition columns missing (`non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount`).
- **P1** — Base-currency snapshot fields missing (`base_cur_currency_code` + 6 `base_cur_*` amounts).
- **P1** — Credit-application lifecycle missing (`pending_credit_application_amount`, `failed_credit_application_amount`, plus `application_status` on detail).
- **P1** — Tax-inclusive pricing not implemented (ADR-017 accepted, not built).
- **P1** — Tax-document full lifecycle missing (master/lines tables, decision service, trigger registry, immutable-after-issued enforcement).
- **P1** — Refund source-lineage not normalized (ADR-030 accepted, not built); reopen-due fixed at 0.
- **P1** — ORDER-only payment-table invariant and voucher-target validation missing (`ORDER_PAYMENT` vs `INVOICE_PAYMENT` vs `ORDER_CREDIT_APPLICATION` lineage).
- **Cleanup status (revised 2026-06-04):** Migrations 0333/0334/0335 were executed by the Codex "Canonical Semantics Plan v4" rollout (see `Order_Fin_Canonical_Semantics_Implementation_Notes.md`, `..._Tracker.md`, `Order_Fin_Legacy_Field_Readiness_Audit.md`). All readers that the June 2 audit flagged (`payment-service.ts`, `invoice-service.ts`, `ar-invoice.service.ts`, `order-service.ts`, `order-cancel-service.ts`, DAL, all API routes, all UI pages, Prisma schema) have **already been migrated to canonical columns**. Post-0335 Jest + typecheck + build + lint are green. → **Phase 9 in this plan collapses to a passive verification step; Phase 10 is removed.**

**Intended outcome:** Order Financial calculation fully aligned with v1.1; legacy columns dropped; all docs (PRD, ADR-017, ADR-030, STATUS, CHANGELOG, test guide, comparison audit) refreshed.

---

## Constraints (CLAUDE.md + project rules)

- Skills MUST be loaded before writing each domain's code: `/database` (SQL), `/multitenancy` (org_* queries), `/backend` (services), `/frontend` (UI), `/i18n` (text), `/implementation` (features), `/code-documentation` (inline comments), `/storybook` (new Cmx primitives).
- Migrations: next sequence after 0335 → **0336**. Never amend existing.
- **NEVER apply migrations** — create `.sql`, STOP, wait for user confirmation before continuing next phase.
- `DROP ... CASCADE` is banned. Use `RESTRICT` + explicit dependency recreate.
- Permissions: `resource:action` two-part only. Every new permission requires a DB seed in the same migration.
- Constants MUST mirror DB string values exactly (`lib/constants/order-financial.ts`).
- `TEXT` not `VARCHAR`.
- Bilingual EN/AR + RTL mandatory; use `@ui/*` Cmx components only.
- After frontend changes: `npm run build` must pass.
- After every phase: update STATUS doc + write the phase's own deliverable doc.
- Final phase invokes `/documentation` skill to refresh everything.

---

## Phase dependency (revised)

```
[1] P0 tax-doc warning fix                                  ← start here, smallest blast
       │
   ┌───┴────────────────────┐
   │                        │
[2] tax-base decomp     [3] ORDER-only payment validation +
   │                        credit-app lifecycle
   └────────────┬───────────┘
                │
              [4] base-currency snapshot
                │
              [5] tax-inclusive pricing (ADR-017)         ← RISKIEST
                │
              [6] refund source-lineage + reopens-due (ADR-030)
                │
              [7] tax-document full lifecycle              ← RISKIEST
                │
              [8] UI consolidation (all new fields)
                │
              [9] legacy reader sanity grep (passive)
                │
              [11] /documentation refresh + Codex deferred coverage closeout
```

**Removed:** Phase 10 (legacy column DROP) — already executed via 0335 on 2026-06-04.
**Demoted:** Phase 9 — Codex audit + greps already cleaned all readers; this phase is now a 30-minute verification pass.
**Promoted:** Phase 1 — first work item, restoring the smallest-blast-radius P0 bug fix as the entry point.

---

## Phase 0 — Plan adoption (manual)

- Move this file to `docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-full-alignment-implementation-plan.md`.
- Create status tracker: `docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-implementation-status.md` (table of phases, current state, owners, dates).
- **Migrations 0333/0334/0335 already applied** (per the Codex v4 rollout). Next available sequence is **0336**.
- **Phase 9** is reduced to a sanity grep (Codex audit confirms it's done) and **Phase 10 (drop) is removed entirely** — the drop already happened.
- Pull the Codex deferred follow-ups into the closeout list (Phase 11): broader write-service & reconciliation regression coverage; optional rename of remaining compatibility aliases.

---

## Phase 1 — P0 Tax-Document Mismatch Warning Fix

**Goal:** Tax-document total compares to `total_amount`, not `ar_receivable_amount`.

- **Skills:** `/backend`, `/multitenancy`, `/code-documentation`, `/testing`
- **Migrations:** none (logic-only)
- **Modify:**
  - [web-admin/lib/services/order-financial-write.service.ts](../../../web-admin/lib/services/order-financial-write.service.ts) — `buildWarningCodes()` tax-document branch.
  - [web-admin/lib/services/reconciliation/voucher-checks.ts](../../../web-admin/lib/services/reconciliation/voucher-checks.ts) — sync the equivalent reconciliation check.
- **Tests:**
  - Extend `__tests__/utils/order-financial-effective-snapshot.test.ts` — three cases: fully-paid CREDIT_INVOICE, partially-paid CREDIT_INVOICE, PAY_ON_COLLECTION + tax doc.
  - Add fixture to `__tests__/features/orders/map-order-financial-summary-view.test.ts`.
- **i18n:** audit existing `OrderFinancial.warnings.taxDocumentTotalMismatch` EN+AR copy.
- **Recon checks:** fix the tax-doc total check; no new code.
- **Verification:** Jest green; manually seed two orders and observe warning disappears on partially-paid CREDIT_INVOICE.
- **Phase doc:** `phase-01-p0-tax-doc-warning-fix.md` under the spec folder.
- **End task:** update implementation-status.md → Phase 1: Done.

Risk: Low. Ship first.

---

## Phase 2 — Tax-Base Decomposition Columns

**Goal:** Persist `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount` per order.

- **Skills:** `/database`, `/multitenancy`, `/backend`, `/code-documentation`
- **Migration:** `supabase/migrations/0336_order_fin_tax_base_decomposition.sql`
  - `ALTER TABLE org_orders_mst ADD COLUMN ... NUMERIC(19,4) NOT NULL DEFAULT 0` ×4. RLS unchanged (table already governed).
  - Reconciliation CHECK relaxed initially: stricter bucket-sum CHECK added only once tax engine emits buckets (Phase 5 may toggle).
- **Modify:**
  - `web-admin/lib/services/order-financial-write.service.ts` — accept/persist buckets in `recalculateOrderFinancialSnapshotTx()`; include in `financial_calculation_snapshot` JSON.
  - `web-admin/lib/services/order-financial-summary.service.ts` — surface buckets.
  - `web-admin/lib/constants/order-financial.ts`, `web-admin/lib/types/order-financial.ts` — names + types.
  - `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts` — pass-through.
- **Tests:** new fixtures in effective-snapshot test + mapper test.
- **i18n:** `OrderFinancial.taxBase.nonTaxable|exempt|zeroRated|outOfScope` (+ AR).
- **Recon checks:** new `RECON_TAX_BASE_BUCKETS_SUM` in `voucher-checks.ts`.
- **Phase doc:** `phase-02-tax-base-decomposition.md`.
- **End task:** STATUS update.

Risk: Low. UI surfaces buckets in Phase 8.

---

## Phase 3 — ORDER-only Payment Validation + Credit Application Lifecycle

**Goal:** Keep `org_order_payments_dtl` ORDER-only, enforce generic target lineage on voucher lines, and add lifecycle to credit applications.

- **Skills:** `/database`, `/multitenancy`, `/backend`, `/code-documentation`
- **Migration:** `supabase/migrations/0337_payment_target_and_credit_app_lifecycle.sql`
  - **Corrected design:** do **not** add `payment_target_type` to `org_order_payments_dtl`. That table remains the ORDER real-payment fact table only.
  - `org_order_credit_apps_dtl` + `application_status TEXT NOT NULL DEFAULT 'APPLIED'` CHECK ∈ (PENDING, RESERVED, PROCESSING, APPLIED, FAILED, CANCELLED, REVERSED, EXPIRED). Backfill from `rec_status`/`is_active`. **Only `APPLIED` reduces `outstanding_amount`.** `PENDING`/`RESERVED`/`PROCESSING` feed `pending_credit_application_amount`; `FAILED`/`CANCELLED`/`EXPIRED` feed `failed_credit_application_amount`; `REVERSED` feeds `credit_reversed_amount` and may set `credit_reversal_reopens_due_amount`.
  - `org_orders_mst` + `pending_credit_application_amount`, `failed_credit_application_amount` NUMERIC(19,4) DEFAULT 0.
- **Modify:**
  - `web-admin/lib/services/order-financial-write.service.ts` — keep payments aggregated from ORDER-only rows; lifecycle math for credit apps.
  - `web-admin/lib/services/voucher-wiring.service.ts` + `lib/services/wiring/order-payment-wiring.handler.ts` + `lib/services/wiring/order-credit-application-wiring.handler.ts` — validate `target_type='ORDER'` and `target_id=order_id` on the relevant voucher lines; set `application_status='APPLIED'` on newly-posted credit-app rows.
  - Reconciliation ensures:
    - `ORDER_PAYMENT` voucher lines create `org_order_payments_dtl`
    - `INVOICE_PAYMENT` voucher lines do **not** create `org_order_payments_dtl`
    - `ORDER_CREDIT_APPLICATION` voucher lines create `org_order_credit_apps_dtl`
- **Tests:** voucher-target validation matrix + credit lifecycle transitions.
- **i18n:** `OrderFinancial.paymentTarget.*`, `OrderFinancial.creditApp.status.*` (debug panel + tables, AR included).
- **Recon checks:** `RECON_PAYMENT_TARGET_VS_ORDER_TOTALS`, `RECON_CREDIT_APP_LIFECYCLE_CONSISTENCY`.
- **Phase doc:** `phase-03-payment-target-and-credit-lifecycle.md`.
- **End task:** STATUS update.

Risk: Medium. Default 'ORDER' / 'APPLIED' preserves current behavior.

---

## Phase 4 — Base-Currency Snapshot

**Goal:** Project amounts into tenant reporting currency using order's stored historical rate.

- **Skills:** `/database`, `/backend`, `/multitenancy`, `/code-documentation`
- **Migration:** `supabase/migrations/0338_order_fin_base_currency_snapshot.sql`
  - `org_orders_mst` + `base_cur_currency_code TEXT NULL` (source-of-truth is HQ-managed `TENANT_CURRENCY`; SQL must not fake a DB default or query `sys_stng_*` directly from this project).
  - Add `base_cur_total_amount`, `base_cur_tax_amount`, `base_cur_paid_amount`, `base_cur_credit_applied_amount`, `base_cur_outstanding_amount`, `base_cur_ar_receivable_amount` NUMERIC(19,4) NOT NULL DEFAULT 0.
  - Backfill numeric `base_cur_*` amounts using stored historical `currency_ex_rate` (`base_cur_amount = transaction_amount * currency_ex_rate`). `base_cur_currency_code` may remain NULL on legacy rows until Phase 4 application recalculation resolves it from HQ settings.
- **Modify:**
  - `web-admin/lib/services/order-financial-write.service.ts` — compute projections inside the same TX as snapshot write; **use stored historical rate, never re-fetch**.
  - `web-admin/lib/services/order-financial-summary.service.ts` — return base-currency block.
  - `lib/constants/order-financial.ts`, `lib/types/order-financial.ts` — types.
- **Tests:** multi-currency fixtures (e.g. base SAR + AED order, USD order).
- **i18n:** `OrderFinancial.baseCurrency.label`, `OrderFinancial.baseCurrency.rateAt` (+ AR).
- **Recon checks:** `RECON_BASE_CURRENCY_RATE_PRESENT`, `RECON_BASE_VS_ORDER_AMOUNT_CONSISTENCY`.
- **Phase doc:** `phase-04-base-currency-snapshot.md`.
- **End task:** STATUS update.

Risk: Medium. Cross-project coordination with cleanmatexsaas to confirm `base_cur_currency_code` source-of-truth — currently must match what HQ tenant config emits.

---

## Phase 5 — Tax-Inclusive Pricing (ADR-017 build) — RISKIEST #1

**Goal:** Support TAX_INCLUSIVE pricing (extract tax from inclusive price) alongside current TAX_EXCLUSIVE. Configurable per tenant + per branch.

- **Skills:** `/database`, `/backend`, `/multitenancy`, `/implementation`, `/code-documentation`
- **Migration:** `supabase/migrations/0339_tax_pricing_mode_config.sql`
  - Add `tax_pricing_mode TEXT NOT NULL DEFAULT 'TAX_EXCLUSIVE'` and `extra_price_pricing_mode TEXT NOT NULL DEFAULT 'INCLUDED_IN_ITEM_PRICE'` to tenant settings table + branch master (branch overrides tenant).
  - CHECK ∈ ('TAX_INCLUSIVE','TAX_EXCLUSIVE') and ('INCLUDED_IN_ITEM_PRICE','SEPARATE_CHARGE').
  - Permissions seeded same migration: `tenant_settings:update_pricing_mode`, `branch_settings:update_pricing_mode`.
- **Modify:**
  - Tax calculator (locate within or beside `order-financial-write.service.ts`). Add `extractTaxFromInclusive()` path. Two distinct identities (do NOT add tax twice in inclusive mode):

    ```text
    TAX_EXCLUSIVE:
      total_amount = net_before_tax_amount + total_tax_amount + rounding_adjustment_amount

    TAX_INCLUSIVE:
      total_amount = net_before_tax_amount + rounding_adjustment_amount
      taxable_amount and total_tax_amount are extracted from the tax-inclusive price
      (the inclusive price already contains the tax; tax is NOT added again to total_amount)
    ```

    Worked example (TAX_INCLUSIVE, VAT 5%): inclusive price = 105.000 → `taxable_amount = 100.000`, `total_tax_amount = 5.000`, `total_amount = 105.000`.
  - `order-financial-write.service.ts` — branch on resolved mode; persist `tax_pricing_mode_at_calculation` in `financial_calculation_snapshot` JSON for audit.
- **New file:** `web-admin/lib/services/pricing-mode-resolver.service.ts` — single resolver (tenant → branch → order override).
- **Feature flag:** `FF_TAX_INCLUSIVE_PRICING` — gate UI exposure for 2-week soak. Calculator handles both modes regardless; flag only gates settings UI.
- **Tests:** matrix (inclusive vs exclusive × multi-tax-rate × bucket decomposition); regression suite asserting EXCLUSIVE behavior unchanged.
- **i18n:** `Settings.pricingMode.inclusive|exclusive`, `Settings.extraPriceMode.included|separate` (+ AR).
- **Recon checks:** `RECON_PRICING_MODE_CONSISTENCY` (order mode matches branch-at-time-of-order).
- **Cmx UI (settings page):** reuse `@ui/forms` `CmxRadioGroup`; reuse `@ui/data-display` for display.
- **Phase doc:** `phase-05-tax-inclusive-pricing-build.md` + flip `ADR-017` status header to **Implemented**.
- **End task:** STATUS update.

Risk: High. Mitigation: feature flag, dual-mode regression suite, manual QA cycle.

---

## Phase 6 — Refund Source-Lineage + Reopen-Due (ADR-030 build)

**Goal:** Normalize `refund_source_type` + FK to source payment; non-zero reopens-due per policy.

- **Skills:** `/database`, `/backend`, `/multitenancy`, `/code-documentation`
- **Migration:** `supabase/migrations/0340_refund_source_lineage_and_reopen_due.sql`
  - `org_order_refunds_dtl` + `refund_source_type TEXT NOT NULL` CHECK ∈ (REAL_PAYMENT_REFUND, GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE, MANUAL_EXCEPTION). One generic `STORED_VALUE_RESTORE` is insufficient for audit / fiscal reporting / source-lineage reconciliation — each stored-value vehicle keeps its own classification.
  - `source_payment_id UUID NULL REFERENCES org_order_payments_dtl(id) ON DELETE RESTRICT` — set only when REAL_PAYMENT_REFUND.
  - Backfill from `refund_method_code` + metadata + `original_credit_type`. Migration emits a **review query** listing rows that could not be classified; do **not** silently guess. `MANUAL_EXCEPTION` requires elevated permission + reason + audit log entry per ADR-030.
  - `reopens_due_amount NUMERIC(19,4) NOT NULL DEFAULT 0` on refund row + CHECK `≤ refund_amount`.
- **Modify:**
  - Refund handler(s) (locate via grep on `refund_method_code` write paths).
  - `order-financial-write.service.ts` — read normalized columns; sum `reopens_due_amount` → `refund_reopens_due_amount` + `credit_reversal_reopens_due_amount` (split by source_type).
- **Tests:** classification matrix; reopen-due math; backfill correctness.
- **i18n:** `OrderFinancial.refunds.sourceType.realPayment|storedValue|customerCredit` (+ AR).
- **Recon checks:** `RECON_REFUND_SOURCE_LINEAGE_CLASSIFICATION`, `RECON_REFUND_REOPENS_DUE_BOUND`.
- **Phase doc:** `phase-06-refund-source-lineage-and-reopen-due.md` + flip `ADR-030` status → **Implemented**.
- **End task:** STATUS update.

Risk: Medium-High. Backfill heuristic requires finance lead sign-off before applying.

---

## Phase 7 — Tax-Document Full Lifecycle — RISKIEST #2

**Goal:** Build `org_tax_documents_mst` + lines + sequence allocator + decision service + trigger registry + immutable-after-issued. Credit-note/debit-note chain for post-issue corrections.

- **Skills:** `/database`, `/multitenancy`, `/backend`, `/implementation`, `/code-documentation`
- **Migration:** `supabase/migrations/0341_tax_documents_master_and_lines.sql`
  - `org_tax_documents_mst` — tenant-scoped, RLS, `status` ∈ (DRAFT, ISSUED, CANCELLED, SUPERSEDED), `document_type` ∈ (INVOICE, SIMPLIFIED_INVOICE, CREDIT_NOTE, DEBIT_NOTE), `trigger_event`, `sequence_number` UNIQUE per (tenant_org_id, document_type, fiscal_year), `supersedes_id` self-FK.
  - `org_tax_documents_lines_dtl` — per-line tax breakdown (links to `org_order_taxes_dtl`).
  - `org_tax_document_triggers_cfg` — per-tenant trigger config: ON_ORDER_SUBMIT, ON_PAYMENT_CONFIRMATION, ON_SERVICE_COMPLETION, ON_DELIVERY, ON_AR_INVOICE_ISSUE.
  - DB-level guard: trigger function preventing UPDATE on `status=ISSUED` rows except transition → SUPERSEDED.
  - Deprecate (mark NULL-tolerant but don't drop) the existing `tax_document_id/no/status/type` columns on `org_orders_mst`; backfill into the new master where applicable.
  - Permissions seeded same migration: `tax_document:create`, `tax_document:issue`, `tax_document:cancel`, `tax_document:supersede`, `tax_document:configure_triggers`.
- **New files:**
  - `web-admin/lib/services/tax-document-decision.service.ts` — pure decision module: `(order_state, trigger_event, tenant_cfg) → action`.
  - `web-admin/lib/services/tax-document-write.service.ts` — transactional executor; integrates sequence allocator.
  - `web-admin/lib/services/tax-document-sequence.service.ts` — row-locked allocator (`SELECT ... FOR UPDATE` on a per-tenant sequence row).
- **Modify:**
  - `order-financial-write.service.ts` — emit trigger events.
  - `src/features/orders/ui/order-financial/order-tax-document-panel.tsx` — surface lifecycle states (Phase 8 polishes).
- **Tests:** decision matrix (5 triggers × 4 document types × 6 order states); concurrency test for sequence allocator; immutability test against ISSUED row.
- **i18n:** `TaxDocument.status.*`, `TaxDocument.type.*`, `TaxDocument.triggerEvent.*` (+ AR).
- **Recon checks:** `RECON_TAX_DOC_SEQUENCE_GAPS`, `RECON_TAX_DOC_IMMUTABILITY`, extend `RECON_TAX_DOC_VS_ORDER_TOTALS` for credit-note net effect.
- **Cmx UI:** reuse `@ui/data-display/StatusBadge`, `@ui/data-display/Table`, `@ui/overlays/Drawer`. New extracted component `TaxDocumentLifecycleTimeline` (Phase 8).
- **Cross-project coordination:** confirm cleanmatexsaas tenant-onboarding invoices use a **separate document_type namespace** so the sequence allocator doesn't collide with operational invoices.
- **Phase doc:** `phase-07-tax-document-lifecycle.md`.
- **End task:** STATUS update.

Risk: High. Fiscal numbering correctness has legal implications. Require finance sign-off + 2-week soak before claiming compliance.

---

## Phase 8 — UI Consolidation

**Goal:** Surface ALL new fields in the Order Financial tab. Build with Cmx primitives only.

- **Skills:** `/frontend`, `/i18n`, `/storybook`, `/code-documentation`
- **Modify:**
  - `web-admin/src/features/orders/ui/order-financial/order-value-breakdown.tsx` — tax-base bucket rows.
  - `web-admin/src/features/orders/ui/order-financial/order-financial-summary-cards.tsx` — base-currency secondary card (collapsed by default when `currency_code === base_cur_currency_code`).
  - `web-admin/src/features/orders/ui/order-financial/order-settlement-summary.tsx` — pending/failed credit-app rows.
  - `web-admin/src/features/orders/ui/order-financial/order-payments-credits-tables.tsx` — credit-app `application_status` column + `refund_source_type` column.
  - `web-admin/src/features/orders/ui/order-financial/order-tax-document-panel.tsx` — full lifecycle + credit-note chain.
  - `web-admin/src/features/orders/ui/order-financial/order-financial-debug-panel.tsx` — show `tax_pricing_mode_at_calculation` + `currency_ex_rate_at_calculation`.
  - `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts` — pass new fields.
- **New (extracted) reusable Cmx-composed components:**
  - `web-admin/src/features/orders/ui/order-financial/order-tax-base-buckets.tsx`
  - `web-admin/src/features/orders/ui/order-financial/tax-document-lifecycle-timeline.tsx`
- **Cmx primitives reused (do NOT duplicate):**
  - `@ui/data-display`: `CmxDescriptionList`, `CmxStatusBadge`, `CmxTable`, `CmxMoney`, `CmxCard`
  - `@ui/foundations`: `CmxStack`, `CmxGrid`
  - `@ui/feedback`: `CmxBanner` (already used by warning banner)
  - `@ui/forms`: `CmxRadioGroup` (Phase 5 settings)
  - `@ui/overlays`: `CmxDrawer`, `CmxDialog` (Phase 7 issue/supersede dialogs)
- **Storybook:** `*.stories.tsx` for both new extracted components, including RTL + a11y variants per `/storybook` standards.
- **Tests:** extend `map-order-financial-summary-view.test.ts`.
- **i18n:** wire EN+AR for every key introduced in Phases 2–7; run `npm run check:i18n`.
- **Verification:** `npm run build` green; manual QA in EN + AR + RTL against 3 production-like seeded orders.
- **Phase doc:** `phase-08-ui-consolidation.md` (include final screenshots).
- **End task:** STATUS update.

Risk: Medium. Wide surface but no business logic.

---

## Phase 9 — Legacy Reader Sanity Grep (passive verification)

**Goal:** Confirm the Codex v4 rollout left zero direct reads of dropped columns. Codex's `Order_Fin_Legacy_Field_Readiness_Audit.md` (2026-06-02) already certified this, plus post-0335 build + Jest + lint went green — so this phase is essentially a 30-minute re-check, not new work.

- **Skills:** `/backend`, `/code-documentation`
- **Migrations:** none
- **Tasks:**
  - Repo-wide grep on `web-admin/` for the dropped column names: `vat_amount`, `promo_discount_amount`, `gift_card_applied_amount`, `net_receivable_amount`, `service_charge_type`, plus naked column reads of `subtotal`/`discount`/`tax`/`total`/`paid_amount`/`service_charge` against `org_orders_mst` (regex must exclude legitimate compatibility-alias names where the source value is already canonical).
  - Add a permanent CI grep gate that fails the build if a dropped column name re-enters `web-admin/`.
  - `mcp__supabase_remote_db__list_tables` confirms `org_orders_mst` does not contain the dropped columns.
  - `mcp__supabase_remote_db__get_logs` — scan the last 7 days for any runtime error mentioning a dropped column. If any present, treat as P0 and reopen Phase 9 as a real code fix.
- **Phase doc:** `phase-09-legacy-reader-sanity.md` — record grep output, MCP query results, CI gate file.
- **End task:** STATUS update.

Risk: Very low. Codex already did the work; this is the safety net.

---

## Phase 11 — Documentation Refresh + Codex Deferred Coverage (final)

**Goal:** Run `/documentation` skill to refresh every doc touched by Phases 1–9, AND absorb the deferred follow-ups Codex's v4 rollout listed but did not complete.

- **Skill:** `/documentation` (+ `/i18n`, `/code-documentation`, `/testing` for spot checks)
- **Documentation updates:**
  - `docs/features/Order_Fin/PRD.md` — mark v1.1 alignment complete; date stamp.
  - `docs/decisions/ADR-017-tax-inclusive-pricing.md` — status: Implemented (Phase 5, date).
  - `docs/decisions/ADR-030-refund-source-lineage.md` — status: Implemented (Phase 6, date).
  - `CHANGELOG.md` — entries for migrations 0336–0341, new ADR statuses, new permissions, new constants, deprecated fields (note 0333/0334/0335 chain already shipped 2026-06-04 by v4).
  - `docs/features/Order_Fin/Fix_29_05_2026/brief_test_guide_01.md` — append per-phase manual QA cases.
  - `docs/features/Order_Fin/Fix_29_05_2026/IMPLEMENTATION_STATUS.md` — mark v1.1 gaps closed; link the v4 tracker as predecessor.
  - `docs/features/Order_Fin/Fix_29_05_2026/Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md` — close audit; mark each P0/P1 item resolved with phase ref.
  - `docs/features/Order_Fin/Fix_29_05_2026/Order_Fin_Canonical_Semantics_Implementation_Notes.md` — append "v1.1 follow-on phases" section linking to this plan.
  - Feature-doc per `/implementation` skill: permissions added, navigation/screens touched, settings (pricing mode), feature flags (`FF_TAX_INCLUSIVE_PRICING`), plan limits (n/a), i18n keys, API routes (n/a), migrations, RBAC changes, env vars.
- **Codex deferred coverage now closed:**
  - Broader write-service regression suite — add reconciliation matrix coverage for the warning codes Plan v4 listed (`ORDER_TOTAL_COMPONENT_MISMATCH`, `DISCOUNT_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`, `OUTSTANDING_MISMATCH`, `PENDING_PAYMENT_COUNTED_AS_PAID`, `AUTHORIZED_PAYMENT_COUNTED_AS_PAID`, `GIFT_CARD_DOUBLE_COUNTED`, `CREDIT_APPLICATION_COUNTED_AS_DISCOUNT`, `AR_RECEIVABLE_MISMATCH`, `TAX_DOCUMENT_TOTAL_MISMATCH`, `LEGACY_FIELD_USED_IN_SUMMARY`, `REFUND_SOURCE_UNCLASSIFIED`, `PAYMENT_TARGET_UNCLASSIFIED`).
  - Optional rename of remaining application-level compatibility aliases (`total`, `paid_amount`, `subtotal`, `tax` in response/view-model contracts). Recommend deferring until next breaking-API release window unless any downstream consumer flags it.
- **Verification:** doc-lint if present; manual TOC pass; confirm every newly-added permission code is present in DB seed migrations.
- **Phase doc:** `phase-11-documentation-refresh.md` — retrospective + open follow-ups.

---

## Cross-project (cleanmatexsaas) coordination

1. **Phase 4 (base-currency):** confirm tenant `base_cur_currency_code` source-of-truth — must come from HQ tenant config, not duplicated.
2. **Phase 5 (tax-inclusive):** if SaaS surfaces self-service pricing settings, schema and copy must align.
3. **Phase 7 (tax-document):** SaaS tenant-onboarding invoices must use a **separate document_type namespace** so sequence allocator doesn't collide with operational invoices.

---

## Cmx component summary

**Reuse (no new primitives):**
- `@ui/data-display`: `CmxDescriptionList`, `CmxStatusBadge`, `CmxTable`, `CmxMoney`, `CmxCard`
- `@ui/foundations`: `CmxStack`, `CmxGrid`
- `@ui/feedback`: `CmxBanner`
- `@ui/forms`: `CmxRadioGroup`
- `@ui/overlays`: `CmxDrawer`, `CmxDialog`

**Extract (composed from primitives, gets Storybook):**
- `order-tax-base-buckets.tsx`
- `tax-document-lifecycle-timeline.tsx`

---

## Top 2 risks (revised)

1. **Phase 5** — core math change (tax-inclusive pricing). Mitigation: feature flag, dual-mode regression suite.
2. **Phase 7** — tax-document fiscal sequence numbering under concurrency. Mitigation: row-locked allocator, finance sign-off, 2-week soak.

(Removed former #1 "Phase 9 urgent fix" — Codex v4 rollout has already closed that work.)

---

## Critical files (modification hotspots)

- `web-admin/lib/services/order-financial-write.service.ts` — Phases 1, 2, 3, 4, 5, 6, 7
- `web-admin/lib/services/order-financial-summary.service.ts` — Phases 2, 4
- `web-admin/lib/services/reconciliation/voucher-checks.ts` — Phases 1, 2, 3, 4, 5, 6, 7
- `web-admin/lib/constants/order-financial.ts`, `lib/types/order-financial.ts` — Phases 2, 3, 4, 5
- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts` — Phases 2, 3, 4, 6, 8
- `web-admin/src/features/orders/ui/order-financial/*` — Phase 8
- `web-admin/lib/services/voucher-wiring.service.ts` + wiring handlers — Phase 3
- `web-admin/lib/services/payment-service.ts` — Phases 3, 9
- `web-admin/lib/services/invoice-service.ts` — Phases 3, 9
- `web-admin/lib/services/ar-invoice.service.ts` — Phase 9
- `web-admin/lib/services/erp-lite-auto-post.service.ts` — Phase 9
- `web-admin/lib/services/order-cancel-service.ts` — Phase 9 (extra reader)

---

## Verification (end-to-end)

Final end-to-end verification before Phase 11 documentation closeout (Phase 10 was removed — legacy DROP already shipped via 0335 on 2026-06-04):

1. `npm run build` in `web-admin` — must pass.
2. `npm run test` — all Jest suites green; new fixtures for every phase.
3. `npm run check:i18n` — no missing AR keys.
4. Manual QA via updated `brief_test_guide_01.md`:
   - Cash sale (TAX_EXCLUSIVE)
   - Cash sale (TAX_INCLUSIVE)
   - Partial cash + CREDIT_INVOICE (verify no false tax-doc warning)
   - Gift card fully covers order (verify total_amount unchanged)
   - Gateway pending → captured → completed lifecycle
   - PAY_ON_COLLECTION partial
   - Refund REAL_PAYMENT_REFUND with `reopens_due_amount > 0`
   - Refund STORED_VALUE_RESTORE (gift card restoration)
   - Multi-currency order (verify base-currency block populated)
   - Tax document ISSUED → CREDIT_NOTE chain
5. Supabase MCP read-only checks: `list_tables`, `get_advisors`, confirm dropped columns absent + RLS intact on new tables.

---

## Per-phase recurring tasks (DO NOT SKIP)

For **every** phase, before marking it Done:

1. Load required skills BEFORE writing code.
2. Create the migration SQL file (if any). **STOP and wait for user confirmation** before continuing.
3. Update `lib/constants/order-financial.ts` constants to mirror DB strings exactly.
4. Update `lib/types/order-financial.ts` types.
5. Add/extend reconciliation checks listed in the phase.
6. Add i18n keys EN+AR.
7. Add/extend Jest tests.
8. Run `npm run build` in `web-admin` and fix until green.
9. Write the per-phase doc under `docs/features/Order_Fin/Fix_29_05_2026/`.
10. Update `order-fin-v1_1-implementation-status.md` — mark phase Done with date.

Phase 11 invokes `/documentation` skill for the global doc refresh.
