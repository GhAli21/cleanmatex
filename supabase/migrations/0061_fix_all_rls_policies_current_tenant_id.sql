-- ==================================================================
-- Fix ALL RLS Policies to Use current_tenant_id()
-- Migration: 0061_fix_all_rls_policies_current_tenant_id
-- Purpose: Update ALL org_* RLS policies to use current_tenant_id() 
--          instead of JWT claims, and add WITH CHECK clauses
-- Reason: JWT doesn't contain tenant_org_id, but current_tenant_id() 
--         has fallback to query org_users_mst
-- Created: 2025-01-XX
-- ==================================================================

BEGIN;

-- ============================================
-- CORE TABLES (from 0002_core_rls.sql)
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE org_tenants_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_subscriptions_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_branches_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_product_data_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_customers_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_orders_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_items_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invoice_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_payments_dtl_tr ENABLE ROW LEVEL SECURITY;

-- Fix org_tenants_mst
DROP POLICY IF EXISTS tenant_isolation_org_tenants ON org_tenants_mst;
CREATE POLICY tenant_isolation_org_tenants ON org_tenants_mst
  FOR ALL
  USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_tenants ON org_tenants_mst IS 
  'Allow users to access only their current tenant record';

-- Fix org_subscriptions_mst
DROP POLICY IF EXISTS tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst;
CREATE POLICY tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_subscriptions_mst ON org_subscriptions_mst IS 
  'Allow users to access subscriptions for their current tenant';

-- Fix org_branches_mst
DROP POLICY IF EXISTS tenant_isolation_org_branches ON org_branches_mst;
CREATE POLICY tenant_isolation_org_branches ON org_branches_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_branches ON org_branches_mst IS 
  'Allow users to access branches for their current tenant';

-- Fix org_product_data_mst
DROP POLICY IF EXISTS tenant_isolation_org_products ON org_product_data_mst;
CREATE POLICY tenant_isolation_org_products ON org_product_data_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_products ON org_product_data_mst IS 
  'Allow users to access products for their current tenant';

-- Fix org_customers_mst
DROP POLICY IF EXISTS tenant_isolation_org_customers ON org_customers_mst;
CREATE POLICY tenant_isolation_org_customers ON org_customers_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_customers ON org_customers_mst IS 
  'Allow users to access customers for their current tenant';

-- Fix org_orders_mst (PRIMARY FIX - Your Current Issue)
DROP POLICY IF EXISTS tenant_isolation_org_orders ON org_orders_mst;
CREATE POLICY tenant_isolation_org_orders ON org_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_orders ON org_orders_mst IS 
  'Allow users to access orders for their current tenant. Fixes INSERT operation failures.';

-- Fix org_order_items_dtl
DROP POLICY IF EXISTS tenant_isolation_org_order_items ON org_order_items_dtl;
CREATE POLICY tenant_isolation_org_order_items ON org_order_items_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_order_items ON org_order_items_dtl IS 
  'Allow users to access order items for their current tenant';

-- Fix org_invoice_mst
DROP POLICY IF EXISTS tenant_isolation_org_invoices ON org_invoice_mst;
CREATE POLICY tenant_isolation_org_invoices ON org_invoice_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_invoices ON org_invoice_mst IS 
  'Allow users to access invoices for their current tenant';

-- Fix org_payments_dtl_tr
DROP POLICY IF EXISTS tenant_isolation_org_payments ON org_payments_dtl_tr;
CREATE POLICY tenant_isolation_org_payments ON org_payments_dtl_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_payments ON org_payments_dtl_tr IS 
  'Allow users to access payments for their current tenant';

-- ============================================
-- CUSTOMER-RELATED TABLES
-- ============================================

ALTER TABLE org_customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_customer_merge_log ENABLE ROW LEVEL SECURITY;

-- Fix org_customer_addresses
DROP POLICY IF EXISTS tenant_isolation_addresses ON org_customer_addresses;
CREATE POLICY tenant_isolation_addresses ON org_customer_addresses
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_addresses ON org_customer_addresses IS 
  'Allow users to access customer addresses for their current tenant';

-- Fix org_customer_merge_log
DROP POLICY IF EXISTS tenant_isolation_merge_log ON org_customer_merge_log;
CREATE POLICY tenant_isolation_merge_log ON org_customer_merge_log
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_merge_log ON org_customer_merge_log IS 
  'Allow users to access customer merge logs for their current tenant';

-- ============================================
-- ORDER-RELATED TABLES
-- ============================================

ALTER TABLE org_order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_item_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_item_processing_steps ENABLE ROW LEVEL SECURITY;

-- Fix org_order_history
DROP POLICY IF EXISTS tenant_isolation_history ON org_order_history;
CREATE POLICY tenant_isolation_history ON org_order_history
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_history ON org_order_history IS 
  'Allow users to access order history for their current tenant';

-- Fix org_order_item_issues
DROP POLICY IF EXISTS tenant_isolation_issues ON org_order_item_issues;
CREATE POLICY tenant_isolation_issues ON org_order_item_issues
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_issues ON org_order_item_issues IS 
  'Allow users to access order item issues for their current tenant';

-- Fix org_order_item_processing_steps
DROP POLICY IF EXISTS tenant_isolation_steps ON org_order_item_processing_steps;
CREATE POLICY tenant_isolation_steps ON org_order_item_processing_steps
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_steps ON org_order_item_processing_steps IS 
  'Allow users to access order item processing steps for their current tenant';

-- ============================================
-- WORKFLOW-RELATED TABLES
-- ============================================

ALTER TABLE org_tenant_workflow_templates_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tenant_workflow_settings_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tenant_service_category_workflow_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_workflow_settings_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_workflow_rules ENABLE ROW LEVEL SECURITY;

-- Fix org_tenant_workflow_templates_cf
DROP POLICY IF EXISTS tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf;
CREATE POLICY tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_workflow_templates ON org_tenant_workflow_templates_cf IS 
  'Allow users to access workflow templates for their current tenant';

-- Fix org_tenant_workflow_settings_cf
DROP POLICY IF EXISTS tenant_isolation_workflow_settings ON org_tenant_workflow_settings_cf;
CREATE POLICY tenant_isolation_workflow_settings ON org_tenant_workflow_settings_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_workflow_settings ON org_tenant_workflow_settings_cf IS 
  'Allow users to access workflow settings for their current tenant';

-- Fix org_tenant_service_category_workflow_cf
DROP POLICY IF EXISTS tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf;
CREATE POLICY tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_category_workflow ON org_tenant_service_category_workflow_cf IS 
  'Allow users to access service category workflow config for their current tenant';

-- Fix org_order_status_history
DROP POLICY IF EXISTS tenant_isolation_status_history ON org_order_status_history;
CREATE POLICY tenant_isolation_status_history ON org_order_status_history
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_status_history ON org_order_status_history IS 
  'Allow users to access order status history for their current tenant';

-- Fix org_workflow_settings_cf
DROP POLICY IF EXISTS tenant_isolation_workflow_settings_cf ON org_workflow_settings_cf;
CREATE POLICY tenant_isolation_workflow_settings_cf ON org_workflow_settings_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_workflow_settings_cf ON org_workflow_settings_cf IS 
  'Allow users to access workflow settings for their current tenant';

-- Fix org_workflow_rules
DROP POLICY IF EXISTS tenant_isolation_workflow_rules ON org_workflow_rules;
CREATE POLICY tenant_isolation_workflow_rules ON org_workflow_rules
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_workflow_rules ON org_workflow_rules IS 
  'Allow users to access workflow rules for their current tenant';

-- ============================================
-- PRICING-RELATED TABLES
-- ============================================

ALTER TABLE org_price_lists_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_price_list_items_dtl ENABLE ROW LEVEL SECURITY;

-- Fix org_price_lists_mst
-- Note: Policy name might conflict, drop all variations
DROP POLICY IF EXISTS tenant_isolation_policy ON org_price_lists_mst;
DROP POLICY IF EXISTS tenant_isolation_price_lists ON org_price_lists_mst;
CREATE POLICY tenant_isolation_price_lists ON org_price_lists_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_price_lists ON org_price_lists_mst IS 
  'Allow users to access price lists for their current tenant';

-- Fix org_price_list_items_dtl
DROP POLICY IF EXISTS tenant_isolation_policy ON org_price_list_items_dtl;
DROP POLICY IF EXISTS tenant_isolation_price_list_items ON org_price_list_items_dtl;
CREATE POLICY tenant_isolation_price_list_items ON org_price_list_items_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_price_list_items ON org_price_list_items_dtl IS 
  'Allow users to access price list items for their current tenant';

-- ============================================
-- SETTINGS TABLES
-- ============================================

ALTER TABLE org_tenant_settings_cf ENABLE ROW LEVEL SECURITY;

-- Fix org_tenant_settings_cf
-- Drop all possible policy names
DROP POLICY IF EXISTS rls_ots_select ON org_tenant_settings_cf;
DROP POLICY IF EXISTS rls_ots_ins ON org_tenant_settings_cf;
DROP POLICY IF EXISTS rls_ots_upd ON org_tenant_settings_cf;
DROP POLICY IF EXISTS rls_ots_del ON org_tenant_settings_cf;
DROP POLICY IF EXISTS tenant_isolation_settings ON org_tenant_settings_cf;

CREATE POLICY tenant_isolation_settings ON org_tenant_settings_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_settings ON org_tenant_settings_cf IS 
  'Allow users to access tenant settings for their current tenant';

-- ============================================
-- PAYMENT-RELATED TABLES
-- ============================================

ALTER TABLE org_promo_codes_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_promo_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_gift_cards_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_discount_rules_cf ENABLE ROW LEVEL SECURITY;

-- Fix org_promo_codes_mst
DROP POLICY IF EXISTS tenant_isolation_promo_codes ON org_promo_codes_mst;
CREATE POLICY tenant_isolation_promo_codes ON org_promo_codes_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_promo_codes ON org_promo_codes_mst IS 
  'Allow users to access promo codes for their current tenant';

-- Fix org_promo_usage_log
DROP POLICY IF EXISTS tenant_isolation_promo_usage ON org_promo_usage_log;
CREATE POLICY tenant_isolation_promo_usage ON org_promo_usage_log
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_promo_usage ON org_promo_usage_log IS 
  'Allow users to access promo usage logs for their current tenant';

-- Fix org_gift_cards_mst
DROP POLICY IF EXISTS tenant_isolation_gift_cards ON org_gift_cards_mst;
CREATE POLICY tenant_isolation_gift_cards ON org_gift_cards_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_gift_cards ON org_gift_cards_mst IS 
  'Allow users to access gift cards for their current tenant';

-- Fix org_gift_card_transactions
DROP POLICY IF EXISTS tenant_isolation_gift_card_trans ON org_gift_card_transactions;
CREATE POLICY tenant_isolation_gift_card_trans ON org_gift_card_transactions
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_gift_card_trans ON org_gift_card_transactions IS 
  'Allow users to access gift card transactions for their current tenant';

-- Fix org_discount_rules_cf
DROP POLICY IF EXISTS tenant_isolation_discount_rules ON org_discount_rules_cf;
CREATE POLICY tenant_isolation_discount_rules ON org_discount_rules_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_discount_rules ON org_discount_rules_cf IS 
  'Allow users to access discount rules for their current tenant';

-- ============================================
-- SUBSCRIPTION/BILLING TABLES
-- ============================================

ALTER TABLE org_pln_subscriptions_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pln_change_history_tr ENABLE ROW LEVEL SECURITY;

-- Fix org_pln_subscriptions_mst
DROP POLICY IF EXISTS tenant_isolation ON org_pln_subscriptions_mst;
CREATE POLICY tenant_isolation ON org_pln_subscriptions_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation ON org_pln_subscriptions_mst IS 
  'Allow users to access platform subscriptions for their current tenant';

-- Fix org_pln_change_history_tr
DROP POLICY IF EXISTS tenant_isolation ON org_pln_change_history_tr;
CREATE POLICY tenant_isolation ON org_pln_change_history_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation ON org_pln_change_history_tr IS 
  'Allow users to access platform subscription change history for their current tenant';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify policies are correct:
-- 
-- 1. Check all policies have WITH CHECK clause:
-- SELECT tablename, policyname, cmd, 
--        CASE WHEN with_check IS NULL OR with_check = '' THEN 'MISSING' ELSE 'OK' END as with_check_status
-- FROM pg_policies 
-- WHERE tablename LIKE 'org_%'
--   AND schemaname = 'public'
--   AND cmd = 'ALL'
-- ORDER BY tablename, policyname;
--
-- 2. Check all policies use current_tenant_id():
-- SELECT tablename, policyname, qual, with_check
-- FROM pg_policies 
-- WHERE tablename LIKE 'org_%'
--   AND schemaname = 'public'
--   AND (qual LIKE '%current_tenant_id%' OR with_check LIKE '%current_tenant_id%')
-- ORDER BY tablename, policyname;
--
-- 3. Count policies per table:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies 
-- WHERE tablename LIKE 'org_%'
--   AND schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;

COMMIT;
