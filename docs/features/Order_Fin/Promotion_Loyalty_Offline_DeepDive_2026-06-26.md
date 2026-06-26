# Deep-Dive — Promotion / Loyalty Engine + Mobile/Offline POS

**Date:** 2026-06-26
**Scope:** the two exploratory ❓ areas carried out of the Order-Fin validation report
(`Opus_Validation_Report_18_06_2026`) D-12 third pass: promotion/loyalty engine
correctness, and mobile/offline POS financial safety.
**Method:** read-only correctness review (same approach as D-12 §4); one safe code-only
fix applied (LOY-1); everything else documented with severity + recommendation.

---

## 1. Promotions

There are **two** promo modules. This is the headline finding.

| Module | Role | State |
|---|---|---|
| `lib/services/discount-service.ts` | **LIVE** order-checkout path | Hardened — keep |
| `lib/services/promotion-engine.service.ts` | Marketing-UI CRUD + a duplicate validate/apply | Mixed — `applyPromotionTx` is dead, weaker |

### Live path — `discount-service.ts` ✅ sound
- `applyPromoCodeTx` (the path order submit uses): `SELECT … FOR UPDATE` on the promo row,
  then **re-checks `current_uses >= max_uses` inside the lock** (line ~275) before
  incrementing — so the `max_uses` cap is **not** TOCTOU-racy. ✓
- `reversePromoUsageTx`: voids usage rows on order cancel, aggregates per-promo to issue
  exactly one decrement per promo, locks each promo row FOR UPDATE. Correct unwind. ✓
- Tenant scoping explicit on every query. ✓

### Findings

**PR-1 — Duplicate promo modules / dead weaker apply (🟡 Medium, maintainability) — ✅ FIXED (2026-06-26).**
`promotion-engine.service.ts`'s `applyPromotionTx` had **no live callers** and was the
**weaker** implementation (no in-lock cap re-check, no `idempotency_key`).
- **Fix:** `applyPromotionTx` now **delegates** to `discount-service.applyPromoCodeTx`
  (`promotionId→promoCodeId`, `tenantId→tenantOrgId`, `orderTotal→orderTotalBefore`) and is
  tagged `@deprecated` — the two can no longer drift, and wiring it yields the hardened path.
  Its test asserts the delegation contract; `applyPromoCodeTx` internals stay covered by
  `discount-service.test.ts`.
- **Validate duplication — ✅ FULLY MERGED (2026-06-26).** Extracted one canonical
  `evaluatePromoCode(params)` in `discount-service.ts` (the authoritative module); **both**
  `validatePromoCode`s are now thin adapters over it (checkout → `ValidatePromoCodeResult`,
  marketing → `PromoValidation`), so the admin preview can never disagree with what checkout
  accepts. The merge also fixed three latent bugs surfaced during the work:
  1. **Marketing preview returned discount = 0 for percentage promos** — it compared the
     lower-case `discount_type` (real DB storage) to the upper-case `PROMO_TYPES.PERCENTAGE`.
     The unified discount calc is now **case-insensitive**.
  2. **Max-order rejection was mislabelled `MIN_ORDER_NOT_MET`** — now a proper
     `MAX_ORDER_EXCEEDED` code (added to the `ValidatePromoCodeResult` union).
  3. **Per-customer usage cap counted voided usages** — now excludes `voided_at` rows.
  Plus: the marketing path now applies the same strict liveness filter
  (`is_active AND is_enabled AND rec_status=1`), upper-cases the code on lookup, and uses the
  atomic `current_uses` counter for the global cap. `createPromotion` now stores `promo_code`
  upper-cased and `discount_type` lower-cased to match the lookup/column conventions. 16-case
  `evaluatePromoCode` test suite added.

**PR-2 — `idempotency_key` column unleveraged on promo apply (🔵 Low) — ✅ FIXED (2026-06-26).**
`discount-service.applyPromoCodeTx` now derives `idempotency_key = "${orderId}:${promoCodeId}"`,
runs an idempotency-skip `findFirst` **after** the FOR UPDATE lock (concurrent applies for the
same order serialise → the second skips, no double increment) and writes the key on create, so
`uq_promo_usage_idempotency (tenant_org_id, idempotency_key)` (mig `0288`) is now the hard DB
backstop instead of unused. No migration; regression test added.

---

## 2. Loyalty — `lib/services/loyalty.service.ts`

DB backstops (migration `0287`): `uq_loyalty_txn_idempotency (tenant_org_id, idempotency_key)`,
`uq_loyalty_acct (tenant_org_id, customer_id)`, `uq_loyalty_per_tenant (tenant_org_id)`.

### Reviewed

- **`redeemPointsTx` ✅ sound** — idempotency-skip (returns the cached txn on key hit),
  `SELECT … FOR UPDATE` on the account, insufficient-balance guard, voucher backlink. Exemplary.
- **`adjustPointsTx` — ✅ FIXED (2026-06-26).** Was `idempotency_key = adj-<acct>-<Date.now()>`
  — two adjustments in the same millisecond could collide on `uq_loyalty_txn_idempotency`. Now
  takes an optional `idempotencyKey` (caller request-id → graceful replay skip) and, when
  omitted, generates `adj-<acct>-<crypto.randomUUID()>` so distinct adjustments never collide.
  FOR UPDATE + negative-balance guard unchanged.

### Fixed

**LOY-1 — `processEarnPoints` lacked the graceful idempotency-skip (🟡 Medium) — FIXED.**
The earn path (outbox-driven, **at-least-once** delivery) wrote `idempotency_key` but did
**not** check for an existing row first — unlike `redeemPointsTx`. The DB unique already
prevented a double-credit, but a re-delivered `LOYALTY_EARN` event would throw a raw
unique-violation that rolls back the worker tx → the event never gets marked processed →
**retry loop / potential outbox wedge**. Added the same top-of-fn `findFirst` skip
`redeemPointsTx` uses (returns the existing row, lets the worker complete). Code-only, no
migration. Regression tests added in `__tests__/services/loyalty.service.test.ts`
(skip-returns-cached / first-delivery-credits) — suite **14/14**.

---

## 3. Gift cards — `lib/services/gift-card-service.ts` ✅ sound (confirmed)

Already shipped + reviewed (Promotions & Gift Cards program, 2026-05-07). Spot-confirmed:
every stored-value write is inside a transaction with `SELECT … FOR UPDATE` on the card row
**and** an `idempotency_key` skip on both redeem and credit (lines ~692, ~860). No change.

---

## 4. Mobile / Offline POS — **does not exist** (by design)

**Finding:** there is **no offline POS / offline financial-write capability** in this codebase.
- The only service worker, `public/sw.js`, handles **VAPID push notifications only** — no
  cache-first routing, no background-sync, no IndexedDB write queue.
- `src/ui/feedback/utils/message-queue.ts` is an in-memory **toast** queue, not a financial
  outbox.
- All order/payment/settlement writes are **synchronous server-authoritative** Prisma
  transactions behind Next.js routes/actions. A client with no network cannot create or
  settle an order.

**Conclusion:** nothing to fix — the current model is online-only and safe. This closes the
report's ❓ item: the concern was "are the financial flows offline-safe?"; the answer is
"there is no offline flow, so there is no offline-safety gap." Mobile usage today is the
responsive web UI against the live server.

**If an offline POS is built later** (future program), it must address — none of which exist yet:
1. **Idempotent replay** of queued sales/collections (client-generated per-event keys; the
   server already supports this via `withIdempotency` + the per-effect unique indexes).
2. **Conflict resolution** for stock, promo `max_uses`, loyalty balances captured offline
   (server is the authority; queued ops must re-validate caps on sync, not trust client state).
3. **Cash-drawer reconciliation** across an offline window (sequence/Z-report integrity).
4. **Document numbering** offline (server `fn_next_fin_doc_no` is authoritative — cannot mint
   final REF-/ARI- numbers offline; use provisional client refs reconciled on sync).

---

## Summary

| Item | Severity | Status |
|---|---|---|
| LOY-1 — earn idempotency-skip | 🟡 Medium | ✅ **Fixed** (code + tests) |
| PR-1 — dead weaker `applyPromotionTx` | 🟡 Medium | ✅ **Fixed** — delegates to `applyPromoCodeTx` + `@deprecated`; validators cross-documented |
| PR-2 — unleveraged promo `idempotency_key` | 🔵 Low | ✅ **Fixed** — key written + post-lock skip in `applyPromoCodeTx` |
| `adjustPointsTx` non-deterministic key | 🔵 Low | ✅ **Fixed** — optional caller key + `randomUUID()` fallback |
| Live promo apply / reverse, redeem, gift cards | — | ✅ Reviewed sound |
| Mobile/offline POS | — | ✅ Closed — does not exist; online-only is safe; future-build requirements listed |

**No migration** for any fix. Code fixes: LOY-1, PR-1 (incl. **full `validatePromoCode` merge**
into one canonical `evaluatePromoCode` + 3 latent bug fixes: percentage-casing, max-order
mislabel, voided-usage count), PR-2, `adjustPointsTx` — all no-migration, all with tests
(promo/loyalty/discount suites + integration green; tsc 0, eslint 0). Mobile/offline POS is a
future program. No open items remain in this area.
