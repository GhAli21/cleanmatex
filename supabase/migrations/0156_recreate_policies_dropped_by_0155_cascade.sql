-- =====================================================
-- Migration: Recreate 8 RLS policies dropped by 0155 CASCADE
-- Date: 2026-03-14
-- Description: Migration 0155 (get_user_tenants add s_current_plan) used
--              DROP FUNCTION CASCADE which dropped 8 policies that reference
--              get_user_tenants(). This migration recreates only those 8.
--
-- Dropped policies (discovered via pg_policies):
-- - org_inv_stock_by_branch: tenant_isolation_org_inv_stock_by_branch
-- - org_inv_stock_tr: tenant_isolation_org_inv_stock_tr
-- - org_order_edit_history: org_order_edit_history_insert_policy, org_order_edit_history_select_policy
-- - org_order_edit_locks: org_order_edit_locks_insert_policy, org_order_edit_locks_select_policy, org_order_edit_locks_delete_policy
-- - org_svc_cat_proc_steps_cf: tenant_isolation_org_svc_cat_proc_steps_cf
-- =====================================================

BEGIN;

-- 1. org_svc_cat_proc_steps_cf
DROP POLICY IF EXISTS tenant_isolation_org_svc_cat_proc_steps_cf ON org_svc_cat_proc_steps_cf;
CREATE POLICY tenant_isolation_org_svc_cat_proc_steps_cf ON org_svc_cat_proc_steps_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- 2. org_inv_stock_tr
DROP POLICY IF EXISTS tenant_isolation_org_inv_stock_tr ON org_inv_stock_tr;
CREATE POLICY tenant_isolation_org_inv_stock_tr ON org_inv_stock_tr
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- 3. org_inv_stock_by_branch
DROP POLICY IF EXISTS tenant_isolation_org_inv_stock_by_branch ON org_inv_stock_by_branch;
CREATE POLICY tenant_isolation_org_inv_stock_by_branch ON org_inv_stock_by_branch
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- 4-6. org_order_edit_locks
DROP POLICY IF EXISTS org_order_edit_locks_select_policy ON org_order_edit_locks;
CREATE POLICY org_order_edit_locks_select_policy ON org_order_edit_locks
  FOR SELECT
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

DROP POLICY IF EXISTS org_order_edit_locks_insert_policy ON org_order_edit_locks;
CREATE POLICY org_order_edit_locks_insert_policy ON org_order_edit_locks
  FOR INSERT
  WITH CHECK (
    tenant_org_id IN (SELECT tenant_id FROM get_user_tenants())
    AND locked_by = auth.uid()
  );

DROP POLICY IF EXISTS org_order_edit_locks_delete_policy ON org_order_edit_locks;
CREATE POLICY org_order_edit_locks_delete_policy ON org_order_edit_locks
  FOR DELETE
  USING (
    locked_by = auth.uid()
    OR tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
      WHERE user_role IN ('owner', 'super_admin', 'tenant_admin')
    )
  );

-- 7-8. org_order_edit_history
DROP POLICY IF EXISTS org_order_edit_history_select_policy ON org_order_edit_history;
CREATE POLICY org_order_edit_history_select_policy ON org_order_edit_history
  FOR SELECT
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

DROP POLICY IF EXISTS org_order_edit_history_insert_policy ON org_order_edit_history;
CREATE POLICY org_order_edit_history_insert_policy ON org_order_edit_history
  FOR INSERT
  WITH CHECK (
    tenant_org_id IN (SELECT tenant_id FROM get_user_tenants())
    AND edited_by = auth.uid()
  );

COMMIT;
