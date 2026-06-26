# Order Financial — Testing & Targeted Manual QA Guide

**Date:** 2026-06-26
**Scope:** validates the changes shipped in the 2026-06-25 → 2026-06-26 hardening pass
(F-R3 refund numbering, receipt-allocation dead-branch, F-09 audit columns, LOY-1 loyalty
earn, promo PR-1/PR-2, `adjustPointsTx`, the `validatePromoCode` merge + 3 latent bug fixes,
and the gateway-verify review).
**Audience:** QA / tester / reviewer doing pre-rollout smoke. Pairs with the GA process gates
in [Process_Gates_Guide.md](./Process_Gates_Guide.md) (finance sign-off + soak).

> This is a **focused** guide, not a full re-test of Order-Fin. It covers only the surfaces
> that actually changed. Untouched flows are covered by the automated suite (see Part A).

---

## Part A — Automated regression gate (run first)

Run from `web-admin/`. All must pass before manual QA.

| Step | Command | Expected |
|---|---|---|
| Unit/integration | `npm test` | **145 suites / 1482 tests** pass |
| DB-level | `npm run test:db-integration` | **7 suites / 24 tests** pass (needs local Supabase up) |
| Types | `npx tsc --noEmit` | **0 errors** |
| Lint | `npx eslint . --quiet` | **0** |
| i18n parity | `npm run check:i18n` | parity OK |
| Build | `npm run build` | Compiled successfully |

**Last run (2026-06-26):** all green.

> DB-integration needs a local stack (`supabase start`) with `DATABASE_URL` pointing at
> `127.0.0.1:54322`. Never run it against remote/prod.

---

## Part B — Targeted manual QA

Prerequisites: a tenant with at least one customer, an active promo (percentage + fixed),
an active loyalty program, and a branch with an open cash-drawer session. Use **staging**, not
production. Each case lists **steps → expected → verify (SQL/read-only)**. Tick the box on pass.

> Read-only SQL is for confirmation only. Do **not** mutate finance rows by hand.

### B-1. Refund numbering is concurrency-safe (F-R3, mig 0387)
**Changed:** `refund_no` is now minted by the atomic `fn_next_fin_doc_no(tenant,'REFUND')`
(row-locked) instead of `count(*)+1`.

- [ ] **Sequential refunds** — create two refunds on the same tenant (any order(s)).
  - **Expected:** numbers are `REF-NNNNNN`, strictly increasing, no duplicates, no gaps you didn't cause.
- [ ] **Verify counter:**
  ```sql
  SELECT doc_type_code, prefix, last_no FROM org_fin_doc_seq_mst
  WHERE doc_type_code = 'REFUND' AND tenant_org_id = '<tenant>';
  -- last_no should equal the highest REF- number issued for the tenant
  ```
- [ ] **No duplicates ever:**
  ```sql
  SELECT refund_no, count(*) FROM org_order_refunds_dtl
  WHERE tenant_org_id = '<tenant>' GROUP BY refund_no HAVING count(*) > 1;  -- expect 0 rows
  ```
- [ ] **Refund lifecycle still works** — initiate → approve → process a CASH refund; balance and
  `org_order_refunds_dtl.refund_status` move PENDING_APPROVAL → APPROVED → PROCESSED; no over-refund.

### B-2. Receipt allocation — `allow_partial_last_target` (dead-branch fix)
**Changed:** the `false` policy is now reachable; default (`true`) is unchanged.

- [ ] **Default policy (`allow_partial_last_target = true`)** — take an over-payment that only
  partially covers the last open target.
  - **Expected:** the last target is **partially paid** (unchanged behavior). No regression.
- [ ] **Only if a tenant uses `false`** — same scenario with a policy where
  `allow_partial_last_target = false`.
  - **Expected:** the last target is **NOT** part-paid; the remainder routes to the fallback
    destination (advance/wallet/etc.) and a `FALLBACK_REQUIRED` warning shows.
  - **Verify policy value:**
    ```sql
    SELECT policy_code, allow_partial_last_target, fallback_destination
    FROM org_fin_rcpt_alloc_policy_cf WHERE tenant_org_id = '<tenant>';
    ```
- [ ] If no tenant uses `false`, mark this **N/A (default-only)** — the code path is covered by
  unit tests.

### B-3. Promo validation + apply (validatePromoCode merge + 3 bug fixes)
**Changed:** one canonical evaluator for checkout + marketing preview; fixed percentage-casing
(preview returned 0), max-order mislabel, voided-usage counting; `createPromotion` now stores
`promo_code` upper / `discount_type` lower.

- [ ] **Percentage promo at checkout** — apply a percentage promo (e.g. 10%) to an order.
  - **Expected:** discount = order_total × pct (capped at `max_discount_amount` if set); **not 0**.
- [ ] **Fixed-amount promo** — discount = fixed value, never exceeding the order total.
- [ ] **Case-insensitive code** — enter the code in lower-case (e.g. `summer10`).
  - **Expected:** still matches and applies (lookup upper-cases).
- [ ] **New promo via the UI** — create a percentage promo with a **lower-case** code, then apply it.
  - **Expected:** it applies at checkout (createPromotion now stores the code upper-cased + `discount_type` lower-cased).
  - **Verify storage:**
    ```sql
    SELECT promo_code, discount_type, promo_type FROM org_promotions_mst
    WHERE tenant_org_id = '<tenant>' ORDER BY created_at DESC LIMIT 3;
    -- promo_code UPPER, discount_type lower ('percentage'/'fixed_amount'), promo_type UPPER
    ```
- [ ] **Min-order guard** — order below `min_order_amount` → rejected with a "minimum" message.
- [ ] **Max-order guard** — order above `max_order_amount` (if set) → rejected; message says
  "only valid for orders up to …" (errorCode `MAX_ORDER_EXCEEDED`, no longer mislabelled).
- [ ] **Global cap** — promo at `current_uses == max_uses` → rejected (max usage reached).
- [ ] **Per-customer cap excludes cancelled** — customer at their per-customer limit is rejected;
  but **cancel/void** an order that used the promo, then re-apply → now **allowed** (voided usage
  no longer counts).
  - **Verify:**
    ```sql
    SELECT count(*) FROM org_promotion_usage_dtl
    WHERE tenant_org_id='<tenant>' AND promo_code_id='<id>' AND customer_id='<cust>' AND voided_at IS NULL;
    ```
- [ ] **Promo reversal on cancel** — cancel an order that used a promo → `current_uses` decrements
  and the usage row is `voided_at`-stamped (single decrement even with multiple usage rows).
- [ ] **Marketing preview matches checkout** — if the marketing "validate" preview is used,
  a percentage promo now shows the **real** discount (previously 0) and agrees with checkout.

### B-4. Loyalty earn idempotency (LOY-1)
**Changed:** `processEarnPoints` now skips gracefully on a duplicate idempotency key (was prone
to wedging the outbox on redelivery).

- [ ] **Earn on order completion** — complete an order for a loyalty customer.
  - **Expected:** points credited once; one `EARN` row in `org_loyalty_txn_dtl`.
- [ ] **No double-credit / no stuck event** — confirm the `LOYALTY_EARN` outbox event reaches a
  processed state (not stuck retrying).
  - **Verify:**
    ```sql
    SELECT status, count(*) FROM org_domain_events_outbox
    WHERE event_type='LOYALTY_EARN' AND tenant_org_id='<tenant>' GROUP BY status;  -- none wedged in retry
    SELECT count(*) FROM org_loyalty_txn_dtl
    WHERE tenant_org_id='<tenant>' AND order_id='<order>' AND txn_type='EARN';      -- exactly 1
    ```
- [ ] **Redeem still correct** — redeem points on an order; balance debits once; insufficient-balance
  is rejected. (redeem path unchanged, smoke only.)
- [ ] **Manual adjust** (`adjustPointsTx`, if exposed) — adjust a balance twice in quick succession;
  both adjustments persist as distinct rows (no key collision).

### B-5. Promo apply idempotency (PR-2) + delegation (PR-1)
**Changed:** promo apply writes an idempotency key + post-lock skip; the legacy
`applyPromotionTx` now delegates to the hardened path.

- [ ] **Submit-order replay** — submit an order with a promo, then retry the same submit
  (same idempotency key / double-click).
  - **Expected:** exactly **one** `org_promotion_usage_dtl` row for that order+promo; `current_uses`
    incremented **once**.
  - **Verify:**
    ```sql
    SELECT order_id, promo_code_id, count(*) FROM org_promotion_usage_dtl
    WHERE tenant_org_id='<tenant>' AND order_id='<order>' GROUP BY order_id, promo_code_id;  -- count = 1
    ```

### B-6. Gateway payment verification (review — no code change)
**Reviewed:** PAYMENT_GATEWAY is settled by a **manual back-office verify**, not an auto webhook.

- [ ] **Pending → verified** — create an order with a gateway leg (status PENDING), then verify it
  via the back-office action (`POST /api/v1/orders/[id]/payments/[paymentId]/verify`,
  permission `orders:verify_payment`).
  - **Expected:** leg flips PENDING → COMPLETED; order snapshot recalculates; idempotent (re-verify
    is a no-op); pending amount was never counted as paid before verification.

### B-7. Tax-doc sequence audit columns (F-09, mig 0388 — no behavior)
- [ ] **Smoke only** — issue a tax document (invoice) for an e-invoice-enabled tenant; numbering
  still works. The new audit columns don't change behavior.
  - **Verify columns exist & defaulted:**
    ```sql
    SELECT rec_status, is_active FROM org_tax_doc_seq_counters LIMIT 1;  -- 1 / true defaults
    ```

---

## Part C — Adjacent-flow regression sanity (quick)

The changes touched shared modules; spot-check these still behave:

- [ ] **Order submit** end-to-end (cash, card-pending, mixed, with gift card + promo + loyalty on one order).
- [ ] **Overpayment disposition** (cash change / save-to-wallet / advance / credit) still routes and
  leaves `overpaid_amount = 0` when fully disposed.
- [ ] **AR allocation / reverse / void** unaffected.
- [ ] **Reconciliation reports** (D-09: excess/liability, B2B, overpayment, cash drawer) load and reconcile.
- [ ] **EN + AR / RTL** render correctly on any screen touched.

---

## Sign-off

| Area | Tester | Date | Result | Notes |
|---|---|---|---|---|
| A — Automated gate | | | | |
| B-1 Refund numbering | | | | |
| B-2 Receipt allocation | | | | |
| B-3 Promo validate/apply | | | | |
| B-4 Loyalty earn | | | | |
| B-5 Promo idempotency | | | | |
| B-6 Gateway verify | | | | |
| B-7 Tax-doc seq | | | | |
| C — Regression sanity | | | | |

**Exit criteria:** Part A green + all applicable Part B/C boxes ticked (or explicitly N/A) → ready
for the GA process gates (finance sign-off + soak, see `Process_Gates_Guide.md`).

---

## Related
- `Process_Gates_Guide.md` — finance sign-off + soak (the production-trust gates).
- `Promotion_Loyalty_Offline_DeepDive_2026-06-26.md` — what changed in promo/loyalty + why.
- `Order_Fin_Phases_RESUME.md` — program status, next migration seq.
