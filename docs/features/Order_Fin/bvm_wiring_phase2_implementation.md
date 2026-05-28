# BVM Wiring Phase 2 — Feature Implementation Documentation

**Feature:** Business Voucher Module — Stored-Value Consolidation (Phase 2)
**Date:** 2026-05-28
**Status:** Complete — Steps 0–4 + 6 shipped; Step 5 deferred to Phase 2.1; Step 8 = user manual QA.
**PRD:** `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md`
**Entry plan:** `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md`
**Status doc:** `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` (§ "2026-05-28 — Phase 2 (Stored-Value Consolidation)")
**Changelog:** `docs/features/Order_Fin/CHANGELOG.md`
**Predecessor:** BVM Phase 1B (`bvm_wiring_phase1b_implementation.md`) + 2026-05-28 Round 2 Stabilization
**Resume context:** `C:\Users\JHNLP\.claude\plans\bvm-phase-2-onward-RESUME.md`

---

## Overview

Phase 1B (2026-05-23) introduced voucher creation + post + wire as a step inside `submit-order`, but stored-value debits still lived in `settleOrder()` — a separate Prisma transaction. If `settleOrder()` failed after voucher posting committed, the system would show a voucher line for a credit application whose underlying balance was never debited.

Phase 2 closes that gap. The submit-order flow now runs:

```
TX1: order + (AR invoice if credit) + promo + gift card (Phase 1B leftover)
TX2: createBizVoucher + addVoucherLine × N + applyStoredValueDebitTx × N + postAndWireBizVoucher  ← ONE atomic tx
TX3: settleOrder({ wiringMode: true })  — order snapshot + outbox only (no stored-value debits)
TX4: AR allocation (only when result.invoiceId is set; unchanged)
```

**Atomicity invariant (new):** every stored-value balance debit (wallet, advance, credit-note, loyalty points, gift card) commits in the same transaction as the voucher header + lines + post & wire. A throw anywhere inside TX2 rolls back every prior write.

**Lock-order invariant (new):** concurrent submits touching the same customer's balances acquire `SELECT … FOR UPDATE` locks in a fixed sequence (`GIFT_CARD → WALLET → CUSTOMER_ADVANCE → CUSTOMER_CREDIT → LOYALTY_CREDIT`) regardless of the order the legs were submitted in. Deadlock-free by construction.

---

## Permissions

**No new permissions.** Phase 2 only changes internal transaction shape; the surface permission gate on `POST /api/v1/orders/submit-order` (which is `orders:create`, established in Phase 1B) is unchanged.

---

## Navigation Tree

**No new navigation entries.** Receipt Vouchers created by submit-order continue to appear under the existing Vouchers page at `/dashboard/internal_fin/vouchers` (filterable by `source_module = 'ORDERS'`).

---

## Tenant Settings

**No new tenant settings.**

---

## System Settings

**No new system settings.**

---

## Feature Flags

**No new feature flags.** The consolidated voucher transaction is always active for `submit-order`; no rollout toggle. The previous `wiringMode` parameter on `settleOrder()` is retained for the existing `__tests__/services/settlement.service.test.ts` suite (which exercises the wiringMode:false path) and as defense in depth.

---

## Plan Limits & Constraints

**None.**

---

## i18n Keys

**No new translation keys.** Phase 2 is a backend-only refactor; no user-facing copy was added. Existing error surfaces (`INSUFFICIENT_WALLET_BALANCE`, `IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_RESOURCE`, etc.) are emitted unchanged via the existing error translation pipeline.

---

## API Routes

**No new routes.** Behavior of the existing route changed:

### `POST /api/v1/orders/submit-order` (behavior change, no contract change)

Same request/response schema as Phase 1B. The behavioral guarantees added by Phase 2:

| Guarantee | Before (Phase 1B) | After (Phase 2) |
|---|---|---|
| Wallet/advance/credit-note/loyalty debit fails mid-flow | Voucher header + lines committed; balance NOT debited | Whole TX2 rolls back; no voucher, no payment fact row |
| Idempotency replay of a stored-value debit | Could double-debit (no skip-on-existing on advance/CN; wallet wrote key but didn't check) | Every `redeem*Tx` returns the cached ledger row when the same key replays |
| Concurrent submits touching the same customer | Lock order depended on caller leg ordering — could deadlock | Locks acquired in canonical `STORED_VALUE_LOCK_ORDER` |
| Settlement double-write | `settleOrder` unconditionally re-called `redeem*Tx` — saved only by lucky failure ordering | `settleOrder` short-circuits the credit-application branch when `wiringMode=true` |

Error codes (unchanged from Phase 1B but worth re-listing as the matrix of throwable codes inside TX2):
- `INSUFFICIENT_*_BALANCE` — balance check inside `redeem*Tx` after `SELECT FOR UPDATE`.
- `IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_RESOURCE` — voucher header guard (B6 Fix B, Phase 1B Round 2).
- `CREDIT_APPLICATION_TYPE_REQUIRED` — planner contract violation.
- `CUSTOMER_ID_REQUIRED_FOR_CREDIT_APPLICATION` — **new** defense-in-depth throw in the orchestrator before dispatching to `applyStoredValueDebitTx`.
- `GIFT_CARD_NOT_FOUND` / `GIFT_CARD_NOT_REDEEMABLE` / `GIFT_CARD_EXPIRED` / `CURRENCY_MISMATCH` / `MAX_REDEMPTIONS_REACHED` — unchanged from `redeemGiftCardTx`.

---

## External Services

**None added or modified.**

---

## Database & Schema

### Migration

`supabase/migrations/0329_phase2_stored_value_voucher_fks.sql`

**Tables modified:**

| Table | Change |
|---|---|
| `org_loyalty_txn_dtl` | Added `fin_voucher_id UUID NULL` + `fin_voucher_trx_line_id UUID NULL` (the other 4 stored-value tables had them from prior migrations) |

**FK constraints added (10):**

For each of `org_gift_card_txn_dtl`, `org_wallet_txn_dtl`, `org_advance_txn_dtl`, `org_credit_note_txn_dtl`, `org_loyalty_txn_dtl`:
- `fk_*_fin_voucher` — `(tenant_org_id, fin_voucher_id) → org_fin_vouchers_mst(tenant_org_id, id) ON DELETE SET NULL`
- `fk_*_voucher_line` — `(tenant_org_id, fin_voucher_trx_line_id) → org_fin_voucher_trx_lines_dtl(tenant_org_id, id) ON DELETE SET NULL`

Composite FKs (tenant_org_id + id) — not single-column — because both targets already have composite PKs. Defense in depth: even if RLS or middleware fail, the DB rejects cross-tenant linkage.

`ON DELETE SET NULL` — voiding a voucher preserves the redemption audit trail.

**Indexes added (10):**

For each of the 5 stored-value tables, two partial indexes (`WHERE col IS NOT NULL`):
- `idx_*_fin_voucher` — `(tenant_org_id, fin_voucher_id)`
- `idx_*_voucher_line` — `(tenant_org_id, fin_voucher_trx_line_id)`

Partial because pre-Phase-2 rows all have NULL link values; indexing them would bloat without benefit.

**RLS policies:** none added. The 5 stored-value tables already have tenant-isolation RLS from prior migrations; Phase 2 does not change that surface.

**Backfill:** none required. Pre-flight discovery query (read-only via Supabase MCP) confirmed zero rows had non-null link values before the migration ran.

### Prisma schema

`web-admin/prisma/schema.prisma`:
- `org_loyalty_txn_dtl` model gained `fin_voucher_id`, `fin_voucher_trx_line_id`, and the two matching `@@index(..., map: ...)` aliases. The other 4 models already had the equivalent columns from `db pull` after earlier migrations.

---

## Constants & Types

`web-admin/lib/constants/order-financial.ts` — added:

```typescript
export const STORED_VALUE_LOCK_ORDER = [
  CREDIT_APPLICATION_TYPES.GIFT_CARD,
  CREDIT_APPLICATION_TYPES.WALLET,
  CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE,
  CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT,
  CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT,
] as const satisfies readonly CreditApplicationType[];

export const STORED_VALUE_LOCK_RANK: Readonly<Record<CreditApplicationType, number>>;
```

`web-admin/lib/services/order-submit-orchestrator.service.ts` — added:

```typescript
const STORED_VALUE_CODE: Record<CreditApplicationType, 'gc'|'w'|'a'|'cn'|'lp'> = { ... };
```

Used to build the sub-idempotency key format `${orderId}_sv_${code}_${legIndex}`. Codes intentionally short to keep `*_txn_dtl` unique-index entries lean.

**No new types added.** All Phase 2 work reuses the existing `CreditApplicationType`, `PrismaTransactionClient`, and voucher-service input types.

**DB-mirror rule check:** `STORED_VALUE_LOCK_ORDER` values are constructed from `CREDIT_APPLICATION_TYPES` constants — no string drift possible.

---

## Service contract changes

All five `redeem*Tx` services accept the same new shape (additive, non-breaking):

```typescript
params: {
  // ...existing fields...
  idempotencyKey?: string;
  voucherId?: string;
  voucherLineId?: string;
}
```

Behavior contract every `redeem*Tx` now honors:

1. **Skip-on-existing.** When `idempotencyKey` matches an existing ledger row's `idempotency_key`, return that row without taking `SELECT FOR UPDATE` and without writing to the ledger. Previously only `redeemGiftCardTx` did this; wallet/loyalty wrote the key but didn't check; advance/credit-note had no key at all.
2. **Voucher backlink persistence.** When `voucherId` / `voucherLineId` are supplied, they land on the ledger row insert (`fin_voucher_id`, `fin_voucher_trx_line_id` columns from migration 0329).

`createBizVoucher`, `addVoucherLine`, `postAndWireBizVoucher` accept `tx?: PrismaTransactionClient`. When supplied, the function runs directly on the caller's transaction — no nested `$transaction`, no nested `withTenantContext`. Existing call sites omit `tx` and behavior is unchanged.

`applyStoredValueDebitTx` (now `export`ed from `order-credit-application.service.ts`) forwards `voucherId`/`voucherLineId` to every dispatch branch and writes them onto the `org_order_credit_apps_dtl` row it creates.

---

## Critical bug prevented in Step 4

`order-settlement.service.ts`: the `CREDIT_APPLICATION` branch inside `settleOrder()` now short-circuits with `if (wiringMode) continue;` **before** any `redeem*Tx` call. Without this guard, Step 3d's orchestrator-tx consolidation would have introduced a silent **double-debit**:

- TX2 (orchestrator voucher tx) debits wallet with `${orderId}_sv_w_${legIndex}` key.
- TX3 (`settleOrder`) unconditionally called `redeemWalletTx(tx, {...})` **with no idempotency key** — the second debit would succeed (if balance allowed) and silently corrupt the ledger, or fail with `INSUFFICIENT_BALANCE` and roll back TX3 while TX2 stayed committed.

The fix moves the entire CREDIT_APPLICATION branch under a `wiringMode=true` early-continue. The orchestrator's TX2 now owns every stored-value debit + the `org_order_credit_apps_dtl` fact row; `settleOrder` only updates the order snapshot.

---

## Legacy retirement

`app/api/v1/orders/_legacy_create-with-payment/` directory deleted. The folder was a Next.js private folder (underscore prefix → not served as a route), but it was still imported by ESLint and grep-able from docs. Phase 2 retires it entirely.

`eslint.config.mjs` keeps the `no-restricted-imports` rule against `**/api/v1/orders/create-with-payment/**` + `**/api/v1/orders/_legacy_create-with-payment/**` with an updated message ("retired") so any future revival is caught at lint time.

---

## Environment Variables

**None added.**

---

## Dependencies

**None added.** No new npm packages.

---

## Logging

**No new log events or categories.** The existing voucher posting + wiring outbox event (`VOUCHER_POSTED_AND_WIRED`) and the `ORDER_COMPLETED` event from `settleOrder` continue to fire unchanged. Stored-value debits don't emit their own outbox events at present (covered by the parent voucher event).

---

## Metrics

**None added.**

---

## Testing

### Phase 2 contract tests (new, +8 cases)

`__tests__/services/stored-value.service.test.ts`:
- `redeemWalletTx` — idempotency-skip returns cached row, no debit, no `SELECT FOR UPDATE`.
- `redeemWalletTx` — voucher backlink fields appear on the `.create()` payload.
- `redeemAdvanceTx` — idempotency-skip (new behavior).
- `redeemAdvanceTx` — voucher backlink persistence.
- `redeemCreditNoteTx` — idempotency-skip (new behavior).
- `redeemCreditNoteTx` — voucher backlink persistence.

`__tests__/services/loyalty.service.test.ts`:
- `redeemPointsTx` — idempotency-skip returns cached row.
- `redeemPointsTx` — voucher backlink persistence.

`__tests__/services/order-settlement-planner.service.test.ts` (added in Step 2, +2 cases):
- `creditApplicationLegs` are sorted into `STORED_VALUE_LOCK_ORDER` regardless of caller input order.
- Stable sort within the same credit type preserves caller `legIndex`.

### Phase 2 jest sweep
```
npx jest __tests__/utils/money.test.ts \
         __tests__/utils/idempotency.test.ts \
         __tests__/services/order-settlement-planner.service.test.ts \
         __tests__/services/discount-service.test.ts \
         __tests__/services/stored-value.service.test.ts \
         __tests__/services/loyalty.service.test.ts
```
→ **69/69 pass**.

### Acceptance scenarios → coverage map

| Scenario (from `BVM_PHASE_2_ENTRY_PLAN.md`) | Guaranteed by |
|---|---|
| 1. Mixed CASH + WALLET atomic commit | Step 3d (one `prisma.$transaction`) + Step 2 planner sort |
| 2. Mid-redemption failure rollback | Step 3d (Prisma rolls back on any throw inside the tx) |
| 3. Idempotency replay = no double-debit | Step 3c idempotency-skip tests above |
| 4. Lock order regardless of caller leg order | Step 2 planner sort test |

### Manual QA scenarios (Step 8 — user)

The 4 scenarios above need to be exercised against the live web-admin against a real DB. Capture verdicts and add a Round 2 RESUME doc if any fail (template at `C:\Users\JHNLP\.claude\plans\bvm-phase-2-onward-RESUME.md`).

---

## Files changed (full list)

### Source

- `web-admin/lib/constants/order-financial.ts` — `STORED_VALUE_LOCK_ORDER`, `STORED_VALUE_LOCK_RANK`
- `web-admin/lib/services/order-settlement-planner.service.ts` — leg sort
- `web-admin/lib/services/order-settlement.service.ts` — wiringMode short-circuit (critical fix)
- `web-admin/lib/services/order-submit-orchestrator.service.ts` — consolidated voucher tx + `STORED_VALUE_CODE` map
- `web-admin/lib/services/voucher-biz.service.ts` — optional `tx` parameter
- `web-admin/lib/services/voucher-line.service.ts` — optional `tx` parameter
- `web-admin/lib/services/voucher-wiring.service.ts` — optional `tx` parameter
- `web-admin/lib/services/stored-value.service.ts` — uniform contract on 3 redeem*Tx
- `web-admin/lib/services/loyalty.service.ts` — `redeemPointsTx` contract extended
- `web-admin/lib/services/gift-card-service.ts` — `redeemGiftCardTx` voucher backlink params
- `web-admin/lib/services/order-credit-application.service.ts` — `applyStoredValueDebitTx` exported + forwards backlinks
- `web-admin/prisma/schema.prisma` — `org_loyalty_txn_dtl` model
- `web-admin/eslint.config.mjs` — legacy-rule message updated

### Tests

- `web-admin/__tests__/services/order-settlement-planner.service.test.ts` — +2
- `web-admin/__tests__/services/stored-value.service.test.ts` — +6
- `web-admin/__tests__/services/loyalty.service.test.ts` — mockTx extended + 2

### Docs

- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` — Phase 2 section appended
- `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` — status flipped to Done + per-step status table
- `docs/features/Order_Fin/CHANGELOG.md` — Phase 2 entry prepended
- `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md` — this file

### Migrations

- `supabase/migrations/0329_phase2_stored_value_voucher_fks.sql`

### Files deleted

- `web-admin/app/api/v1/orders/_legacy_create-with-payment/` (folder + `route.ts`)

---

## Deferred to Phase 2.1

**Step 5 — `input.giftCardId` as a voucher line.** The gift card amount is currently applied as a pre-discount on the order total (it shrinks `serverTotals.finalTotal` before the planner runs). Adding a voucher line for it would make `voucher.total_amount ≠ sum(line_amounts)` and break `validateVoucherForPosting`. A correct fix needs either (a) folding the gift-card amount into `plan.immediateSettlementAmount` (calculation-service refactor) or (b) relaxing the voucher posting invariant. Phase 2's atomicity acceptance criteria 1–4 are all satisfied without this change.

**Voucher status triple-column collapse.** Tracked in Phase 1B / Round 2 docs; depends on confirming no readers use the legacy `status` column. Not blocked by Phase 2.

**Verify-payment endpoint** (BANK_TRANSFER / CHECK confirmation flow), Payment Modal v4 (WALLET + CHECK + HYPERPAY UI), Payment Method settings UI (D9 toggles + tenant `currency_code`). All UI debt items tracked in `BVM_PHASE_2_ENTRY_PLAN.md` § "UI debt".

---

## Implementation Status

- [x] Database schema (migration 0329)
- [x] Constants & types (`STORED_VALUE_LOCK_ORDER`, `STORED_VALUE_CODE`)
- [x] Backend service contracts (5 redeem*Tx, 3 voucher services, applyStoredValueDebitTx)
- [x] Orchestrator consolidation
- [x] Critical bug fix (`wiringMode` short-circuit in settleOrder)
- [x] Legacy route retired
- [x] Contract tests (+8)
- [x] Documentation (this file + status + changelog + entry plan)
- [ ] Manual QA (Step 8 — user)
