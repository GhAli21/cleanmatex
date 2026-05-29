# RESUME — BVM Wiring Phases 4 → 6 (finish the program)

**Created:** 2026-05-29 (end of Phase 3 implementation session).
**Predecessor:** Phase 3 closed 2026-05-29 — see `bvm_wiring_phase3_implementation.md` in this same folder.
**Predecessor RESUME (archive):** `C:\Users\JHNLP\.claude\plans\bvm-phase-3-to-6-RESUME.md` — Phase 3 section is now ✅ done; Phases 4/5/6 content there still applies but this doc supersedes it.

---

## How to resume in a fresh session (single prompt)

1. Reopen Claude Code in `f:\jhapp\cleanmatex`.
2. Verify `git status` shows the Phase 3 commit on top.
3. Paste this prompt verbatim:

> Read `docs/features/Order_Fin/bvm_wiring_phase4_to_6_RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation` skills. Start at Phase 4 Step 0 (discovery). Use Supabase remote MCP for read-only DB inspection. NEVER apply migrations — create the `.sql` file and STOP for review. After every code step, run `npx tsc --noEmit` (filtered to exclude any pre-existing UI errors) + the Phase 2+3 jest sweep to confirm no regressions, then append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` per the dual-step pattern. End each phase with the per-phase exit checklist. Close each phase with the `/documentation` skill writing `docs/features/Order_Fin/bvm_wiring_phase{N}_implementation.md`. Build production-ready code: no gaps, no shortcuts, full bilingual EN/AR + RTL where UI ships, Cmx components only, security/permissions correct, multi-tenant safety via `withTenantContext`. After Phase 6 closes, write `bvm_wiring_program_summary.md` capping the whole multi-session program.

That single prompt is enough — this doc is self-contained.

---

## State at handoff (verify before starting)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | Phase 3 commit (user's DD_MM_YYYY_N prefix) or later | `git log -1 --oneline` |
| Last migration | `0329_phase2_stored_value_voucher_fks.sql` | `ls supabase/migrations/03*.sql \| sort \| tail -3` |
| Next migration | `0330` | same as above + increment |
| Phase 2 + Phase 3 jest sweep | 77/77 (or 117/117 incl. gift-card-service) | see verification commands below |
| TS errors | 0 (filtered) | `cd web-admin && npx tsc --noEmit 2>&1 \| Select-String -NotMatch 'payment-config\|cash-drawers'` |
| Supabase MCP | configured | `.mcp.json` has `supabase_remote_db` |

### Files dirty at handoff (NOT mine, in-progress work — leave alone)

Carried over from Phase 2/3 handoff. These are someone else's mid-work and must not be touched by Phase 4–6 work:

- `web-admin/__tests__/features/orders/payment-modal-v4.utils.test.ts`
- `web-admin/__tests__/api/v1/customers/stored-value.route.test.ts` (untracked)
- `web-admin/app/api/v1/customers/[id]/stored-value/route.ts`
- `web-admin/lib/validations/new-order-payment-schemas.ts`
- `web-admin/messages/{ar,en}.json` (payment-modal-v4 i18n in progress)
- `web-admin/src/features/orders/hooks/use-order-submission.ts`
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`, `payment-modal-v4.tsx`
- `web-admin/src/features/payment-config/ui/*.tsx`

---

## Canonical references

| Purpose | Path |
|---|---|
| PRD (master spec, all phases) | `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` |
| Current implementation status | `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` |
| Phase 3 close (just shipped) | `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` |
| Phase 2 close (predecessor) | `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md` |
| AR Invoice scope ADR | `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` |
| Changelog | `docs/features/Order_Fin/CHANGELOG.md` |
| Phase 2 entry plan (Phase 6 "UI debt" + "Schema debt" feed Phase 6) | `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` |
| Phase 3 plan (archive) | `C:\Users\JHNLP\.claude\plans\vivid-wishing-wave.md` |

---

## Constraints — DO NOT VIOLATE

Read `CLAUDE.md` lines 1–80 for the full list. The non-negotiables relevant to Phases 4–6:

1. **No migration apply.** Create the `.sql` file, then STOP and wait for the user to apply + run `npx prisma generate`. MCP is for read-only discovery only.
2. **Migration sequence.** Next migration = `0330`. Increment after.
3. **DROP CASCADE banned by default.** Use `RESTRICT`. CASCADE only with explicit user approval + a recreate manifest.
4. **Every `org_*` query filters by `tenant_org_id`.** Use `withTenantContext()` in web-admin.
5. **TEXT not VARCHAR** for new string columns.
6. **DB-mirror rule.** Any TS constant that round-trips to the DB MUST use the exact same string the DB stores.
7. **Permission codes:** `resource:action` (two parts only), lowercase + underscores. Every new code needs a migration that seeds it into `sys_auth_permissions`.
8. **Navigation changes** are dual-write: `web-admin/config/navigation.ts` + a `sys_components_cd` migration. Use the `/navigation` skill.
9. **Constants live in `lib/constants/`**, types in `lib/types/`. No duplication.
10. **Skill loading.** Load the relevant skill BEFORE writing any code in that domain.
11. **STOP-and-wait after migrations.** User confirms apply before continuing.
12. **Cmx components only** for UI — `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`. Never `@ui/compat`.
13. **Build must stay green.** Run `npx tsc --noEmit` (filtered) + jest sweep at every step boundary.
14. **Dual-step pattern.** After every implementation step, immediately append progress to `IMPLEMENTATION_STATUS.md` before starting the next step.
15. **Production quality everywhere.** UI/UX best practices, accessibility (a11y), bilingual EN/AR + RTL, semantic HTML, server-side pagination on every list, no half-finished features.

---

## What Phases 1A→3 have already delivered (do NOT redo)

- **Atomicity invariant:** submit-order's voucher header + lines + every redeem*Tx + post & wire + AR invoice (Phase 3) all run in ONE `prisma.$transaction`.
- **`redeem*Tx` uniform contract:** all 5 services accept `idempotencyKey?`, `voucherId?`, `voucherLineId?` with skip-on-existing + backlink persistence.
- **`STORED_VALUE_LOCK_ORDER`:** planner sorts `creditApplicationLegs` by lock-order rank.
- **`applyStoredValueDebitTx`:** dispatcher exported from `order-credit-application.service.ts`. GIFT_CARD case at lines 177-191.
- **Voucher services** accept optional `tx?: PrismaTransactionClient`.
- **Migration 0329:** 10 composite FKs + 10 partial indexes + 2 loyalty columns.
- **Legacy route retired:** `_legacy_create-with-payment` deleted in Phase 2.
- **Phase 3 (2026-05-29):** `createInvoice` adapter replaced with `createArInvoiceFromOrders` in orchestrator; gift-card-by-id flows through TX2 voucher loop as ORDER_CREDIT_APPLICATION line; breakdown math switched to `plan.creditAppliedAmount` + `plan.realPaymentAmount`. NO Phase 3 migration shipped.

---

## Phase 4 — Reconciliation

**PRD section:** §23
**Entry condition:** Phase 3 closed (✅ 2026-05-29).

### Step 0 — Discovery (read-only)

```
rg 'reconcil' web-admin/lib/services web-admin/app
rg 'org_reconcil' web-admin/prisma/schema.prisma
```

A `__tests__/services/reconciliation.service.test.ts` already exists per Phase 2 discovery — confirm the service file (`lib/services/reconciliation.service.ts` or `order-reconciliation.service.ts`) and its current shape before writing new code.

Use Supabase MCP read-only:

```sql
-- Is there a reconciliation table already?
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%reconcil%';

-- Permission code state
SELECT permission_code, scope_type FROM sys_auth_permissions WHERE permission_code LIKE 'reports:%' ORDER BY permission_code;
```

### Step 1 — Permission migration `0330` (if `reports:reconcile` not seeded)

Create `supabase/migrations/0330_reports_reconcile_permission.sql` that:
- Inserts `('reports:reconcile', …)` into `sys_auth_permissions` if not present
- Optionally grants to default Admin / Finance Admin / Tenant Owner roles via `sys_auth_role_default_permissions`

**STOP for user review + apply + `npx prisma generate`.**

### Step 2 — Service implementation

`lib/services/order-reconciliation.service.ts` (or extend existing):

- `reconcileOrder(tenantId, orderId)`:
  - Reads voucher lines + operational tables (`org_order_payments_dtl`, stored-value ledgers, AR allocations).
  - Uses the FK backlinks added in migration 0329 to join voucher lines ↔ stored-value ledger rows.
  - Returns a typed mismatch report: `{ orderId, mismatches: Array<{ kind, expected, actual, vchLineId?, ledgerRowId? }>, passed: boolean }`.

- `reconcileTenantWindow(tenantId, dateRange, { page, pageSize })`:
  - Paginated batch report for nightly review.
  - Server-side pagination per `/frontend` rules.

- All queries wrap in `withTenantContext(tenantId, …)` — no direct prisma calls.

### Step 3 — API routes (gated on `reports:reconcile`)

- `POST /api/v1/finance/reconciliation/run` — body `{ orderId }`, returns the single-order report.
- `GET /api/v1/finance/reconciliation/window?from=&to=&page=&pageSize=` — paginated batch report.

Both routes: Zod validation, centralized logger, RBAC check.

### Step 4 — UI (Cmx components only)

- New screen: `app/dashboard/settings/finance/reconciliation/page.tsx` → thin route → `src/features/finance/ui/reconciliation-screen.tsx`.
- Use `@ui/data-display/cmx-datatable` for the mismatch table (server-side pagination).
- `@ui/forms` for date-range input.
- `@ui/primitives` for buttons + page header.
- Empty state: `@ui/feedback/cmx-summary-message`.

### Step 5 — Navigation (DUAL-WRITE per CRITICAL RULE #10)

- Update `web-admin/config/navigation.ts` — add entry under existing Finance/Settings tree.
- Migration `0331_nav_reconciliation.sql` that inserts into `sys_components_cd` (use `/navigation` skill).

### Step 6 — i18n (EN + AR + RTL)

- Reuse `common.*` keys where possible (`save`, `cancel`, `loading`).
- New namespace `reconciliation.*` with EN + AR pairs.
- RTL: `rtl:` Tailwind classes everywhere ml/mr/text-align is used.
- Run `npm run check:i18n`.

### Step 7 — Tests

- Service unit tests: matched-and-mismatched scenarios, multi-tenant isolation, pagination boundary cases.
- API route smoke tests.
- Phase 2 + Phase 3 baseline sweep must stay green.

### Step 8 — Docs

- Per-step IMPLEMENTATION_STATUS.md updates (dual-step rule).
- Phase close: `/documentation` skill → `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md`.
- CHANGELOG entry.

### Phase 4 exit checklist

- [ ] All step exit criteria green
- [ ] `npx tsc --noEmit` filtered = 0 errors
- [ ] Phase 2 + Phase 3 + new Phase 4 jest sweep all green
- [ ] `npm run build` succeeds
- [ ] `IMPLEMENTATION_STATUS.md` updated step-by-step
- [ ] CHANGELOG entry added
- [ ] `bvm_wiring_phase4_implementation.md` written
- [ ] Permission migration applied (user)
- [ ] Navigation migration applied (user)
- [ ] Manual QA: open Reconciliation page, run a single-order reconcile + a date-range batch, verify mismatch detection works for a deliberate ledger drift scenario.
- [ ] User commits with `DD_MM_YYYY_N` prefix

---

## Phase 5 — History / Audit

**PRD section:** §22
**Entry condition:** Phase 4 closed.

### Step 0 — Discovery (read-only)

```
rg 'org_order_history|org_order_status_history' web-admin/prisma/schema.prisma
rg 'order-history.service' web-admin/lib
```

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'org_order_%hist%';
```

### Step 1 — Migration `0332_phase5_order_history.sql` (if tables missing)

Two tables:
- `org_order_history` — event log (event_type, payload jsonb, actor)
- `org_order_status_history` — status timeline (from_status, to_status, transition_at, reason)

Both with `tenant_org_id` + composite FK to `org_orders_mst` + standard audit fields + RLS via `tenant_isolation_*` policy. Standard indexes.

STOP for user apply + `npx prisma generate`.

### Step 2 — Outbox consumer

After submit-order success, the existing outbox event publisher writes `ORDER_COMPLETED` (and Phase 3's `AR_INVOICE_ISSUED`). Wire a new outbox subscriber in `lib/services/order-history-consumer.service.ts` that:
- Consumes `ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`.
- Writes the history rows asynchronously (NOT inside the submit tx — Phase 2 atomicity boundary is sacred).
- Idempotent on `(tenant_org_id, outbox_event_id)`.

### Step 3 — UI

`src/features/orders/ui/order-detail-screen.tsx` gets a "History" tab using `@ui/navigation/cmx-tabs-panel`. Tab body uses `@ui/data-display/cmx-datatable` (server-side pagination) for the timeline. RTL-aware ordering (newest first, but flip the chevron with `rtl:rotate-180` if used).

### Step 4 — Tests + docs

- Consumer service unit tests (idempotency, multi-tenant).
- UI a11y test for the new tab.
- Phase docs per pattern.

### Phase 5 exit checklist — same template as Phase 4

---

## Phase 6 — UI / schema debt cleanup

Priority order (from `BVM_PHASE_2_ENTRY_PLAN.md` § "UI debt" + § "Schema debt", reordered by Phase 3 close):

1. **Verify-payment endpoint** (highest UX value — unblocks BANK_TRANSFER / CHECK):
   - `POST /api/v1/orders/[id]/payments/[paymentId]/verify`
   - Service: `verifyPaymentTx(tx, { orderId, paymentId, userId })` — flips `payment_status` PENDING → COMPLETED, emits outbox event.
   - New permission `orders:verify_payment` (needs DB seed migration).
   - UI: badge + verify button in payment details, Cmx components.

2. **Retire `createInvoice`** (legacy adapter in `web-admin/lib/services/invoice-service.ts`):
   - Migrate `app/actions/payments/invoice-actions.ts:createInvoiceAction` to use `createArInvoiceFromOrders`.
   - Update `__tests__/services/invoice-service.test.ts` accordingly.
   - Delete `createInvoice` + its private helpers.
   - Extract `assertBlockingInvoiceAutoPostSucceeded` into `lib/services/erp-lite-auto-post.util.ts` (currently duplicated between `invoice-service.ts` and `ar-invoice.service.ts` after Phase 3).

3. **Hoist `STORED_VALUE_CODE`** from orchestrator-local (`order-submit-orchestrator.service.ts:84-90`) into `lib/constants/order-financial.ts`.

4. **Payment Modal v4 completion** (WALLET method + CHECK/HYPERPAY validation messages). NOTE: someone is already mid-work in this area — check git status before touching. Possibly out of scope and merged separately.

5. **Payment Method settings UI** — 4 D9 toggles + tenant-level `currency_code`.

6. **`paymentStatus` field on `paymentLegSchema`** + planner honoring (B7 unblock).

7. **Voucher status triple-column collapse migration** — only after audit confirms no readers use legacy `status`.

This phase can be broken into multiple sessions. Each sub-item is its own step with its own progress update + docs entry.

### Phase 6 exit checklist — same template

---

## Per-step protocol (apply to every step in every phase)

1. **Plan the step** — confirm scope + acceptance criteria.
2. **Load any new skill** the step needs (`/i18n` for translations, `/navigation` for nav, `/database` for SQL, etc.).
3. **Implement** with production-ready discipline (no gaps, no shortcuts, full a11y/RTL/i18n where applicable).
4. **STOP for user review** if it's a migration. Otherwise…
5. **Verify:**
   ```powershell
   cd web-admin
   npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 30
   npx jest __tests__/utils/money.test.ts `
            __tests__/utils/idempotency.test.ts `
            __tests__/services/order-settlement-planner.service.test.ts `
            __tests__/services/discount-service.test.ts `
            __tests__/services/stored-value.service.test.ts `
            __tests__/services/loyalty.service.test.ts `
            __tests__/services/ar-invoice.service.test.ts `
            __tests__/services/gift-card-service.test.ts
   ```
   Baseline expected: **117/117 pass** (69 Phase 2 + 7 Phase 3 + 40 gift-card-service + 1 AR PAY_ON_COLLECTION). Add new tests on top.
6. **Update IMPLEMENTATION_STATUS.md** with the step's progress entry (dual-step rule).
7. **Mark TODO complete + next step in_progress** (TodoWrite).

## Per-phase protocol (apply at every phase boundary)

1. Run every per-step protocol on every step.
2. Run the per-phase exit checklist.
3. Invoke `/documentation` skill → `docs/features/Order_Fin/bvm_wiring_phase{N}_implementation.md` matching the Phase 2/3 template.
4. Update `docs/features/Order_Fin/CHANGELOG.md` with a top-of-file entry.
5. Flip the phase status in `IMPLEMENTATION_STATUS.md` to ✅ Done.
6. Update memory `project_bvm_wiring_phases.md` with the new state.
7. STOP for user manual QA + commit before moving to the next phase.

## Program close (after Phase 6)

Write `docs/features/Order_Fin/bvm_wiring_program_summary.md` capping the whole multi-session effort — for posterity + onboarding new engineers.

---

## Quick sanity test before each resume

```powershell
cd f:\jhapp\cleanmatex
git status                    # should be clean OR show only the dirty files listed above
git log -1 --oneline          # should show Phase 3 commit (or later)
cd web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 10
npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts `
         __tests__/services/order-settlement-planner.service.test.ts `
         __tests__/services/discount-service.test.ts `
         __tests__/services/stored-value.service.test.ts `
         __tests__/services/loyalty.service.test.ts `
         __tests__/services/ar-invoice.service.test.ts `
         __tests__/services/gift-card-service.test.ts
# 117/117 expected
```

If any fail, hand-investigate before resuming.

---

## Final note

Phase 4 is roughly 1 session. Phase 5 is 1–2 sessions. Phase 6 is multi-session and can pause between sub-items. The PRD is the source of truth for behavior; this doc is the source of truth for sequencing and constraints. Do not skip the per-phase exit checklist.

When all phases close, write `bvm_wiring_program_summary.md` to cap the program.
