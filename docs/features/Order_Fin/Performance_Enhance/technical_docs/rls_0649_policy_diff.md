# 0649 RLS Policy Diff (review listing)

Generated 2026-10-28 from **remote** `pg_policies` with the same regex used by `0649_rls_wrap_auth_helpers.sql`. On local, 25 policies deparse `org_users_mst.role` without the `::text` cast. The migration transforms each database's own text, so local gets the same wrapping on its own expressions.

**Totals:** 354 public policies · **319 change** · 35 unchanged (no helper calls) · 0 already wrapped · dry-run residual unwrapped = 0 · dry-run round-trip mismatch = 0.

The only transformation: `helper()` → `(SELECT helper())` for `current_tenant_id`, `is_admin`, `auth.uid`, `auth.jwt`, `auth.role`. Nothing else in any expression changes.

## Expression groups (USING / WITH CHECK, before → after)

| # | Policies | Before | After | Tables |
|---|---|---|---|---|
| 1 | 205 | `tenant_org_id = current_tenant_id()` (USING + CHECK) | `tenant_org_id = (SELECT current_tenant_id())` | Standard tenant isolation on 205 `org_*` tables (regenerate with the query below) |
| 2 | 27 | `(auth.jwt() ->> 'role') = 'service_role'` (USING) | `((SELECT auth.jwt()) ->> 'role') = 'service_role'` | cmx_effective_permissions, org_auth_user_*, org_customer_addresses, org_customer_merge_log, org_inv_stock_*, org_order_history, org_order_issues, org_order_item_processing_steps, org_order_status_history, org_price_list*, org_svc_cat_proc_steps_cf, org_tenant_*workflow*, org_tenants_mst, org_users_mst, org_workflow_*, sys_auth_permissions, sys_auth_role_default_permissions, sys_auth_roles |
| 3 | 16 | same as #2, USING + CHECK | same wrapping | org_b2b_statement_payments_dtl, org_customer_*, org_fin_overpay_disp_dtl, org_fin_rcpt_alloc_*, org_order_discounts_dtl, org_order_item_pieces_dtl, org_order_piece_hist_tr, org_order_preferences_dtl, org_packing_preference_cf, org_preference_bundles_cf, org_service_*_cf, org_tax_doc_seq_counters |
| 4 | 14 | tenant AND `EXISTS(org_users_mst … user_id = auth.uid() … tenant = current_tenant_id() … role='admin')` | all three calls wrapped | cmx_effective_permissions, org_auth_user_{permissions,resource_permissions,resource_roles,roles,workflow_roles} |
| 5 | 9 | `tenant_org_id = current_tenant_id()` (USING only) | wrapped | org_auth_admin_config_cf, org_customer_category_cf, org_ntf_{audit_dtl,delivery_log_dtl,receipts_tr,soft_bounce_lst,suppression_lst}, org_oc_edit_policy_asg_cf |
| 6 | 5 | `tenant_org_id IS NULL OR tenant_org_id IN (SELECT … WHERE user_id = auth.uid())` | inner `auth.uid()` wrapped | org_ord_{custom_validations,screen_contracts,webhook_subscriptions}_cf |
| 7 | 5 | admin EXISTS as #4 (CHECK only) | wrapped | org_auth_user_* |
| 8 | 4 | `user_id = auth.uid()` | wrapped | cmx_effective_permissions, org_auth_user_{resource_roles,roles,workflow_roles} |
| 9 | 3 | `tenant_org_id = current_tenant_id()` (CHECK only) | wrapped | org_customer_category_cf, org_ntf_audit_dtl, org_ntf_delivery_log_dtl |
| 10 | 3 | `auth.role() = 'authenticated' OR auth.role() = 'service_role'` | both wrapped | sys_auth_permissions, sys_auth_role_default_permissions, sys_auth_roles |
| 11 | 3 | tenant AND `is_admin()` | both wrapped | org_users_mst, sys_auth_audit_log, sys_auth_user_sessions_mst |
| 12 | 3 | tenant OR `tenant_org_id IS NULL` (USING + CHECK) | wrapped | org_ord_{custom_validations,screen_contracts,webhook_subscriptions}_cf |
| 13 | 3 | `tenant_org_id::text = auth.jwt() ->> 'tenant_org_id'` | wrapped | sys_bill_invoices_mst, sys_dev_api_keys_mst, sys_dev_api_usage_tr |
| 14 | 2 | `auth_user_id = auth.uid()` | wrapped | sys_auth_audit_log, sys_auth_user_sessions_mst |
| 15 | 2 | tenant AND (`user_id = auth.uid()` OR admin EXISTS) | all wrapped | org_auth_user_permissions, org_auth_user_resource_permissions |
| 16–27 | 15 | super_admin EXISTS (sys_components_cd ×4), `tenant IN (… auth.uid())` (org_ord_transition_events, org_ord_screen_contracts_cf), org_users_mst self/admin variants (×5), `id = current_tenant_id()` (org_tenants_mst), `locked_by`/`edited_by = auth.uid()` (org_order_edit_locks ×3, org_order_edit_history) | helper calls wrapped only | as listed |

`get_user_tenants()` is used in `FROM` (a set-returning function), so it is already evaluated once per statement and is **not** touched.

## Regenerate this listing

```sql
with pat as (select '(?<!SELECT )\m(auth\.(?:uid|jwt|role)|(?:public\.)?(?:current_tenant_id|is_admin))\(\)'::text re)
select p.tablename, p.policyname, p.cmd, p.qual,
       regexp_replace(p.qual, pat.re, '(SELECT \1())', 'g') new_qual,
       p.with_check, regexp_replace(p.with_check, pat.re, '(SELECT \1())', 'g') new_check
from pg_policies p, pat
where p.schemaname = 'public'
order by 1, 2;
```

## Visibility baseline (remote, before 0649, rolled-back sessions)

After apply, the same per-table visible row counts must reproduce the same fingerprint (md5 over `table=count;` for non-zero tables, ordered by table name).

| Context | Readable RLS tables | Not readable (no grant) | Fingerprint |
|---|---|---|---|
| Cashier `63b41929…` (tenant `1111…`) | 259 | 18 | `851105ebb144546e0eb8aac383269cba` |
| Tenant admin `643d9acf…` (tenant `c9ac29d1…`) | 259 | 18 | `d389f3a928692dafff688973e0c3152a` (86 non-zero tables) |
| `anon` | 252 | 25 | `a1ff15cfd1f1ef20a021ce53929071d0` |

Side finding (not changed by 0649): the admin `EXISTS` policies check `org_users_mst.role = 'admin'`, but no active user has exactly that role (roles seen: `cashier`, `tenant_admin`). Those policy branches currently grant nothing. Review this with RBAC.
