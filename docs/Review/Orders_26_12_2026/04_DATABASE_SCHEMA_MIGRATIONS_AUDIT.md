# 04 — Database, Schema, Migrations, RLS, Precision & Timezones Audit

**Scope:** 105 Orders, Workflow, Assembly, QA, Packing, Delivery, Billing/Invoice, and Plan-Limit models in `web-admin/prisma/schema.prisma` + corresponding `supabase/migrations/`.

---

## 1. Domain Inventory Summary

- **Core Orders & Lines (12):** `org_orders_mst`, `org_order_items_dtl`, `org_order_item_pieces_dtl`, `org_order_piece_hist_tr`, `org_order_preferences_dtl`, `org_order_discounts_dtl`, `org_order_charges_dtl`, `org_order_taxes_dtl`, `org_order_adjustments_dtl`, `org_order_history`, `org_order_status_history` (legacy), `org_order_issues`.
- **Processing, Edit V2 & Contracts (14):** `org_order_item_processing_steps`, `org_order_edit_locks`, `org_order_edit_history`, `org_order_changes_mst`, `org_order_change_ops_dtl`, `org_ord_*`, `org_oc_edit_policy_asg_cf`, `sys_oc_edit_policy_*` (6).
- **Workflow V2 & Legacy (34):** `org_wf_*` (4), `sys_wf_*` (20), legacy `org_workflow_*` / `org_tenant_workflow_*` / `sys_workflow_template_*` (10).
- **Stage Ops & Receipts (14):** `org_asm_*` (4), `org_qa_decisions_tr`, `org_pck_packing_lists_mst`, `org_packing_preference_cf`, `org_dlv_*` (5), `org_drivers_mst`, `org_rcpt_receipts_mst`.
- **Order-Linked Finance (13):** `org_order_payments_dtl`, `org_order_credit_apps_dtl`, `org_order_refunds_dtl`, `org_invoice_*` (6), `org_credit_notes_*` (2), `org_fin_vouchers_*` (2).
- **Plan Limits & Usage (7):** `org_usage_tracking`, `org_pln_subscriptions_mst`, `sys_plan_*`, `sys_plans_mst`, `sys_pln_subscription_plans_mst`.

**RLS Verification (Positive):** 100% of `org_*` tables in the Orders & Workflow domain have `tenant_org_id` AND `ENABLE ROW LEVEL SECURITY`. Zero Prisma `@ignore` workarounds remain after `0553`.

---

## 2. Ranked Findings & Recommendations

### CRITICAL

#### C1. 30+ Bare `ON DELETE SET NULL` on Composite `(..., tenant_org_id)` FKs Where `tenant_org_id` Is `NOT NULL`
- **Locations:** `org_order_items_dtl` (`L918`), `org_order_item_pieces_dtl` (`L6297,6301`), `org_order_item_processing_steps` (`L2374`), `org_asm_*` (`L5324,5390,5438`), `org_dlv_*` & `org_drivers_mst` (`L5480,5514,5516,5561,5562,5598,5642`), `org_pck_*`/`org_qa_*`/`org_rcpt_*` (`L5716,5751,5793,5794`), `org_invoice_*`/`org_fin_vouchers_*`/`org_credit_note_txn_dtl` (`L790,1462-1469,6919,6989,8467-8468,9099-9100`).
- **Issue:** Deleting a referenced branch, driver, assembly location, voucher, order, or invoice causes Postgres to attempt `SET tenant_org_id = NULL`, crashing with `23502 not_null_violation`.
- **Recommendation:** Forward migration replacing bare `ON DELETE SET NULL` with `ON DELETE RESTRICT` or PG15+ column-list `ON DELETE SET NULL (<nullable_col>)` (matching `0677_ord_root_order_id.sql:48-50`).
- **[YOUR NOTE]:** 

#### C2. 44 Single-Column FKs Between `org_*` Tables Bypassing DB-Level Tenant Isolation
- **Locations:**
  - `org_orders_mst`: `parent_order_id`, `b2b_contract_id`, `gift_card_id`, `promo_code_id`, `customer_id` (`L1312-1319`)
  - `org_order_items_dtl`: `order_id`, `product_id`, `override_by` (`L920-924`)
  - `org_order_item_pieces_dtl`: `order_item_id`, `order_id`, `product_id` (`L6298-6300`)
  - `org_order_preferences_dtl`, `org_order_issues`, `org_order_history`, `org_order_piece_hist_tr`, `org_order_edit_locks`, `org_order_edit_history`, `org_order_charges/taxes/discounts_dtl`, `org_order_payments_dtl`, `org_order_refunds_dtl`, `org_invoice_mst`, `org_credit_notes_*`, `org_wf_release_ln`.
- **Issue:** Under Prisma/`service_role`, DB constraints cannot stop Tenant A's child row from referencing Tenant B's parent row.
- **Recommendation:** Upgrade to Prisma-safe composite `(..., tenant_org_id)` FKs matching parent unique key column order in a forward migration.
- **[YOUR NOTE]:** 

#### C3. SaaS Subscription Order Plan Limits Are Unenforced at DB & App Level
- **Locations:** `sys_plan_limits` (`0006:97`), `sys_pln_subscription_plans_mst` (`0041:938`), `org_usage_tracking`, `web-admin/lib/services/usage-tracking.service.ts:254,397`.
- **Issue:** `incrementOrderCount()` has 0 callers; `canCreateOrder()` is not called by `submit-order`; limits are split across 3 catalogs.
- **Recommendation:** Unify plan-limit catalog, check + atomically increment `org_usage_tracking.orders_count` inside the order-create transaction.
- **[YOUR NOTE]:** 

---

### HIGH

#### H1. Prisma Schema Drift vs `0834–0841` Timezone Migrations (83 Columns Still `@db.Timestamp(6)`) + `0835` View Bug
- **Locations:** `web-admin/prisma/schema.prisma` (83 columns on `org_orders_mst`, `org_order_item_pieces_dtl`, `org_dlv_stops_dtl`, `org_asm_tasks_mst`, `org_invoice_mst`, etc.); `supabase/migrations/0835_orders_event_stamps_timestamptz.sql:44-55`.
- **Issue:** `0834–0841` converted `org_*` timestamps to `TIMESTAMPTZ`, but `schema.prisma` wasn't re-pulled (`npm run prisma:pull`). Also `0835` recreated `org_order_status_history_legacy` without `WITH (security_invoker = true)` (despite its comment claiming it) and 20 `sys_*` audit timestamps remain naive `TIMESTAMP`.
- **Recommendation:** Apply `0834–0841` + run `npm run prisma:pull`, and add a forward migration setting `security_invoker = true` on `org_order_status_history_legacy`.
- **[YOUR NOTE]:** 

#### H2. 3 Dead `FOR EACH ROW` Recalc Triggers Still Firing on Every `org_order_items_dtl` Write
- **Locations:** `0015_preparation_itemization.sql:136-150`, `0114_recalc_order_totals_include_vat.sql:17-37`.
- **Issue:** `after_{ins,upd,del}_items_recalc` invoke `fn_recalc_order_totals()` which is neutered with `If 1=2 THEN` and references dropped columns (`subtotal`, `total`).
- **Recommendation:** Drop all 3 triggers, `trg_after_item_change_recalc()`, and `fn_recalc_order_totals(uuid, uuid)` with `RESTRICT`.
- **[YOUR NOTE]:** 

#### H3. Missing Status `CHECK` / FK Constraints & Dual Legacy/V2 Status Triggers
- **Locations:** `org_orders_mst.status`, `current_status`, `preparation_status`, `prepared_by` (`schema.prisma:1110-1112,1306-1327`), `org_order_items_dtl.item_status`, `org_order_item_pieces_dtl.piece_status`, `trg_order_initial_status` (`0013:306`).
- **Recommendation:** Add `CHECK` on `preparation_status` + FK `prepared_by -> auth.users(id) ON DELETE RESTRICT`, add catalog/check constraints on statuses, and retire legacy `org_order_status_history` dual-write trigger when safe.
- **[YOUR NOTE]:** 

---

### MEDIUM & LOW

- **Numeric Precision Drift (26 columns):** All 9 exchange-rate columns use `(10,6)`, `(18,6)`, `(19,6)`, or `(22,10)` instead of `DECIMAL(28,12)` per `numeric-precision.md`; tax/VAT/discount rates vary across `(5,2)`, `(5,3)`, `(9,4)`.
- **12 Exact-Duplicate Indexes + Missing Branch Queue Indexes:** Drop duplicates on `org_orders_mst`, `org_order_items_dtl`, `org_order_history`, `org_ord_screen_contracts_cf`, `org_workflow_*`, `org_invoice_mst`, `org_credit_notes_mst`, `org_fin_vouchers_mst`; add `(tenant_org_id, branch_id, current_status, ready_by_at)` on `org_orders_mst` and branch-scoped queue indexes on `org_asm_tasks_mst` and `org_dlv_stops_dtl`.
- **37 Non-Tenant-First List Indexes:** Convert leading-column indexes on `org_order_items_dtl`, `org_order_item_pieces_dtl`, `org_order_history`, `org_order_issues`, `org_asm_*`, `org_qa_*`, `org_pck_*`, `org_dlv_*` to lead with `tenant_org_id`.
- **Legacy `VARCHAR` (190 cols across 31 tables):** Low runtime risk; standardize to `TEXT` opportunistically.
- **[YOUR NOTE]:** 
