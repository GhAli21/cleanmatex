# RESUME — BVM Wiring Phase 4 (mid-session checkpoint)

**Created:** 2026-05-29 (mid-Phase-4 checkpoint, before `/clear`).
**Predecessor:** `bvm_wiring_phase4_to_6_RESUME.md` (the original Phase 4→6 resume; this doc supersedes its Phase 4 section).
**Successors:** Phase 5 (`bvm_wiring_phase4_to_6_RESUME.md` § Phase 5) and Phase 6 (same doc § Phase 6) still apply unchanged.

---

## Single-line prompt to paste in the new session

> Read `docs/features/Order_Fin/bvm_wiring_phase4_RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation` skills. Resume BVM Wiring Phase 4 at **Unit B — Step 2d (ar-checks.ts module)**. Scope is locked at **B** (PRD §22.1 + §24.3 expansion). Use Supabase remote MCP for read-only DB inspection. NEVER apply migrations. After every code step, run `cd web-admin && npx tsc --noEmit` (filtered to exclude `payment-config|cash-drawers`) + the 120/120 jest baseline sweep, then append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`. End each phase with its exit checklist + close via `/documentation` skill. Production quality only: full EN/AR + RTL, Cmx components, RBAC, multi-tenant safety, no shortcuts. After Phase 6, write `bvm_wiring_program_summary.md`.

---

## State at handoff (verified clean — safe to resume cold)

| Thing | Value |
|---|---|
| Branch | `main` |
| HEAD | Phase 3 close (`5c7a78b 28_05_2026_14 fix ar-invoice.service.ts and Update payment Modal screen v04`) |
| Last migration on disk | `0329_phase2_stored_value_voucher_fks.sql` → next free seq = **0330** |
| Phase 4 migration | **NONE** — Step 1 SKIPPED (no schema gap; documented in IMPLEMENTATION_STATUS) |
| tsc (filtered) | **0 errors** |
| Jest baseline sweep | **120/120 pass** |
| Supabase MCP | configured (`supabase_remote_db`) |

### Files dirty at handoff — split into (a) Phase 4 work-in-progress and (b) carry-over from prior sessions

**(a) Phase 4 in-flight (ship these as a Phase 4 commit when phase closes — DO NOT discard):**

- `web-admin/app/api/v1/finance/reconciliation/issues/[issueId]/route.ts` — BUG-R1 fix (permission code `acknowledge` → `acknowledge_issues`)
- `web-admin/lib/constants/order-financial.ts` — `RECONCILIATION_CHECK_NAMES` extended with 20 new BVM Phase 4 check identifiers (PRD §22.1)
- `web-admin/lib/services/reconciliation/types.ts` — NEW. Shared `CheckResult` type, `RECONCILIATION_TOLERANCE`, `toNumber`, `summarizeIssues`, `persistReconciliationIssues` (bulk createMany helper)
- `web-admin/lib/services/reconciliation/stored-value-checks.ts` — NEW. Wallet balance invariant + 5 `*_LEDGER_LINK_EXISTS` checks (wallet/advance/gift-card/credit-note/loyalty) using 0329 FK backlinks. **Has a TODO marker — see Open issue T1 below**
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` — Phase 4 Step 0 (Discovery) + Step 1 (SKIPPED) sections appended, with the mid-session checkpoint section at the bottom
- `docs/features/Order_Fin/bvm_wiring_phase4_RESUME.md` — this doc (NEW)

**(b) Carry-over — NOT MINE, leave alone (was already dirty before Phase 4 started):**

- `web-admin/app/dashboard/internal_fin/invoices/[id]/page.tsx`
- `web-admin/messages/{ar,en}.json` (payment-modal-v4 i18n in progress elsewhere)
- `web-admin/src/features/ar/ui/ar-invoice-detail-tabs.tsx`
- `web-admin/src/features/ar/ui/ar-invoice-detail-data-table.tsx` (untracked)
- `docs/features/Order_Fin/CleanMateX_Order_Details_Financial_Summary_Enhancement_Spec_v1_0.md` (untracked)

---

## Scope decisions already approved by user (do not re-ask)

1. **Scope B** — PRD §22.1 + §24.3 expansion (bug fixes + ~15 new checks + voucher-scoped endpoint + UI Cmx migration). Rejected Option A (light) and Option C (full handler refactor).
2. **Baseline = 120/120** (live count after Phase 3 Round 3 supersedes RESUME doc's stale 117/117 number).
3. **Voucher-scoped endpoint name** = `GET /api/v1/finance/vouchers/[voucherId]/reconciliation` (matches PRD §24.3 verbatim, mirrors `/post` pattern).
4. **Duplicate `orders/[id]/financial-reconcile*` routes** — KEEP both, clarify JSDoc cross-refs. GET = view, POST = on-demand action with different permission. Different verbs, different permissions, semantically distinct.

---

## Bug catalogue (catalogued during Step 0 discovery)

| # | Severity | Status | Location |
|---|---|---|---|
| R1 | HIGH | **FIXED** in this session | `app/api/v1/finance/reconciliation/issues/[issueId]/route.ts` — was `reconciliation:acknowledge` (unseeded → always 403); now `reconciliation:acknowledge_issues` (matches mig 0294) |
| R2 | HIGH | pending Step 2d/2e | Service doesn't use 0329 FK backlinks. Stored-value half done in `stored-value-checks.ts`; needs wiring + per-table debit filter (TODO T1) |
| R3 | MED | pending Step 2c–2g | PRD §22.1 specifies 23 checks; service implements 8. New constants in place; check modules half done |
| R4 | MED | pending Step 2h | No `voucher-reconciliation.service.ts`; no `GET /vouchers/[id]/reconciliation` route |
| R5 | MED | pending Step 4 | UI uses raw HTML (not Cmx) — `reconciliation-list-client.tsx`, `reconciliation-detail-client.tsx` |
| R6 | MED | pending Step 4 + 6 | No RTL classes; mojibake (`Ã¢â‚¬â€`) in placeholder/copy in `reconciliation-list-client.tsx` (cp1252→utf8 corruption) |
| R7 | LOW | partially addressed | Bulk-insert helper exists (`persistReconciliationIssues` in `types.ts`) but service still uses per-row loop until Step 2e rewrite |
| R8 | LOW | pending Step 3b | Two `orders/[id]/financial-reconcile*` routes need clearer JSDoc cross-refs |

---

## Phase 4 work plan — what's done and what's left

### Unit A — Constants + shared helpers ✅ DONE
- [x] Step 2a: BUG-R1 permission code fix
- [x] Step 2b: Extend `RECONCILIATION_CHECK_NAMES` with 20 new PRD §22.1 codes
- [x] Step 2b: Create `lib/services/reconciliation/types.ts` (CheckResult, summarizeIssues, persistReconciliationIssues, toNumber, RECONCILIATION_TOLERANCE)

### Unit B — Service core rewrite ⏳ IN PROGRESS

- [x] Step 2c: `stored-value-checks.ts` skeleton with 6 check functions (wallet balance + 5 LEDGER_LINK_EXISTS). **Has TODO marker (T1)** — per-table debit-only filter is missing.
- [ ] **Step 2d (NEXT)** — `ar-checks.ts`: `INVOICE_PAYMENT_LINK_EXISTS`, `REFUND_LINK_EXISTS`.
- [ ] **Step 2e** — `order-checks.ts`: factor existing legacy checks (`PAYMENT_TOTAL_MATCH`, `OUTSTANDING_TOTAL_MATCH`, `CREDIT_APP_BALANCE`, `REFUND_CONSISTENCY`, `GATEWAY_PENDING_INTEGRITY`, `LEGACY_STATUS_LEAKAGE`, `OUTBOX_PROCESSED`) into this module. Add new ones: `ORDER_PAYMENT_LINK_EXISTS`, `ORDER_PAYMENT_AMOUNT_MATCHES_LINE`, `ORDER_CREDIT_APPLICATION_LINK_EXISTS`, `ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE`, `ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS`, `ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS`.
- [ ] **Step 2f** — `order-snapshot-checks.ts`: `ORDER_CHARGES_MATCH_SNAPSHOT`, `ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`, `PIECE_EXTRA_PRICE_INCLUDED_ONCE`, `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE`.
- [ ] **Step 2g** — `voucher-checks.ts`: `VOUCHER_TOTAL_EQUALS_LINES`, `NO_DUPLICATE_OPERATIONAL_EFFECT`, `GATEWAY_STATE_VALID`, `CASH_MOVEMENT_LINK_EXISTS`, `CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT`. These all operate on voucher line rows — also reused by the voucher-scoped service.
- [ ] **Step 2h** — Rewrite `lib/services/reconciliation.service.ts`:
  - Wire all new check modules into `runReconciliation`.
  - Replace per-row insert loop with `persistReconciliationIssues` bulk createMany.
  - Compute `total_checked` dynamically from the union of check names, not magic-number 8.
  - Use `summarizeIssues(allIssues, totalChecks)` from `types.ts`.
- [ ] **Step 2i** — Create `lib/services/voucher-reconciliation.service.ts` with `reconcileVoucher(tenantOrgId, voucherId): CheckResult[]` (PRD §23.1 + §24.3). Reuses `voucher-checks.ts` + relevant per-line link checks.
- [ ] **Step 2j** — Update existing tests:
  - `__tests__/services/reconciliation.service.test.ts` — swap mocked `create` → `createMany`; update assertion shapes (`data: expect.arrayContaining([...])`).
  - `__tests__/integration/reconciliation-run.test.ts` — same.
  - Keep all currently-passing assertions green.

### Unit C — API routes
- [ ] **Step 3a** — NEW route `app/api/v1/finance/vouchers/[voucherId]/reconciliation/route.ts` (GET, `reconciliation:view`). Calls `reconcileVoucher`. Zod-validated voucherId param. CSRF not needed (GET). Returns `{ success, data: { voucherId, voucherNo, issues, summary } }`.
- [ ] **Step 3b** — JSDoc cleanup on the duplicate `orders/[id]/financial-reconcile*` pair: add `@see` cross-refs explaining GET vs POST distinction, both routes link to each other.

### Unit D — UI Cmx migration (R5 + R6 + R7 cleanup)
- [ ] **Step 4a** — Rewrite `src/features/billing/ui/reconciliation-list-client.tsx`:
  - Replace raw `<table>` with `@ui/data-display/cmx-datatable` (server-side pagination).
  - Replace raw `<button>` with `CmxButton` from `@ui/primitives`.
  - Replace run-reconciliation dialog with `CmxDialog` from `@ui/overlays`.
  - Replace `<input type="date">` with `CmxFormField` / `@ui/forms`.
  - Empty state: `CmxSummaryMessage` from `@ui/feedback`.
  - Status badges: `CmxBadge` from `@ui/primitives`.
  - Add `rtl:` Tailwind flips for all `ml-*`/`mr-*`/`text-left`/`text-right`.
  - Remove `Cancel` hardcoded English → `tCommon('cancel')`.
  - Fix mojibake `Ã¢â‚¬â€` placeholders → proper `—` em-dash from translations.
  - Use `useLocale()` + `Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', ...)` for date formatting.
- [ ] **Step 4b** — Rewrite `src/features/billing/ui/reconciliation-detail-client.tsx` to same standards.
- [ ] **Step 4c** — Replace inline arrow/back-link in `app/dashboard/internal_fin/reconciliation/[runId]/page.tsx` with `CmxBreadcrumbs` or `CmxButton` variant=ghost with `ArrowLeft` icon (`rtl:rotate-180`).

### Unit E — Navigation, i18n, tests, docs
- [ ] **Step 5** — Navigation audit. Expect zero changes — `billing_reconciliation` already at `/dashboard/internal_fin/reconciliation` per mig 0306; `navigation.ts:452-457` aligned. Verify and document only.
- [ ] **Step 6a** — i18n gap-fill. Audit `billing.reconciliation.*` namespace against the new UI keys + new check name labels in EN + AR. Update `messages/en.json` + `messages/ar.json`. Add per-check labels under `billing.reconciliation.checks.{CHECK_NAME}` for both languages.
- [ ] **Step 6b** — Run `npm run check:i18n`.
- [ ] **Step 7a** — `__tests__/services/reconciliation/stored-value-checks.test.ts` — coverage per check, multi-tenant isolation, FK-backlink absence detection.
- [ ] **Step 7b** — Same per check module under `__tests__/services/reconciliation/*.test.ts`.
- [ ] **Step 7c** — `__tests__/services/voucher-reconciliation.service.test.ts` — voucher-scoped reconcile, voucher with mixed line roles.
- [ ] **Step 7d** — Multi-tenant isolation test in at least one module (asserts a check for tenant A cannot see tenant B's drift).
- [ ] **Step 7e** — Add new check files to the baseline sweep command for future RESUME docs.
- [ ] **Step 8a** — Write `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md` (mirror Phase 3 template).
- [ ] **Step 8b** — Append Phase 4 entry to `docs/features/Order_Fin/CHANGELOG.md` (top-of-file).
- [ ] **Step 8c** — Flip Phase 4 status to ✅ Done in `IMPLEMENTATION_STATUS.md`.
- [ ] **Step 8d** — Phase 4 exit checklist (see RESUME doc original).
- [ ] **Step 8e** — Update memory `project_bvm_wiring_phases.md` to Phase 4 ✅.

---

## Open issues / TODOs left in code

| ID | File | Issue | Resolution |
|---|---|---|---|
| T1 | `lib/services/reconciliation/stored-value-checks.ts` | All 5 ledger LINK_EXISTS checks omit the per-table debit-only filter. wallet/advance/credit_note/loyalty have `txn_type` (e.g. `'REDEMPTION'` for wallet); gift_card has `transaction_type`. Without the filter the check would over-flag legitimate top-ups/issuances. | Step 2c continuation: query each table once via MCP to enumerate `txn_type`/`transaction_type` values, then add per-call filters. Module not yet wired into orchestrator so no production impact. |

---

## Phase 5 & Phase 6 — unchanged

After Phase 4 closes, jump to:
- **Phase 5** — History/Audit. Spec in `bvm_wiring_phase4_to_6_RESUME.md` § Phase 5.
- **Phase 6** — UI / schema debt cleanup. Spec in `bvm_wiring_phase4_to_6_RESUME.md` § Phase 6.

After Phase 6 closes, write `docs/features/Order_Fin/bvm_wiring_program_summary.md`.

---

## Quick sanity test before resuming

```powershell
Set-Location F:\jhapp\cleanmatex\web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 10
# expect: 0 errors

npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts `
         __tests__/services/order-settlement-planner.service.test.ts `
         __tests__/services/discount-service.test.ts `
         __tests__/services/stored-value.service.test.ts `
         __tests__/services/loyalty.service.test.ts `
         __tests__/services/ar-invoice.service.test.ts `
         __tests__/services/gift-card-service.test.ts
# expect: 120/120 pass

git status
# expect: Phase 4 work-in-progress dirty files (list above), nothing else new
```

If any of the above fails, hand-investigate before continuing.
