# Order Create Performance — Plan

Status: [STATUS.md](STATUS.md). Started from the Order Cart Line Grouping speed check (PF), see
[../Order_Cart_Line_Grouping/STATUS.md](../Order_Cart_Line_Grouping/STATUS.md) "PF results".
Rules: [performance-engineering.md](../../dev/rules/performance-engineering.md) (measure first, one change at a time,
keep money, tenant and security rules).

## 1. Goal

A cashier presses **Submit** and sees the order number fast, also when several cashiers of one Organization
submit at the same time.

| Order | Target (p95, whole Submit, server side) |
|---|---|
| typical (30 lines / 60 pieces) | ≤ 1.5 s |
| heavy (60 lines / 150 pieces with preferences) | ≤ 3 s |
| 5 cashiers of one Organization submitting together | same targets, no failures |

Owner confirmed the 1.5 s / 3 s target "for now" (2026-11-27).

## 2. What one Submit does today (traced 2026-11-28)

| Step | Where | Cost |
|---|---|---|
| A. Extra request before Submit: open/check POS session | `use-order-submission.ts` → `/api/v1/pos-sessions/ensure-for-order-entry` | a full extra API call (proxy, auth, permission, DB) on every order |
| B. Proxy | `proxy.ts` | calls Supabase Auth `getUser()` (a network call to the Auth server) for every `/api` request, then returns without using it |
| C. Route auth | `require-permission.ts` → `jwt-tenant-validator.ts` | `getUser()` again (2nd Auth call), session check RPC, permission RPC |
| D. Idempotency | `submit-order/route.ts` | look-up + claim row |
| E. Checks and quote (before the transaction) | `order-submit-orchestrator.service.ts` | override/discount permission, server quote (currency, time, discount rules, promos, pricing facts), payment method configs (twice on gift-card orders), credit limit, drawer session, settlement plan checks |
| F. One transaction | same file + `order-service.ts` | order number → header → items, preferences, pieces → tax rows → invoice → promo → POS session → receipt voucher (number lock) → lines → wiring → settlement → tax document → commit mark |
| G. After commit | route | redundant `idempotency_key` UPDATE, hash update, re-read order, read voucher effects, load notification facts + time zone, record notification |

Already done (uncommitted, Line Grouping PF): pieces saved per line in one statement, all piece preference rows in
one statement. Heavy order 756 → 217 statements, 1.99 s → 1.04 s at 1.7 ms to the database.

## 3. Findings

### Bugs / risks (fix regardless of timing)

**F1 — Connection pool can run dry under concurrent Submits (HIGH).**
Inside the Submit transaction (which holds one connection), some reads use the global client, so each needs a
**second** connection:
- `validateOrderSourceForCreation` (2 reads, `order-source-policy.ts`),
- `getCashControlSettings` (2 reads in parallel) via `resolvePosSessionForFinanceTx` and `planCashChangeRounding`,
- `resolveCurrencyRoundingRule` + `sys_currency_cd` (`currency-rounding.ts`, `cash-change-rounding.service.ts`),
- to verify: `getTaxDocumentTriggerConfigs` in `maybeIssueTaxDocumentTx`.

The cloud config (`.env.dbcloudjh`) has `connection_limit=2`. Two Submits on one app server each hold one
connection in their transaction, and both then wait for a free connection for these reads, until Prisma's pool
timeout ends one of them with an error. The order-number lock is held all that time, so the rest of the Organization's cashiers wait too.
Fix: read these settings **before** the transaction and pass them in (they are configuration, not money state).
This also shortens the time locks are held. Then set the pool size for the hosting model (§4).

**F2 — One order at a time per Organization (HIGH under load).**
The order number is taken first inside the transaction (`order-service.ts`, `generateOrderNumberWithTx`). The
day counter row in `org_doc_seq_mst` stays locked until COMMIT, i.e. through items, pieces, voucher, wiring and
settlement. Every other Submit of the same Organization (all branches) waits for it.
Fix (needs owner decision D1): take the number in its own short statement just before the transaction. Then a
failed Submit leaves a gap in order numbers. Order numbers are not tax-document numbers (tax documents have
their own numbering). The item and piece codes are built from the order number, so the number can't simply be
taken at the end.

**F3 — Receipt voucher number lock (MEDIUM, paid orders).**
`voucher-number.service.ts` takes an Organization-wide advisory lock and a MAX scan, held from voucher creation to COMMIT.
After F2 it becomes the next queue. Receipt numbers are financial documents, so keep them gap-free: move the
number to the doc-seq engine and assign it as the **last** step of the transaction (short lock). Needs a migration;
do it only if Phase 0 shows it queuing.

### Wasted work (safe to remove)

- **W1** Proxy `getUser()` on `/api` requests that it never uses, and the route calls `getUser()` again: 2 Auth
  server calls per API request, on every API call, not only Submit. Platform-wide change; must keep token refresh
  (cookies) working → own package with auth tests (D3).
- **W2** The extra `ensure-for-order-entry` call before every Submit. Submit already resolves the POS session
  inside its transaction and answers `409 POS_SESSION_REQUIRED` with `canOpenInline`. Keep the session id the
  page already has; call ensure only when there is none, or after that 409.
- **W3** Route writes `idempotency_key` to the order after success, but the order was inserted with it already.
- **W4** After commit: the order re-read and the voucher-effects read run one after the other; notification facts,
  time zone and the notification request run before the reply. Run the reads together; record the notification
  inside the transaction (`emitNotificationEventTx`, durable) from data already in hand, or after the reply with
  `after()`.
- **W5** Gift-card orders load payment method configs twice (`listEffectivePaymentMethodConfigs`). Load once.
- **W6** Independent pre-transaction reads run one by one (credit limit, drawer session, payment configs; parts of
  the quote). Run together where they don't depend on each other, bounded by the pool size (F1).
- **W7** `after_ins/upd/del_items_recalc` on `org_order_items_dtl` call `fn_recalc_order_totals`, whose body is
  disabled (`IF 1=2`). Drop the three triggers (migration). Small DB-time gain, removes a trap.
- **W8** `org_fin_vouchers_mst` has a unique and a plain index on the same `(tenant_org_id, voucher_no)`. Drop the
  plain one (DB Integrity findings).

### Statement count still grows with order size

- **S1** Items are inserted one statement per line, item preferences one per line, pieces one per line. Batch all
  items (`createManyAndReturn`, ids matched by `order_item_srno`), add item preferences to the single preference
  statement, insert all pieces in one statement. Statement count then stays about the same for any order size.
  Needed when the database is more than ~6 ms away or heavy orders miss the target.

### Checked and fine

- Per-piece triggers (`fn_ord_piece_code_set`, `fn_ord_piece_tag_rules`) do primary-key look-ups only.
- `oc_guard_committed_cols` returns at once for server writes.
- Indexes used by numbering and idempotency exist.
- Header insert triggers write 2 history rows (status + action log): fine.

## 4. Plan (in this order)

| Phase | Work | Needs |
|---|---|---|
| **P0 Measure** | Step timings in the Submit route (auth, idempotency, quote, checks, transaction, after-commit) as logs + `Server-Timing`; extend the PF harness to the whole Submit and to 5 concurrent cashiers of one Organization; record app/DB regions. | — |
| **P1 Correctness under load** | F1 (settings read before the transaction, pool size), F2 (order number outside the transaction), W2 (no extra ensure call). | D1, D2 |
| **P2 Shorter request** | W3, W4, W5, W6. Re-measure. | — |
| **P3 Fewer statements** (only if P0/P2 numbers miss) | S1; F3 if the voucher lock queues. | migration for F3 |
| **P4 Platform** | W1 auth (own package, all API routes gain); W7, W8 migrations. | D3 |
| **Hosting** | App in the same region as the database. Serverless: transaction pooler, `connection_limit` 1–3 per instance. Long-running server: 10–20 behind the pooler. | D2 |

Each phase: parity DB tests (same rows written), concurrency test, `npm run build`, STATUS + QA guide update.

## 5. Not recommended

| Idea | Why not |
|---|---|
| Trust the browser's totals and skip the server quote | money security; the server must price |
| Move payments, voucher or settlement to a background job | an order could exist without its money records (ADR: same transaction) |
| Cache sessions or permissions across requests | a revoked user could keep working |
| Raise the transaction timeout | hides the queue, doesn't remove it |
| Run queries in parallel inside the transaction | one connection runs one statement at a time |
| Rewrite the whole create as one database function | duplicates the pricing calculator; only if P3 still misses |

## 6. Owner decisions

- **D1** May order numbers have gaps when a Submit fails? Recommended: yes.
- **D2** Where does web-admin run (provider, region, serverless or long-running) and in which region is the database?
- **D3** Approve the auth change (W1) as a separate platform package?
