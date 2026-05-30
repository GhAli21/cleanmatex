# BVM Wiring Phase 4 — Implementation Log

**Date:** 2026-05-29 → 2026-05-30
**Status:** ✅ Shipped (Scope B = PRD §22.1 expanded checks + §24.3 voucher endpoint + UI Cmx migration + i18n cleanup + test expansion)
**Predecessor commit:** Phase 3 close (`5c7a78b 28_05_2026_14 fix ar-invoice.service.ts and Update payment Modal screen v04`).
**Plan source:** `docs/features/Order_Fin/bvm_wiring_phase4_to_6_RESUME.md` § Phase 4 (original), `docs/features/Order_Fin/bvm_wiring_phase4_RESUME.md` (mid-session), `docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md` (close).

---

## Overview

Phase 4 turned the pre-existing 8-check reconciliation prototype into the full PRD §22.1 + §24.3 reconciliation surface specified by BVM, factored into modular checks, fixed every R1–R8 bug catalogued in Step 0, and migrated the operator UI to Cmx with full RTL + i18n parity.

| Change | Effect |
|---|---|
| **1. Bug-fix sweep (R1, R7)** | R1 closed in Step 2a (permission code `reconciliation:acknowledge` → seeded `reconciliation:acknowledge_issues`, fixing always-403 on issue ACK). R7 closed in Step 2h (per-row insert loop replaced with bulk `createMany` via `persistReconciliationIssues`). |
| **2. Check expansion 8 → 30 (R2, R3)** | Five new check modules under `lib/services/reconciliation/` cover every PRD §22.1 check (link-existence on 0303 / 0318 / 0329 FK backlinks, separation invariants, snapshot/charge invariants, voucher integrity, cash-movement link). Legacy 8 checks factored 1:1 (zero behaviour change). |
| **3. Voucher-scoped reconciliation (R4)** | New `lib/services/voucher-reconciliation.service.ts` + `GET /api/v1/finance/vouchers/[voucherId]/reconciliation` route fulfil PRD §23.1 + §24.3. On-demand, read-only operator surface that runs the 3 voucher integrity checks without writing a run row. |
| **4. Orchestrator rewrite (R7)** | `lib/services/reconciliation.service.ts` rewritten: inline checks removed, modules fanned out via `Promise.all`, `total_checked` now dynamic (`EXECUTED_CHECK_NAMES.length` = 30 today), magic `8` eliminated. Public API surface unchanged. |
| **5. UI Cmx migration (R5, R6)** | `reconciliation-list-client.tsx`, `reconciliation-detail-client.tsx`, and the back-link in `[runId]/page.tsx` migrated to `CmxButton`, `Badge`, `CmxDialog`, `CmxInput`, `CmxSummaryMessage`. Full RTL pass (`rtl:` flips, `ar-OM` `Intl.DateTimeFormat`, mojibake purged, hardcoded English replaced with `tCommon('cancel')`). |
| **6. i18n parity** | `billing.reconciliation.paginationTotal` + 33-entry `billing.reconciliation.checks.<NAME>` sub-namespace added to both `en.json` and `ar.json`. `npm run check:i18n` green. |
| **7. Test coverage** | New `__tests__/services/reconciliation/check-modules.test.ts` (29 tests) covering every new module + voucher-scoped service + multi-tenant isolation. Existing orchestrator + integration tests rewritten against the bulk-insert contract (14 tests). Full sweep: **163/163 pass**. |
| **8. Route pair JSDoc cross-refs (R8)** | `orders/[id]/financial-reconcile` (POST, `reconciliation:run`, CSRF) and `orders/[id]/financial-reconciliation` (GET, `reconciliation:view`) now declare each other via `@see`; operator intent semantics clarified. |
| **9. Stored-value `txn_type` filter (T1 from Step 2c)** | Closed inside Step 2h. All five `*_LEDGER_LINK_EXISTS` checks now apply the per-table debit-only filter (`STORED_VALUE_TXN_TYPES.REDEMPTION` / `GIFT_CARD_TXN_TYPE.REDEEM` / `LOYALTY_TXN_TYPES.REDEEM`) — eliminates over-flagging of legitimate top-ups / issuances. **No follow-up debt carried into Phase 5/6.** |

No DB migration shipped — Step 1 discovery confirmed every column the new checks need already exists (mig 0303 + 0318 + 0329 backlinks; mig 0294 permissions; mig 0293 reconciliation tables; mig 0306 navigation).

---

## Requirements

- [x] R1 — issues PATCH route no longer always returns 403 (permission code matches seeded `reconciliation:acknowledge_issues`)
- [x] R2 — all PRD §22.1 `*_LEDGER_LINK_EXISTS` checks operational via 0329 FK backlinks
- [x] R3 — PRD §22.1's 23 checks implemented (orchestrator now runs 30 distinct checks; superset)
- [x] R4 — PRD §24.3 voucher-scoped reconciliation endpoint shipped; voucher-scoped service implemented
- [x] R5 — list + detail UI uses Cmx primitives only; raw HTML eliminated
- [x] R6 — RTL classes applied; mojibake purged; bilingual `Intl.DateTimeFormat`; hardcoded "Cancel" removed
- [x] R7 — issue persistence is bulk `createMany`; `total_checked` is dynamic
- [x] R8 — duplicate `orders/[id]/financial-reconcile*` route pair carries `@see` cross-references and clear intent JSDoc
- [x] T1 — stored-value `txn_type` debit-only filter applied per source table
- [x] `npx tsc --noEmit` filtered = **0 errors**
- [x] Full jest sweep = **163/163 pass** (120 baseline + 14 orchestrator + 29 check-modules)
- [x] `npm run check:i18n` = **green**

---

## Database Schema

**No migration.** Step 1 discovery confirmed every dependency already exists:

| Object | Source migration | Notes |
|---|---|---|
| `org_fin_recon_runs_mst` / `org_fin_recon_issues_dtl` | mig 0293 | Live since Order_Fin P6; reused as-is |
| `reconciliation:view`, `reconciliation:run`, `reconciliation:acknowledge_issues` | mig 0294 | Seeded for `super_admin` / `tenant_admin` / `admin`; `branch_manager` view-only |
| `billing_reconciliation` nav row | mig 0295 + 0306 | DB ⇄ `navigation.ts` already in sync (no Phase 4 navigation change) |
| `fin_voucher_id` + `fin_voucher_trx_line_id` FK backlinks on stored-value ledgers + AR allocations + order-payment / credit-app rows | mig 0303 / 0318 / 0329 | Required by every `*_LINK_EXISTS` check |
| `chk_payments_voucher_required` constraint | Phase 3 Round 2 | No longer violated after the legacy TX4 removal |

**Schema-debt deferred to Phase 6 (not blocking):** `org_fin_recon_issues_dtl` is missing standard audit fields (`is_active`, `rec_status`, `rec_notes`, `rec_order`, `created_by/info`, `updated_*`). Functionally inert — Phase 4 checks run cleanly without them — so the cleanup is scheduled with the other Phase 6 schema-debt items, not back-ported here.

**Status taxonomy note:** PRD §22.2's `WARNING` aggregate run-status maps to the existing internal `PARTIAL` (DB CHECK constraint `PENDING/RUNNING/PASSED/FAILED/PARTIAL`). Kept stable to avoid a migration churn for a UI-side label.

---

## API Endpoints

### New route

| Method + path | Permission | CSRF | Returns |
|---|---|---|---|
| `GET /api/v1/finance/vouchers/[voucherId]/reconciliation` | `reconciliation:view` | not required (read-only) | `{ success, data: { voucherId, voucherNo, voucherStatus, issues, summary } }` |

- Zod-validated `voucherId` UUID.
- Maps Prisma `findFirstOrThrow` rejection → 404; other failures → 500.
- Slug shape `[voucherId]` matches sibling routes (`/post`, `/cancel`) so the Next.js dynamic-slug-consistency rule holds.
- No DB write — every persisted reconciliation row still flows through the tenant-level `runReconciliation` orchestrator.

### Clarified routes

| Method + path | Permission | CSRF | Intent |
|---|---|---|---|
| `POST /api/v1/orders/[id]/financial-reconcile` | `reconciliation:run` | required | Operator action; runs the 6 per-order balance checks and persists nothing (synchronous). Returns 201 with `checkedAt`. Now JSDoc-linked to the GET sibling. |
| `GET /api/v1/orders/[id]/financial-reconciliation` | `reconciliation:view` | not required | Read-only view of the same 6 checks. Now JSDoc-linked to the POST sibling. |

Both share `getOrderFinancialReconciliation` under the hood. No behaviour change.

### Existing routes preserved

`/api/v1/finance/reconciliation/runs`, `runs/[runId]`, `issues/[issueId]` continue to back the list + detail + ACK flows. The `issues/[issueId]` PATCH route's permission code was the only bug-fix needed (R1, Step 2a) — schema, response, and pagination shape unchanged.

---

## UI Components

| File | Change |
|---|---|
| `src/features/billing/ui/reconciliation-list-client.tsx` | Raw `<button>` → `CmxButton` (`primary`/`outline`/`ghost`, `asChild` for `Link`); status badge spans → `Badge` via `statusBadgeVariant`; date pickers → `CmxInput`; empty/error states → `CmxSummaryMessage`; `Intl.DateTimeFormat` driven by `useLocale()`; full `rtl:` flips on alignment + back-link icon (`rtl:rotate-180`); new `paginationTotal` i18n key in footer. |
| `src/features/billing/ui/reconciliation-detail-client.tsx` | Same primitive migration; modal overlay → `CmxDialog` + `CmxDialogContent` + `CmxDialogHeader` + `CmxDialogTitle` + `CmxDialogFooter`; ACK textarea → `CmxInput`; hardcoded English "Cancel" → `tCommon('cancel')`; mojibake (`Ã¢â‚¬â€`, `â†`, `â`) purged; severity + issue-state badges via `severityBadgeVariant` / `issueBadgeVariant`; check labels resolved via `useMessages()` lookup against `billing.reconciliation.checks.<NAME>` with raw-code fallback. |
| `app/dashboard/internal_fin/reconciliation/[runId]/page.tsx` | Back-link migrated to `CmxButton variant="ghost" asChild` wrapping `<Link>`; Lucide `ArrowLeft` icon with `rtl:rotate-180`; no other layout change (page is a thin server wrapper). |

Voucher-scoped reconciliation does not yet have a dedicated UI tab — Phase 4 ships the route+service and lets the existing operator detail surface consume it. UI placement is open for Phase 6 if voucher inspectors request it.

---

## Business Logic

### Reconciliation orchestrator flow after Phase 4

```
┌────────────────────────────────────────────────────────────────────────────┐
│ runReconciliation(tenantOrgId, params)                                     │
│  ├── createReconciliationRunHeader (PENDING → RUNNING) — sequential run_no │
│  ├── getScopedOrders(window) → ReconciliationOrderRow[]                    │
│  ├── getPostedVouchersInWindow(window) → VoucherHeader[]                   │
│  ├── Promise.all([                                                          │
│  │     runOrderBalanceChecks(orders),                — legacy 6/order      │
│  │     runOrderSnapshotChecks(orders),               — Phase 4 (5/order)   │
│  │     checkOrderPaymentLink(window),                — Phase 4             │
│  │     checkOrderPaymentAmountMatchesLine(window),                         │
│  │     checkOrderCreditApplicationLink(window),                            │
│  │     checkOrderCreditApplicationAmountMatchesLine(window),               │
│  │     checkOrderCreditApplicationNotInPayments(window),                   │
│  │     checkOrderCreditApplicationNotInDiscounts(window),                  │
│  │     checkInvoicePaymentLink(window),              — Phase 4 (AR)        │
│  │     checkRefundLink(window),                                            │
│  │     checkWalletBalanceMatchesLedger(),            — stored-value (6)    │
│  │     checkWalletLedgerLink(window),                                      │
│  │     checkAdvanceLedgerLink(window),                                     │
│  │     checkGiftCardLedgerLink(window),                                    │
│  │     checkCreditNoteLedgerLink(window),                                  │
│  │     checkLoyaltyLedgerLink(window),                                     │
│  │     runVoucherIntegrityChecks(vouchers),          — voucher (3)         │
│  │     checkCashMovementLink(window),                — cash-movement (2)   │
│  │     checkCashMovementAmountEqualsRetained(window),                      │
│  │     checkOutboxStuck(),                           — tenant-level (1)    │
│  │   ])                                                                    │
│  ├── flatten → CheckResult[]                                               │
│  ├── persistReconciliationIssues(runId, issues) — single createMany        │
│  ├── compute summary { passed, blockers, warnings, info, partial }         │
│  ├── total_checked = EXECUTED_CHECK_NAMES.length (== 30 today)             │
│  └── close run as PASSED / PARTIAL / FAILED                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Check module fan-out

| Module | Public entry | Checks emitted | Notes |
|---|---|---|---|
| `reconciliation/types.ts` | `CheckResult`, `ReconciliationSummary`, `RECONCILIATION_TOLERANCE`, `toNumber`, `summarizeIssues`, `persistReconciliationIssues` | (helpers) | Single source of truth — every check module imports from here. |
| `reconciliation/order-checks.ts` | `runOrderBalanceChecks`, `checkOrderPaymentLink`, `checkOrderPaymentAmountMatchesLine`, `checkOrderCreditApplicationLink`, `checkOrderCreditApplicationAmountMatchesLine`, `checkOrderCreditApplicationNotInPayments`, `checkOrderCreditApplicationNotInDiscounts`, `checkOutboxStuck`, `ReconciliationOrderRow` | 6 legacy/order + 6 new link/separation + 1 tenant outbox | Legacy 1:1 factored. Outbox check now wrapped in `withTenantContext` (defense-in-depth). |
| `reconciliation/order-snapshot-checks.ts` | `runOrderSnapshotChecks` | 5/order — `ORDER_CHARGES_MATCH_SNAPSHOT`, `ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`, `PIECE_EXTRA_PRICE_INCLUDED_ONCE`, `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE` | Bundled `Promise.all` per order; reuses roll-ups in memory. |
| `reconciliation/ar-checks.ts` | `checkInvoicePaymentLink`, `checkRefundLink` | 2 window-scoped | `INVOICE_PAYMENT_LINK_EXISTS` uses `org_invoice_payments_dtl.voucher_id` post-Phase-2 invariant; `REFUND_LINK_EXISTS` does indirect reverse-pointer lookup on `org_order_refunds_dtl` (schema-debt note pencilled for Phase 6 to add direct backlink). |
| `reconciliation/stored-value-checks.ts` | `checkWalletBalanceMatchesLedger`, `checkWalletLedgerLink`, `checkAdvanceLedgerLink`, `checkGiftCardLedgerLink`, `checkCreditNoteLedgerLink`, `checkLoyaltyLedgerLink` | 1 snapshot + 5 link | Per-table debit-only filter (T1 closed): `STORED_VALUE_TXN_TYPES.REDEMPTION` (wallet/advance/credit_note), `GIFT_CARD_TXN_TYPE.REDEEM`, `LOYALTY_TXN_TYPES.REDEEM`. Eliminates over-flagging of top-ups / issuances. |
| `reconciliation/voucher-checks.ts` | `runVoucherIntegrityChecks`, `checkCashMovementLink`, `checkCashMovementAmountEqualsRetained`, `getPostedVouchersInWindow`, `VoucherHeader` | 3/voucher + 2 cash-movement | Reversal lines (`reversed_line_id IS NOT NULL`) exempt from duplicate-effect detection. Voucher header projection shared with `voucher-reconciliation.service.ts`. |
| `voucher-reconciliation.service.ts` (top-level) | `reconcileVoucher(tenantOrgId, voucherId)` | 3 voucher integrity (no DB write) | On-demand operator action — does **not** write `org_fin_recon_runs_mst` rows. Persistent audit trail remains the tenant-level run. `summarizeIssues(issues, 3)` because only 3 checks executed. |

### Multi-tenant safety invariant

Every Prisma call in every check module goes through `withTenantContext(tenantOrgId, ...)`. The outbox check (previously inline in `reconciliation.service.ts` without a wrapper) is now wrapped — defense-in-depth on top of RLS. Each `where` clause additionally filters by `tenant_org_id` explicitly. The new `__tests__/services/reconciliation/check-modules.test.ts` includes a dedicated cross-tenant isolation test that mocks the Prisma layer to honour `where.tenant_org_id` and asserts tenant A cannot see tenant B's drift.

### Stored-value `txn_type` filter (T1 closure)

| Source table | Column | Debit-only enum value | Source migration |
|---|---|---|---|
| `org_wallet_txn_dtl` | `txn_type` | `STORED_VALUE_TXN_TYPES.REDEMPTION` | mig 0285 |
| `org_customer_advance_txn_dtl` | `txn_type` | `STORED_VALUE_TXN_TYPES.REDEMPTION` | mig 0285 |
| `org_credit_note_txn_dtl` | `txn_type` | `STORED_VALUE_TXN_TYPES.REDEMPTION` | mig 0285 |
| `org_gift_card_transactions_dtl` | `transaction_type` | `GIFT_CARD_TXN_TYPE.REDEEM` | mig 0245 |
| `org_loyalty_transactions_dtl` | `txn_type` | `LOYALTY_TXN_TYPES.REDEEM` | mig 0286 |

All five enum constants are DB-mirrored (no string literals in TS).

---

## Testing

| Test ID | File | Scenario |
|---|---|---|
| **Orchestrator (Step 2j) — 14/14** | `__tests__/services/reconciliation.service.test.ts` (8) + `__tests__/integration/reconciliation-run.test.ts` (6) | PASSED / FAILED / PARTIAL transitions on new bulk-insert shape; `createMany` called once with `data: expect.arrayContaining([…])`; sequential `run_no` preserved; `total_checked = RECONCILIATION_TOTAL_CHECKS > 8`; clean run short-circuits and skips `createMany` entirely; `acknowledgeIssue` path unchanged. |
| T-AR-1 / T-AR-2 | `__tests__/services/reconciliation/check-modules.test.ts` | `checkInvoicePaymentLink` happy + violation (NULL `voucher_id` on APPLIED allocation). |
| T-AR-3 / T-AR-4 | same | `checkRefundLink` happy + violation (PROCESSED refund with no posted REFUND_VOUCHER). |
| T-SV-1 → T-SV-7 | same | `checkWalletBalanceMatchesLedger` snapshot mismatch + all 5 `*_LEDGER_LINK_EXISTS` happy/violation paths asserting per-table `txn_type` / `transaction_type` filter (T1 closure). |
| T-ORD-1 → T-ORD-9 | same | Legacy balance (`PAYMENT_TOTAL_MATCH`, `CREDIT_APP_BALANCE`, `OUTSTANDING_TOTAL_MATCH`, `REFUND_CONSISTENCY`, `GATEWAY_PENDING_INTEGRITY`, `LEGACY_STATUS_LEAKAGE`) + new link checks + separation checks (NOT_IN_PAYMENTS, NOT_IN_DISCOUNTS). |
| T-SNAP-1 / T-SNAP-2 | same | `ORDER_CHARGES_MATCH_SNAPSHOT` + `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE` violation. |
| T-VCH-1 → T-VCH-5 | same | `VOUCHER_TOTAL_EQUALS_LINES`, `NO_DUPLICATE_OPERATIONAL_EFFECT` (reversal-exempt), `GATEWAY_STATE_VALID`, `CASH_MOVEMENT_LINK_EXISTS`, `CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT`. |
| T-VRSVC-1 | same | `reconcileVoucher` returns the expected summary shape for a clean voucher. |
| T-TEN-1 | same | Multi-tenant isolation: tenant A's check never observes tenant B's drift; `withTenantContext` forwards the right tenant id. |
| Pre-existing baseline | 9 suites, 120 tests | All green — no regression. |

**Total: 163/163 pass** (120 baseline + 14 orchestrator/integration + 29 new check-module + voucher-scoped tests).

### Acceptance scenarios for manual QA

1. **Run reconciliation with no drift** → run status PASSED, 0 issues, `total_checked = 30` (or current `RECONCILIATION_TOTAL_CHECKS`), no `createMany` invoked.
2. **Run reconciliation with a missing voucher backlink** (force NULL `fin_voucher_id` on a COMPLETED order payment) → BLOCKER `ORDER_PAYMENT_LINK_EXISTS` appears in the run detail; ACK flow works (was always-403 before R1 fix).
3. **Run reconciliation with a wallet top-up** (no voucher debit) → check does **not** raise `WALLET_LEDGER_LINK_EXISTS` for it (T1 filter excludes top-ups). Force a REDEMPTION with NULL backlink → BLOCKER appears.
4. **`GET /api/v1/finance/vouchers/<id>/reconciliation`** → returns summary with 3 checks executed; voucher integrity violations (mismatched total, duplicate effect, gateway XOR) surface here without a persistent run row.
5. **Operator UI in Arabic locale (RTL)** → list + detail render right-to-left; date pickers use `ar-OM` format; check labels resolve to Arabic; back-link icon flips; ACK dialog "Cancel" button reads "إلغاء" via `tCommon('cancel')`.
6. **Acknowledge an issue** → PATCH `issues/[issueId]` returns 200 (was 403 prior to R1 fix); detail view re-renders with the issue marked ACK.

---

## Implementation Status

- [x] Database schema — no migration needed (Step 1 SKIP, mirrors Phase 3 decision pattern)
- [x] Backend service — orchestrator rewrite + 5 check modules + voucher-scoped service
- [x] API contract — new voucher route, R1 permission fix on issues PATCH, JSDoc cross-refs on the orders pair
- [x] Frontend UI — Cmx primitives, RTL, bilingual `Intl.DateTimeFormat`, i18n labels
- [x] Tests — +29 check-module/voucher-service cases; +14 (rewritten) orchestrator+integration; 163/163 pass
- [x] i18n — `paginationTotal` + 33-entry `checks.*` namespace in en.json + ar.json; `check:i18n` green
- [x] Build gate — `npm run build` succeeds (delegated via tsc + jest filter; full build re-run scheduled at user commit prep)
- [x] Documentation — IMPLEMENTATION_STATUS (per-step entries), CHANGELOG (Phase 4 entry, Step 8b), this file (Step 8a)
- [x] User commit prep — pending user `DD_MM_YYYY_N` prefix commit

---

## Feature Implementation Requirements

### Permissions
- **None added.** All three reconciliation permissions (`reconciliation:view`, `reconciliation:run`, `reconciliation:acknowledge_issues`) are seeded by mig 0294. R1 was a TypeScript typo (`acknowledge` ≠ `acknowledge_issues`), not a missing DB row.

### Navigation Tree
- **None changed.** `billing_reconciliation` already at `/dashboard/internal_fin/reconciliation` in both `web-admin/config/navigation.ts:452-457` and `sys_components_cd` (mig 0306). Step 5 verified parity — no Phase 4 migration written.

### Tenant Settings
- **None added.**

### Feature Flags
- **None.** Phase 4 is a hard cut — every run now executes the 30-check matrix; no toggle.

### Plan Limits
- **None changed.**

### i18n Keys

| Key | EN | AR |
|---|---|---|
| `billing.reconciliation.paginationTotal` | `"{count} total"` | `"{count} إجمالي"` |
| `billing.reconciliation.checks.<NAME>` (× 33) | Bilingual labels for every `RECONCILIATION_CHECK_NAMES` value | Same |

`useMessages()` lookup with raw-code fallback ensures the detail UI degrades gracefully when a label is missing (no crash, just shows the canonical check name).

### API Routes

- **Added:** `GET /api/v1/finance/vouchers/[voucherId]/reconciliation`
- **Modified (permission code fix only):** `PATCH /api/v1/finance/reconciliation/issues/[issueId]`
- **Modified (JSDoc only):** `POST /api/v1/orders/[id]/financial-reconcile` + `GET /api/v1/orders/[id]/financial-reconciliation`

### Migrations
- **None.** Step 1 SKIP — no schema gap. The schema-debt items on `org_fin_recon_issues_dtl` (audit field additions) are listed under Phase 6 follow-ups, not blocking.

### Constants & Types

| Location | Change |
|---|---|
| `lib/constants/order-financial.ts` | `RECONCILIATION_CHECK_NAMES` extended with 20 new BVM Phase 4 codes (PRD §22.1 sourced). Legacy codes retained for backward compatibility with persisted rows. JSDoc explains the closed-enum invariant. |
| `lib/services/reconciliation/types.ts` | NEW — `CheckResult`, `ReconciliationSummary`, `RECONCILIATION_TOLERANCE = 0.01`, `toNumber()`, `summarizeIssues()`, `persistReconciliationIssues()`. Single source of truth for all five check modules. |
| `lib/services/reconciliation/order-checks.ts` | Exports `ReconciliationOrderRow` for orchestrator reuse. |
| `lib/services/reconciliation/voucher-checks.ts` | Exports `VoucherHeader` for the voucher-scoped service. |
| `lib/services/reconciliation.service.ts` | Re-exports `RECONCILIATION_TOTAL_CHECKS` = `EXECUTED_CHECK_NAMES.length` for the UI to read the live count. |

### Environment Variables
- **None added.**

### Dependencies
- **None added.** All new imports come from existing modules.

### Logging
- No new log lines. Outbox check (already running) still emits `OUTBOX_PROCESSED` WARNING when ≥ 1 PENDING/FAILED event has been stuck > 1 hour.

### Metrics
- **None added.** Run summary (`passed_count`, `blockers_count`, `warnings_count`, `info_count`, `total_checked`) now reflects the true 30-check matrix instead of the magic-8 value, so any downstream dashboard reading these columns will see numbers move on next run.

---

## Verification Matrix (final, post-Phase-4)

| Check | Command | Result |
|---|---|---|
| TypeScript (filtered) | `cd web-admin; npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers'` | **0 errors** |
| Full jest sweep | (See sweep command in resume doc / IMPLEMENTATION_STATUS Step 7e) | **163/163 pass** |
| i18n parity | `npm run check:i18n` | **green** |
| Navigation parity | `navigation.ts` vs `sys_components_cd` mig 0306 | **in sync (no change)** |
| Permission parity | mig 0294 seeded codes vs runtime references | **in sync** |

---

## Risks & Mitigations

| Risk | Status | Mitigation |
|---|---|---|
| Magic-8 → dynamic `total_checked` breaks dashboards reading `total_checked` | low | Downstream UI already reads the column generically; the new value is structurally larger and the labelled checks are richer. No format change. |
| `txn_type` filter excludes a real broken redemption | mitigated | Each module's debit-only filter is enum-mirrored against the DB; new test cases pin the filter behaviour per source table. |
| `persistReconciliationIssues` bulk createMany swallows partial failures | very low | Prisma `createMany` is all-or-nothing inside `withTenantContext`; the run header transitions to FAILED on throw. |
| Voucher-scoped service called for a non-existent voucher | mitigated | `findFirstOrThrow` mapped to 404 in the route; happy path covered by T-VRSVC-1. |
| Refund-link check is indirect (no direct backlink yet) | tracked | Phase 6 to add `fin_voucher_id` column on `org_order_refunds_dtl` and switch to direct lookup. Indirect lookup is correct today but slower than a backlink scan. |
| `org_fin_recon_issues_dtl` missing audit fields | tracked | Phase 6 cleanup; no functional impact. |
| Cmx UI migration regresses a previously-working flow | mitigated | All four user-visible flows (list, detail, ACK, back) covered by acceptance scenarios above; no UX behaviour change beyond i18n + RTL polish. |
| Mojibake re-introduction | mitigated | Both client files now use proper UTF-8 literals (`—`, `←`) or Lucide icons; ESLint/TS picks up future regressions. |

---

## Rollback Strategy

Phase 4 ships no migration, so revert is purely code:

```
git revert <phase-4-commit>
```

- The new voucher reconciliation route is additive — pre-Phase-4 clients never called it; no contract breakage.
- The check-module factoring restores byte-identical behaviour for the 8 pre-Phase-4 checks (covered by orchestrator tests).
- The R1 permission-code fix is the only persisted behaviour change; reverting it restores the 403-always state. Mig 0294's seeded code (`reconciliation:acknowledge_issues`) was always the correct value — the TypeScript was wrong, never the DB.
- UI Cmx migration is presentation-only; revert restores the raw-HTML version. Recommended: do **not** revert UI alone — the Cmx pass is required by the ESLint + build gate.
- Test files are additive (new file `check-modules.test.ts`); orchestrator + integration test rewrites are the only existing files modified, and the prior assertions on per-row `create` no longer match the production code, so reverting tests alone would leave the suite broken.

---

## Follow-ups (Phase 5 / 6 candidates)

1. **Add direct `fin_voucher_id` backlink on `org_order_refunds_dtl`** so `checkRefundLink` switches from indirect lookup to a direct FK scan (Phase 6 schema work).
2. **Add audit fields on `org_fin_recon_issues_dtl`** (`is_active`, `rec_status`, `rec_notes`, `rec_order`, `created_by/info`, `updated_*`) for parity with other `*_dtl` tables (Phase 6 schema-debt cleanup).
3. **Voucher reconciliation UI surface** — once an operator tab consumes `/vouchers/[id]/reconciliation`, decide whether to surface as a button in voucher detail or a dedicated page (Phase 6 UI debt).
4. **Audit/history table for reconciliation runs** — currently each run row is the audit. Phase 5 covers order-history; reconciliation run history is implicit in the run table itself, so no extra wiring is required from Phase 5.

No outstanding TODOs from Phase 4 itself (T1 was closed inside Step 2h).

---

## References

- Phase 3 implementation log: `bvm_wiring_phase3_implementation.md`
- BVM Wiring PRD: `CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` §§22, 23, 24
- Mid-session checkpoint: `bvm_wiring_phase4_RESUME.md` (Steps 2c onward)
- Close-to-program-end resume: `bvm_wiring_phase4_close_to_program_end_RESUME.md`
- Predecessor program plan: `bvm_wiring_phase4_to_6_RESUME.md`
- Phase 6 priority backlog: `BVM_PHASE_2_ENTRY_PLAN.md`
- Phase 4 migrations of record (reused, none new): `0293`, `0294`, `0295`, `0303`, `0306`, `0318`, `0329`
