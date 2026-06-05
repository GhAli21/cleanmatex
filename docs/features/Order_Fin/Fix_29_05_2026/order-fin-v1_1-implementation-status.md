# Order Fin v1.1 Full Alignment — Implementation Status

**Plan:** [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md)
**Predecessor:** Codex "Canonical Semantics Plan v4" (shipped 2026-06-04 via migrations 0333/0334/0335 — see [Order_Fin_Canonical_Semantics_Implementation_Notes.md](Order_Fin_Canonical_Semantics_Implementation_Notes.md))
**Started:** 2026-06-04
**Owner:** —

---

## Phase Tracker

| # | Phase | Status | Migration(s) | Deliverable doc | Date |
|---|---|---|---|---|---|
| 0 | Plan adoption + status tracker | Done | — | this file | 2026-06-04 |
| 1 | P0 tax-doc warning fix | **Done** | none | [`phase-01-p0-tax-doc-warning-fix.md`](phase-01-p0-tax-doc-warning-fix.md) | 2026-06-04 |
| 2 | Tax-base decomposition columns | **Done** | `0336_order_fin_tax_base_decomposition.sql` (applied) | [`phase-02-tax-base-decomposition.md`](phase-02-tax-base-decomposition.md) | 2026-06-04 |
| 3 | ORDER-only payment validation + credit-app lifecycle | **Done** | `0337_payment_target_and_credit_app_lifecycle.sql` (applied) | [`phase-03-payment-target-and-credit-lifecycle.md`](phase-03-payment-target-and-credit-lifecycle.md) | 2026-06-04 |
| 4 | Base-currency snapshot | **Done** | `0338_order_fin_base_currency_snapshot.sql` (applied) | [`phase-04-base-currency-snapshot.md`](phase-04-base-currency-snapshot.md) | 2026-06-05 |
| 5 | Tax-inclusive pricing build (ADR-017) | **Done** | `0339_tax_pricing_mode_config.sql` (applied) | [`phase-05-tax-inclusive-pricing-build.md`](phase-05-tax-inclusive-pricing-build.md) | 2026-06-05 |
| 6 | Refund source-lineage + reopens-due (ADR-030) | **Done** | `0340_refund_source_lineage_and_reopen_due.sql` (applied) | [`phase-06-refund-source-lineage-and-reopen-due.md`](phase-06-refund-source-lineage-and-reopen-due.md) | 2026-06-05 |
| 7 | Tax-document full lifecycle | **Done** | `0341_tax_documents_master_and_lines.sql` (applied) | [`phase-07-tax-document-lifecycle.md`](phase-07-tax-document-lifecycle.md) | 2026-06-05 |
| 8 | UI consolidation (all new fields) | **Done** | none | [`phase-08-ui-consolidation.md`](phase-08-ui-consolidation.md) | 2026-06-05 |
| 9 | Legacy reader sanity grep (passive) | **Done** | none | [`phase-09-legacy-reader-sanity.md`](phase-09-legacy-reader-sanity.md) | 2026-06-05 |
| 11 | Documentation refresh + Codex deferred coverage | **Done** | none | [`phase-11-documentation-refresh.md`](phase-11-documentation-refresh.md) | 2026-06-05 |

> **Phase 10 (legacy column DROP) was removed** — already shipped via migration 0335 by the Codex v4 rollout on 2026-06-04. Phase numbering preserves the original plan's positions.

---

## Risks (top 2)

1. **Phase 5** — core math change (TAX_INCLUSIVE extraction). Mitigation: feature flag `FF_TAX_INCLUSIVE_PRICING`, dual-mode regression suite, 2-week soak.
2. **Phase 7** — tax-document fiscal sequence numbering under concurrency. Mitigation: row-locked `SELECT ... FOR UPDATE` allocator, finance sign-off, 2-week soak. Cross-project coordination with cleanmatexsaas required so onboarding invoices use a separate document_type namespace.

---

## Open follow-ups (will close in Phase 11)

- Broader write-service & reconciliation regression coverage (Codex deferred from v4).
- Optional rename of remaining application-level compatibility aliases (`total`, `paid_amount`, `subtotal`, `tax`) — defer until next breaking-API window.

---

## Notes / Decision log

- 2026-06-04 — Plan adopted with the final precision edits, later corrected for Phase 3: keep `org_order_payments_dtl` ORDER-only (no `payment_target_type` column), use `org_fin_voucher_trx_lines_dtl.target_type/target_id` as the generic discriminator, keep the 8-state `application_status` lifecycle on `org_order_credit_apps_dtl`, keep the 7-state `refund_source_type`, and preserve the TAX_INCLUSIVE identity (`total = net_before_tax + rounding`).
- 2026-06-04 — **Phase 1 shipped.** P0 tax-doc mismatch warning corrected via new pure helper `evaluateTaxDocumentTotalMismatch` (lib/utils/order-financial-tax-document-mismatch.ts). Warning is inert until Phase 7 provides `org_tax_documents_mst.total_amount` as the real comparand. 10 new helper tests + 18 adjacent regression tests green; typecheck + build green.
- 2026-06-04 — **Phase 2 shipped.** Migration 0336 applied; added `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount` on `org_orders_mst`. Write service, summary service, effective-snapshot util, view model, mapper, types, Prisma, and EN/AR i18n all wired. Bucket values default to 0 — Phase 5 will populate from the tax engine. `TAX_BASE_BUCKETS_SUM` reservation added to `RECONCILIATION_CHECK_NAMES` (active check function deferred to Phase 5). 22 targeted tests green; typecheck + i18n parity + build green.
- 2026-06-04 — **Phase 3 shipped.** Migration 0337 is treated as applied. The corrected design intentionally leaves `org_order_payments_dtl` ORDER-only and moves generic target discrimination to voucher lines (`line_role` + `target_type` + `target_id`). Added `application_status` lifecycle wiring on `org_order_credit_apps_dtl`, new order-header snapshot buckets (`pending_credit_application_amount`, `failed_credit_application_amount`), Prisma schema updates, read/write model support, ORDER-payment / ORDER-credit voucher-line validation, reconciliation checks (`PAYMENT_TARGET_VS_ORDER_TOTALS`, `CREDIT_APP_LIFECYCLE_CONSISTENCY`), EN/AR labels, and targeted tests. Typecheck + i18n parity + build green.
- 2026-06-05 — **Phase 4 shipped.** Migration 0338 applied with final `base_cur_*` naming. Added nullable `base_cur_currency_code` plus six base-currency reporting amounts on `org_orders_mst`; backfilled numeric amounts from stored `currency_ex_rate`; wired Prisma, write/read services, effective snapshot fallback, view model, mapper, reconciliation checks, EN/AR labels, and targeted tests. `base_cur_currency_code` remains nullable because the source-of-truth is HQ-managed `TENANT_CURRENCY` consumed via HQ API, not direct `sys_stng_*` access. Typecheck + i18n parity + targeted Jest + build green.
- 2026-06-05 — **Phase 5 shipped.** Migration 0339 applied. `pricing-mode-resolver.service.ts` created; `extractTaxFromInclusive` exported; TAX_INCLUSIVE branch in `resolveCanonicalTotalAmount`; snapshot version 5 with `taxPricingModeAtCalculation` audit field; `PRICING_MODE_CONSISTENCY` recon check; EN/AR labels; 12 Jest tests green; tsc + i18n + build green.
- 2026-06-05 — **Phase 6 shipped.** Migration 0340 applied. `refund_source_type` (7-value CHECK) + `reopens_due_amount` on `org_order_refunds_dtl`; backfill from method/metadata heuristics; `MANUAL_EXCEPTION` fallback with review query; `classifyRefunds` exported and updated to use canonical column; `refundReopensDueAmount` sourced from DB; `REFUND_SOURCE_LINEAGE_CLASSIFICATION` (WARNING) and `REFUND_REOPENS_DUE_BOUND` (BLOCKER) recon checks; EN/AR labels; 21 Jest tests green; tsc + i18n + build green. ADR-030 flipped to Implemented.
- 2026-06-05 — **Phase 7 shipped.** Migration 0341 applied. 4 new tables: `org_tax_documents_mst` (DB-immutability trigger `trg_tax_doc_immutable`), `org_tax_doc_lines_dtl`, `org_tax_doc_seq_counters` (row-locked sequence allocator, `SELECT … FOR UPDATE`), `org_tax_doc_triggers_cfg`; `currency_ex_rate DECIMAL(10,6)` + `base_currency_code TEXT` added per ADR-039 multi-currency convention; 5 permissions seeded; Prisma schema + prisma generate green; `tax-document-sequence.service.ts`, `tax-document-decision.service.ts` (pure, no DB), `tax-document-write.service.ts` (create/issue/supersede lifecycle); 3 new recon checks (SEQUENCE_GAPS/IMMUTABILITY/VS_ORDER_TOTALS); `taxDocuments` namespace added to EN/AR; 33 Jest tests green; tsc (Phase 7 files) + i18n parity green.
- 2026-06-05 — **Phase 11 shipped. Program COMPLETE.** ADR-017 + ADR-039 flipped to Implemented. `CHANGELOG.md` prepended with v1.1 block (migrations 0336–0341, ADR table, permissions). Comparison audit conclusion status → Closed. `brief_test_guide_01.md` appended with per-phase v1.1 QA checklist (9 sections). `phase-11-documentation-refresh.md` written. All deferred items dispositioned. Open follow-ups recorded for next program.
- 2026-06-05 — **Phase 9 shipped.** No migration. `scripts/check-legacy-columns.js` added; `npm run check:legacy` wired in `package.json`. Balanced-brace extractor scopes detection to `org_orders_mst` Prisma call blocks only — eliminates false positives from AR invoice / payment tables that legitimately carry the same column names. MCP confirmed 7 banned columns absent from `org_orders_mst`. Exit 0 on clean codebase.
- 2026-06-05 — **Phase 8 shipped.** No migration. All Phase 2–7 fields surfaced in the Order Financial UI. `OrderRefundRow` extended with `refund_source_type`/`reopens_due_amount`; `TaxDocumentSummaryRow` added to `OrderFinancialSummary`; `order-tax-documents-mst` queried in `getOrderFinancialSummary`. `OrderTaxDocumentView` extended with Phase 7 lifecycle fields; `rawSnapshot` extended with `taxPricingModeAtCalculation`. `order-detail-client.tsx` builds `taxDocument` from `financialData.taxDocuments[0]` with snapshot fallback. New extracted components: `order-tax-base-buckets.tsx` (tax-base decomposition + pricing mode label) and `tax-document-lifecycle-timeline.tsx` (status badge + lifecycle fields). Modified panels: `order-value-breakdown.tsx` (tax-base buckets), `order-financial-summary-cards.tsx` (base-currency secondary card), `order-settlement-summary.tsx` (pending/failed credit-app rows), `order-payments-credits-tables.tsx` (application_status column + refunds table with source-type and reopens-due), `order-tax-document-panel.tsx` (delegates to lifecycle timeline), `order-financial-debug-panel.tsx` (`taxPricingModeAtCalculation` + `currencyExRate` fields). EN/AR i18n keys added for all new labels. Stories: `OrderTaxBaseBuckets.stories.tsx` (5 variants + RTL) and `TaxDocumentLifecycleTimeline.stories.tsx` (6 variants + RTL). Build green, i18n parity green.
