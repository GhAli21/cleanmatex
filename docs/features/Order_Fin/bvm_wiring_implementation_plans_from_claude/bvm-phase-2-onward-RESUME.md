# RESUME — BVM Wiring Phase 2 → 5 (full completion)

**Created:** 2026-05-28 (end of Round 2 stabilization session)
**Predecessor session:** Round 2 stabilization at commit `47543ab` on `main` (see RESUME `sleepy-zooming-goose-RESUME.md` for context)
**Scope:** Complete BVM Wiring Phases 2–5, then close UI/schema debt documented in `BVM_PHASE_2_ENTRY_PLAN.md`.

---

## How to resume this session (single prompt)

1. Reopen Claude Code in `f:\jhapp\cleanmatex`.
2. Verify you are at HEAD `47543ab` on `main` (or later — push hasn't happened yet, run `git push` first if you want a remote backup).
3. Paste this prompt verbatim:

> Read `C:\Users\JHNLP\.claude\plans\bvm-phase-2-onward-RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation` skills. Start at Phase 2 Step 0 (discovery). Do NOT apply any migration — create the file and stop for review. Use Supabase remote MCP for read-only DB inspection (already configured in `.mcp.json` with token; no OAuth needed).

That single prompt is enough — the doc is self-contained.

---

## State at handoff (verify before starting)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | `47543ab` | `git rev-parse HEAD` |
| Working tree | clean | `git status` |
| Last migration applied | `0328_fix_payment_method_drift_and_voucher_status.sql` | `ls supabase/migrations/0328*` |
| Next migration number | `0329` | `ls supabase/migrations/03*.sql | sort | tail -3` |
| TypeScript | 0 errors | `cd web-admin && npx tsc --noEmit` |
| Baseline jest | 41/41 | `cd web-admin && npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts` |
| Supabase MCP | configured | `.mcp.json` has `supabase_remote_with_token` |

---

## Canonical references (read these first)

| Purpose | Path |
|---|---|
| PRD (master spec for all phases) | `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` |
| Current status (Phase 1B fully stable; Round 2 closed) | `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` |
| Phase 2 entry plan (acceptance criteria + UI/schema debt) | `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` |
| Phase 1B implementation log | `docs/features/Order_Fin/bvm_wiring_phase1b_implementation.md` |
| AR Invoice scope ADR | `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` |
| Round 2 stabilization details (B5/B6/B8 fixes) | `IMPLEMENTATION_STATUS.md` § "2026-05-28 — Round 2 Stabilization" |
| Original BVM wiring plan | `C:\Users\JHNLP\.claude\plans\business-voucher-wiring-you-witty-thimble.md` |

---

## Constraints — DO NOT VIOLATE

Read `CLAUDE.md` lines 1–80 for the full list. The non-negotiables for this work:

1. **No migration apply.** Create the `.sql` file, then STOP and wait for the user to apply + run `npx prisma generate`. Do NOT use Supabase MCP `apply_migration`. MCP is for read-only discovery queries only.
2. **Migration sequence.** Next migration = `0329`. After that, increment. Use snake_case filenames.
3. **DROP CASCADE is BANNED by default.** Use `RESTRICT`. Only use CASCADE with explicit user approval + a recreate manifest.
4. **Every `org_*` query filters by `tenant_org_id`.** No exceptions. Use `withTenantContext()` in web-admin.
5. **TEXT not VARCHAR** for new string columns.
6. **DB-mirror rule.** Any TypeScript constant that round-trips to the DB MUST use the exact same string the DB stores (case, separators, spelling). Example: if column stores `'PENDING_PAYMENT'`, constant value is `'PENDING_PAYMENT'`, not `'pending-payment'`.
7. **Permission codes** must be `resource:action` (two parts), lowercase + underscores. Every new code needs a migration that seeds it.
8. **Navigation changes** are dual-write: `web-admin/config/navigation.ts` + a `sys_components_cd` migration.
9. **Constants live in `lib/constants/`**, types in `lib/types/`. No duplication.
10. **Skill loading.** Load `/database` before SQL, `/frontend` before JSX, `/backend` before API routes, `/i18n` before any user-facing text.
11. **Memory workflow.** After every migration file, STOP and wait for user confirmation of successful application before continuing.
12. **Always Cmx components** for UI — `@ui/primitives`, `@ui/feedback`, etc. Never raw HTML or shadcn when a Cmx wrapper exists.
13. **Build must stay green.** Run `npx tsc --noEmit` at every phase boundary. Run the baseline jest suite. Never close a phase with red tests.

---

## Decisions already locked in (do not relitigate)

From Round 1 + Round 2 stabilization:

| Decision | Where it lives |
|---|---|
| Voucher sub-idempotency keys prefixed with `result.orderId` (not `input.idempotencyKey`) | `order-submit-orchestrator.service.ts` |
| `createBizVoucher` rejects cached vouchers whose `source_ref_id`/`order_id` mismatch | `voucher-biz.service.ts` |
| Submit-order route stakes idempotency-hash placeholder PRE-orchestrator | `app/api/v1/orders/submit-order/route.ts` |
| Pre-mutation errors unstake the placeholder (validation failures don't burn the key) | same route, `PRE_MUTATION_ERROR_CODES` set |
| Failed orchestrator runs (post-tx1) return `PRIOR_ATTEMPT_FAILED` on retry | same route |
| All voucher status transitions sync `voucher_status` + legacy `status` + `posting_status` | wiring, posting, biz (cancel), reversal services |
| `org_payment_methods_cf.requires_cash_drawer` + `requires_reference` are NULLABLE; service falls back to sys via `eff_*` pattern | `payment-config.service.ts` |
| `addVoucherLine.create()` persists `org_payment_method_id`, `payment_terminal_id`, `credit_application_type` | `voucher-line.service.ts` |
| AR invoice creation gated on `effectiveOutstandingPolicy === 'CREDIT_INVOICE'` | per ADR `ADR_ar_invoice_is_receivable_only.md` |
| BANK_TRANSFER stays `PENDING` until cashier verifies (NO auto-COMPLETED) | tenant policy choice 2026-05-28 |
| Verify-payment endpoint will be added in Phase 2 (not Phase 1B) | `BVM_PHASE_2_ENTRY_PLAN.md` UI debt section |

---

## Scope — everything that remains

### Phase 2 (PRIMARY — start here)
Stored-Value + Gift Card consolidation into the voucher transaction. PRD scope: move `giftCardId`, wallet, advance, credit-note, loyalty debits OUT of `settleOrder()` and INTO the voucher tx so the whole submit is atomic.

### Phase 3
AR Invoice via `CREDIT_INVOICE` — orchestrator calls `createArInvoiceFromOrders()` after `settleOrder()` when `plan.shouldCreateArInvoice`.

### Phase 4
Reconciliation — `order-reconciliation.service.ts`; reconcile voucher lines against operational tables (orders, payments, stored-value txns).

### Phase 5
History / Audit — `org_order_history` + `org_order_status_history` entries after order submission.

### Phase 6 (debt cleanup — last)
- Verify-payment endpoint (`POST /api/v1/orders/[id]/payments/[paymentId]/verify`)
- Payment Modal v4: WALLET method, CHECK/HYPERPAY validation messages
- Payment Method settings UI: 4 D9 toggles + tenant-level `currency_code`
- `paymentStatus` field on `paymentLegSchema` + planner honoring (B7 unblock)
- Voucher status triple-column collapse migration (after all readers migrated to `voucher_status`)

---

## Phase 2 — Detailed plan

### Acceptance criteria (already documented in BVM_PHASE_2_ENTRY_PLAN.md)

1. Submit-order with mixed CASH + WALLET: voucher tx commits header + lines + wallet debit atomically. Wallet insufficient → whole tx rolls back; no voucher, no PAID order.
2. Forced mid-redemption failure (e.g. lock timeout on `org_loyalty_accounts_mst`): voucher tx rolls back; no payment fact rows; stored-value balances unchanged; outbox emits nothing.
3. Idempotency replay: same order + same key + same body → second voucher post is a no-op (skipped via pre-check on every redemption ledger).
4. Multi-balance order (gift-card + wallet + loyalty in one submit): locks taken in `STORED_VALUE_LOCK_ORDER` regardless of caller leg ordering.

### Step 0 — Discovery (read-only, no code yet)

Run via Supabase remote MCP `execute_sql` (read-only — no DDL):

```sql
-- 0.1 — verify FK columns exist on stored-value tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name IN ('fin_voucher_trx_line_id','voucher_line_id')
  AND table_name IN (
    'org_gift_card_txn_dtl','org_wallet_txn_dtl','org_advance_txn_dtl',
    'org_credit_note_txn_dtl','org_loyalty_transactions_dtl'
  )
ORDER BY table_name, column_name;

-- 0.2 — verify createArInvoiceFromOrders exists in code
-- (use Grep: rg 'createArInvoiceFromOrders' web-admin/lib/services)

-- 0.3 — confirm every settleOrder caller already passes wiringMode:true
-- (Grep: rg 'settleOrder\(' web-admin/lib/services web-admin/app)

-- 0.4 — find STORED_VALUE_LOCK_ORDER constant or note it must be added
-- (Grep: rg 'STORED_VALUE_LOCK_ORDER' web-admin/lib)
```

Report back: which FK columns are missing, what `createArInvoiceFromOrders` looks like, whether legacy `wiringMode:false` callers still exist, whether the lock-order constant exists.

### Step 1 — Migration `0329_phase2_stored_value_voucher_fks.sql` (only if Step 0 finds missing FKs)

For each stored-value txn table missing `fin_voucher_trx_line_id`:
- `ALTER TABLE … ADD COLUMN fin_voucher_trx_line_id UUID NULL`
- `ALTER TABLE … ADD CONSTRAINT fk_…_voucher_line FOREIGN KEY (tenant_org_id, fin_voucher_trx_line_id) REFERENCES org_fin_voucher_trx_lines_dtl(tenant_org_id, id) ON DELETE SET NULL`
- `CREATE INDEX idx_…_voucher_line ON … (tenant_org_id, fin_voucher_trx_line_id) WHERE fin_voucher_trx_line_id IS NOT NULL`

STOP after writing the file. Wait for user.

### Step 2 — Add `STORED_VALUE_LOCK_ORDER` constant

`lib/constants/order-financial.ts`:
```typescript
export const STORED_VALUE_LOCK_ORDER = ['GIFT_CARD','WALLET','CUSTOMER_ADVANCE','CUSTOMER_CREDIT','LOYALTY_CREDIT'] as const;
```

Then sort `creditApplicationLegs` by this order before any redemption call. Reason: avoid deadlock when two concurrent submits touch the same customer's balances.

### Step 3 — Move redemption calls into the voucher transaction

Current state (Phase 1B): `order-submit-orchestrator.service.ts` calls `createBizVoucher` + `addVoucherLine` + `postAndWireBizVoucher` in their own `withTenantContext` blocks. Stored-value debits happen later inside `settleOrder()`.

Target: redemption ledger writes (`redeemGiftCardTx`, `redeemWalletTx`, `redeemAdvanceTx`, `redeemCreditNoteTx`, `redeemLoyaltyPointsTx`) execute **inside the same prisma transaction** that creates the voucher header + lines + posts the voucher. Use `prisma.$transaction(async (tx) => { … })`.

Sub-steps:
1. Refactor `createBizVoucher`, `addVoucherLine`, `postAndWireBizVoucher` to accept an optional `tx?: PrismaTxClient` and pass it through.
2. Make every `redeem*Tx` accept the tx + take `SELECT … FOR UPDATE` on the balance row using `STORED_VALUE_LOCK_ORDER`.
3. Make every `redeem*Tx` accept an `idempotency_key` arg (extending Phase 1A's idempotency contract). Skip if a ledger row already exists with the same key.
4. Orchestrator builds the transaction in this order: lock balances → debit balances → insert voucher header → insert voucher lines (with `fin_voucher_trx_line_id` linkage written back to ledger rows) → post + wire → commit.

Sub-key format for stored-value idempotency (mirrors Round 2 Fix A pattern):
- Gift card: `${result.orderId}_sv_gc_${legIndex}`
- Wallet: `${result.orderId}_sv_w_${legIndex}`
- Advance: `${result.orderId}_sv_a_${legIndex}`
- Credit note: `${result.orderId}_sv_cn_${legIndex}`
- Loyalty: `${result.orderId}_sv_lp_${legIndex}`

### Step 4 — Remove stored-value debit blocks from `settleOrder()`

`lib/services/order-settlement.service.ts` currently has stored-value redemption calls behind `wiringMode: false`. After Step 3, every caller uses `wiringMode: true`. Audit the codebase:

```
rg 'settleOrder\(' web-admin/lib web-admin/app
```

Verify every caller passes `wiringMode: true`. If any legacy caller remains, gate the move on a feature flag and add a deprecation note. Otherwise delete the `wiringMode: false` branch.

### Step 5 — Gift card via `input.giftCardId` becomes a voucher line

Phase 1B: `input.giftCardId` is consumed at totals computation but never produces a voucher line. Add an `ORDER_CREDIT_APPLICATION` line for it in the orchestrator's voucher tx (alongside other credit-application legs).

### Step 6 — Tests

Add (or extend) `__tests__/services/order-submit-orchestrator.service.test.ts`:
- Happy path: CASH + WALLET → voucher header committed, voucher line per leg, wallet ledger row linked via `fin_voucher_trx_line_id`.
- Sad path: WALLET insufficient → throws, no order row, no voucher, no ledger debit.
- Idempotency replay: same key → second submit returns same orderId + same voucher; no ledger duplicates.
- Lock ordering: mixed gift-card + wallet + loyalty submitted in mixed order → SELECT FOR UPDATE follows `STORED_VALUE_LOCK_ORDER`.

Run baseline + new suites. All must pass.

### Step 7 — Docs

Append "Phase 2 — Stored-Value Consolidation" section to `IMPLEMENTATION_STATUS.md`. Update `BVM_PHASE_2_ENTRY_PLAN.md` status header to ✅ Done. Add Phase 2 entry to `CHANGELOG.md` if it exists.

### Step 8 — Manual QA (user)

Test all 4 acceptance scenarios in the live web-admin. Capture verdicts. If any fail → write a Phase 2 Round 2 RESUME doc and STOP.

---

## Phase 3 — AR Invoice via CREDIT_INVOICE

**Entry condition:** Phase 2 closed, build green, manual QA passed.

1. Check whether `createArInvoiceFromOrders()` exists in `web-admin/lib/services/ar-invoice.service.ts`. If yes, wire it. If no, design it from the PRD §20.3 spec.
2. In `order-submit-orchestrator.service.ts`, after `settleOrder()`, when `plan.shouldCreateArInvoice` is true:
   - Call `createArInvoiceFromOrders({ tenantId, orderId: result.orderId, customerId, branchId, outstandingAmount, currencyCode, userId })` inside its own tx (tx5).
   - Attach the resulting `invoice_id` to `org_orders_mst` so credit collection workflows can find it.
3. Update `submitOrderRequestSchema` if needed.
4. Add tests for CREDIT_INVOICE path.
5. Update IMPLEMENTATION_STATUS.md.

**PRD section:** §20.3

---

## Phase 4 — Reconciliation

**Entry condition:** Phase 3 closed.

1. Create `lib/services/order-reconciliation.service.ts`:
   - `reconcileOrder(tenantId, orderId)` reads voucher lines + operational tables (`org_order_payments_dtl`, stored-value ledgers, AR allocations) and reports any mismatches.
   - `reconcileTenantWindow(tenantId, dateRange)` for nightly batch.
2. Permissions: `reports:reconcile` (add migration).
3. API: `POST /api/v1/finance/reconciliation/run` (single order) + `GET /api/v1/finance/reconciliation/window` (batch report).
4. UI: minimal admin page under Settings → Finance → Reconciliation.
5. Tests + IMPLEMENTATION_STATUS.md.

**PRD section:** §23

---

## Phase 5 — History / Audit

**Entry condition:** Phase 4 closed.

1. After submit-order success, write to `org_order_history` (event log) + `org_order_status_history` (status timeline).
2. Hook into the outbox so the event publisher creates these rows asynchronously (don't block submit-order tx).
3. UI: order detail page shows the timeline.
4. Tests + IMPLEMENTATION_STATUS.md.

**PRD section:** §22

---

## Phase 6 — UI / schema debt cleanup

(See `BVM_PHASE_2_ENTRY_PLAN.md` § "UI debt" and § "Schema debt" for the full list.)

Priority order:
1. **Verify-payment endpoint** (highest UX value — unblocks BANK_TRANSFER / CHECK flow).
2. WALLET in Payment Modal v4 (needed to QA Phase 2).
3. `paymentStatus` field on `paymentLegSchema` + planner honoring (B7).
4. CHECK / HYPERPAY validation messages.
5. Payment Method settings UI: D9 toggles + tenant-level `currency_code`.
6. Voucher status column collapse migration (only after audit confirms no readers use legacy `status`).

---

## Per-phase exit checklist (do not skip)

Before marking any phase ✅ Done:

- [ ] All acceptance criteria for the phase pass manual QA
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Baseline jest suite passes (41/41 from Round 2 baseline + any new tests this phase added)
- [ ] Build: `npm run build` succeeds (per CLAUDE.md rule 5)
- [ ] `IMPLEMENTATION_STATUS.md` updated with phase section
- [ ] Any new permission codes have a migration
- [ ] Any new navigation entries have a migration + `navigation.ts` update
- [ ] Any new constants follow the DB-mirror rule
- [ ] Memory updated (`project_bvm_wiring_phases.md` status line)
- [ ] Commit on `main` with the user's standard format (`DD_MM_YYYY_N` prefix)

---

## What to do if you get stuck

1. **Migration apply error:** the user runs the migration via Supabase CLI; if it fails, capture the SQLSTATE + the failing statement, fix the SQL, re-run. Never use `--no-verify` or skip hooks.
2. **TypeScript error after schema change:** run `npx prisma generate` first; if still failing, the schema needs regen.
3. **Test failure on RLS:** verify `withTenantContext()` wraps the query; check `tenant_org_id` is on every row created.
4. **Idempotency conflict in retest:** delete the stale row via MCP — same pattern as Round 2:
   ```sql
   DELETE FROM org_idempotency_keys
   WHERE tenant_org_id = '<tenant>'::uuid
     AND resource_type = 'submit_order'
     AND (resource_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM org_orders_mst o WHERE o.id = resource_id AND o.rec_status = 1));
   ```
5. **Stuck on a design question:** STOP. Write a `bvm-phase-X-question-RESUME.md` and ask the user. Do not invent semantics.

---

## Files most likely to touch (per phase)

### Phase 2
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- `web-admin/lib/services/order-settlement.service.ts`
- `web-admin/lib/services/voucher-biz.service.ts`
- `web-admin/lib/services/voucher-line.service.ts`
- `web-admin/lib/services/voucher-wiring.service.ts`
- `web-admin/lib/services/gift-card-service.ts` (or wherever `redeemGiftCardTx` lives)
- `web-admin/lib/services/wallet-service.ts` (and similar for advance/credit-note/loyalty)
- `web-admin/lib/constants/order-financial.ts`
- `supabase/migrations/0329_*.sql` (if FKs missing)

### Phase 3
- `web-admin/lib/services/ar-invoice.service.ts`
- `web-admin/lib/services/order-submit-orchestrator.service.ts`
- New tests under `__tests__/services/`

### Phase 4
- New: `web-admin/lib/services/order-reconciliation.service.ts`
- New API route + UI page
- Migration for `reports:reconcile` permission

### Phase 5
- `web-admin/lib/services/order-history.service.ts` (may already exist)
- Outbox consumer wiring
- Order detail UI page

### Phase 6
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx`
- New verify-payment endpoint + service
- Payment Method settings UI
- `web-admin/lib/validations/new-order-payment-schemas.ts` (B7)

---

## What the USER should do before / during / after

### Before /clear (you are here now)
1. `git push` if you want a remote backup of the Round 2 work.
2. Run /clear.

### When you come back
1. Reopen Claude Code in `f:\jhapp\cleanmatex`.
2. Paste the single resume prompt at the top of this doc.
3. The new Claude session will:
   - Read this doc
   - Load the 5 skills
   - Run Step 0 discovery
   - Report findings and either proceed (if clean) or ask one targeted question
4. Sit back; Claude will run Phase 2 Steps 0–7 with STOPs at every migration write.

### During Phase 2 manual QA (Step 8)
- Test mixed CASH + WALLET on a live order. Should write a voucher line for each, debit wallet atomically, leave wallet untouched on failure.
- Test deliberate failure (e.g. wallet balance < amount). Expect: order does not commit, voucher does not exist, wallet balance unchanged.
- Test idempotency replay (same key, same body) — should return the same order, no duplicate ledger debits.
- Capture verdicts. If anything fails, give Claude the failure list and it will write a Phase 2 Round 2 RESUME doc.

### After each phase closes
- Approve the commit message format Claude proposes.
- Push to origin if you want a remote checkpoint.
- /clear if context is over 70% (saves tokens for next phase).

---

## Quick sanity test before resuming

If you want to verify nothing is broken before kicking Claude off:

```powershell
cd f:\jhapp\cleanmatex
git status                    # should be clean
git log -1 --oneline          # should show 47543ab or later
cd web-admin
npx tsc --noEmit              # 0 errors expected
npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts
# 41/41 expected
```

If any of these fail, something has changed since the handoff and a hand-investigation is needed before resuming.

---

## Final note

This is a multi-phase, multi-session effort. Each phase is sized for 1–2 sessions max. The PRD is the source of truth for behavior; this doc is the source of truth for sequencing and constraints. Do not skip the per-phase exit checklist — it is the only thing standing between a clean Phase N→N+1 transition and a Round 2-style stabilization mess.
