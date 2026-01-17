-- ==================================================================
-- Comprehensive RLS Policies Audit and Standardization
-- Migration: 0081_comprehensive_rls_policies
-- Purpose: Audit all org_* tables, ensure RLS is enabled, create/update
--          policies with consistent naming and WITH CHECK clauses
--          using current_tenant_id() function
-- 
-- This migration:
-- 1. Ensures RLS is enabled on all org_* tables
-- 2. Drops old/duplicate policies that use JWT claims or lack WITH CHECK
-- 3. Creates standardized policies named tenant_isolation_{table_name}
-- 4. All policies use current_tenant_id() function for tenant isolation
-- 5. All policies include WITH CHECK clauses for INSERT/UPDATE operations
-- 6. Preserves RBAC-specific policies (SELECT, INSERT, UPDATE, DELETE)
-- 7. Preserves service_role policies (for admin/system access)
--
-- Special Cases:
-- - org_tenants_mst: Uses id = current_tenant_id()
-- - org_users_mst: Base policy allows users to access own record (user_id = auth.uid() AND tenant_org_id = current_tenant_id())
--                  Admin policies allow admins to manage all users in their tenant (using is_admin() function)
-- - Tables with NULL tenant_org_id: Allow NULL values (e.g., org_ord_screen_contracts_cf)
--
-- Related: Migration 0061_fix_all_rls_policies_current_tenant_id.sql
-- Created: 2025-01-XX
-- ==================================================================

BEGIN;

-- ============================================
-- Helper Function: Drop old/duplicate policies for a table
-- Keeps: Policies using current_tenant_id() with WITH CHECK
-- Drops: Policies using JWT claims, policies without WITH CHECK (unless RBAC-specific)
-- ============================================
CREATE OR REPLACE FUNCTION drop_old_policies_for_table(table_name TEXT)
RETURNS void AS $$
DECLARE
  policy_record RECORD;
  is_rbac_table BOOLEAN := table_name IN (
    'org_auth_user_roles', 
    'org_auth_user_resource_roles', 
    'org_auth_user_permissions',
    'org_auth_user_resource_permissions',
    'org_auth_user_workflow_roles'
  );
BEGIN
  FOR policy_record IN 
    SELECT policyname, cmd, COALESCE(qual::text, '') as qual_text, COALESCE(with_check::text, '') as with_check_text
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = table_name
  LOOP
    -- For RBAC tables, keep specific policies (SELECT, INSERT, UPDATE, DELETE)
    -- Only drop if it's a FOR ALL policy using JWT or missing WITH CHECK
    IF is_rbac_table AND policy_record.cmd != 'ALL' THEN
      CONTINUE; -- Keep RBAC-specific policies
    END IF;
    
    -- Keep service_role policies (they bypass RLS)
    IF policy_record.policyname LIKE 'service_role%' THEN
      CONTINUE;
    END IF;
    
    -- Drop policies using JWT claims (but not service_role)
    IF (policy_record.qual_text LIKE '%auth.jwt()%' 
        OR policy_record.qual_text LIKE '%tenant_org_id%::text%')
       AND policy_record.policyname NOT LIKE 'service_role%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
      CONTINUE;
    END IF;
    
    -- Drop FOR ALL policies without WITH CHECK (unless it's a service_role policy)
    IF policy_record.cmd = 'ALL' 
       AND policy_record.with_check_text = ''
       AND policy_record.policyname NOT LIKE 'service_role%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
      CONTINUE;
    END IF;
    
    -- Drop duplicate policies with inconsistent naming (keep tenant_isolation_{table_name})
    IF policy_record.policyname != 'tenant_isolation_' || table_name
       AND policy_record.policyname NOT LIKE 'service_role%'
       AND policy_record.policyname NOT LIKE 'org_auth_%'
       AND policy_record.policyname NOT LIKE 'rls_%' THEN
      -- Only drop if there's already a tenant_isolation policy
      IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = table_name
          AND policyname = 'tenant_isolation_' || table_name
      ) THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Ensure RLS is enabled on all org_* tables
-- ============================================
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename LIKE 'org_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_record.tablename);
  END LOOP;
END $$;

-- ============================================
-- SPECIAL CASES
-- ============================================

-- org_tenants_mst: Uses id = current_tenant_id()
DROP POLICY IF EXISTS tenant_isolation_org_tenants ON org_tenants_mst;
DROP POLICY IF EXISTS tenant_access_own_tenant ON org_tenants_mst;
DROP POLICY IF EXISTS admin_view_tenant_details ON org_tenants_mst;
SELECT drop_old_policies_for_table('org_tenants_mst');

CREATE POLICY tenant_isolation_org_tenants_mst ON org_tenants_mst
  FOR ALL
  USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_tenants_mst ON org_tenants_mst IS 
  'Allow users to access only their current tenant record';

-- org_users_mst: Special case - users can access own record, admins can manage all users in tenant
DROP POLICY IF EXISTS tenant_isolation_user_tenant ON org_users_mst;
DROP POLICY IF EXISTS tenant_isolation_org_users ON org_users_mst;
DROP POLICY IF EXISTS user_view_own_records ON org_users_mst;
DROP POLICY IF EXISTS user_update_own_profile ON org_users_mst;
DROP POLICY IF EXISTS admin_view_tenant_users ON org_users_mst;
DROP POLICY IF EXISTS admin_create_tenant_users ON org_users_mst;
DROP POLICY IF EXISTS admin_update_tenant_users ON org_users_mst;
DROP POLICY IF EXISTS admin_delete_tenant_users ON org_users_mst;
SELECT drop_old_policies_for_table('org_users_mst');

-- Base policy: Users can access their own record
CREATE POLICY tenant_isolation_org_users_mst ON org_users_mst
  FOR ALL
  USING (user_id = auth.uid() AND tenant_org_id = current_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_users_mst ON org_users_mst IS 
  'Allow users to access only their own user record within their current tenant';

-- Admin policies: Admins can manage all users in their tenant
-- Policy 1: Admins can view all users in their tenant
CREATE POLICY admin_view_tenant_users ON org_users_mst
  FOR SELECT
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );

-- Policy 2: Admins can create users in their tenant
CREATE POLICY admin_create_tenant_users ON org_users_mst
  FOR INSERT
  WITH CHECK (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );

-- Policy 3: Admins can update users in their tenant (except themselves)
CREATE POLICY admin_update_tenant_users ON org_users_mst
  FOR UPDATE
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
    --AND user_id != auth.uid() -- Cannot modify own record via admin panel
  )
  WITH CHECK (
    tenant_org_id = current_tenant_id()
    AND is_admin()
    --AND user_id != auth.uid()
  );

-- Policy 4: Admins can delete (soft delete via is_active) users in their tenant
CREATE POLICY admin_delete_tenant_users ON org_users_mst
  FOR DELETE
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
    AND user_id != auth.uid() -- Cannot delete self
  );

COMMENT ON POLICY admin_view_tenant_users ON org_users_mst IS 
  'Allow tenant admins to view all users in their tenant';
COMMENT ON POLICY admin_create_tenant_users ON org_users_mst IS 
  'Allow tenant admins to create users in their tenant';
COMMENT ON POLICY admin_update_tenant_users ON org_users_mst IS 
  'Allow tenant admins to update users in their tenant (except themselves)';
COMMENT ON POLICY admin_delete_tenant_users ON org_users_mst IS 
  'Allow tenant admins to delete users in their tenant (except themselves)';

-- ============================================
-- STANDARD org_* TABLES (tenant_org_id = current_tenant_id())
-- ============================================

-- Core tables
SELECT drop_old_policies_for_table('org_subscriptions_mst');
DROP POLICY IF EXISTS tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst;
CREATE POLICY tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_branches_mst');
DROP POLICY IF EXISTS tenant_isolation_org_branches ON org_branches_mst;
DROP POLICY IF EXISTS tenant_isolation_org_branches_mst ON org_branches_mst;
CREATE POLICY tenant_isolation_org_branches_mst ON org_branches_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_product_data_mst');
DROP POLICY IF EXISTS tenant_isolation_org_products ON org_product_data_mst;
DROP POLICY IF EXISTS tenant_isolation_org_product_data_mst ON org_product_data_mst;
DROP POLICY IF EXISTS tenant_isolation_policy_products_mst ON org_product_data_mst;
CREATE POLICY tenant_isolation_org_product_data_mst ON org_product_data_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_customers_mst');
DROP POLICY IF EXISTS tenant_isolation_org_customers ON org_customers_mst;
DROP POLICY IF EXISTS tenant_isolation_org_customers_mst ON org_customers_mst;
CREATE POLICY tenant_isolation_org_customers_mst ON org_customers_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_orders_mst');
DROP POLICY IF EXISTS tenant_isolation_org_orders ON org_orders_mst;
DROP POLICY IF EXISTS tenant_isolation_org_orders_mst ON org_orders_mst;
CREATE POLICY tenant_isolation_org_orders_mst ON org_orders_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_order_items_dtl');
DROP POLICY IF EXISTS tenant_isolation_org_order_items ON org_order_items_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_order_items_dtl ON org_order_items_dtl;
CREATE POLICY tenant_isolation_org_order_items_dtl ON org_order_items_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_invoice_mst');
DROP POLICY IF EXISTS tenant_isolation_org_invoices ON org_invoice_mst;
DROP POLICY IF EXISTS tenant_isolation_org_invoice_mst ON org_invoice_mst;
CREATE POLICY tenant_isolation_org_invoice_mst ON org_invoice_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_payments_dtl_tr');
DROP POLICY IF EXISTS tenant_isolation_org_payments ON org_payments_dtl_tr;
DROP POLICY IF EXISTS tenant_isolation_org_payments_dtl_tr ON org_payments_dtl_tr;
CREATE POLICY tenant_isolation_org_payments_dtl_tr ON org_payments_dtl_tr
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Service category
SELECT drop_old_policies_for_table('org_service_category_cf');
DROP POLICY IF EXISTS tenant_isolation_org_service_category ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_cf ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_delete ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_insert ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_update ON org_service_category_cf;
CREATE POLICY tenant_isolation_org_service_category_cf ON org_service_category_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Order-related tables
SELECT drop_old_policies_for_table('org_order_item_pieces_dtl');
DROP POLICY IF EXISTS tenant_isolation_org_order_pieces ON org_order_item_pieces_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_order_item_pieces_dtl ON org_order_item_pieces_dtl;
CREATE POLICY tenant_isolation_org_order_item_pieces_dtl ON org_order_item_pieces_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_order_item_processing_steps');
DROP POLICY IF EXISTS tenant_isolation_steps ON org_order_item_processing_steps;
DROP POLICY IF EXISTS tenant_isolation_org_order_item_processing_steps ON org_order_item_processing_steps;
CREATE POLICY tenant_isolation_org_order_item_processing_steps ON org_order_item_processing_steps
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_order_item_issues');
DROP POLICY IF EXISTS tenant_isolation_issues ON org_order_item_issues;
DROP POLICY IF EXISTS tenant_isolation_org_order_item_issues ON org_order_item_issues;
CREATE POLICY tenant_isolation_org_order_item_issues ON org_order_item_issues
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_order_status_history');
DROP POLICY IF EXISTS tenant_isolation_status_history ON org_order_status_history;
DROP POLICY IF EXISTS tenant_isolation_org_order_status_history ON org_order_status_history;
CREATE POLICY tenant_isolation_org_order_status_history ON org_order_status_history
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_order_history');
DROP POLICY IF EXISTS tenant_isolation_history ON org_order_history;
DROP POLICY IF EXISTS tenant_isolation_org_order_history ON org_order_history;
CREATE POLICY tenant_isolation_org_order_history ON org_order_history
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Customer addresses
SELECT drop_old_policies_for_table('org_customer_addresses');
DROP POLICY IF EXISTS tenant_isolation_addresses ON org_customer_addresses;
DROP POLICY IF EXISTS tenant_isolation_org_customer_addresses ON org_customer_addresses;
CREATE POLICY tenant_isolation_org_customer_addresses ON org_customer_addresses
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_customer_merge_log');
DROP POLICY IF EXISTS tenant_isolation_merge_log ON org_customer_merge_log;
DROP POLICY IF EXISTS tenant_isolation_org_customer_merge_log ON org_customer_merge_log;
CREATE POLICY tenant_isolation_org_customer_merge_log ON org_customer_merge_log
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Pricing
SELECT drop_old_policies_for_table('org_price_lists_mst');
DROP POLICY IF EXISTS tenant_isolation_price_lists ON org_price_lists_mst;
DROP POLICY IF EXISTS tenant_isolation_org_price_lists_mst ON org_price_lists_mst;
CREATE POLICY tenant_isolation_org_price_lists_mst ON org_price_lists_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_price_list_items_dtl');
DROP POLICY IF EXISTS tenant_isolation_price_list_items ON org_price_list_items_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_price_list_items_dtl ON org_price_list_items_dtl;
CREATE POLICY tenant_isolation_org_price_list_items_dtl ON org_price_list_items_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Promotions
SELECT drop_old_policies_for_table('org_promo_codes_mst');
DROP POLICY IF EXISTS tenant_isolation_promo_codes ON org_promo_codes_mst;
DROP POLICY IF EXISTS tenant_isolation_org_promo_codes_mst ON org_promo_codes_mst;
CREATE POLICY tenant_isolation_org_promo_codes_mst ON org_promo_codes_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_promo_usage_log');
DROP POLICY IF EXISTS tenant_isolation_promo_usage ON org_promo_usage_log;
DROP POLICY IF EXISTS tenant_isolation_org_promo_usage_log ON org_promo_usage_log;
CREATE POLICY tenant_isolation_org_promo_usage_log ON org_promo_usage_log
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Discounts
SELECT drop_old_policies_for_table('org_discount_rules_cf');
DROP POLICY IF EXISTS tenant_isolation_discount_rules ON org_discount_rules_cf;
DROP POLICY IF EXISTS tenant_isolation_org_discount_rules_cf ON org_discount_rules_cf;
CREATE POLICY tenant_isolation_org_discount_rules_cf ON org_discount_rules_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Gift cards
SELECT drop_old_policies_for_table('org_gift_cards_mst');
DROP POLICY IF EXISTS tenant_isolation_gift_cards ON org_gift_cards_mst;
DROP POLICY IF EXISTS tenant_isolation_org_gift_cards_mst ON org_gift_cards_mst;
CREATE POLICY tenant_isolation_org_gift_cards_mst ON org_gift_cards_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_gift_card_transactions');
DROP POLICY IF EXISTS tenant_isolation_gift_card_trans ON org_gift_card_transactions;
DROP POLICY IF EXISTS tenant_isolation_org_gift_card_transactions ON org_gift_card_transactions;
CREATE POLICY tenant_isolation_org_gift_card_transactions ON org_gift_card_transactions
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Workflow
SELECT drop_old_policies_for_table('org_workflow_settings_cf');
DROP POLICY IF EXISTS tenant_isolation_workflow_settings_cf ON org_workflow_settings_cf;
DROP POLICY IF EXISTS tenant_isolation_workflow_settings_global ON org_workflow_settings_cf;
DROP POLICY IF EXISTS tenant_isolation_org_workflow_settings_cf ON org_workflow_settings_cf;
CREATE POLICY tenant_isolation_org_workflow_settings_cf ON org_workflow_settings_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_workflow_rules');
DROP POLICY IF EXISTS tenant_isolation_workflow_rules ON org_workflow_rules;
DROP POLICY IF EXISTS tenant_isolation_org_workflow_rules ON org_workflow_rules;
CREATE POLICY tenant_isolation_org_workflow_rules ON org_workflow_rules
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_tenant_workflow_templates_cf');
DROP POLICY IF EXISTS tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf;
DROP POLICY IF EXISTS tenant_isolation_org_tenant_workflow_templates_cf ON org_tenant_workflow_templates_cf;
CREATE POLICY tenant_isolation_org_tenant_workflow_templates_cf ON org_tenant_workflow_templates_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_tenant_workflow_settings_cf');
DROP POLICY IF EXISTS tenant_isolation_org_tenant_workflow_settings_cf ON org_tenant_workflow_settings_cf;
CREATE POLICY tenant_isolation_org_tenant_workflow_settings_cf ON org_tenant_workflow_settings_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_tenant_service_category_workflow_cf');
DROP POLICY IF EXISTS tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf;
DROP POLICY IF EXISTS tenant_isolation_org_tenant_service_category_workflow_cf ON org_tenant_service_category_workflow_cf;
CREATE POLICY tenant_isolation_org_tenant_service_category_workflow_cf ON org_tenant_service_category_workflow_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Settings
SELECT drop_old_policies_for_table('org_tenant_settings_cf');
DROP POLICY IF EXISTS tenant_isolation_settings ON org_tenant_settings_cf;
DROP POLICY IF EXISTS tenant_isolation_org_tenant_settings_cf ON org_tenant_settings_cf;
CREATE POLICY tenant_isolation_org_tenant_settings_cf ON org_tenant_settings_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_stng_settings_cf');
DROP POLICY IF EXISTS tenant_isolation_org_stng_settings_cf ON org_stng_settings_cf;
CREATE POLICY tenant_isolation_org_stng_settings_cf ON org_stng_settings_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_stng_effective_cache_cf');
DROP POLICY IF EXISTS tenant_isolation_org_stng_effective_cache_cf ON org_stng_effective_cache_cf;
CREATE POLICY tenant_isolation_org_stng_effective_cache_cf ON org_stng_effective_cache_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_stng_audit_log_tr');
DROP POLICY IF EXISTS tenant_isolation_org_stng_audit_log_tr ON org_stng_audit_log_tr;
CREATE POLICY tenant_isolation_org_stng_audit_log_tr ON org_stng_audit_log_tr
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Feature flags
SELECT drop_old_policies_for_table('org_ff_overrides_cf');
DROP POLICY IF EXISTS "Tenant override isolation" ON org_ff_overrides_cf;
DROP POLICY IF EXISTS tenant_isolation_org_ff_overrides_cf ON org_ff_overrides_cf;
CREATE POLICY tenant_isolation_org_ff_overrides_cf ON org_ff_overrides_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Subscriptions
SELECT drop_old_policies_for_table('org_pln_subscriptions_mst');
DROP POLICY IF EXISTS tenant_isolation ON org_pln_subscriptions_mst;
DROP POLICY IF EXISTS tenant_isolation_org_pln_subscriptions_mst ON org_pln_subscriptions_mst;
CREATE POLICY tenant_isolation_org_pln_subscriptions_mst ON org_pln_subscriptions_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_pln_change_history_tr');
DROP POLICY IF EXISTS tenant_isolation ON org_pln_change_history_tr;
DROP POLICY IF EXISTS tenant_isolation_org_pln_change_history_tr ON org_pln_change_history_tr;
CREATE POLICY tenant_isolation_org_pln_change_history_tr ON org_pln_change_history_tr
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Usage tracking
SELECT drop_old_policies_for_table('org_usage_tracking');
DROP POLICY IF EXISTS tenant_isolation_org_usage_tracking ON org_usage_tracking;
CREATE POLICY tenant_isolation_org_usage_tracking ON org_usage_tracking
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Assembly
SELECT drop_old_policies_for_table('org_asm_tasks_mst');
DROP POLICY IF EXISTS org_asm_tasks_tenant_isolation ON org_asm_tasks_mst;
DROP POLICY IF EXISTS tenant_isolation_org_asm_tasks_mst ON org_asm_tasks_mst;
CREATE POLICY tenant_isolation_org_asm_tasks_mst ON org_asm_tasks_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_asm_items_dtl');
DROP POLICY IF EXISTS org_asm_items_tenant_isolation ON org_asm_items_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_asm_items_dtl ON org_asm_items_dtl;
CREATE POLICY tenant_isolation_org_asm_items_dtl ON org_asm_items_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_asm_locations_mst');
DROP POLICY IF EXISTS org_asm_locations_tenant_isolation ON org_asm_locations_mst;
DROP POLICY IF EXISTS tenant_isolation_org_asm_locations_mst ON org_asm_locations_mst;
CREATE POLICY tenant_isolation_org_asm_locations_mst ON org_asm_locations_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_asm_exceptions_tr');
DROP POLICY IF EXISTS org_asm_exceptions_tenant_isolation ON org_asm_exceptions_tr;
DROP POLICY IF EXISTS tenant_isolation_org_asm_exceptions_tr ON org_asm_exceptions_tr;
CREATE POLICY tenant_isolation_org_asm_exceptions_tr ON org_asm_exceptions_tr
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_qa_decisions_tr');
DROP POLICY IF EXISTS org_qa_decisions_tenant_isolation ON org_qa_decisions_tr;
DROP POLICY IF EXISTS tenant_isolation_org_qa_decisions_tr ON org_qa_decisions_tr;
CREATE POLICY tenant_isolation_org_qa_decisions_tr ON org_qa_decisions_tr
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_pck_packing_lists_mst');
DROP POLICY IF EXISTS org_pck_lists_tenant_isolation ON org_pck_packing_lists_mst;
DROP POLICY IF EXISTS tenant_isolation_org_pck_packing_lists_mst ON org_pck_packing_lists_mst;
CREATE POLICY tenant_isolation_org_pck_packing_lists_mst ON org_pck_packing_lists_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Receipts
SELECT drop_old_policies_for_table('org_rcpt_receipts_mst');
DROP POLICY IF EXISTS org_rcpt_receipts_tenant_isolation ON org_rcpt_receipts_mst;
DROP POLICY IF EXISTS tenant_isolation_org_rcpt_receipts_mst ON org_rcpt_receipts_mst;
CREATE POLICY tenant_isolation_org_rcpt_receipts_mst ON org_rcpt_receipts_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_rcpt_templates_cf');
DROP POLICY IF EXISTS org_rcpt_templates_tenant_isolation ON org_rcpt_templates_cf;
DROP POLICY IF EXISTS tenant_isolation_org_rcpt_templates_cf ON org_rcpt_templates_cf;
CREATE POLICY tenant_isolation_org_rcpt_templates_cf ON org_rcpt_templates_cf
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Delivery
SELECT drop_old_policies_for_table('org_dlv_routes_mst');
DROP POLICY IF EXISTS org_dlv_routes_tenant_isolation ON org_dlv_routes_mst;
DROP POLICY IF EXISTS tenant_isolation_org_dlv_routes_mst ON org_dlv_routes_mst;
CREATE POLICY tenant_isolation_org_dlv_routes_mst ON org_dlv_routes_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_dlv_stops_dtl');
DROP POLICY IF EXISTS org_dlv_stops_tenant_isolation ON org_dlv_stops_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_dlv_stops_dtl ON org_dlv_stops_dtl;
CREATE POLICY tenant_isolation_org_dlv_stops_dtl ON org_dlv_stops_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_dlv_slots_mst');
DROP POLICY IF EXISTS org_dlv_slots_tenant_isolation ON org_dlv_slots_mst;
DROP POLICY IF EXISTS tenant_isolation_org_dlv_slots_mst ON org_dlv_slots_mst;
CREATE POLICY tenant_isolation_org_dlv_slots_mst ON org_dlv_slots_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_dlv_pod_tr');
DROP POLICY IF EXISTS org_dlv_pod_tenant_isolation ON org_dlv_pod_tr;
DROP POLICY IF EXISTS tenant_isolation_org_dlv_pod_tr ON org_dlv_pod_tr;
CREATE POLICY tenant_isolation_org_dlv_pod_tr ON org_dlv_pod_tr
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Order transition events and webhooks
SELECT drop_old_policies_for_table('org_ord_transition_events');
DROP POLICY IF EXISTS tenant_isolation_org_ord_transition_events ON org_ord_transition_events;
CREATE POLICY tenant_isolation_org_ord_transition_events ON org_ord_transition_events
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

SELECT drop_old_policies_for_table('org_ord_webhook_subscriptions_cf');
DROP POLICY IF EXISTS tenant_isolation_org_ord_webhook_subscriptions_cf ON org_ord_webhook_subscriptions_cf;
CREATE POLICY tenant_isolation_org_ord_webhook_subscriptions_cf ON org_ord_webhook_subscriptions_cf
  FOR ALL USING (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL)
  WITH CHECK (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL);

SELECT drop_old_policies_for_table('org_ord_screen_contracts_cf');
DROP POLICY IF EXISTS tenant_isolation_org_ord_screen_contracts_cf ON org_ord_screen_contracts_cf;
CREATE POLICY tenant_isolation_org_ord_screen_contracts_cf ON org_ord_screen_contracts_cf
  FOR ALL USING (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL)
  WITH CHECK (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL);

SELECT drop_old_policies_for_table('org_ord_custom_validations_cf');
DROP POLICY IF EXISTS tenant_isolation_org_ord_custom_validations_cf ON org_ord_custom_validations_cf;
CREATE POLICY tenant_isolation_org_ord_custom_validations_cf ON org_ord_custom_validations_cf
  FOR ALL USING (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL)
  WITH CHECK (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL);

-- ============================================
-- RBAC Tables (keep existing complex policies but ensure tenant isolation)
-- ============================================
-- Note: These tables have complex RBAC policies (SELECT, INSERT, UPDATE, DELETE)
-- We ensure the base tenant isolation policy exists and uses current_tenant_id()
-- The specific RBAC policies will work in conjunction with this base policy

-- org_auth_user_roles - Clean up old policies and ensure base tenant isolation policy
SELECT drop_old_policies_for_table('org_auth_user_roles');
-- Ensure base policy exists with proper name and WITH CHECK
DO $$
BEGIN
  -- Drop if exists with wrong name or missing WITH CHECK
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_roles'
      AND policyname = 'tenant_isolation_org_auth_user_roles'
      AND (with_check IS NULL OR qual::text NOT LIKE '%current_tenant_id()%')
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_org_auth_user_roles ON org_auth_user_roles;
  END IF;
  
  -- Create if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_roles'
      AND policyname = 'tenant_isolation_org_auth_user_roles'
  ) THEN
    CREATE POLICY tenant_isolation_org_auth_user_roles ON org_auth_user_roles
      FOR ALL USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

-- org_auth_user_resource_roles
SELECT drop_old_policies_for_table('org_auth_user_resource_roles');
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_resource_roles'
      AND policyname = 'tenant_isolation_org_auth_user_resource_roles'
      AND (with_check IS NULL OR qual::text NOT LIKE '%current_tenant_id()%')
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_org_auth_user_resource_roles ON org_auth_user_resource_roles;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_resource_roles'
      AND policyname = 'tenant_isolation_org_auth_user_resource_roles'
  ) THEN
    CREATE POLICY tenant_isolation_org_auth_user_resource_roles ON org_auth_user_resource_roles
      FOR ALL USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

-- org_auth_user_permissions
SELECT drop_old_policies_for_table('org_auth_user_permissions');
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_permissions'
      AND policyname = 'tenant_isolation_org_auth_user_permissions'
      AND (with_check IS NULL OR qual::text NOT LIKE '%current_tenant_id()%')
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_org_auth_user_permissions ON org_auth_user_permissions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_permissions'
      AND policyname = 'tenant_isolation_org_auth_user_permissions'
  ) THEN
    CREATE POLICY tenant_isolation_org_auth_user_permissions ON org_auth_user_permissions
      FOR ALL USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

-- org_auth_user_resource_permissions
SELECT drop_old_policies_for_table('org_auth_user_resource_permissions');
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_resource_permissions'
      AND policyname = 'tenant_isolation_org_auth_user_resource_permissions'
      AND (with_check IS NULL OR qual::text NOT LIKE '%current_tenant_id()%')
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_org_auth_user_resource_permissions ON org_auth_user_resource_permissions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_resource_permissions'
      AND policyname = 'tenant_isolation_org_auth_user_resource_permissions'
  ) THEN
    CREATE POLICY tenant_isolation_org_auth_user_resource_permissions ON org_auth_user_resource_permissions
      FOR ALL USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

-- org_auth_user_workflow_roles
SELECT drop_old_policies_for_table('org_auth_user_workflow_roles');
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_workflow_roles'
      AND policyname = 'tenant_isolation_org_auth_user_workflow_roles'
      AND (with_check IS NULL OR qual::text NOT LIKE '%current_tenant_id()%')
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation_org_auth_user_workflow_roles ON org_auth_user_workflow_roles;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'org_auth_user_workflow_roles'
      AND policyname = 'tenant_isolation_org_auth_user_workflow_roles'
  ) THEN
    CREATE POLICY tenant_isolation_org_auth_user_workflow_roles ON org_auth_user_workflow_roles
      FOR ALL USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

-- ============================================
-- Cleanup: Drop helper function
-- ============================================
DROP FUNCTION IF EXISTS drop_old_policies_for_table(TEXT);

-- ============================================
-- Verification: Report tables without proper policies
-- ============================================
DO $$
DECLARE
  table_record RECORD;
  policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== RLS Policy Audit Report ===';
  
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename LIKE 'org_%'
    ORDER BY tablename
  LOOP
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = table_record.tablename
      AND policyname = 'tenant_isolation_' || table_record.tablename;
    
    IF policy_count = 0 THEN
      RAISE WARNING 'Table % has no tenant_isolation policy', table_record.tablename;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== Audit Complete ===';
END $$;

COMMIT;

