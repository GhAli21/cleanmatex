-- Migration 0134: Add missing audit columns to tables that don't have them
-- Audit columns per database conventions: created_at, created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
-- Uses ADD COLUMN IF NOT EXISTS for idempotency. Do NOT apply if columns already exist.
-- You will apply this migration manually.

BEGIN;

-- org_customer_addresses: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_customer_addresses
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_customer_merge_log: missing created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_customer_merge_log
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_order_items_dtl: missing created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_order_status_history: missing created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_order_status_history
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_order_edit_locks: missing all audit columns (has locked_at, locked_by - different purpose)
ALTER TABLE org_order_edit_locks
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_order_history: missing created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_order_history
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_order_item_issues: missing created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_order_item_issues
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_order_item_processing_steps: missing all audit columns (has done_at, done_by)
ALTER TABLE org_order_item_processing_steps
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_usage_tracking: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_usage_tracking
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_workflow_rules: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_workflow_rules
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_workflow_settings_cf: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_workflow_settings_cf
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_tenant_service_category_workflow_cf: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_tenant_service_category_workflow_cf
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_tenant_workflow_settings_cf: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_tenant_workflow_settings_cf
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_tenant_workflow_templates_cf: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_tenant_workflow_templates_cf
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_gift_card_transactions: missing all audit columns (has transaction_date, processed_by)
ALTER TABLE org_gift_card_transactions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_promo_usage_log: missing all audit columns (has used_at, used_by)
ALTER TABLE org_promo_usage_log
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_order_type_cd: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_order_type_cd
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_otp_codes: missing created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_otp_codes
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_plan_limits: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_plan_limits
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_service_category_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_service_category_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_payment_method_cd: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_payment_method_cd
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_payment_type_cd: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_payment_type_cd
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_auth_user_permissions: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_auth_user_permissions
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_auth_user_resource_permissions: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_auth_user_resource_permissions
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_auth_user_resource_roles: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_auth_user_resource_roles
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_auth_user_roles: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_auth_user_roles
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_auth_user_workflow_roles: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_auth_user_workflow_roles
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_auth_roles: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_auth_roles
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- hq_roles: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE hq_roles
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- hq_session_tokens: missing created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE hq_session_tokens
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- hq_tenant_status_history: missing all audit columns
ALTER TABLE hq_tenant_status_history
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_tenant_lifecycle: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_tenant_lifecycle
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_tenant_metrics_daily: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_tenant_metrics_daily
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- org_pln_change_history_tr: missing created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE org_pln_change_history_tr
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_discount_redemptions_tr: missing created_at, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_discount_redemptions_tr
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_invoice_payments_tr: missing updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_invoice_payments_tr
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_dunning_mst: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_dunning_mst
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_payment_gateways_cf: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_payment_gateways_cf
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_payment_method_codes_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_payment_method_codes_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_payment_methods_mst: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_payment_methods_mst
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_revenue_metrics_monthly: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_revenue_metrics_monthly
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_bill_usage_metrics_daily: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_bill_usage_metrics_daily
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_code_tables_registry: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_code_tables_registry
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_order_status_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_order_status_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_payment_gateway_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_payment_gateway_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_payment_status_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_payment_status_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_billing_cycle_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_billing_cycle_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_language_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_language_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_metric_type_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_metric_type_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_notification_channel_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_notification_channel_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_notification_type_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_notification_type_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_permission_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_permission_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_plan_features_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_plan_features_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_plans_mst: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_plans_mst
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_quality_check_status_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_quality_check_status_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_report_category_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_report_category_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_item_type_cd: missing created_info, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_item_type_cd
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_workflow_template_cd: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_workflow_template_cd
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_workflow_template_stages: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_workflow_template_stages
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

-- sys_workflow_template_transitions: missing created_by, created_info, updated_by, updated_info, rec_status, rec_order, rec_notes
ALTER TABLE sys_workflow_template_transitions
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_info TEXT NULL,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER NULL,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT NULL;

COMMIT;
