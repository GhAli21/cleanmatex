# RESUME — BVM Phase 1B Stabilization Round 2

**Created:** 2026-05-28 (mid-session, before user /clear)
**Predecessor plan:** `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose.md` (Stages 0–13 all complete; build green; 34 tests pass)
**Resume trigger:** User ran Step 8 manual smoke tests; surfaced 5 new bugs (B5–B13). Investigation against remote DB confirmed root causes; fixes not yet applied.

---

## How to resume this session

1. Reopen Claude Code in `f:\jhapp\cleanmatex`.
2. Tell Claude:
   > Read `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose-RESUME.md` and continue from Section "Pending fixes". Use the Supabase remote MCP (already configured in `.mcp.json` with access token — no OAuth needed).
3. Claude will read this doc, load the Supabase MCP tools via ToolSearch, then start applying fixes in the priority order below.

---

## Test data — manual QA reference

**Tenant:** `11111111-1111-1111-1111-111111111111`
**Branch:** `597139c9-633c-43f5-b25f-9012a70893b4`

| Scenario | Order ID | Verdict |
|---|---|---|
| 1 CASH | `c8fd03df-f8a2-4b1d-89ee-63306aa35cad` (ORD-20260528-0001) | Voucher posted+wired BUT cash drawer movement MISSING, several fields null |
| 2 CARD | (not captured) | Mostly OK |
| 3 PAY_ON_COLLECTION | (not captured) | OK |
| 4 Multi-leg CASH+WALLET | n/a | WALLET not in Payment Modal v4 UI yet |
| 5 Idempotency retry | n/a | User didn't test directly |
| 6 CHECK payment | (couldn't submit) | UI blocks button silently |
| 7 BANK_TRANSFER | `433d736f...` (attempt 1, 500) + `d935ddd5...` (attempt 2) | **CRITICAL — see B6 below** |
| 8 GATEWAY (HyperPay) | n/a | UI blocks button silently |
| 9 is_show_in_order_pos filter | n/a | OK |
| 10 allow_status_override | n/a | Override flag NOT honored (by design for Phase 1B — see B7) |

---

## Bugs found (root cause confirmed)

### 🔴 B5 — Cash drawer wiring skipped for CASH (Scenario 1)

**Symptom:** `org_cash_drawer_movements_dtl` has zero rows for order `c8fd03df...`. `org_order_payments_dtl.cash_drawer_session_id = null`. Voucher line `org_payment_method_id = null`.

**Root cause confirmed:**
```
SELECT effective_requires_cash_drawer FROM org_payment_methods_cf JOIN sys_payment_method_cd
  WHERE payment_method_code = 'CASH'
→ effective = FALSE
  (org column = FALSE; sys column = TRUE)
```

`org_payment_methods_cf.requires_cash_drawer` is `BOOLEAN NOT NULL DEFAULT FALSE`. Migration 0325 did `UPDATE ... SET requires_cash_drawer = COALESCE(o.requires_cash_drawer, s.requires_cash_drawer)` — since the org column is NOT NULL (defaulted to FALSE on row creation), the COALESCE is a no-op. The org row is **stuck at FALSE** for all tenants. Same problem for `requires_reference`.

Planner reads `effective_requires_cash_drawer = FALSE` → skips `cashDrawerSessionId` → wiring handler skips drawer.

**ALSO confirmed:** voucher line has `org_payment_method_id = null` even though the planner builds `option.id = row.id`. This means **`listEffectivePaymentMethodConfigs` returns a row whose `id` is null OR the addVoucherLine call drops it**. Need to trace `payment-config.service.ts` (around line 164 `mapBaseRow` / line 211 `mergeBranchOverrides`).

**Tendered amount null:** `paymentLegSchema` from frontend doesn't carry `cashTendered`. Payment Modal V4 collects an amount but doesn't pass tendered separately. Phase 2 concern.

---

### 🔴 B6 — Idempotency sub-key bleed across orders (Scenario 7) — DATA INTEGRITY BUG

**Symptom:** Two orders sharing the same root idempotency key `ab70272b-c2c9-405d-aa77-53b954bc3f94`:

```
Order 433d736f (attempt 1, 500 error):
  payment_status = 'partial' (lowercase legacy)
  total_paid_amount = null
  outstanding_amount = null
  idempotency_key = null
  → 0 rows in org_order_payments_dtl / taxes / charges / discounts

Voucher RV-2026-000012 (d193858e):
  source_ref_id = order_id = 433d736f (HEADER tied to attempt 1)
  voucher_status = POSTED, status = 'draft', posting_status = 'NOT_POSTED'
  paid_amount = 3.193

Voucher line 1890cec4:
  order_id = d935ddd5 (LINE tied to attempt 2 !!!)
  wiring_status = WIRED
  order_payment_id = aecc3898 (lives in d935ddd5)

Order d935ddd5 (attempt 2, succeeded):
  payment_status = 'UNPAID', total_paid_amount = 0, outstanding = 3.193
  idempotency_key = 'ab70272b...'
  → 1 row in org_order_payments_dtl with fin_voucher_id = d193858e (pointing to the OTHER order's voucher)
  → 2 rows in org_order_taxes_dtl
```

**Cross-table verification:** A grep across the DB found this voucher has `header.source_ref_id != line.order_id` — the **only** voucher in the system with this pattern, confirming this is a new failure mode introduced by Stage 8's idempotency change OR existed before but never surfaced.

**Cause chain confirmed:**

1. **Attempt 1 (BANK_TRANSFER, no reference):**
   - Pre-flight planner did NOT throw `PAYMENT_REFERENCE_REQUIRED` because B5 root cause also affects `requires_reference` (BANK_TRANSFER: org=FALSE, sys=TRUE → effective FALSE). Validator skipped the throw.
   - tx1 committed order 433d736f.
   - createBizVoucher committed voucher header (its own internal $transaction).
   - Some failure between voucher creation and post → 500.
   - **Voucher header and its sub-idempotency cache survived the failure** (in `org_idempotency_keys` and on the voucher row itself).

2. **Attempt 2 (same root idempotency key):**
   - The route's check found `org_orders_mst.idempotency_key = null` for 433d736f (because attempt 1 failed before the route stored the key) → fell through to legacy match-by-key path → also found nothing → **created a new order d935ddd5**.
   - `org_idempotency_keys` table had no entry for the root key yet either (Stage 8 stores the hash row only AFTER orchestrator success).
   - **BUT** `createBizVoucher` is called with sub-key `${input.idempotencyKey}_vch` — and that key was already stored in attempt 1 (on the voucher row, `uq_fin_vouchers_idempotency`). It returned the EXISTING voucher d193858e (still pointing to 433d736f).
   - `addVoucherLine` with `_vl_rp_0` sub-key — line did NOT exist yet (attempt 1 failed before line insert), so it inserted a fresh line, populated with the NEW order d935ddd5.
   - `postAndWireBizVoucher` with `_vch_post` sub-key — no prior cache, ran fresh, wired the line to d935ddd5.
   - settleOrder ran for d935ddd5.

**The fundamental bug:** voucher sub-idempotency keys (`_vch`, `_vch_post`, `_vl_rp_N`) **survive across failed orchestrator runs** and get returned to a brand-new order on retry. The orchestrator never validates that the cached voucher header's `source_ref_id` matches the new `result.orderId`.

**Why d935ddd5 shows UNPAID despite a payment row existing:**
The payment row `aecc3898.payment_status = 'PENDING'` (gateway BANK_TRANSFER defaults to PENDING per D9 fallback). The recalc service excludes non-COMPLETED payments from `total_paid_amount`. So total_paid=0 is technically correct, but the UX is broken (user sees UNPAID after submitting a payment).

---

### 🟡 B7 — `allow_status_override` not honored (Scenario 10) — Phase 1B BY DESIGN

**Symptom:** User set `org_payment_methods_cf.CARD.allow_status_override = TRUE` (confirmed `org_allow_status_override = true` in DB). Submitted CARD payment with `paymentStatus: 'PENDING'` in request. Result: `payment_status = 'COMPLETED'` (override ignored).

**Root cause:** `lib/services/order-settlement-planner.service.ts:86-87`:
```typescript
// paymentStatus override: reserved for Phase 2 (no paymentStatus field on PaymentLeg yet)
const resolvedPaymentStatus = defaultCreationStatus;
```

This is **explicitly deferred to Phase 2** — the `paymentLegSchema` has no `paymentStatus` field, so even if the planner read an override, the request body can't carry one. **Not a bug — design choice carried over from Phase 1B.** Documented as a Phase 2 deliverable.

---

### 🟡 B8 — Voucher status triple-column inconsistency

**Confirmed across the DB:**
```
voucher_status | status   | posting_status | rows
DRAFT          | issued   | NOT_POSTED     | 21    ← lowercase 'issued' contradicts DRAFT
DRAFT          | draft    | NOT_POSTED     |  9    ← consistent
POSTED         | draft    | NOT_POSTED     |  6    ← BOTH legacy columns contradict POSTED
CANCELLED      | voided   | NOT_POSTED     |  3    ← lowercase 'voided' contradicts CANCELLED + NOT_POSTED
```

`org_fin_vouchers_mst` has THREE columns describing the same concept:
- `status` (legacy lowercase: draft / issued / voided)
- `voucher_status` (Phase 1A uppercase: DRAFT / POSTED / CANCELLED)
- `posting_status` (Phase 1A uppercase: NOT_POSTED / POSTED) — meant to track wiring posting, but always stays NOT_POSTED currently

`postAndWireBizVoucher` updates `voucher_status` to POSTED but **does not touch `status` or `posting_status`**. The legacy `status` column was the original; the new columns layered on top without removing the old.

**Fix shape:** Either (a) make `voucher-wiring.service.ts` synchronize all three columns on POST/CANCEL transitions, OR (b) decide one column is authoritative and add DB triggers + comments to deprecate the others. **Recommendation: (a)** for this round (low-risk), then plan a column-cleanup migration for Phase 2.

---

### 🟠 B9 — Frontend UI gaps (NOT scope for Phase 1B)

- Payment Modal v4 missing WALLET method (Scenario 4).
- Payment Modal v4 silently disables the submit button on CHECK without `checkNumber` (Scenario 6) — no validation message shown.
- Payment Modal v4 silently disables the submit button on HYPERPAY/gateway methods (Scenario 8) — no error.
- Payment Method settings UI missing the 4 nullable D9 columns (`allow_status_override`, `default_creation_status`, `is_user_id_required`, `allow_outside_integration`) (Scenario 10).
- Payment Method settings save requires `currency_code` — should be tenant-level not per-method (Scenario 10).

**All Phase 2 / dedicated UI feature work. Listed here as backlog.**

---

## Pending fixes (priority order)

### P1 — Data corrective migration (UNBLOCKS B5 + part of B6)

**Create:** `supabase/migrations/0326_fix_payment_method_config_drift.sql`

```sql
-- ============================================================
-- Migration: 0326 — Fix B5/B6: payment-method config drift
-- ============================================================
-- Problem: migration 0325 wrote
--   UPDATE org_payment_methods_cf SET requires_cash_drawer = COALESCE(org, sys)
-- but org column is NOT NULL DEFAULT FALSE, so COALESCE is a no-op
-- (the org column is never NULL). Result: every existing tenant row
-- has requires_cash_drawer = FALSE for CASH (should be TRUE) and
-- requires_reference = FALSE for BANK_TRANSFER/CHECK (should be TRUE).
--
-- Fix: forcibly set these BOOLEAN columns from the sys defaults wherever
-- the org row matches a payment_method_code that the sys table declares
-- to require the flag.

-- 1. Sync requires_cash_drawer from sys to org
UPDATE org_payment_methods_cf o
SET    requires_cash_drawer = s.requires_cash_drawer
FROM   sys_payment_method_cd s
WHERE  o.payment_method_code = s.payment_method_code
   AND o.requires_cash_drawer IS DISTINCT FROM s.requires_cash_drawer;

-- 2. Sync requires_reference from sys to org
UPDATE org_payment_methods_cf o
SET    requires_reference = s.requires_reference
FROM   sys_payment_method_cd s
WHERE  o.payment_method_code = s.payment_method_code
   AND o.requires_reference IS DISTINCT FROM s.requires_reference;

-- 3. Long-term fix: convert these columns to NULLABLE so COALESCE works
--    for future tenants without re-running this migration. Each tenant
--    can still override; NULL = inherit from sys.
ALTER TABLE org_payment_methods_cf
  ALTER COLUMN requires_cash_drawer DROP NOT NULL,
  ALTER COLUMN requires_cash_drawer DROP DEFAULT,
  ALTER COLUMN requires_reference   DROP NOT NULL,
  ALTER COLUMN requires_reference   DROP DEFAULT;
```

**Then:** update Prisma schema to mark both columns `Boolean?` (nullable), regenerate.

**STOP after writing the migration file. Wait for user to confirm safe application.**

### P2 — Fix voucher line `org_payment_method_id` + tendered_amount mapping (B5 secondary)

Investigate `web-admin/lib/services/payment-config.service.ts` `mapBaseRow()` and `listEffectivePaymentMethodConfigs()` — verify the `id` field of `org_payment_methods_cf` is actually returned in the row. If yes, the orchestrator's pass-through is fine; if not, fix the mapper.

Then trace `addVoucherLine` (`web-admin/lib/services/voucher-line.service.ts`) — confirm it persists `org_payment_method_id` to `org_fin_voucher_trx_lines_dtl`. If yes, also confirm the wiring handler (`web-admin/lib/services/wiring/order-payment-wiring.handler.ts`) carries it to `org_order_payments_dtl`.

For `tendered_amount`: Payment Modal V4 doesn't collect tendered separately. **Defer to Payment Modal V4 enhancement** unless backend has a default-from-amount path we should add.

### P3 — Fix idempotency sub-key bleed (B6) — HIGH severity

**Two complementary fixes:**

**Fix A — Make sub-keys order-aware:** Change the orchestrator to compose sub-keys from `result.orderId` (not just `input.idempotencyKey`):

Currently in `order-submit-orchestrator.service.ts`:
- Voucher: `${input.idempotencyKey}_vch`
- Lines: `${input.idempotencyKey}_vl_rp_${legIndex}`
- Post: `${input.idempotencyKey}_vch_post`

Change to:
- Voucher: `${result.orderId}_vch`
- Lines: `${result.orderId}_vl_rp_${legIndex}`
- Post: `${result.orderId}_vch_post`

Because the route owns idempotency (D11), the orderId is unique per logical submit. If the route caches by root key, it returns the cached order; if a NEW orderId is generated (because attempt 1 didn't store the root key), the voucher sub-keys will be completely fresh, eliminating the cross-order bleed.

**Fix B — Defensive guard inside `createBizVoucher`:** When the idempotency key matches an existing voucher, verify the existing voucher's `source_ref_id` matches the new request's `source_ref_id`. If mismatch, throw `IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_RESOURCE` (409).

**Both fixes are needed** — Fix A prevents the bleed in the happy path; Fix B protects against any future caller that reuses keys incorrectly.

**Also fix:** Route's idempotency persistence must happen BEFORE orchestrator runs (not after), so failed attempts still block retries with the same key from producing new orders. Move `storeIdempotencyHash` to happen pre-orchestrator with a placeholder resource_id, then update with the real resource_id on success.

### P4 — Voucher status column synchronization (B8)

In `web-admin/lib/services/voucher-wiring.service.ts` (postAndWireBizVoucher), the existing UPDATE to org_fin_vouchers_mst sets `voucher_status`. Add the other two columns:

```typescript
await db.org_fin_vouchers_mst.update({
  where: { id: voucherId },
  data: {
    voucher_status:  VOUCHER_STATUS.POSTED,
    posting_status:  'POSTED',           // ← add
    status:          'issued',           // ← legacy lowercase: 'issued' = posted/finalized
    posted_at:       now,
    posted_by:       userId,
    paid_amount:     recalcTotal,
    outstanding_amount: 0,
  },
});
```

Same for cancellation: when `cancelBizVoucher` sets `voucher_status = CANCELLED`, also set `status = 'voided'`, `posting_status = 'CANCELLED'` (verify allowed values first).

**Historical data fix:** Add a one-off SQL in the same migration as P1 to reconcile the 30+ existing inconsistent rows.

### P5 — Documentation update

After P1-P4 land:
- Append to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` a new section "## 2026-05-28 — Round 2 Stabilization (post-manual-QA)" listing the 4 fixes.
- Update `bvm_wiring_phase1b_implementation.md` Step 8 with the QA verdict (8/10 pass, 2/10 fail — B5 + B6).
- Update `BVM_PHASE_2_ENTRY_PLAN.md`:
  - Move WALLET UI + HYPERPAY UI + status-override paymentStatus field + Settings UI D9 toggles into Phase 2 scope under "UI debt".
  - Add the voucher-status column cleanup migration as a Phase 2 schema task.

---

## Open questions for the resume

1. **B5 P1 migration approach:** Apply the corrective UPDATE + drop NOT NULL (recommended, single forward fix), OR only the UPDATE (faster but doesn't help future tenant onboarding)?
2. **B6 P3 sub-key design:** Use `result.orderId` (Fix A) AND add the defensive header check in createBizVoucher (Fix B), or just Fix A?
3. **B8 voucher status:** Sync all three columns on every transition (defensive), OR add a DB trigger that auto-syncs legacy `status` from `voucher_status` (cleaner long-term)?
4. **Pre-existing inconsistent voucher rows (30+):** Backfill as part of P1 migration, or leave historical and only fix new writes?
5. **Voucher 433d736f / d193858e cleanup:** Force-link the orphan voucher to order d935ddd5 (header update), OR void it and create a fresh one? OR leave as-is since it's test data?

---

## Files touched by the round-1 stabilization (do not re-touch unless fixing)

| File | What it has |
|---|---|
| `web-admin/lib/utils/money.ts` | NEW — Decimal helpers |
| `web-admin/lib/utils/idempotency.ts` | NEW — canonicalize + SHA-256 hash + store/find |
| `web-admin/lib/services/voucher-wiring.service.ts` | `recalcOrderSnapshotIfLinked()` helper; raw outbox → `emitEventTx` |
| `web-admin/lib/services/order-submit-orchestrator.service.ts` | `createInvoice` gated; AR allocation gated; isCompound; sumMoney |
| `web-admin/lib/services/order-settlement.service.ts` | check fields persistence; addMoney; throw on null credit_application_type |
| `web-admin/lib/services/order-settlement-planner.service.ts` | throw on null credit_application_type |
| `web-admin/lib/services/ar-invoice.service.ts` | defense-in-depth AR ledger guard; money helpers |
| `web-admin/lib/services/discount-service.ts` | `invoiceId?` optional |
| `web-admin/lib/services/permission-service-server.ts` | removed Jh65/Jh66 logs |
| `web-admin/lib/constants/order-financial.ts` | `OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED` |
| `web-admin/app/api/v1/orders/submit-order/route.ts` | SHA-256 idempotency conflict check |
| `web-admin/app/api/v1/finance/vouchers/[voucherId]/post/route.ts` | calls recalc helper |
| `web-admin/app/actions/finance/voucher-actions.ts` | calls recalc helper, revalidates order pages |
| `web-admin/app/api/v1/ar/invoices/route.ts` + `[id]/route.ts` | `invoices:read` |
| `web-admin/config/navigation.ts` | `invoices:read` |
| `web-admin/src/features/billing/access/billing-access.ts` | `invoices:read` (5 sites) |
| `web-admin/src/features/orders/access/orders-access.ts` | URL fix to /submit-order |
| `web-admin/src/features/orders/ui/payment-modal-v4.tsx` | variable hoisting fix |
| `web-admin/prisma/schema.prisma` | D9 columns on sys + org payment models |
| `web-admin/app/api/v1/orders/_legacy_create-with-payment/route.ts` | `@ts-expect-error` annotations |
| `web-admin/__tests__/utils/money.test.ts` | NEW — 13 tests |
| `web-admin/__tests__/utils/idempotency.test.ts` | NEW — 11 tests |
| `web-admin/__tests__/services/order-settlement-planner.service.test.ts` | NEW — 10 tests |
| `web-admin/__tests__/services/discount-service.test.ts` | stale mock fix |
| `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` | NEW ADR |
| `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md` | Phase 1B Stabilization Impact section |
| `docs/features/AR_Invoice/UI_FLOW_AND_SCREENS.md` | invoices:read |
| `docs/features/AR_Invoice/API_CONTRACTS.md` | invoices:read |
| `docs/features/AR_Invoice/CleanMateX_Full_AR_Invoice_Docs_Pack/01_FULL_AR_INVOICE_PRD.md` | invoices:read |
| `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` | NEW canonical status doc |
| `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` | NEW |
| `docs/features/Order_Fin/README.md` | cross-refs |
| `docs/features/Order_Fin/CHANGELOG.md` | 2026-05-28 entry |
| `docs/features/Order_Fin/bvm_wiring_phase1b_implementation.md` | stabilization addendum |

## MCP servers ready

`.mcp.json` already has `supabase_remote_with_token` configured with the access token. The resume session can run `mcp__supabase_remote_db__execute_sql` immediately after loading via ToolSearch — no OAuth needed.

## Build / test baseline at handoff

- `npx tsc --noEmit` — **0 errors**
- `npx jest __tests__/utils/ __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts` — **41/41 pass**
- `git status` — clean except for the brand assets and `.claude/settings.local.json` modified flag
- No new migrations pending application
