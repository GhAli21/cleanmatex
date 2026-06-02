# RESUME — BVM Wiring Phases 3 → 6 (finish the BVM program)

**Created:** 2026-05-29 (end of Phase 2 implementation session)
**Predecessor commit:** `13f8872` on `main` ("28_05_2026_3 Continue in BMV Wiring …") — Phase 2 fully shipped.
**Scope:** Complete BVM Wiring Phases 3, 4, 5, then close UI/schema debt documented in `BVM_PHASE_2_ENTRY_PLAN.md` as Phase 6.

---

## How to resume this session (single prompt)

1. Reopen Claude Code in `f:\jhapp\cleanmatex`.
2. Verify you are at HEAD `13f8872` on `main` (or later).
3. Paste this prompt verbatim:

> Read `C:\Users\JHNLP\.claude\plans\bvm-phase-3-to-6-RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation` skills. Start at Phase 3 Step 0 (discovery). Do NOT apply any migration — create the file and stop for review. Use Supabase remote MCP for read-only DB inspection. After each step, update `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` with the progress entry per the dual-step pattern. After every code step, run `npx tsc --noEmit` (filtered to exclude pre-existing payment-config UI errors) + the Phase 2 jest sweep to confirm no regressions. End each phase with a per-phase exit checklist; only after that proceed to the next phase. Finalise the whole run with the /documentation skill writing one implementation file per phase (`bvm_wiring_phase{N}_implementation.md`).

That single prompt is enough — this doc is self-contained.

---

## State at handoff (verify before starting)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | `13f8872` or later | `git rev-parse HEAD` |
| Last migration | `0329_phase2_stored_value_voucher_fks.sql` | `ls supabase/migrations/03*.sql \| sort \| tail -3` |
| Next migration | `0330` | same as above + increment |
| Phase 2 jest sweep | 69/69 | `cd web-admin && npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts __tests__/services/stored-value.service.test.ts __tests__/services/loyalty.service.test.ts` |
| TS errors in Phase 2 files | 0 | `npx tsc --noEmit 2>&1 \| Select-String -NotMatch 'payment-config\|cash-drawers'` |
| Supabase MCP | configured | `.mcp.json` has `supabase_remote_db` |

### Files dirty at handoff (NOT mine — pre-existing in-progress work)

These were dirty when Phase 2 closed. They are unrelated to BVM Wiring and should be left alone:

- `web-admin/__tests__/features/orders/payment-modal-v4.utils.test.ts`
- `web-admin/__tests__/api/v1/customers/stored-value.route.test.ts` (untracked)
- `web-admin/app/api/v1/customers/[id]/stored-value/route.ts`
- `web-admin/messages/ar.json`, `web-admin/messages/en.json` (payment modal v4 i18n in progress)
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx`
- `web-admin/src/features/orders/ui/payment-modal-v4.utils.ts`
- `web-admin/src/features/payment-config/ui/*.tsx` (large in-progress UI refactor — has its own tsc errors)

There are also 3 pre-existing `tsc` errors in `src/features/payment-config/ui/cash-drawers-tab.tsx` (`branches` prop missing on `CashDrawerFormDialogProps`). Do NOT try to fix them — they belong to whoever owns that UI work.

---

## Canonical references (read these first)

| Purpose | Path |
|---|---|
| PRD (master spec for ALL phases) | `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` |
| Current status (Phase 2 closed; this is where to append your progress entries) | `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` |
| Phase 2 entry plan (✅ Done; section "UI debt" + "Schema debt" feeds Phase 6) | `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` |
| Phase 2 implementation log | `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md` |
| AR Invoice scope ADR | `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` |
| AR Invoice IMPLEMENTATION_STATUS | `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md` |
| Changelog | `docs/features/Order_Fin/CHANGELOG.md` |
| Original BVM plan | `C:\Users\JHNLP\.claude\plans\business-voucher-wiring-you-witty-thimble.md` |
| Phase 2 RESUME (predecessor) | `C:\Users\JHNLP\.claude\plans\bvm-phase-2-onward-RESUME.md` |

---

## Constraints — DO NOT VIOLATE

Read `CLAUDE.md` lines 1–80 for the full list. The non-negotiables:

1. **No migration apply.** Create the `.sql` file, then STOP and wait for the user to apply + run `npx prisma generate`. MCP is for read-only discovery only.
2. **Migration sequence.** Next migration = `0330`. After that, increment. snake_case filenames.
3. **DROP CASCADE is BANNED by default.** Use `RESTRICT`. CASCADE only with explicit user approval + a recreate manifest.
4. **Every `org_*` query filters by `tenant_org_id`.** Use `withTenantContext()` in web-admin.
5. **TEXT not VARCHAR** for new string columns.
6. **DB-mirror rule.** Any TypeScript constant that round-trips to the DB MUST use the exact same string the DB stores.
7. **Permission codes** must be `resource:action` (two parts), lowercase + underscores. Every new code needs a migration that seeds it.
8. **Navigation changes** are dual-write: `web-admin/config/navigation.ts` + a `sys_components_cd` migration. Use the `/navigation` skill.
9. **Constants live in `lib/constants/`**, types in `lib/types/`. No duplication.
10. **Skill loading.** Load `/database` before SQL, `/frontend` before JSX, `/backend` before API routes, `/i18n` before any user-facing text, `/code-documentation` for inline comments.
11. **Memory workflow.** After every migration file, STOP and wait for user confirmation of successful application before continuing.
12. **Always Cmx components** for UI — `@ui/primitives`, `@ui/feedback`, etc.
13. **Build must stay green.** Run `npx tsc --noEmit` (filtered) + jest sweep at every step boundary.
14. **Dual-step pattern** (per Phase 2 close request): after every implementation step, IMMEDIATELY append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` before starting the next step.

---

## Phase 2 — Already shipped (do NOT re-do)

Reference for what's in place. Phase 3 builds on these:

- **Atomicity invariant:** submit-order's voucher header + lines + every `redeem*Tx` + post & wire run in ONE `prisma.$transaction` inside `order-submit-orchestrator.service.ts`.
- **`redeem*Tx` contract:** all 5 services accept `idempotencyKey?`, `voucherId?`, `voucherLineId?` with uniform skip-on-existing + backlink persistence.
- **`STORED_VALUE_LOCK_ORDER`** — planner sorts `creditApplicationLegs` by `STORED_VALUE_LOCK_RANK`.
- **`applyStoredValueDebitTx`** — exported from `order-credit-application.service.ts`; the dispatcher used by the orchestrator.
- **Voucher services** (`createBizVoucher`, `addVoucherLine`, `postAndWireBizVoucher`) — accept optional `tx?: PrismaTransactionClient`.
- **`settleOrder({ wiringMode: true })`** — the CREDIT_APPLICATION branch short-circuits with `continue` so no double-debit can occur.
- **Migration 0329** — 10 composite FKs + 10 partial indexes + 2 loyalty columns.
- **Legacy route retired** — `app/api/v1/orders/_legacy_create-with-payment/` deleted.

---

## Phase 3 — AR Invoice via CREDIT_INVOICE

**PRD section:** §20.3
**Entry condition:** Phase 2 closed (✅), build green, manual QA passed for Phase 2 acceptance scenarios.

### Step 0 — Discovery (read-only)

Already known from Phase 2 Step 0: `createArInvoiceFromOrders` exists at `web-admin/lib/services/ar-invoice.service.ts` with tests and a `POST /api/v1/ar/invoices/from-orders` route. Re-verify before touching:

```
rg 'createArInvoiceFromOrders' web-admin/lib web-admin/app
rg 'shouldCreateArInvoice' web-admin/lib web-admin/app
```

Run via Supabase remote MCP `execute_sql` (read-only):

```sql
-- Confirm AR invoice table shape
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'org_invoice_mst'
  AND column_name IN ('id','tenant_org_id','order_id','customer_id','invoice_no','total_amount','outstanding_amount','currency_code','invoice_date','due_date')
ORDER BY ordinal_position;

-- Confirm AR allocation table shape (sanity for tx4)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'org_ar_allocations_dtl'
ORDER BY ordinal_position;
```

Report findings: does `createArInvoiceFromOrders` accept a `tx` already? Does it return the invoice id?

### Step 1 — Migration `0330` only if Step 0 finds a gap

If the AR invoice table is missing any expected columns or FK constraints to `org_orders_mst`, create migration `0330_phase3_ar_invoice_voucher_link.sql`. STOP for user review/apply + `npx prisma generate`.

If the schema is already complete, skip the migration step and update IMPLEMENTATION_STATUS.md accordingly.

### Step 2 — Thread `tx?` through `createArInvoiceFromOrders` (if needed)

Mirror Phase 2 Step 3b pattern:

```typescript
async function createArInvoiceFromOrdersInTx(tx, params) { ... }

export async function createArInvoiceFromOrders(
  params,
  tx?: PrismaTransactionClient,
) {
  if (tx) return createArInvoiceFromOrdersInTx(tx, params);
  return withTenantContext(params.tenantId, () =>
    prisma.$transaction((innerTx) => createArInvoiceFromOrdersInTx(innerTx, params)),
  );
}
```

### Step 3 — Wire into the orchestrator

`order-submit-orchestrator.service.ts`:

- After `settleOrder()` (TX3), when `plan.shouldCreateArInvoice` is `true`:
  - Call `createArInvoiceFromOrders({ tenantId, orderId: result.orderId, customerId, branchId, outstandingAmount, currencyCode, userId })` inside its own tx (TX5).
  - Attach the resulting `invoice_id` to `org_orders_mst.invoice_id` so credit collection workflows can find it.
- Decide: does TX5 NEED to be atomic with TX2 (the voucher tx)? Probably NOT — AR invoice failure after voucher commit is recoverable (an admin can re-issue the invoice). But IDEMPOTENCY KEY for AR invoice MUST be deterministic (`${result.orderId}_ar`) so a retry of the entire submit doesn't create a duplicate AR invoice row.

### Step 4 — Update `submitOrderRequestSchema` if AR invoice needs new request fields

Probably none. Verify.

### Step 5 — Tests

Add to `__tests__/services/order-submit-orchestrator.service.test.ts` (create if doesn't exist) OR `__tests__/services/ar-invoice.service.test.ts`:

- CREDIT_INVOICE order with outstanding > 0 → AR invoice row created, `org_orders_mst.invoice_id` populated.
- Replay of same order (same idempotency key) → no duplicate AR invoice row.
- Non-credit-invoice order (cash sale) → AR invoice NOT created (sanity).

### Step 6 — Docs

- Append "Phase 3 — AR Invoice via CREDIT_INVOICE" section to `IMPLEMENTATION_STATUS.md`.
- Create `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` via /documentation skill at end of phase.
- Add CHANGELOG entry.

### Phase 3 exit checklist

- [ ] All Phase 3 acceptance criteria pass manual QA
- [ ] `npx tsc --noEmit` filtered = 0 errors
- [ ] Phase 2 jest sweep + new Phase 3 tests all green
- [ ] `npm run build` succeeds
- [ ] `IMPLEMENTATION_STATUS.md` updated with Phase 3 section
- [ ] CHANGELOG entry added
- [ ] `bvm_wiring_phase3_implementation.md` written
- [ ] User commits with `DD_MM_YYYY_N` prefix

---

## Phase 4 — Reconciliation

**PRD section:** §23
**Entry condition:** Phase 3 closed.

### Step 0 — Discovery

```
rg 'reconcil' web-admin/lib/services web-admin/app
rg 'org_reconcil' web-admin/prisma/schema.prisma
```

Check whether `lib/services/reconciliation.service.ts` already exists (there's a test file `__tests__/services/reconciliation.service.test.ts` listed in Phase 2 discovery — the service may already exist in skeleton form).

### Step 1 — Permission migration

Create migration that seeds `reports:reconcile` permission into `sys_auth_permissions`. STOP for user apply.

### Step 2 — Service implementation

`lib/services/order-reconciliation.service.ts`:
- `reconcileOrder(tenantId, orderId)` reads voucher lines + operational tables (`org_order_payments_dtl`, stored-value ledgers, AR allocations) and returns mismatch report.
- `reconcileTenantWindow(tenantId, dateRange)` for nightly batch.

Use the FK backlinks added in migration 0329 to join voucher lines ↔ stored-value ledger rows.

### Step 3 — API routes

- `POST /api/v1/finance/reconciliation/run` — single order
- `GET /api/v1/finance/reconciliation/window` — batch report

Both gated on `reports:reconcile`.

### Step 4 — UI (Cmx components)

Settings → Finance → Reconciliation page. Use `@ui/data-display` `CmxDataTable` for the mismatch table; `@ui/forms` for date range input; `@ui/primitives` for buttons.

### Step 5 — Navigation

DUAL-WRITE per CLAUDE.md rule #10:
- `web-admin/config/navigation.ts` add entry
- Migration that inserts into `sys_components_cd`

Use the `/navigation` skill.

### Step 6 — i18n

Add EN + AR keys for the reconciliation page. Use `/i18n` skill.

### Step 7 — Tests + docs

- Service unit tests
- IMPLEMENTATION_STATUS.md entry
- `bvm_wiring_phase4_implementation.md` (via /documentation skill at end of phase)

### Phase 4 exit checklist — same template as Phase 3

---

## Phase 5 — History / Audit

**PRD section:** §22
**Entry condition:** Phase 4 closed.

### Step 0 — Discovery

```
rg 'org_order_history' web-admin/prisma/schema.prisma
rg 'org_order_status_history' web-admin/prisma/schema.prisma
rg 'order-history.service' web-admin/lib
```

### Step 1 — Migration if tables missing

`0332_phase5_order_history.sql` (or similar). Two tables:
- `org_order_history` — event log
- `org_order_status_history` — status timeline

Standard audit fields + tenant_org_id + composite FKs + RLS. Follow the table-check workflow first.

### Step 2 — Outbox consumer

After submit-order success, the existing outbox event publisher should create history rows asynchronously. Wire a new outbox subscriber that consumes `ORDER_COMPLETED` (and possibly `VOUCHER_POSTED_AND_WIRED`) and writes the history row.

### Step 3 — UI

Order detail page gets a "History" tab showing the timeline. Cmx components only.

### Step 4 — Tests + docs

Per the established pattern.

### Phase 5 exit checklist — same template

---

## Phase 6 — UI / schema debt cleanup

Priority order (from `BVM_PHASE_2_ENTRY_PLAN.md` § "UI debt" and § "Schema debt"):

1. **Verify-payment endpoint** (highest UX value — unblocks BANK_TRANSFER / CHECK flow):
   - `POST /api/v1/orders/[id]/payments/[paymentId]/verify`
   - Service: `verifyPaymentTx(tx, { orderId, paymentId, userId })` — updates `payment_status` from `PENDING` to `COMPLETED`, emits outbox event.
   - Permission: `orders:verify_payment` (new) — needs migration.
2. **Phase 2.1 deferred: gift-card-by-id as voucher line** — needs the voucher-total semantic decision documented in `bvm_wiring_phase2_implementation.md`.
3. **Payment Modal v4** completion (WALLET method + CHECK/HYPERPAY validation messages). NOTE: someone else is already mid-work in this area at handoff time — check git status before touching. Possibly out of scope here and merged separately.
4. **Payment Method settings UI** — 4 D9 toggles + tenant-level `currency_code`.
5. **`paymentStatus` field on `paymentLegSchema`** + planner honoring (B7 unblock).
6. **Voucher status triple-column collapse migration** — only after audit confirms no readers use legacy `status`.

This phase can be broken into multiple sessions. Each sub-item is its own step with its own progress update.

### Phase 6 exit checklist — same template

---

## Per-step protocol (apply to every step in every phase)

1. **Plan the step** — confirm scope + acceptance criteria.
2. **Load any new skill** the step needs (`/i18n` for translations, `/navigation` for nav, `/database` for SQL, etc.).
3. **Implement.**
4. **STOP for user review** if it's a migration. Otherwise…
5. **Verify:**
   ```powershell
   cd web-admin
   npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 30
   npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts __tests__/services/stored-value.service.test.ts __tests__/services/loyalty.service.test.ts
   ```
   Baseline expected: 69/69 pass. Add new tests on top.
6. **Update IMPLEMENTATION_STATUS.md** with the step's progress entry — including a checked-off step row in the per-phase status table.
7. **Mark TODO complete + next step in_progress** (TodoWrite).

## Per-phase protocol (apply at every phase boundary)

1. Run the per-step protocol on every step of the phase.
2. Run the per-phase exit checklist.
3. Invoke `/documentation` skill to produce `bvm_wiring_phase{N}_implementation.md` matching the Phase 2 template.
4. Update CHANGELOG with a top-of-file entry.
5. Flip the phase status in `BVM_PHASE_2_ENTRY_PLAN.md` (or whichever entry-plan doc is current) to ✅ Done.
6. Update memory `project_bvm_wiring_phases.md` with the new state.
7. STOP for user manual QA before moving to the next phase.

---

## What the USER should do before / during / after

### Before /clear (NOW)

1. (Optional) Run the 4 Phase 2 manual QA scenarios listed in the previous response. If anything fails, paste the failure list before /clear so Phase 2 Round 2 can be planned.
2. (Optional) `git push` for remote backup of commit `13f8872`.
3. `/clear`.

### When you come back

1. Reopen Claude Code in `f:\jhapp\cleanmatex`.
2. Paste the single resume prompt at the top of this doc.
3. The fresh Claude session will:
   - Read this doc + reference docs
   - Load the 7 skills
   - Run Phase 3 Step 0 discovery
   - Report findings, ask any blocking question, otherwise proceed step by step
4. Phase 3 → 6 is roughly 3–5 sessions of work, depending on how much sits behind STOPs.

### During each phase

- Approve migration files when asked.
- Apply migration + run `npx prisma generate` when asked.
- Run the 4-scenario manual QA at each phase exit checklist.
- If anything fails, give Claude the failure list — a Round 2 RESUME doc gets written and you `/clear` again.

### After each phase closes

- Approve the commit message format Claude proposes (`DD_MM_YYYY_N` prefix).
- Push if you want a remote checkpoint.
- `/clear` if context > 70% before starting the next phase.

---

## Quick sanity test before each resume

```powershell
cd f:\jhapp\cleanmatex
git status                    # should be clean OR show only the dirty files listed above
git log -1 --oneline          # should show 13f8872 or a later phase commit
cd web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 10
npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts __tests__/services/stored-value.service.test.ts __tests__/services/loyalty.service.test.ts
# 69/69 expected
```

If any of these fail, something has changed since handoff and a hand-investigation is needed before resuming.

---

## Final note

Phases 3, 4, 5 are sized roughly 1 session each. Phase 6 is multi-session and can be paused between sub-items. The PRD is the source of truth for behavior; this doc is the source of truth for sequencing and constraints. Do not skip the per-phase exit checklist — that's the only thing standing between a clean Phase N→N+1 transition and a Round 2 stabilization mess.

When all phases close, write a `bvm_wiring_program_summary.md` capping the whole multi-session effort.
