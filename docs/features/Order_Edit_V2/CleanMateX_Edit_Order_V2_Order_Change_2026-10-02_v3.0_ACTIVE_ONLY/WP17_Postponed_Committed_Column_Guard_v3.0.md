# WP17 postponed — committed commercial column guard

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** CLOSED 2026-11-07 — migration `0702_oc_committed_column_guard.sql` applied by the owner (local + remote, types and Prisma regenerated); proof passed (below).
**Decision:** Do not revoke `anon`, `authenticated`, or `service_role` grants. The tenant app writes through `authenticated`. Revoking that role would stop Create, processing, and finance.

## What was found

On the local database, `anon`, `authenticated`, and `service_role` can `INSERT`, `UPDATE`, and `DELETE` these tables:

- `org_orders_mst`
- `org_order_items_dtl`
- `org_order_item_pieces_dtl`
- `org_order_preferences_dtl`
- `org_order_charges_dtl`

Row security limits which organization a session can see. It does not stop a session inside that organization from changing quantity, price, or preferences on a committed order through the data API. The route guards do not cover that path.

## What to build later

Add one new migration. Do not edit `0113` or `0627`.

- While `committed_at` is empty, the trigger does nothing. Create keeps working.
- After the order is committed, reject a change to quantity, product, price, notes, stain, damage, packing, or preference content.
- Leave readiness, scan, rack, piece stage, and processing confirmation open. Those stay with workflow.
- Edit Order Apply, charge void, preference-charge repair, and the financial snapshot set a transaction-local flag before they write. The trigger allows that transaction through.

Review the migration before it is applied. Prove Create, a readiness save, a charge void, and a refused direct price update before treating the guard as active.

## 2026-11-06 — migration 0702 written

**Re-checked on remote first:** `anon`, `authenticated` and `service_role` still hold `INSERT`, `UPDATE`, `DELETE` on all five tables. The finding stands.

**Design (changed from "What to build later" above):** no transaction flag. The guard limits only the data-API roles, `anon` and `authenticated`. Every committed-order money writer was traced to Prisma, which connects as `postgres`: Edit Order Apply (`commercial-edit.writer.ts`), the financial snapshot (`order-financial-write.service.ts`), charge void (`order-charge.service.ts`). So none of them needs a flag and none changes. `service_role` (server-only key) and `SECURITY DEFINER` functions (their `current_user` is the owner) are not limited either.

**What 0702 does** — one function `oc_guard_committed_cols()`, one `BEFORE` trigger per table; the protected columns are trigger arguments, checked against the catalog when the migration runs (a missing column fails it):

| Table | Trigger | On a committed order, for anon / authenticated |
|---|---|---|
| `org_orders_mst` | `oc_order_committed_cols_guard` (UPDATE) | money totals, payment and credit figures, tax document and AR fields, the financial snapshot, commercial modes, currency, branch, parent/root order, Edit access fields cannot change |
| `org_order_items_dtl` | `oc_item_committed_cols_guard` | no insert or delete; product, quantity, prices, override, notes, stain/damage, packing, line money, tax, speed, soft-delete columns cannot change |
| `org_order_item_pieces_dtl` | `oc_piece_committed_cols_guard` | same as items, piece columns |
| `org_order_preferences_dtl` | `oc_pref_committed_cols_guard` | no insert or delete; preference identity, content, prices, bundle, soft-delete columns cannot change |
| `org_order_charges_dtl` | `oc_charge_committed_cols_guard` | no insert or delete; amount, type, currency, tax and void columns cannot change |

Refused writes raise SQLSTATE `42501` naming the table and column. Still writable: status, stage, scan, barcode, rack, locker, bag count, readiness (`quantity_ready`, `ready_at`, `is_ready`), issues and rejection, preparation, processing confirmation (`processing_confirmed`, `confirmed_*`), follow-up notes, `customer_id` (customer merge), audit columns. The Supabase-client writers in web-admin (batch-update, preparation, issues, item processing, piece workflow, processing preferences, customer merge) only touch those. The routes that add or remove preferences, conditions or packing on a committed order already refuse with `LEGACY_COMMITTED_UPDATE_RETIRED`.

**Checked before writing:** SQL and PL/pgSQL parse offline (pglast); all 218 listed columns exist on remote; `fn_recalc_order_totals` (called by the item triggers) is a no-op (`IF 1=2`). The migration was not executed.

**Proof after apply (owner applies; then I run these on local):**

1. Create an order (Prisma) → committed; works.
2. As `authenticated` in that organization: update `quantity_ready` on an item, `piece_stage` on a piece, `processing_confirmed` on a preference → all succeed.
3. As `authenticated`: update `price_per_unit` on an item, insert a preference, delete a charge, update `total_amount` on the order → each refused with `42501`.
4. Edit Order Apply and a charge void on the same order (Prisma) → succeed.
5. An uncommitted order: `authenticated` can still change its lines (Create flow unchanged).
6. Rerun the DB proofs (`order-change-edit-parity`, `order-fin-view-sources`) and the full DB suite.

## 2026-11-07 — applied and proved

- Remote: the 5 triggers exist (`oc_order_committed_cols_guard`, `oc_item_…`, `oc_piece_…`, `oc_pref_…`, `oc_charge_…`).
- Proof on local PostgreSQL, `web-admin/__tests__/db-integration/order-committed-column-guard.db.test.ts` (each test rolls back) — 4/4:
  1. `authenticated` on a committed order: item readiness/status, piece stage/rack, preference processing confirmation, order rack/issue flag → all succeed.
  2. `authenticated` on a committed order: item price, item quantity, piece line total, preference price, add preference, delete preference, void charge, delete charge, order total, order paid → all refused `42501` naming the column; values unchanged.
  3. `postgres` (Prisma) on the same committed order: charge void, line price, order total → succeed.
  4. `authenticated` on an uncommitted order: line change and charge delete → succeed (Create unchanged).
- Full DB suite: 55/56 suites, 264/265 tests. The one failure is `wf-policy-issue-catalog-seed-invariants` (local SIMPLE v2 published version has no stage sequence: local data drift, not this change). The earlier 11 failures no longer occur.

## Not in this postponement

Route closure, structural Apply, the processing echo check, the order lock, and the applied `0627` repair-function refusal stay in the closed WP17 report.
