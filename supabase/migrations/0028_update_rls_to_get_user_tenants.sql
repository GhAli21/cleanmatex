-- 0028_update_rls_to_get_user_tenants.sql
-- Purpose: Update all RLS policies to use get_user_tenants() instead of JWT claims
-- Reason: JWT doesn't contain tenant_org_id by default, get_user_tenants() is more reliable
-- Created: 2025-11-06
-- Author: CleanMateX Development Team

BEGIN;

-- ==================================================================
-- DROP OLD JWT-BASED POLICIES
-- ==================================================================

-- Core tables (from 0002_core_rls.sql)
DROP POLICY IF EXISTS tenant_isolation_org_tenants ON org_tenants_mst;
DROP POLICY IF EXISTS tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst;
DROP POLICY IF EXISTS tenant_isolation_org_branches ON org_branches_mst;
DROP POLICY IF EXISTS tenant_isolation_org_service_category ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_products ON org_product_data_mst;
DROP POLICY IF EXISTS tenant_isolation_org_customers ON org_customers_mst;
DROP POLICY IF EXISTS tenant_isolation_org_orders ON org_orders_mst;
DROP POLICY IF EXISTS tenant_isolation_org_order_items ON org_order_items_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_invoices ON org_invoice_mst;
DROP POLICY IF EXISTS tenant_isolation_org_payments ON org_payments_dtl_tr;

-- Customer enhancements (from 0011_customer_enhancements.sql)
DROP POLICY IF EXISTS tenant_isolation_addresses ON org_customer_addresses;
DROP POLICY IF EXISTS tenant_isolation_merge_log ON org_customer_merge_log;

-- Order history (from 0022_order_history_canonical.sql)
DROP POLICY IF EXISTS tenant_isolation_history ON org_order_history;

-- Workflow config (from 0019_tenant_workflow_config.sql)
DROP POLICY IF EXISTS tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf;
DROP POLICY IF EXISTS tenant_isolation_workflow_settings ON org_tenant_workflow_settings_cf;
DROP POLICY IF EXISTS tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf;

-- Order issues and steps (from 0021_order_issues_steps.sql)
DROP POLICY IF EXISTS tenant_isolation_issues ON org_order_item_issues;
DROP POLICY IF EXISTS tenant_isolation_steps ON org_order_item_processing_steps;

-- Catalog pricing (from 0014_catalog_pricing_tables.sql)
DROP POLICY IF EXISTS tenant_isolation_policy ON org_price_lists_mst;
DROP POLICY IF EXISTS tenant_isolation_policy ON org_price_list_items_dtl;

-- Workflow status system (from 0013_workflow_status_system.sql)
DROP POLICY IF EXISTS tenant_isolation_status_history ON org_order_status_history;
DROP POLICY IF EXISTS tenant_isolation_workflow_settings ON org_workflow_settings_cf;
DROP POLICY IF EXISTS tenant_isolation_workflow_rules ON org_workflow_rules;

-- Preparation itemization (from 0015_preparation_itemization.sql)
DROP POLICY IF EXISTS tenant_isolation_all ON org_order_items_dtl;

-- Products RLS (from 0026_products_rls.sql) - already using get_user_tenants, but drop duplicates
DROP POLICY IF EXISTS tenant_isolation_org_service_category2 ON org_service_category_cf;

-- ==================================================================
-- CREATE NEW POLICIES USING get_user_tenants()
-- ==================================================================

-- Core Tables
-- Tenants (each user can only see their own tenant record)
CREATE POLICY tenant_isolation_org_tenants ON org_tenants_mst
  FOR ALL
  USING (id IN (SELECT tenant_id FROM get_user_tenants()));

-- Subscriptions
CREATE POLICY tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Branches
CREATE POLICY tenant_isolation_org_branches ON org_branches_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Service Categories
CREATE POLICY tenant_isolation_org_service_category ON org_service_category_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Products
CREATE POLICY tenant_isolation_org_products ON org_product_data_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Customers (link table)
CREATE POLICY tenant_isolation_org_customers ON org_customers_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Orders
CREATE POLICY tenant_isolation_org_orders ON org_orders_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Order Items
CREATE POLICY tenant_isolation_org_order_items ON org_order_items_dtl
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Invoices
CREATE POLICY tenant_isolation_org_invoices ON org_invoice_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Payments
CREATE POLICY tenant_isolation_org_payments ON org_payments_dtl_tr
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Customer Addresses
CREATE POLICY tenant_isolation_addresses ON org_customer_addresses
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Customer Merge Log
CREATE POLICY tenant_isolation_merge_log ON org_customer_merge_log
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Order History
CREATE POLICY tenant_isolation_history ON org_order_history
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Workflow Templates
CREATE POLICY tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Workflow Settings
CREATE POLICY tenant_isolation_workflow_settings ON org_tenant_workflow_settings_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Category Workflow
CREATE POLICY tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Order Item Issues
CREATE POLICY tenant_isolation_issues ON org_order_item_issues
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Processing Steps
CREATE POLICY tenant_isolation_steps ON org_order_item_processing_steps
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Price Lists
CREATE POLICY tenant_isolation_price_lists ON org_price_lists_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Price List Items
CREATE POLICY tenant_isolation_price_list_items ON org_price_list_items_dtl
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Order Status History
CREATE POLICY tenant_isolation_status_history ON org_order_status_history
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Workflow Settings (global)
CREATE POLICY tenant_isolation_workflow_settings_global ON org_workflow_settings_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Workflow Rules
CREATE POLICY tenant_isolation_workflow_rules ON org_workflow_rules
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- ==================================================================
-- VERIFICATION
-- ==================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Count policies using get_user_tenants
  -- pg_policies uses 'qual' column for USING clause and 'with_check' for WITH CHECK clause
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual::text LIKE '%get_user_tenants%' 
      OR with_check::text LIKE '%get_user_tenants%'
    );
  
  RAISE NOTICE '✅ Migration complete. % policies now use get_user_tenants()', policy_count;
END $$;

COMMIT;

-- ==================================================================
-- NOTES
-- ==================================================================
-- This migration updates all RLS policies to use get_user_tenants() 
-- instead of JWT claims (auth.jwt() ->> 'tenant_org_id').
--
-- Benefits:
-- 1. Works without JWT customization
-- 2. Supports multi-tenant users
-- 3. More reliable (queries database directly)
-- 4. Consistent across all tables
--
-- Service role policies are preserved (they use auth.jwt() ->> 'role' = 'service_role')
-- which is fine since 'role' is a standard JWT claim.

