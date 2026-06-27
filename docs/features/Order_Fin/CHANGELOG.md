# Changelog Ã¢â‚¬â€ Order Financial Platform

## 2026-06-27 — Payment Modal v4: `usePaymentEngine` extraction (Phase 0–1) + QA bug fixes

**Program plan:** `~/.claude/plans/happy-doodling-volcano.md`  
**Review / design:** `docs/features/Order_Fin/Payment_Modal_Review/Payment_Modal_v4_UX_Review_and_Engine_Plan.md`  
**ADR:** `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md` (single headless engine, two views; rejects parallel modals)  
**Scope:** No migration. **No payload-contract change.** Behavior-frozen refactor of `web-admin/src/features/orders/ui/payment-modal-v4.tsx` + two pre-existing UI bug fixes.

### Shipped — Phase 0 (regression baseline)
- ADR accepted: open in Simple, auto-escalate to Full via `needsAdvanced`; one engine, two views.
- Baseline payload-fixture harness — 8 captured `{paymentData, payload}` scenarios under `web-admin/__tests__/features/orders/payment-payload-fixtures/` + skipped oracle test (activates in Phase 2F).

### Shipped — Phase 1 (logic extraction, zero behavior change)
- `hooks/use-money-derivations.ts` — leg aggregations + change/overpayment math (7 tests).
- `hooks/payment-validation.ts` → `derivePaymentValidationItems` — submit-gate rules (10 tests).
- `payment-modal-v4.right-rail.ts` → `deriveBalanceStatusLabel` / `deriveRequiredActionCopy` / `deriveRightRailWarningMessages` (13 tests).
- `hooks/payment-needs-advanced.ts` → `computeNeedsAdvanced` — Simple→Full predicate (13 tests; wiring deferred to Phase 4).
- Component ~250 lines lighter; all extractions are verbatim lifts wired with byte-identical memo deps.

### Shipped — QA bug fixes (pre-existing, surfaced during fixture capture)
- **Bug 2 + 3 FIXED** — allocation drawers rendered *behind* the extra-receipt dialog (CmxDialog renders inline with a shared `z-50` → stacking by DOM order). Reordered the drawers after the dialog in `payment-modal-v4.tsx`; restores the overpayment-allocation → submit flow.
- **Bug 1 DIAGNOSED (no fix)** — pay-fully-by-gift-card → backend `OUTSTANDING_POLICY_REQUIRED`; root cause + fix recipe in `Payment_Modal_Review/Payment_Modal_v4_QA_Bugs_2026-06-27.md`.

### Validation
eslint clean · `tsc` clean on touched files (pre-existing repo errors only) · **production build green** · 114 payment-suite + 59 new-hook tests pass.

### Migrations applied
None (code-only).

---

## 2026-06-05 — Order Financial v1.1 Full Alignment (Phases 1–9)

**Plan:** `docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-full-alignment-implementation-plan.md`  
**Status tracker:** `docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-implementation-status.md`  
**Predecessor:** Canonical Semantics v4 rollout (migrations 0333/0334/0335, 2026-06-04)

### Shipped

- **Phase 1 — P0 tax-document mismatch warning fix.** New pure helper `evaluateTaxDocumentTotalMismatch` (`lib/utils/order-financial-tax-document-mismatch.ts`). Warning now compares tax-document total to fiscal sale total, not to `ar_receivable_amount`; eliminates false warnings on partially-paid CREDIT_INVOICE orders. 28 tests green.

- **Phase 2 — Tax-base decomposition columns.** Migration `0336` adds `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount` to `org_orders_mst` (NUMERIC 19,4, NOT NULL DEFAULT 0). Write service, summary service, view model, mapper, types, and EN/AR i18n wired. `TAX_BASE_BUCKETS_SUM` reconciliation check reserved.

- **Phase 3 — ORDER-only payment validation + credit-app lifecycle.** Migration `0337`. `org_order_payments_dtl` remains ORDER real-payment fact table only; `application_status` 8-state lifecycle added to `org_order_credit_apps_dtl`; `pending_credit_application_amount` + `failed_credit_application_amount` added to `org_orders_mst`. New recon checks: `PAYMENT_TARGET_VS_ORDER_TOTALS`, `CREDIT_APP_LIFECYCLE_CONSISTENCY`.

- **Phase 4 — Base-currency snapshot.** Migration `0338`. `base_cur_currency_code TEXT NULL` + six `base_cur_*` NUMERIC columns on `org_orders_mst`; backfill from stored `currency_ex_rate`. ADR-039 → Implemented. New recon checks: `BASE_CURRENCY_RATE_PRESENT`, `BASE_VS_ORDER_AMOUNT_CONSISTENCY`.

- **Phase 5 — Tax-inclusive pricing (ADR-017).** Migration `0339`. `pricing-mode-resolver.service.ts` created; `extractTaxFromInclusive` exported; TAX_INCLUSIVE branch in `resolveCanonicalTotalAmount`; `taxPricingModeAtCalculation` audit field in snapshot v5; feature flag `FF_TAX_INCLUSIVE_PRICING`; recon check `PRICING_MODE_CONSISTENCY`. ADR-017 → Implemented.

- **Phase 6 — Refund source-lineage + reopens-due (ADR-030).** Migration `0340`. `refund_source_type` (7-value CHECK) + `reopens_due_amount` on `org_order_refunds_dtl`; `classifyRefunds` updated. New recon checks: `REFUND_SOURCE_LINEAGE_CLASSIFICATION` (WARNING), `REFUND_REOPENS_DUE_BOUND` (BLOCKER). ADR-030 → Implemented.

- **Phase 7 — Tax-document full lifecycle.** Migration `0341`. 4 new tables: `org_tax_documents_mst` (DB-immutability trigger), `org_tax_doc_lines_dtl`, `org_tax_doc_seq_counters` (row-locked sequence allocator), `org_tax_doc_triggers_cfg`. New services: sequence, decision, write. New recon checks: `TAX_DOC_SEQUENCE_GAPS`, `TAX_DOC_IMMUTABILITY`, `TAX_DOC_VS_ORDER_TOTALS`.

- **Phase 8 — UI consolidation.** No migration. All Phase 2–7 fields surfaced in Order Financial panels. New extracted components: `order-tax-base-buckets.tsx`, `tax-document-lifecycle-timeline.tsx`. 11 new Storybook variants. EN + AR i18n parity green.

- **Phase 9 — Legacy reader sanity grep (CI gate).** `scripts/check-legacy-columns.js` + `npm run check:legacy`. Balanced-brace extractor scopes detection to `org_orders_mst` Prisma call blocks only. Exit 0 on clean codebase.

### Migrations applied

| Seq | File | Content |
|---|---|---|
| 0336 | `0336_order_fin_tax_base_decomposition.sql` | 4 tax-base bucket columns |
| 0337 | `0337_payment_target_and_credit_app_lifecycle.sql` | Credit-app lifecycle + header buckets |
| 0338 | `0338_order_fin_base_currency_snapshot.sql` | 7 base-currency columns |
| 0339 | `0339_tax_pricing_mode_config.sql` | Tax pricing mode config |
| 0340 | `0340_refund_source_lineage_and_reopen_due.sql` | Refund source-type + reopens-due |
| 0341 | `0341_tax_documents_master_and_lines.sql` | 4 tax-document tables + triggers |

### ADR status updates

| ADR | Now |
|---|---|
| ADR-017 Tax-Inclusive Pricing | Implemented (Phase 5, 2026-06-05) |
| ADR-030 Refund Source Lineage | Implemented (Phase 6, 2026-06-05) |
| ADR-039 Multi-Currency Snapshots | Implemented (Phase 4, 2026-06-05) |

### Verification

- `npm run build` — green; `npm run check:i18n` — green; `npm run check:legacy` — exit 0

---

## 2026-05-30 — BVM Wiring Phase 6: Settlement Hardening (PRD §22.3 + §D9 — verify-payment, modal hardening, D9 UI, per-leg status)

**Implementation log:** `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md`
**Program summary:** `docs/features/Order_Fin/bvm_wiring_program_summary.md`

### Shipped

- **Sub-item 1 — Verify-Payment surface.** Migration `0332_phase6_verify_payment_permission_and_action.sql` seeds the `order_payments:verify` permission (granted to `super_admin` / `tenant_admin` / `admin` / `operator`) and extends `chk_history_action_type` with `PAYMENT_VERIFIED`. New API route `POST /api/v1/orders/[id]/payments/[paymentId]/verify` flips a PENDING `REAL_PAYMENT` leg to COMPLETED via `verifyPaymentTx`, emits `PAYMENT_VERIFIED` (aggregate=order_payment), and the Phase 5 history consumer translates that into a `PAYMENT_VERIFIED` row on `org_order_history` with no new consumer plumbing. Verify button added to `OrderPaymentsCreditsTables` with `CmxDialog` confirm + RBAC gate.
- **Sub-item 2 — Legacy `createInvoice` retired.** Deleted `createInvoice` and its helpers in `lib/services/invoice-service.ts`. `createInvoiceAction` becomes a thin shim around `createArInvoiceFromOrders`. ERP-lite BLOCKING-policy semantics now live in the shared `lib/services/erp-lite-auto-post.util.ts` used by both the canonical writer and the shim. Stale `invoice-service.test.ts` deleted; equivalent coverage already in `ar-invoice.service.test.ts`.
- **Sub-item 3 — `STORED_VALUE_SUB_IDEMPOTENCY_CODE` constants hoist.** Sub-key short codes (`gc | w | a | cn | lp`) moved out of `order-submit-orchestrator.service.ts` into `lib/constants/order-financial.ts` as a frozen `Readonly<Record<CreditApplicationType, …>>`. Orchestrator imports the map; emitted key strings are byte-identical to the previous implementation.
- **Sub-item 4 — Payment Modal v4 hardening.** New helpers in `payment-modal-v4.utils.ts`: `todayYyyyMmDd`, `validateCheckDueDate` (CHECK rule; client-side guard), `buildGatewayReturnState` / `parseGatewayReturnState` (HYPERPAY/PayTabs/Stripe redirect envelope). 6 new unit tests; 2 new i18n keys (`orders.new.splitPayment.checkDateInvalid` / `checkDateInPast`).
- **Sub-item 5 — Payment Method settings UI (D9 toggles).** New BVM Routing card inside the payment-method-config dialog surfaces 5 tenant-override columns (`settlement_type_code`, `credit_application_type`, `default_creation_status`, `allow_status_override`, `is_user_id_required`) using tri-state `CmxSelectDropdown` controls. Pure round-trip helpers in `src/features/payment-config/ui/d9-routing-helpers.ts` (14 unit tests). Zod schema, action input, type definitions, and service-layer DTO projection all extended. 19 new i18n leaf keys (EN+AR parity).
- **Sub-item 6 — `paymentStatus` on `paymentLegSchema` + B7 closer + server-side CHECK refine.** Added optional `paymentStatus: z.enum(['COMPLETED','PENDING']).optional()` to `paymentLegSchema`. Planner (`buildSettlementPlan`) and settler (`settleOrder` non-wiringMode path) honor explicit `'PENDING'`; explicit `'COMPLETED'` (and omission) keep the legacy gateway/D9 fallback. Hoisted `validateCheckDueDate` + `todayYyyyMmDd` into `lib/utils/check-date.ts` (server-safe location) and added a Zod `.superRefine` so CHECK due-date enforcement runs on the server too. `ResolvedSettlementLeg` gains an optional `paymentStatus?`; the orchestrator forwards `leg.paymentStatus` onto every resolved leg.
- **Sub-item 7 — Voucher status triple-column collapse.** **DEFERRED.** Pre-flight Supabase MCP audit found 0 view / 0 function readers but multiple TypeScript voucher services still read the legacy `voucher.status` column (`voucher-service.ts:160`, `:189`, `:245`, etc.). The drop requires a coordinated TS refactor that exceeds the safe Phase 6 envelope. Audit evidence and 4-step follow-up plan documented in `IMPLEMENTATION_STATUS.md` → Sub-item 7 so the next program can resume without re-deriving.

### Tests

- **+11 tests** in `__tests__/services/order-settlement-planner.service.test.ts` (3 Sub-item 6 B7 tests) and `__tests__/validations/payment-leg-schema.test.ts` (NEW, 8 tests).
- **+14 tests** in `__tests__/features/payment-config/d9-routing-helpers.test.ts` (NEW, Sub-item 5).
- **+6 tests** in `__tests__/features/orders/payment-modal-v4.utils.test.ts` (Sub-item 4).
- **+6 tests** in `__tests__/services/verify-payment.service.test.ts` (NEW, Sub-item 1) and **+2 tests** in `__tests__/services/order-history-consumer.service.test.ts` (Sub-item 1 — PAYMENT_VERIFIED routing).
- Full sweep at Phase 6 close: **221/221 pass** (172 Phase 5 baseline + 6 verify + 2 history-PV + 16 modal v4 utils + 14 D9 + 11 B7+schema).

### Verification

- `npx tsc --noEmit` = 0 errors (full, unfiltered).
- Full jest sweep = 221/221 pass.
- `npm run check:i18n` = green.
- Migration 0332 applied during Sub-item 1; no further migrations on disk (Sub-item 7 deferred).
- `npx prisma generate` clean.

### Files

- **New:** `supabase/migrations/0332_phase6_verify_payment_permission_and_action.sql`, `web-admin/lib/utils/check-date.ts`, `web-admin/lib/services/erp-lite-auto-post.util.ts`, `web-admin/lib/services/order-settlement.service.ts` `verifyPaymentTx` export, `web-admin/app/api/v1/orders/[id]/payments/[paymentId]/verify/route.ts`, `web-admin/src/features/payment-config/ui/d9-routing-helpers.ts`, `web-admin/__tests__/services/verify-payment.service.test.ts`, `web-admin/__tests__/features/payment-config/d9-routing-helpers.test.ts`, `web-admin/__tests__/validations/payment-leg-schema.test.ts`, `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md`, `docs/features/Order_Fin/bvm_wiring_program_summary.md`.
- **Modified:** `web-admin/lib/constants/order-financial.ts`, `web-admin/lib/validations/new-order-payment-schemas.ts`, `web-admin/lib/services/order-settlement-planner.service.ts`, `web-admin/lib/services/order-settlement.service.ts`, `web-admin/lib/services/order-history-consumer.service.ts`, `web-admin/lib/services/invoice-service.ts`, `web-admin/lib/services/ar-invoice.service.ts`, `web-admin/lib/services/order-submit-orchestrator.service.ts`, `web-admin/lib/services/payment-config.service.ts`, `web-admin/lib/types/order-financial.ts`, `web-admin/lib/types/payment.ts`, `web-admin/app/actions/payments/invoice-actions.ts`, `web-admin/app/actions/payment-config/payment-methods-actions.ts`, `web-admin/src/features/orders/ui/payment-modal-v4.tsx`, `web-admin/src/features/orders/ui/payment-modal-v4.utils.ts`, `web-admin/src/features/orders/ui/order-financial/order-payments-credits-tables.tsx`, `web-admin/src/features/payment-config/model/payment-method-config-schema.ts`, `web-admin/src/features/payment-config/ui/payment-method-config-dialog.tsx`, `web-admin/__tests__/services/order-settlement-planner.service.test.ts`, `web-admin/__tests__/services/order-history-consumer.service.test.ts`, `web-admin/__tests__/features/orders/payment-modal-v4.utils.test.ts`, `web-admin/messages/en.json`, `web-admin/messages/ar.json`, `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`, `docs/features/Order_Fin/CHANGELOG.md`.
- **Deleted:** `web-admin/__tests__/services/invoice-service.test.ts` (Sub-item 2; its assertions are now covered by `ar-invoice.service.test.ts`).

### Follow-ups (next-program candidates)

1. **Sub-item 7** — Voucher status triple-column collapse (DB coherency check → TS service refactor → DROP COLUMN migration). Full 4-step plan in `IMPLEMENTATION_STATUS.md` → Sub-item 7.
2. **HYPERPAY redirect envelope wiring** — Sub-item 4 helpers are unit-tested; the `payment-modal-v4.tsx` redirect handler still needs to consume them.
3. **D9 cross-field warning hints** — settings dialog should warn on contradictory D9 combinations (e.g. CASH method with `settlement_type_code='CREDIT_INVOICE'`).
4. **Per-order `AR_INVOICE_LINKED` sub-events** — carried forward from Phase 5; would close the multi-order AR-invoice silent-skip path.

---

## 2026-05-30 — BVM Wiring Phase 5: History / Audit (PRD §22 — outbox-driven order timeline)

**Implementation log:** `docs/features/Order_Fin/bvm_wiring_phase5_implementation.md`

### Shipped

- **Migration 0330** extends `chk_history_action_type` to allow 3 BVM action codes (`ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`). Adds nullable `outbox_event_id UUID` column on `org_order_history` with FK → `org_domain_events_outbox(id) ON DELETE SET NULL`, partial unique index `uq_history_outbox_event (tenant_org_id, outbox_event_id) WHERE outbox_event_id IS NOT NULL` (consumer idempotency key), and fast-path lookup index. No CASCADE, no data loss; legacy rows unaffected (NULL `outbox_event_id`).
- **New consumer service** `web-admin/lib/services/order-history-consumer.service.ts` subscribes to the 3 BVM outbox events. Resolves `order_id` from `aggregate_id` (ORDER_COMPLETED) or via `org_fin_vouchers_mst.order_id` / `org_invoice_mst.order_id` for voucher / AR-invoice events. Manual financial vouchers + multi-order invoices → SKIPPED_NOT_ORDER_LINKED (intentional). Idempotent upsert on the partial unique index with `update: {}` no-clobber clause. Runs in the outbox worker; never enlarges the submit-order tx.
- **OrderTimeline UI** (`src/features/orders/ui/order-timeline.tsx`) extended with icons (`ShieldCheck` / `FileText` / `Receipt`), Order Fin palette colors (green-700 / violet-600 / sky-500), and i18n keys for the 3 new action types. Existing fetch / render / RTL paths untouched.
- **i18n** — 3 new bilingual labels in `orders.timeline.actions.*` (EN: Order Completed / Voucher Posted / AR Invoice Issued; AR: اكتمل الطلب / تم ترحيل السند / تم إصدار فاتورة الذمم). `check:i18n` green.
- **Prisma schema** updated: `outbox_event_id` field + relation + `@@unique` + lookup `@@index` on `org_order_history`; back-relation `org_order_history[]` on `org_domain_events_outbox`.

### Tests

- **+9 consumer tests** in `__tests__/services/order-history-consumer.service.test.ts` (direct `ORDER_COMPLETED`, voucher-resolved + invoice-resolved paths, manual-voucher skip, multi-order-invoice skip, unsupported-event skip, idempotency, multi-tenant isolation, batch outcome 1:1).
- Full sweep: **172/172 pass** (163 prior baseline + 9 new).

### Verification

- `npx tsc --noEmit` filtered = 0 errors.
- Full jest sweep = 172/172 pass.
- `npm run check:i18n` = green.
- Migration 0330 applied; `npx prisma generate` clean.

### Files

- **New:** `supabase/migrations/0330_phase5_order_history_bvm_action_types.sql`, `web-admin/lib/services/order-history-consumer.service.ts`, `web-admin/__tests__/services/order-history-consumer.service.test.ts`, `docs/features/Order_Fin/bvm_wiring_phase5_implementation.md`.
- **Modified:** `web-admin/prisma/schema.prisma`, `web-admin/src/features/orders/ui/order-timeline.tsx`, `web-admin/messages/en.json`, `web-admin/messages/ar.json`, `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`, `docs/features/Order_Fin/CHANGELOG.md`.

### Follow-ups (Phase 6 candidates)

1. Promote the consumer to a default outbox-worker subscriber (wire into `claimBatch` loop).
2. Per-order AR_INVOICE_LINKED sub-events for multi-order invoices so each linked order timeline includes the AR raise.
3. Reconciliation check for missing outbox-driven history rows (every POSTED voucher with `order_id` should have a VOUCHER_POSTED_AND_WIRED row on the order timeline).

---

## 2026-05-30 — BVM Wiring Phase 4: reconciliation expansion (PRD §22.1 + §24.3)

**Implementation log:** `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md`

### Shipped

- **8 → 30 reconciliation checks.** Five new check modules under `web-admin/lib/services/reconciliation/` (`ar-checks`, `stored-value-checks`, `order-checks`, `order-snapshot-checks`, `voucher-checks`) implement every PRD §22.1 check using the mig 0303 / 0318 / 0329 FK backlinks. Legacy 8 checks factored 1:1 (zero behaviour change).
- **Orchestrator rewrite.** `reconciliation.service.ts` now fans out checks via `Promise.all`, persists issues with bulk `createMany` (closes BVM R7 per-row insert loop), and computes `total_checked` dynamically from `EXECUTED_CHECK_NAMES` (no more magic-8). Public API surface unchanged.
- **Voucher-scoped reconciliation (PRD §24.3).** New `voucher-reconciliation.service.ts` + `GET /api/v1/finance/vouchers/[voucherId]/reconciliation` route. Read-only operator action; runs the 3 voucher integrity checks without writing a run row.
- **BVM R1 fix.** `app/api/v1/finance/reconciliation/issues/[issueId]/route.ts` permission code corrected from `reconciliation:acknowledge` (unseeded; always 403) to seeded `reconciliation:acknowledge_issues`.
- **UI Cmx migration.** `reconciliation-list-client.tsx`, `reconciliation-detail-client.tsx`, and `[runId]/page.tsx` back-link migrated to `CmxButton`, `Badge`, `CmxDialog`, `CmxInput`, `CmxSummaryMessage`. Full RTL pass: `rtl:` flips, `ar-OM` `Intl.DateTimeFormat`, mojibake purged, hardcoded English "Cancel" → `tCommon('cancel')`.
- **i18n parity.** `billing.reconciliation.paginationTotal` + 33-entry `billing.reconciliation.checks.<NAME>` sub-namespace added to en.json + ar.json. `useMessages()` lookup with raw-code fallback.
- **Route pair JSDoc cross-refs (R8).** `orders/[id]/financial-reconcile` (POST, run) and `orders/[id]/financial-reconciliation` (GET, view) now declare each other via `@see`.
- **Stored-value `txn_type` filter (T1 closure).** All 5 `*_LEDGER_LINK_EXISTS` checks apply per-table debit-only enums (`STORED_VALUE_TXN_TYPES.REDEMPTION` / `GIFT_CARD_TXN_TYPE.REDEEM` / `LOYALTY_TXN_TYPES.REDEEM`). Eliminates over-flagging of top-ups / issuances.

### Tests

- **+29 new check-module + voucher-service tests** in `__tests__/services/reconciliation/check-modules.test.ts` (includes multi-tenant isolation test).
- **+14 rewritten orchestrator + integration tests** (`reconciliation.service.test.ts` 8, `reconciliation-run.test.ts` 6) against the bulk-insert contract.
- Full sweep: **163/163 pass** (120 baseline + 14 orchestrator + 29 check-modules).

### Verification

- `npx tsc --noEmit` filtered = 0 errors.
- Full jest sweep = 163/163 pass.
- `npm run check:i18n` = green.
- No migration shipped (Step 1 SKIP — every dependency already in mig 0293 / 0294 / 0295 / 0303 / 0306 / 0318 / 0329).

### Files

- **New:** `web-admin/lib/services/reconciliation/{types,ar-checks,stored-value-checks,order-checks,order-snapshot-checks,voucher-checks}.ts`, `web-admin/lib/services/voucher-reconciliation.service.ts`, `web-admin/app/api/v1/finance/vouchers/[voucherId]/reconciliation/route.ts`, `web-admin/__tests__/services/reconciliation/check-modules.test.ts`, `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md`.
- **Modified:** `web-admin/lib/services/reconciliation.service.ts`, `web-admin/lib/constants/order-financial.ts`, `web-admin/app/api/v1/finance/reconciliation/issues/[issueId]/route.ts`, `web-admin/app/api/v1/orders/[id]/financial-reconcile/route.ts`, `web-admin/app/api/v1/orders/[id]/financial-reconciliation/route.ts`, `web-admin/app/dashboard/internal_fin/reconciliation/[runId]/page.tsx`, `web-admin/src/features/billing/ui/reconciliation-list-client.tsx`, `web-admin/src/features/billing/ui/reconciliation-detail-client.tsx`, `web-admin/messages/en.json`, `web-admin/messages/ar.json`, `web-admin/__tests__/services/reconciliation.service.test.ts`, `web-admin/__tests__/integration/reconciliation-run.test.ts`, `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`, `docs/features/Order_Fin/CHANGELOG.md`.

### Follow-ups (Phase 6 candidates)

1. Add direct `fin_voucher_id` backlink on `org_order_refunds_dtl` so `checkRefundLink` switches from indirect lookup to direct FK scan.
2. Add standard audit fields on `org_fin_recon_issues_dtl` (`is_active`, `rec_status`, `rec_notes`, `rec_order`, `created_by/info`, `updated_*`).
3. Voucher-reconciliation UI surface (button in voucher detail vs. dedicated page).

---

## 2026-05-29 — BVM Wiring Phase 3 Round 3: gift-card-as-discount semantic fix

**Surfaced by:** Round-2 manual QA — AR invoice produced 0.94 instead of expected 1.040 because the pricing engine already deducts gift-card from `finalTotal` and the planner then subtracted it again as a credit-application.

### Shipped

- **Orchestrator distinguishes gift-card from at-settlement credit-applications.** New `settlementCreditApplied = plan.creditAppliedAmount - giftCardApplied` and `correctedOutstanding = finalTotal - realPayment - settlementCreditApplied` hoisted before the `shouldCreateArInvoice` gate.
- **AR invoice `expected_total_amount` now uses `correctedOutstanding`.**
- **`shouldCreateArInvoice` gate now uses `correctedOutstanding`.**
- **`breakdown.outstanding`/`netReceivable` use the same corrected math** — also fixes the order's persisted `outstanding_amount` snapshot.
- **Voucher line for gift-card preserved.** Gift-card still emits `LINE_ROLE.ORDER_CREDIT_APPLICATION` (M3 expectation unchanged) — the line tracks the BALANCE DEBIT, separate from pricing math.
- **AR test updated** (`ar-invoice.service.test.ts` Round-2 case → Round-3) to assert `expected_total_amount = 1.04` for the canonical gift+cash+CREDIT_INVOICE scenario.

### Verification
- `npx tsc --noEmit` filtered = 0 errors
- 120/120 jest pass
- `npm run build` succeeds

### Files modified
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- `web-admin/__tests__/services/ar-invoice.service.test.ts`
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`
- `docs/features/Order_Fin/CHANGELOG.md`

### Production-data artifacts

Two pre-Round-3 AR invoices are still in the DB from earlier QA attempts:
- `ARI-000012` (order `d9a306fc-e3d7-4b40-9205-a1e5f21e5dcf`, total 2.04, pre-Round-1 inflated)
- `ARI-000014` (order `01a1c005-cb1f-4693-9b5c-3bd888efe28f`, total 0.94, pre-Round-3 under-sized)

Recommended cleanup: void both via the AR invoice UI with reason "QA test artifact — pre Round-3 sizing bug". The orders themselves are valid; only the AR invoice headers are wrong.

---

## 2026-05-29 — BVM Wiring Phase 3 Round 2: AR invoice = receivable, zero-outstanding gate, TX4 removed

**Surfaced by:** Manual QA scenario M1 — `chk_payments_voucher_required` constraint violation + inflated AR invoice total.

### Shipped

1. **AR writer `expected_total_amount` input** — `createArInvoiceFromOrders` now accepts an optional amount that sizes the invoice header, per-order link, line summary, and AR ledger debit. Single-order callers (submit-order) use it; multi-order API-route callers keep legacy full-sale sizing by omitting it.

2. **Orchestrator: zero-outstanding gate** — `shouldCreateArInvoice = effectiveOutstandingPolicy === 'CREDIT_INVOICE' && plan.outstandingAmount > TOLERANCE`. New ADR `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md` documents the rule.

3. **Orchestrator: TX4 AR-allocation block REMOVED.** Cash + credit-application legs are already accounted for by the BVM voucher. The legacy `recordPaymentTransaction` + `allocateArPaymentTx` flow only existed to bring an inflated invoice's outstanding down — now unnecessary. Also closes the `chk_payments_voucher_required` violation (the offending call site is gone). Imports cleaned up.

4. **Orchestrator: AR invoice sized to `plan.outstandingAmount`.** Passes through the new writer input.

### Tests

- `__tests__/services/ar-invoice.service.test.ts` — +2 cases (expected_total override + legacy fallback). Sweep now **120/120 pass**.

### Production AR invoice for the failing M1 order

The pre-Round-2 AR invoice `ARI-000012` (total 2.04, OVERDUE) for order `d9a306fc-e3d7-4b40-9205-a1e5f21e5dcf` is already committed. Recommended cleanup: void it through the AR invoice UI with reason "QA test artifact — Phase 3 Round 1 inflated". The next fresh submit will produce the correct sized invoice.

### Verification

- `npx tsc --noEmit` filtered = 0 errors.
- 120/120 jest pass.
- `npm run build` succeeds.

### Files modified (Round 2)

- `web-admin/lib/validations/ar-invoice-schemas.ts`
- `web-admin/lib/services/ar-invoice.service.ts`
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- `web-admin/__tests__/services/ar-invoice.service.test.ts`
- `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md` (new)
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`
- `docs/features/Order_Fin/CHANGELOG.md`

---

## 2026-05-29 — BVM Wiring Phase 3: AR Invoice canonical writer + Gift-card-as-voucher-line

### Shipped in this session

**No migration** — `org_invoice_mst` already had every column the new writer needs (`gift_card_id`, `gift_card_applied_amount`, `issued_at`, `issued_by`, …). Discovery via Supabase MCP confirmed before any code change. Two D9 `GIFT_CARD` payment-method-config rows already exist (one per tenant) so the synthesis path is safe out of the box.

**Change 1 — AR Invoice canonical writer migration (`createInvoice` → `createArInvoiceFromOrders`)**
- `ar-invoice.service.ts` `createArInvoiceFromOrders` now accepts an optional `tx?: PrismaTx` so submit-order threads its own transaction through. The producer runs inside the caller's tx with no outer `prisma.$transaction` wrapper — guarantees the AR invoice commits atomically with the order header and the voucher.
- New input flags: `issueImmediately?: boolean` (default false; API route DRAFT semantics preserved) and `gift_card_applied_amount?: number`. When `issueImmediately === true`: status derived from OPEN via `deriveArInvoiceStatus`, `issued_at`/`issued_by` populated inline, AR ledger `INVOICE_ISSUED` DEBIT appended, `AR_INVOICE_ISSUED` outbox event emitted, status-history `actionCd = 'CREATE_FROM_ORDERS_ISSUED'`.
- Mirrors the legacy `createInvoice` ERP-lite parity: `ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction` now fires inside the writer, gated by `assertBlockingInvoiceAutoPostSucceeded` (locally copied from `invoice-service.ts` — Phase 6 cleanup will extract a shared util).
- Schema (`ar-invoice-schemas.ts`): `createArInvoiceFromOrdersSchema` now admits the two new optional fields.
- Orchestrator (`order-submit-orchestrator.service.ts:565-588`): replaces `createInvoice(...)` with `createArInvoiceFromOrders({ order_ids:[orderId], ..., issueImmediately:true, idempotency_key:'${orderId}_ar' }, { tenantId, userId }, tx)`. Idempotency key matches the Phase 2 sub-key convention (`${orderId}_vch`, `${orderId}_vch_post`).
- `createInvoice` is left in `invoice-service.ts` for the deprecated `createInvoiceAction` server action and its existing jest tests. Removal is Phase 6.

**Change 2 — Gift-card-by-id as ORDER_CREDIT_APPLICATION voucher line (Phase 2.1 deferred item closed)**
- Gift-card no longer debited in TX1. The orchestrator now synthesises a `ResolvedSettlementLeg` with `paymentNature = CREDIT_APPLICATION, creditApplicationType = GIFT_CARD, creditReferenceId = input.giftCardId, amount = serverTotals.giftCardApplied` and pushes it onto `settlementLegs` (NOT `paymentLegs`) BEFORE `buildSettlementPlan`.
- Planner classification unchanged: the existing CREDIT_APPLICATION branch handles GIFT_CARD via STORED_VALUE_LOCK_ORDER (gift-card rank 0).
- The existing TX2 voucher loop produces a `LINE_ROLE.ORDER_CREDIT_APPLICATION` voucher line + calls `applyStoredValueDebitTx({ creditType: GIFT_CARD, creditReferenceId: input.giftCardId, voucherId, voucherLineId, idempotencyKey: '${orderId}_sv_gc_${legIndex}' })`. Dispatcher (`order-credit-application.service.ts:177-191`) routes to `redeemGiftCardTx` with `fin_voucher_id` + `fin_voucher_trx_line_id` populated atomically — closes the Phase 2.1 deferred gap.
- Throws `GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED` if the tenant's D9 GIFT_CARD row is missing (operator setup error, no silent fallback).

**Breakdown snapshot math fix** (`order-submit-orchestrator.service.ts:882-902`)
- `creditsTotal: serverTotals.giftCardApplied` → `plan.creditAppliedAmount` (now sums every credit-application: gift-card + wallet + advance + credit-note + loyalty).
- `outstanding: ... - amountToCharge` → `... - plan.realPaymentAmount` to remove the double-subtraction risk when wallet/advance legs arrive via `paymentLegs` (because `amountToCharge` filters only by `DEFERRED_METHODS`, not `paymentNature`).
- `netReceivable = finalTotal - plan.creditAppliedAmount` (was `finalTotal - giftCardApplied`).

### Tests added

- `__tests__/services/ar-invoice.service.test.ts` — +5 Phase 3 cases (issueImmediately on/off, gift_card mirror, ERP-lite BLOCKING gate, caller-tx atomic invariant).
- `__tests__/services/order-settlement-planner.service.test.ts` — +2 Phase 3 cases (synthesized gift-card leg classification, mixed cash+wallet+gift-card `creditAppliedAmount` sum).

### Verification

- `npx tsc --noEmit` filtered = 0 errors (the 3 pre-existing `payment-config` UI errors noted in the Phase 3 RESUME were closed by the intervening 28_05_2026_4/_5 commits; baseline is now genuinely clean).
- Phase 2 baseline jest sweep (6 suites, 69 tests) **+ Phase 3 (8 new cases)** = **77/77 pass**.
- `__tests__/services/gift-card-service.test.ts` — 40/40 pass (service untouched).
- `npm run build` — succeeds.

### Files modified

- `web-admin/lib/services/ar-invoice.service.ts`
- `web-admin/lib/validations/ar-invoice-schemas.ts`
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- `web-admin/__tests__/services/ar-invoice.service.test.ts`
- `web-admin/__tests__/services/order-settlement-planner.service.test.ts`

### Follow-ups (carried to Phase 6)

- Retire `createInvoice` from `invoice-service.ts` once `createInvoiceAction` migrates to the canonical writer.
- Extract `assertBlockingInvoiceAutoPostSucceeded` into `lib/services/erp-lite-auto-post.util.ts` (currently duplicated between `invoice-service.ts` and `ar-invoice.service.ts`).

---

## 2026-05-28 (later in day) — BVM Wiring Phase 2: Stored-Value Consolidation

### Closed in this session

**Migration:** `supabase/migrations/0329_phase2_stored_value_voucher_fks.sql`
- Added `fin_voucher_id` + `fin_voucher_trx_line_id` to `org_loyalty_txn_dtl`.
- Added 10 composite FK constraints `(tenant_org_id, <link_id>) → org_fin_vouchers_mst | org_fin_voucher_trx_lines_dtl ON DELETE SET NULL` across all 5 stored-value txn tables.
- Added 10 partial indexes (`WHERE col IS NOT NULL`).

**New invariant — stored-value atomicity:**
- Submit-order's voucher creation, line inserts, every `redeem*Tx` debit, and `postAndWireBizVoucher` now run in **one `prisma.$transaction`**. A failure anywhere inside rolls back the voucher header, every line, every prior balance debit.
- Previously: a mid-flow failure could leave the voucher header committed with no payment fact rows.

**Service contracts standardised:**
- All 5 `redeem*Tx` services accept `idempotencyKey?`, `voucherId?`, `voucherLineId?` with uniform skip-on-existing semantics. `redeemAdvanceTx` and `redeemCreditNoteTx` previously had no idempotency support — Phase 2 closes that drift.
- `createBizVoucher`, `addVoucherLine`, `postAndWireBizVoucher` accept an optional `tx?: PrismaTransactionClient` to join the caller's transaction.
- `applyStoredValueDebitTx` (now exported) forwards `voucherId`/`voucherLineId` to every dispatch path and writes them on `org_order_credit_apps_dtl`.

**Lock-order discipline:**
- New `STORED_VALUE_LOCK_ORDER` constant (`GIFT_CARD → WALLET → CUSTOMER_ADVANCE → CUSTOMER_CREDIT → LOYALTY_CREDIT`).
- Planner sorts `creditApplicationLegs` by `STORED_VALUE_LOCK_RANK` → concurrent submits take row locks in the same sequence — deadlock-free.

**Critical bug prevented (Step 4):**
- `order-settlement.service.ts`: the `CREDIT_APPLICATION` branch now short-circuits with `if (wiringMode) continue;` BEFORE any `redeem*Tx` call. Without this guard, the orchestrator-tx consolidation would have caused `settleOrder` to debit every stored-value balance a second time.

**Legacy retirement:** `app/api/v1/orders/_legacy_create-with-payment/` deleted (Next.js private folder, never served). ESLint rule kept as a future-proof guard.

**Deferred to Phase 2.1:** `input.giftCardId` as a voucher line — needs a voucher-total semantic decision.

**Tests:** +8 contract tests; Phase 2 sweep 69/69 pass.

---

## 2026-05-28

### BVM Wiring Phase 1B — Pre-Phase-2 Stabilization Session

Session plan: `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose.md` (13 stages, all complete)
Status doc: `IMPLEMENTATION_STATUS.md`

**Audit findings resolved:**
- **B1** (build-blocking): `taxLines.push` missing `isCompound` field — threaded from `org_tax_profiles_cf.is_compound` via `calculateTax()`. Build GREEN for the first time in Phase 1B.
- **B2** (live 403 for non-admin): permission code `invoices:view` renamed to `invoices:read` (the actually-seeded code) across 5 sites.
- **B3** (AR ledger pollution): `createInvoice()` gated on `effectiveOutstandingPolicy === 'CREDIT_INVOICE'`. Cash sales no longer produce AR invoice rows or AR ledger debits. See new ADR: `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md`.
- **X1** (drift risk): raw outbox insert in `voucher-wiring.service.ts` replaced with typed `emitEventTx()`; `OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED` added to constants.
- **X5** (live silent drift): manual voucher post via Finance UI now refreshes linked order snapshot via new `recalcOrderSnapshotIfLinked()` helper.
- **Y3** (live data loss): `collectPaymentTx` now persists `check_no`/`check_bank_name`/`check_due_date`.
- **Y4** (log noise): `Jh65`/`Jh66` debug logs deleted from permission service.
- **S1** (Prisma drift): D9 columns added to `sys_payment_method_cd` (6) and `org_payment_methods_cf` (4) Prisma models; Step 0h debt closed.
- **S2** (silent retry inconsistency): SHA-256 payload-hash conflict detection added via new `lib/utils/idempotency.ts`. Submit-order route returns 409 IDEMPOTENCY_CONFLICT on payload mismatch.
- **S3** (fallback drift): planner + settlement both `throw 'CREDIT_APPLICATION_TYPE_REQUIRED'` instead of silent fallback.
- **S4**: `orders-access.ts:58` updated from `/create-with-payment` to `/submit-order`.
- **S6** (float drift): new `lib/utils/money.ts` (Decimal-backed) applied at known drift sites in orchestrator, settlement, and AR invoice services.
- **F21**: `redeemPointsTx` idempotency key is now deterministic (`loyalty-redeem-${orderId}` — was `${orderId}-points-redeem-${Date.now()}`).

**Also fixed (pre-existing, surfaced during stabilization):**
- `payment-modal-v4.tsx` use-before-declaration (`payNowAmount`/`remainingBalance` hoisted).
- `discount-service.test.ts` stale mock table names updated to current schema.

**New files:**
- `lib/utils/money.ts` (Decimal helpers)
- `lib/utils/idempotency.ts` (canonicalize + SHA-256 hash + store/find)
- `__tests__/utils/money.test.ts` (13 tests, all pass)
- `__tests__/utils/idempotency.test.ts` (11 tests, all pass)
- `__tests__/services/order-settlement-planner.service.test.ts` (10 tests, all pass)
- `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md`
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` (new canonical name, supersedes `current_status.md`)
- `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md`

**Verification:**
- `npx tsc --noEmit` — 0 errors
- 34 new tests + existing discount-service tests all green
- No new migrations (all changes are code + Prisma schema sync)

---

## 2026-05-23

### BVM Wiring Phase 1B — Submit Order Canonical Path

**Migrations applied:** `0324_bvm_wiring_phase1b_line_type.sql`, `0325_payment_method_config_enrichment.sql`

**New files:**
- `lib/types/settlement-plan.ts` — `RealPaymentLeg`, `CreditApplicationLeg`, `SettlementPlan` interfaces
- `lib/services/order-settlement-planner.service.ts` — pure `buildSettlementPlan()` + async `validateSettlementPlan()`
- `lib/services/order-submit-orchestrator.service.ts` — `submitOrder()` orchestrator + `resolveOrderBranch()`
- `app/api/v1/orders/submit-order/route.ts` — canonical order submission endpoint
- `docs/features/Order_Fin/ADR_submit_order_canonical_path.md` — ADR for canonical path decision
- `docs/features/Order_Fin/bvm_wiring_phase1b_implementation.md` — full feature implementation doc

**Modified files:**
- `lib/types/order-financial.ts` — D9 config fields added to `SettlementOption`
- `lib/validations/new-order-payment-schemas.ts` — `submitOrderRequestSchema` + `SubmitOrderRequest` type
- `lib/constants/order-financial.ts` — `CREDIT_APPLICATION_TYPES` fixed to exact DB constraint values
- `lib/constants/voucher.ts` — `LINE_TYPE.CREDIT_APPLICATION` added
- `lib/services/checkout-config.service.ts` — COALESCE JOIN for D9 fields from `sys_payment_method_cd`
- `lib/services/order-credit-application.service.ts` — constant key fixes (CUSTOMER_ADVANCE, CUSTOMER_CREDIT, LOYALTY_CREDIT)
- `lib/services/order-settlement.service.ts` — same constant key fixes
- `app/api/v1/orders/_legacy_create-with-payment/route.ts` — folder renamed, `@deprecated FROZEN` added
- `eslint.config.mjs` — `no-restricted-imports` barricade for legacy path
- `src/features/orders/hooks/use-order-submission.ts` — switched to `submit-order`, updated response parsing, warning toasts + voucher badge
- `messages/en.json` + `ar.json` — 4 new i18n keys (payment warnings + voucherCreated)
- `prisma/schema.prisma` — updated for D9 columns on both payment method tables

**Architecture change:** `POST /api/v1/orders/submit-order` is now the single canonical path. The orchestrator follows the sequence: settlement plan → validate → create voucher + lines → post + wire → `settleOrder(wiringMode: true)`. `settleOrder` skips the `org_order_payments_dtl` / `org_order_credit_apps_dtl` direct writes when wiring has already created them.

## 2026-05-22

### BVM Wiring Phase 1A — Order Payment + Credit Application + Cash Drawer Wiring
- Implemented wiring layer: `postAndWireBizVoucher()`, handler services, `getVoucherLinkedEffects()`
- Added `fin_vouchers:wire` and `fin_vouchers:view_effects` permissions
- Added wiring status UI to vouchers page
- Migrations: `0318_bvm_wiring_phase1a_schema.sql`, `0319_bvm_wiring_phase1a_permissions.sql`

## 2026-05-18

### Documentation
- Created full P19 documentation suite (README, developer_guide, current_status, progress_summary, technical_docs, Order_Fin_Docs)

### Tests
- 126 tests across 16 suites Ã¢â‚¬â€ all passing
- Integration tests: refund-flow, gift-card-redemption, checkout-multi-payment, reconciliation-run
- Unit tests: tax-engine, loyalty, outbox, stored-value, cash-drawer, refund, reconciliation, promotion-engine, order-calculation, settlement
- E2E stubs: cash-drawer, stored-value, promotions, tax-setup, reconciliation
- Validation tests: financial-schemas, financial-tenant-isolation

## 2026-05-15

### UI Pages (P10Ã¢â‚¬â€œP14)
- `app/dashboard/internal_fin/cash-drawers/` Ã¢â‚¬â€ cash drawer list + detail + session print
- `app/dashboard/internal_fin/refunds/` Ã¢â‚¬â€ refunds list
- `app/dashboard/internal_fin/reconciliation/` Ã¢â‚¬â€ reconciliation list + detail
- `app/dashboard/marketing/promotions/` Ã¢â‚¬â€ promotions list
- `app/dashboard/settings/tax/` Ã¢â‚¬â€ tax profiles + exemptions

### Print & Export (P15)
- `app/dashboard/internal_fin/payments/[id]/print/receipt-voucher/` Ã¢â‚¬â€ receipt voucher print
- `app/dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print/` Ã¢â‚¬â€ session summary print

### Background Jobs (P16)
- `supabase/migrations/0296_pg_cron_jobs.sql` Ã¢â‚¬â€ pg_cron schedule for outbox worker
- `supabase/functions/outbox-worker/index.ts` Ã¢â‚¬â€ Edge Function

### i18n (P17)
- Added ~200 translation keys to `messages/en.json` and `messages/ar.json`

## 2026-05-14

### API Routes (P9)
- Cash drawers: open/close session, cash movement, session summary
- Customers: wallet top-up, wallet ledger, advance issue, advance ledger, credit note issue, credit notes list, loyalty, stored-value hub
- Orders: refund initiation, refund list, refund approval, payment collection
- Finance: reconciliation runs, reconciliation issues, financial reports (orders summary, payments breakdown, tax report)
- Gift cards: balance lookup, ledger
- Loyalty: config, tiers
- Marketing: promotions CRUD, promo validation
- Settings: payment methods, terminals, tax profiles, tax exemptions

### Services (P8)
- `lib/services/order-settlement.service.ts` Ã¢â‚¬â€ multi-leg atomic settlement
- `lib/services/order-refund.service.ts` Ã¢â‚¬â€ 3-step refund lifecycle
- `lib/services/stored-value.service.ts` Ã¢â‚¬â€ wallet, advance, credit note ops
- `lib/services/loyalty.service.ts` Ã¢â‚¬â€ earn/redeem points
- `lib/services/promotion-engine.service.ts` Ã¢â‚¬â€ discount calculation + usage tracking
- `lib/services/tax-engine.service.ts` Ã¢â‚¬â€ profile-based tax with exemptions
- `lib/services/reconciliation.service.ts` Ã¢â‚¬â€ 7-check financial reconciliation
- `lib/services/cash-drawer.service.ts` Ã¢â‚¬â€ session lifecycle + movement recording
- `lib/services/outbox.service.ts` Ã¢â‚¬â€ domain event append + batch claim
- `lib/services/order-calculation.service.ts` Ã¢â‚¬â€ server-side totals calculation

## 2026-05-07 Ã¢â‚¬â€œ 2026-05-14

### Migrations (P0Ã¢â‚¬â€œP7)
- `0278` Ã¢â‚¬â€ rename org_order_discounts_dtl
- `0279` Ã¢â‚¬â€ sys financial lookup tables (payment nature, credit application types, etc.)
- `0280` Ã¢â‚¬â€ org_order_charges_dtl
- `0281` Ã¢â‚¬â€ org_order_taxes_dtl
- `0282` Ã¢â‚¬â€ org_orders_mst financial snapshot columns
- `0283` Ã¢â‚¬â€ harden credit_apps + refunds
- `0284` Ã¢â‚¬â€ org_customer_wallets_mst + org_wallet_txn_dtl
- `0285` Ã¢â‚¬â€ org_customer_advances_mst + org_advance_txn_dtl
- `0286` Ã¢â‚¬â€ org_credit_notes_mst + org_credit_note_txn_dtl
- `0287` Ã¢â‚¬â€ org_loyalty_accounts_mst + org_loyalty_txn_dtl
- `0288` Ã¢â‚¬â€ extend promotions tables (stacking, usage limits)
- `0289` Ã¢â‚¬â€ org_tax_profiles_cf + org_tax_exemptions_cf
- `0290` Ã¢â‚¬â€ currency rounding config
- `0291` Ã¢â‚¬â€ payment config seed (payment methods, cash payment nature)
- `0292` Ã¢â‚¬â€ org_domain_events_outbox (idempotency + retry)
- `0293` Ã¢â‚¬â€ org_reconciliation_runs_mst + org_reconciliation_issues_dtl
- `0294` Ã¢â‚¬â€ financial permissions seed
- `0295` Ã¢â‚¬â€ financial navigation (sys_components_cd)
- `0296` Ã¢â‚¬â€ pg_cron jobs

### Constants & Types
- `lib/constants/order-financial.ts` Ã¢â‚¬â€ all financial enums + status codes
- `lib/types/order-financial.ts` Ã¢â‚¬â€ FinancialBreakdownSnapshot, SettlementOption, ResolvedSettlementLeg, etc.
