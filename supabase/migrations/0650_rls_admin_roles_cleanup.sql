-- ============================================================
-- Migration: 0650_rls_admin_roles_cleanup.sql
-- Purpose:   (1) Admin RLS checks accept super_admin, tenant_admin and admin.
--                Previously 21 RBAC-table policies required role = 'admin',
--                which no active user has, so their admin branches granted
--                nothing; is_admin() checked only super_admin/tenant_admin.
--                is_admin() becomes the single source of truth and the 21
--                policies call it.
--            (2) Remove 43 policies that only allow service_role. service_role
--                has BYPASSRLS, so they never grant anything; they only add a
--                per-statement auth.jwt() evaluation to every query on those tables.
--            (3) org_users_mst.role: varchar(50) on remote, text on local
--                (schema drift). Converge on TEXT (repository rule). The 4
--                sys_components_cd navigation policies depend on the column, so
--                they are dropped and recreated identically around the change.
--            (4) One active override per scope on org_tenant_settings_cf.
--                HQ StngTenantOverridesService does check-then-insert, so two
--                concurrent saves could create duplicates and the resolver
--                would have to pick one. The unique index makes the second
--                insert fail cleanly. It also replaces idx_ots_lookup_act (0647).
-- Affected:  is_admin(); policies on cmx_effective_permissions,
--            org_auth_user_{permissions,resource_permissions,resource_roles,roles,workflow_roles},
--            sys_components_cd and 43 service_role policies (see list);
--            org_users_mst.role; org_tenant_settings_cf indexes
-- Related:   0649 (initPlan wrapping), 0647 (idx_ots_lookup_act)
-- Plan:      docs/features/Order_Fin/Performance_Enhance/RLS_InitPlan_Remediation_Plan.md
-- ============================================================

SET LOCAL lock_timeout = '10s';

-- ------------------------------------------------------------
-- (1) Admin role check: single source of truth
-- ------------------------------------------------------------

-- True when the calling user is an active admin of their current tenant.
-- Admin roles: super_admin, tenant_admin, admin (codes in sys_auth_roles).
-- SECURITY DEFINER so it can read org_users_mst under RLS; search_path pinned
-- (was unset: a mutable search_path on a SECURITY DEFINER function is unsafe).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_users_mst ou
    WHERE ou.user_id = auth.uid()
      AND ou.tenant_org_id = public.current_tenant_id()
      AND ou.role IN ('super_admin', 'tenant_admin', 'admin')
      AND ou.is_active = true
  );
$function$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when auth.uid() is an active super_admin, tenant_admin or admin of current_tenant_id(). Single admin check used by RLS policies (0650).';

-- Tenant row AND caller is a tenant admin. ALTER POLICY keeps name, command, roles and permissive flag.
ALTER POLICY cmx_effective_permissions_select_tenant ON public.cmx_effective_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));

ALTER POLICY org_auth_user_permissions_delete_admin ON public.org_auth_user_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_permissions_update_admin ON public.org_auth_user_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_permissions_insert_admin ON public.org_auth_user_permissions
  WITH CHECK ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
-- Users see their own rows; admins see all rows of their tenant.
ALTER POLICY org_auth_user_permissions_select_tenant ON public.org_auth_user_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id()))
         AND ((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin())));

ALTER POLICY org_auth_user_resource_permissions_delete_admin ON public.org_auth_user_resource_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_resource_permissions_update_admin ON public.org_auth_user_resource_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_resource_permissions_insert_admin ON public.org_auth_user_resource_permissions
  WITH CHECK ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_resource_permissions_select_tenant ON public.org_auth_user_resource_permissions
  USING ((tenant_org_id = (SELECT public.current_tenant_id()))
         AND ((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin())));

ALTER POLICY org_auth_user_resource_roles_delete_admin ON public.org_auth_user_resource_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_resource_roles_update_admin ON public.org_auth_user_resource_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_resource_roles_insert_admin ON public.org_auth_user_resource_roles
  WITH CHECK ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_resource_roles_select_tenant ON public.org_auth_user_resource_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));

ALTER POLICY org_auth_user_roles_delete_admin ON public.org_auth_user_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_roles_update_admin ON public.org_auth_user_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_roles_insert_admin ON public.org_auth_user_roles
  WITH CHECK ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_roles_select_tenant ON public.org_auth_user_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));

ALTER POLICY org_auth_user_workflow_roles_delete_admin ON public.org_auth_user_workflow_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_workflow_roles_update_admin ON public.org_auth_user_workflow_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_workflow_roles_insert_admin ON public.org_auth_user_workflow_roles
  WITH CHECK ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));
ALTER POLICY org_auth_user_workflow_roles_select_tenant ON public.org_auth_user_workflow_roles
  USING ((tenant_org_id = (SELECT public.current_tenant_id())) AND (SELECT public.is_admin()));

COMMENT ON POLICY cmx_effective_permissions_select_tenant ON public.cmx_effective_permissions IS
  'Tenant admins (is_admin(): super_admin/tenant_admin/admin) read their tenant''s effective permissions. 0650.';
COMMENT ON POLICY org_auth_user_permissions_delete_admin ON public.org_auth_user_permissions IS 'Tenant admins delete rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_permissions_update_admin ON public.org_auth_user_permissions IS 'Tenant admins update rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_permissions_insert_admin ON public.org_auth_user_permissions IS 'Tenant admins insert rows for their tenant. 0650.';
COMMENT ON POLICY org_auth_user_permissions_select_tenant ON public.org_auth_user_permissions IS 'Users read their own rows; tenant admins read all rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_permissions_delete_admin ON public.org_auth_user_resource_permissions IS 'Tenant admins delete rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_permissions_update_admin ON public.org_auth_user_resource_permissions IS 'Tenant admins update rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_permissions_insert_admin ON public.org_auth_user_resource_permissions IS 'Tenant admins insert rows for their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_permissions_select_tenant ON public.org_auth_user_resource_permissions IS 'Users read their own rows; tenant admins read all rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_roles_delete_admin ON public.org_auth_user_resource_roles IS 'Tenant admins delete rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_roles_update_admin ON public.org_auth_user_resource_roles IS 'Tenant admins update rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_roles_insert_admin ON public.org_auth_user_resource_roles IS 'Tenant admins insert rows for their tenant. 0650.';
COMMENT ON POLICY org_auth_user_resource_roles_select_tenant ON public.org_auth_user_resource_roles IS 'Tenant admins read rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_roles_delete_admin ON public.org_auth_user_roles IS 'Tenant admins delete rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_roles_update_admin ON public.org_auth_user_roles IS 'Tenant admins update rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_roles_insert_admin ON public.org_auth_user_roles IS 'Tenant admins insert rows for their tenant. 0650.';
COMMENT ON POLICY org_auth_user_roles_select_tenant ON public.org_auth_user_roles IS 'Tenant admins read rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_workflow_roles_delete_admin ON public.org_auth_user_workflow_roles IS 'Tenant admins delete rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_workflow_roles_update_admin ON public.org_auth_user_workflow_roles IS 'Tenant admins update rows of their tenant. 0650.';
COMMENT ON POLICY org_auth_user_workflow_roles_insert_admin ON public.org_auth_user_workflow_roles IS 'Tenant admins insert rows for their tenant. 0650.';
COMMENT ON POLICY org_auth_user_workflow_roles_select_tenant ON public.org_auth_user_workflow_roles IS 'Tenant admins read rows of their tenant. 0650.';

-- ------------------------------------------------------------
-- (2) Remove service_role-only policies (no-op grants: service_role has BYPASSRLS).
-- Removal changes no visibility for any role: for every other role the
-- predicate (auth.jwt() ->> 'role') = 'service_role' was always false.
-- The three sys_auth_*_select policies (authenticated OR service_role) are kept.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS service_role_cmx_effective_perms_full_access ON public.cmx_effective_permissions;
DROP POLICY IF EXISTS service_role_org_user_perms_full_access ON public.org_auth_user_permissions;
DROP POLICY IF EXISTS service_role_org_user_resource_perms_full_access ON public.org_auth_user_resource_permissions;
DROP POLICY IF EXISTS service_role_org_user_resource_roles_full_access ON public.org_auth_user_resource_roles;
DROP POLICY IF EXISTS service_role_org_user_roles_full_access ON public.org_auth_user_roles;
DROP POLICY IF EXISTS service_role_org_user_workflow_roles_full_access ON public.org_auth_user_workflow_roles;
DROP POLICY IF EXISTS service_role_org_b2b_stmt_pay_dtl ON public.org_b2b_statement_payments_dtl;
DROP POLICY IF EXISTS service_role_addresses ON public.org_customer_addresses;
DROP POLICY IF EXISTS service_role_org_cust_cat_access ON public.org_customer_category_cf;
DROP POLICY IF EXISTS service_role_merge_log ON public.org_customer_merge_log;
DROP POLICY IF EXISTS service_role_org_customer_pref_changelog ON public.org_customer_pref_changelog;
DROP POLICY IF EXISTS service_role_org_customer_service_prefs ON public.org_customer_service_prefs;
DROP POLICY IF EXISTS service_role_org_fin_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl;
DROP POLICY IF EXISTS service_role_org_fin_rcpt_alloc_policy_cf ON public.org_fin_rcpt_alloc_policy_cf;
DROP POLICY IF EXISTS service_role_org_fin_rcpt_alloc_preview_tr ON public.org_fin_rcpt_alloc_preview_tr;
DROP POLICY IF EXISTS service_role_org_inv_stock_by_branch ON public.org_inv_stock_by_branch;
DROP POLICY IF EXISTS service_role_org_inv_stock_tr ON public.org_inv_stock_tr;
DROP POLICY IF EXISTS service_role_org_ord_discounts_dtl ON public.org_order_discounts_dtl;
DROP POLICY IF EXISTS service_role_history ON public.org_order_history;
DROP POLICY IF EXISTS service_role_issues ON public.org_order_issues;
DROP POLICY IF EXISTS service_role_org_order_pieces ON public.org_order_item_pieces_dtl;
DROP POLICY IF EXISTS service_role_steps ON public.org_order_item_processing_steps;
DROP POLICY IF EXISTS service_role_org_order_piece_hist_tr ON public.org_order_piece_hist_tr;
DROP POLICY IF EXISTS service_role_org_order_preferences_dtl ON public.org_order_preferences_dtl;
DROP POLICY IF EXISTS service_role_status_history ON public.org_order_status_history;
DROP POLICY IF EXISTS service_role_org_packing_preference_cf ON public.org_packing_preference_cf;
DROP POLICY IF EXISTS service_role_org_preference_bundles_cf ON public.org_preference_bundles_cf;
DROP POLICY IF EXISTS service_role_policy ON public.org_price_list_items_dtl;
DROP POLICY IF EXISTS service_role_policy ON public.org_price_lists_mst;
DROP POLICY IF EXISTS service_role_org_service_category_access ON public.org_service_category_cf;
DROP POLICY IF EXISTS service_role_org_service_preference_cf ON public.org_service_preference_cf;
DROP POLICY IF EXISTS service_role_org_svc_cat_proc_steps_cf ON public.org_svc_cat_proc_steps_cf;
DROP POLICY IF EXISTS service_role_org_tax_doc_seq_counters ON public.org_tax_doc_seq_counters;
DROP POLICY IF EXISTS service_role_category_workflow ON public.org_tenant_service_category_workflow_cf;
DROP POLICY IF EXISTS service_role_workflow_settings ON public.org_tenant_workflow_settings_cf;
DROP POLICY IF EXISTS service_role_workflow_templates ON public.org_tenant_workflow_templates_cf;
DROP POLICY IF EXISTS service_role_tenants_access ON public.org_tenants_mst;
DROP POLICY IF EXISTS service_role_full_access ON public.org_users_mst;
DROP POLICY IF EXISTS service_role_workflow_rules ON public.org_workflow_rules;
DROP POLICY IF EXISTS service_role_workflow_settings ON public.org_workflow_settings_cf;
DROP POLICY IF EXISTS service_role_rbac_full_access ON public.sys_auth_permissions;
DROP POLICY IF EXISTS service_role_rbac_role_perms_full_access ON public.sys_auth_role_default_permissions;
DROP POLICY IF EXISTS service_role_rbac_roles_full_access ON public.sys_auth_roles;

-- ------------------------------------------------------------
-- (3) org_users_mst.role -> TEXT
-- The 21 policies above no longer reference the column. The 4 navigation
-- policies still do, so drop them, change the type, and recreate them with
-- identical meaning: only active super_admins of an active tenant may manage
-- the global navigation catalog. This stays super_admin-only on purpose,
-- because sys_components_cd is shared by all tenants.
-- ------------------------------------------------------------
DROP POLICY navigation_admin_read_policy   ON public.sys_components_cd;
DROP POLICY navigation_admin_insert_policy ON public.sys_components_cd;
DROP POLICY navigation_admin_update_policy ON public.sys_components_cd;
DROP POLICY navigation_admin_delete_policy ON public.sys_components_cd;

-- varchar -> text is binary-coercible: no table rewrite. No-op where already text (local).
ALTER TABLE public.org_users_mst ALTER COLUMN role TYPE TEXT;

COMMENT ON COLUMN public.org_users_mst.role IS
  'Tenant role code of the user (sys_auth_roles.code), e.g. super_admin, tenant_admin, admin, cashier. TEXT since 0650.';

CREATE POLICY navigation_admin_read_policy ON public.sys_components_cd
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_users_mst u JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
                 WHERE u.user_id = (SELECT auth.uid()) AND u.is_active = true AND t.is_active = true AND u.role = 'super_admin'));
CREATE POLICY navigation_admin_insert_policy ON public.sys_components_cd
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_users_mst u JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
                      WHERE u.user_id = (SELECT auth.uid()) AND u.is_active = true AND t.is_active = true AND u.role = 'super_admin'));
CREATE POLICY navigation_admin_update_policy ON public.sys_components_cd
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_users_mst u JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
                 WHERE u.user_id = (SELECT auth.uid()) AND u.is_active = true AND t.is_active = true AND u.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_users_mst u JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
                      WHERE u.user_id = (SELECT auth.uid()) AND u.is_active = true AND t.is_active = true AND u.role = 'super_admin'));
CREATE POLICY navigation_admin_delete_policy ON public.sys_components_cd
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_users_mst u JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
                 WHERE u.user_id = (SELECT auth.uid()) AND u.is_active = true AND t.is_active = true AND u.role = 'super_admin'));

COMMENT ON POLICY navigation_admin_read_policy ON public.sys_components_cd IS 'Active super_admins of an active tenant read the global navigation catalog. Recreated 0650.';
COMMENT ON POLICY navigation_admin_insert_policy ON public.sys_components_cd IS 'Active super_admins of an active tenant insert navigation entries. Recreated 0650.';
COMMENT ON POLICY navigation_admin_update_policy ON public.sys_components_cd IS 'Active super_admins of an active tenant update navigation entries. Recreated 0650.';
COMMENT ON POLICY navigation_admin_delete_policy ON public.sys_components_cd IS 'Active super_admins of an active tenant delete navigation entries. Recreated 0650.';

-- ------------------------------------------------------------
-- (4) One active override per (tenant, setting, branch, user) scope.
-- NULLS NOT DISTINCT so tenant-level rows (branch and user NULL) are unique too.
-- Soft-deleted rows (is_active = false) are excluded and keep their history.
-- Fails (and rolls back the migration) if duplicates exist; none existed on 2026-10-28.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX uq_ots_scope_act
  ON public.org_tenant_settings_cf (tenant_org_id, setting_code, branch_id, user_id) NULLS NOT DISTINCT
  WHERE is_active;

COMMENT ON INDEX public.uq_ots_scope_act IS
  'At most one active override per tenant/setting/branch/user scope; also serves the resolver''s tenant-first lookup.';

-- Superseded by uq_ots_scope_act (same columns and predicate, now unique).
DROP INDEX IF EXISTS public.idx_ots_lookup_act;

-- ------------------------------------------------------------
-- Assertions: fail the migration (full rollback) on any surprise.
-- ------------------------------------------------------------
DO $verify$
DECLARE v INTEGER;
BEGIN
  SELECT count(*) INTO v FROM pg_policies
  WHERE schemaname = 'public' AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '''admin''::text';
  IF v > 0 THEN RAISE EXCEPTION '0650: % policies still check role = ''admin'' only', v; END IF;

  SELECT count(*) INTO v FROM pg_policies
  WHERE schemaname = 'public' AND qual ~ '^\(\(\( SELECT auth\.jwt\(\) AS jwt\) ->> ''role''::text\) = ''service_role''::text\)$';
  IF v > 0 THEN RAISE EXCEPTION '0650: % service_role-only policies remain', v; END IF;

  SELECT count(*) INTO v FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sys_components_cd' AND policyname LIKE 'navigation_admin_%';
  IF v <> 4 THEN RAISE EXCEPTION '0650: expected 4 navigation admin policies, found %', v; END IF;

  SELECT count(*) INTO v FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'org_users_mst' AND column_name = 'role' AND data_type <> 'text';
  IF v > 0 THEN RAISE EXCEPTION '0650: org_users_mst.role is not TEXT'; END IF;
END
$verify$;
