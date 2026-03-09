# Plan: Add branch_id to All Remaining Transaction Tables

## Context

Migration `0106` already added `branch_id` to the first wave of financial/transaction tables
(`org_payments_dtl_tr`, `org_invoice_mst`, `org_fin_vouchers_mst`, `org_gift_card_transactions`,
`org_rcpt_receipts_mst`, `org_inv_stock_tr`, `org_orders_mst`).

**8 transaction tables still lack `branch_id`:**

| Table | Backfill Source |
|---|---|
| `org_order_items_dtl` | `order_id → org_orders_mst.branch_id` |
| `org_order_item_pieces_dtl` | `order_id → org_orders_mst.branch_id` |
| `org_order_item_processing_steps` | `order_id → org_orders_mst.branch_id` |
| `org_asm_tasks_mst` | `order_id → org_orders_mst.branch_id` |
| `org_asm_exceptions_tr` | `task_id → org_asm_tasks_mst.branch_id` |
| `org_dlv_stops_dtl` | `route_id → org_dlv_routes_mst.branch_id` |
| `org_dlv_pod_tr` | `stop_id → org_dlv_stops_dtl.branch_id` (chain) |
| `org_qa_decisions_tr` | `order_id → org_orders_mst.branch_id` |
| `org_pck_packing_lists_mst` | `order_id → org_orders_mst.branch_id` |

> Note: `org_asm_tasks_mst` already has `branch_id` (added in 0063). Used as backfill source for exceptions.

Goal: Complete full branch coverage across all operational transaction tables for branch-level
reporting, operations dashboards, and production readiness.

---

## Pattern to Follow (from migration 0106)

For each table:
1. `ADD COLUMN IF NOT EXISTS branch_id UUID NULL`
2. `ADD CONSTRAINT fk_[short]_branch FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE SET NULL ON UPDATE NO ACTION` — wrapped in idempotent `DO $$ IF NOT EXISTS $$` block
3. `CREATE INDEX IF NOT EXISTS idx_[table]_branch ON [table](tenant_org_id, branch_id) WHERE branch_id IS NOT NULL`
4. `COMMENT ON COLUMN ... IS '...'`
5. Backfill `UPDATE ... SET branch_id = ... FROM ... WHERE branch_id IS NULL AND source.branch_id IS NOT NULL`

All inside a single `BEGIN; ... COMMIT;` transaction block.

---

## Implementation

### File to Create

**`supabase/migrations/0138_add_branch_id_remaining_transaction_tables.sql`**

### Tables and SQL Plan

#### 1. `org_order_items_dtl`
- Add column, FK constraint (`fk_ord_items_branch`), index (`idx_ord_items_branch`)
- Backfill: `UPDATE ... FROM org_orders_mst o WHERE t.order_id = o.id`

#### 2. `org_order_item_pieces_dtl`
- Add column, FK constraint (`fk_ord_pieces_branch`), index (`idx_ord_pieces_branch`)
- Backfill: `UPDATE ... FROM org_orders_mst o WHERE t.order_id = o.id`

#### 3. `org_order_item_processing_steps`
- Add column, FK constraint (`fk_ord_proc_steps_branch`), index (`idx_ord_proc_steps_branch`)
- Backfill: `UPDATE ... FROM org_orders_mst o WHERE t.order_id = o.id`

#### 4. `org_asm_exceptions_tr`
- Add column, FK constraint (`fk_asm_exc_branch`), index (`idx_asm_exc_branch`)
- Backfill: `UPDATE ... FROM org_asm_tasks_mst t WHERE e.task_id = t.id` (task already has branch_id)

#### 5. `org_dlv_stops_dtl`
- Add column, FK constraint (`fk_dlv_stops_branch`), index (`idx_dlv_stops_branch`)
- Backfill: `UPDATE ... FROM org_dlv_routes_mst r WHERE s.route_id = r.id` (route has branch_id)
- Secondary backfill: `UPDATE ... FROM org_orders_mst o WHERE s.order_id = o.id AND s.branch_id IS NULL`

#### 6. `org_dlv_pod_tr`
- Add column, FK constraint (`fk_dlv_pod_branch`), index (`idx_dlv_pod_branch`)
- Backfill: Chain via stops: `UPDATE pod SET branch_id = s.branch_id FROM org_dlv_stops_dtl s WHERE pod.stop_id = s.id` (after stops are filled)

#### 7. `org_qa_decisions_tr`
- Add column, FK constraint (`fk_qa_dec_branch`), index (`idx_qa_dec_branch`)
- Backfill: `UPDATE ... FROM org_orders_mst o WHERE q.order_id = o.id`

#### 8. `org_pck_packing_lists_mst`
- Add column, FK constraint (`fk_pck_list_branch`), index (`idx_pck_list_branch`)
- Backfill: `UPDATE ... FROM org_orders_mst o WHERE p.order_id = o.id`
- Secondary backfill: `UPDATE ... FROM org_asm_tasks_mst t WHERE p.task_id = t.id AND p.branch_id IS NULL`

### Backfill Execution Order (respects chain dependencies)

```
1. org_order_items_dtl          ← from orders (direct)
2. org_order_item_pieces_dtl    ← from orders (direct)
3. org_order_item_processing_steps ← from orders (direct)
4. org_asm_exceptions_tr        ← from asm_tasks (already has branch_id)
5. org_dlv_stops_dtl            ← from dlv_routes (already has branch_id), fallback from orders
6. org_dlv_pod_tr               ← from dlv_stops (just filled in step 5)
7. org_qa_decisions_tr          ← from orders (direct)
8. org_pck_packing_lists_mst    ← from orders, fallback from asm_tasks
```

---

## Key Files

| File | Role |
|---|---|
| `supabase/migrations/0106_add_branch_id_to_transaction_tables.sql` | Reference template (pattern to follow exactly) |
| `supabase/migrations/0001_core_schema.sql` | Defines org_branches_mst composite PK `(id, tenant_org_id)` |
| `supabase/migrations/0063_org_asm_assembly_qa_system.sql` | Source schema for asm/qa/packing tables |
| `supabase/migrations/0065_org_dlv_delivery_management.sql` | Source schema for delivery tables |
| `supabase/migrations/0073_org_order_item_pieces_dtl.sql` | Source schema for pieces table |
| `supabase/migrations/0021_order_issues_steps.sql` | Source schema for processing steps |
| **`supabase/migrations/0138_add_branch_id_remaining_transaction_tables.sql`** | **File to create** |

---

## Verification

1. Run migration against local Supabase: `supabase db push` (or confirm with user first)
2. Verify columns added: `SELECT column_name FROM information_schema.columns WHERE table_name = 'org_order_items_dtl' AND column_name = 'branch_id';`
3. Verify FKs: `SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_name IN ('org_order_items_dtl', ...);`
4. Verify indexes: `SELECT indexname FROM pg_indexes WHERE tablename IN (...) AND indexname LIKE '%branch%';`
5. Verify backfill: `SELECT COUNT(*) FROM org_order_items_dtl WHERE branch_id IS NULL AND order_id IS NOT NULL;` — should be 0 (or low if orders themselves had no branch)
6. Migration is fully idempotent — safe to re-run

---

## Out of Scope

- No application code changes needed (branch_id is already passed from order context in service layer)
- No RLS policy changes (tenant-level isolation via tenant_org_id is sufficient; no branch-level RLS)
- No i18n or UI changes
