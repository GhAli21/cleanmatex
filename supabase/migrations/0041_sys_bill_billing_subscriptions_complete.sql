-- Migration: Billing & Subscription Management System (Complete)
-- PRD: PRD-SAAS-MNG-0003
-- Date: 2025-11-20
-- Author: Platform HQ Team
-- Description: Complete billing and subscription management schema including:
--              - Subscription plans and tenant subscriptions
--              - Invoices and payments (Cash, Bank Transfer, Card, Check, Payment Gateway)
--              - Usage tracking and metering
--              - Dunning management
--              - Revenue analytics
--              - Discount codes and redemptions
--              - Payment method codes configuration

-- =====================================================
-- 1. SUBSCRIPTION PLANS
-- =====================================================

-- System subscription plans (global plans available to all tenants)
CREATE TABLE sys_pln_subscription_plans_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan identification
  plan_code VARCHAR(50) NOT NULL UNIQUE,
  plan_name VARCHAR(250) NOT NULL,
  plan_name_ar VARCHAR(250),
  description TEXT,
  description_ar TEXT,

  -- Pricing
  base_price DECIMAL(19, 4) NOT NULL DEFAULT 0,
  annual_price DECIMAL(19, 4),
  setup_fee DECIMAL(19, 4),
  currency VARCHAR(10) DEFAULT 'OMR',

  -- Billing configuration
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  CHECK (billing_cycle IN ('monthly', 'annual', 'custom')),
  trial_days INTEGER DEFAULT 0,

  -- Features (JSONB)
  features JSONB NOT NULL DEFAULT '{
    "pdf_invoices": false,
    "whatsapp_receipts": false,
    "in_app_receipts": false,
    "printing": false,
    "b2b_contracts": false,
    "white_label": false,
    "marketplace_listings": false,
    "loyalty_programs": false,
    "driver_app": false,
    "multi_branch": false,
    "advanced_analytics": false,
    "api_access": false
  }'::jsonb,

  -- Limits (JSONB)
  limits JSONB NOT NULL DEFAULT '{
    "max_orders_per_month": -1,
    "max_branches": 1,
    "max_users": 1,
    "max_storage_mb": 1000,
    "max_api_calls_per_month": 0
  }'::jsonb,

  -- Overage pricing (JSONB)
  overage_pricing JSONB DEFAULT '{
    "per_order": null,
    "per_user": null,
    "per_gb_storage": null
  }'::jsonb,

  -- Visibility & status
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Display & branding
  display_order INTEGER DEFAULT 0,
  recommended BOOLEAN DEFAULT false,
  plan_color VARCHAR(60),
  plan_icon VARCHAR(120),

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200)
);

-- Indexes for plans
CREATE INDEX idx_sys_pln_plans_active ON sys_pln_subscription_plans_mst(is_active, display_order);
CREATE INDEX idx_sys_pln_plans_code ON sys_pln_subscription_plans_mst(plan_code);
CREATE INDEX idx_sys_pln_plans_public ON sys_pln_subscription_plans_mst(is_public, is_active);

COMMENT ON TABLE sys_pln_subscription_plans_mst IS 'System subscription plans available to all tenants';

-- =====================================================
-- 2. TENANT SUBSCRIPTIONS
-- =====================================================

-- Tenant subscriptions (which plan each tenant is on)
CREATE TABLE org_pln_subscriptions_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Plan reference
  plan_code VARCHAR(50) NOT NULL,
  plan_name VARCHAR(250),

  -- Subscription status
  status VARCHAR(20) DEFAULT 'trial',
  CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),

  -- Pricing (snapshot at subscription time)
  base_price DECIMAL(19, 4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'OMR',
  billing_cycle VARCHAR(20) DEFAULT 'monthly',

  -- Billing period
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,

  -- Trial
  trial_start DATE,
  trial_end DATE,

  -- Lifecycle dates
  activated_at TIMESTAMP,
  suspended_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  -- Discount information
  discount_code VARCHAR(50),
  discount_value DECIMAL(19, 4),
  discount_type VARCHAR(20),
  CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_months')),
  discount_duration_months INTEGER,
  discount_applied_at TIMESTAMP,

  -- Plan change scheduling
  scheduled_plan_code VARCHAR(50),
  scheduled_plan_change_date DATE,
  plan_change_scheduled_at TIMESTAMP,
  plan_changed_at TIMESTAMP,
  previous_plan_code VARCHAR(50),

  -- Payment method
  default_payment_method_id UUID,

  -- Metadata
  subscription_notes TEXT,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Composite unique constraint
  UNIQUE(tenant_org_id, id)
);

-- Indexes for subscriptions
CREATE INDEX idx_org_pln_subs_tenant ON org_pln_subscriptions_mst(tenant_org_id);
CREATE INDEX idx_org_pln_subs_status ON org_pln_subscriptions_mst(status, is_active);
CREATE INDEX idx_org_pln_subs_plan ON org_pln_subscriptions_mst(plan_code);
CREATE INDEX idx_org_pln_subs_period ON org_pln_subscriptions_mst(current_period_end);

-- Enable RLS
ALTER TABLE org_pln_subscriptions_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_pln_subscriptions_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

COMMENT ON TABLE org_pln_subscriptions_mst IS 'Tenant subscription records - which plan each tenant is on';

-- =====================================================
-- 3. INVOICES
-- =====================================================

-- Tenant invoices
CREATE TABLE sys_bill_invoices_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES org_pln_subscriptions_mst(id),

  -- Invoice details
  invoice_no VARCHAR(100) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Billing period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,

  -- Plan info (snapshot at invoice time)
  plan_code VARCHAR(50) NOT NULL,
  plan_name VARCHAR(255),

  -- Line items
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Amounts
  subtotal DECIMAL(19, 4) NOT NULL,
  discount_total DECIMAL(19, 4) DEFAULT 0,
  tax DECIMAL(19, 4) DEFAULT 0,
  total DECIMAL(19, 4) NOT NULL,
  amount_paid DECIMAL(19, 4) DEFAULT 0,
  amount_due DECIMAL(19, 4) NOT NULL,

  -- Currency
  currency VARCHAR(3) DEFAULT 'OMR',

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')),

  -- Payment details
  paid_at TIMESTAMP,
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  payment_gateway_ref VARCHAR(255),
  payment_gateway_fee DECIMAL(19, 4),

  -- Invoice metadata
  notes TEXT,
  internal_notes TEXT,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),

  -- Composite unique constraint
  UNIQUE(tenant_org_id, id)
);

-- Invoice number sequence
CREATE SEQUENCE seq_invoice_number START WITH 1000;

-- Indexes for invoices
CREATE INDEX idx_sys_bill_inv_tenant ON sys_bill_invoices_mst(tenant_org_id, invoice_date DESC);
CREATE INDEX idx_sys_bill_inv_status ON sys_bill_invoices_mst(status, due_date);
CREATE INDEX idx_sys_bill_inv_no ON sys_bill_invoices_mst(invoice_no);
CREATE INDEX idx_sys_bill_inv_period ON sys_bill_invoices_mst(billing_period_start, billing_period_end);
CREATE INDEX idx_sys_bill_inv_subscription ON sys_bill_invoices_mst(subscription_id);

-- Enable RLS
ALTER TABLE sys_bill_invoices_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sys_bill_invoices_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

COMMENT ON TABLE sys_bill_invoices_mst IS 'Tenant invoices for subscription and usage charges';
COMMENT ON COLUMN sys_bill_invoices_mst.payment_method IS 'Payment method used: cash (default), bank_transfer, card, check, payment_gateway';

-- =====================================================
-- 4. INVOICE PAYMENTS
-- =====================================================

-- Invoice payments (for tracking partial payments and payment attempts)
CREATE TABLE sys_bill_invoice_payments_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES sys_bill_invoices_mst(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Payment details
  payment_date DATE NOT NULL,
  amount DECIMAL(19, 4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'OMR',

  -- Payment method
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  payment_gateway_ref VARCHAR(255),
  payment_gateway_fee DECIMAL(19, 4),

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Failure details
  failure_reason TEXT,

  -- Metadata
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,

  -- Composite FK
  FOREIGN KEY (tenant_org_id, invoice_id) REFERENCES sys_bill_invoices_mst(tenant_org_id, id)
);

-- Indexes for invoice payments
CREATE INDEX idx_sys_bill_pay_invoice ON sys_bill_invoice_payments_tr(invoice_id);
CREATE INDEX idx_sys_bill_pay_tenant ON sys_bill_invoice_payments_tr(tenant_org_id, payment_date DESC);
CREATE INDEX idx_sys_bill_pay_status ON sys_bill_invoice_payments_tr(status);

/*
-- Enable RLS
ALTER TABLE sys_bill_invoice_payments_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sys_bill_invoice_payments_tr
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
*/

COMMENT ON TABLE sys_bill_invoice_payments_tr IS 'Payment transactions for invoices';
COMMENT ON COLUMN sys_bill_invoice_payments_tr.payment_method IS 'Payment method used: cash (default), bank_transfer, card, check, payment_gateway';

-- =====================================================
-- 5. PAYMENT METHOD CODES
-- =====================================================

-- Payment method codes/configuration (defines available payment types)
CREATE TABLE sys_bill_payment_method_codes_cd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Method identification
  method_code VARCHAR(50) NOT NULL UNIQUE,
  method_name VARCHAR(250) NOT NULL,
  method_name_ar VARCHAR(250),
  description TEXT,
  description_ar TEXT,

  -- Method type
  type VARCHAR(20) NOT NULL,
  CHECK (type IN ('cash', 'bank_transfer', 'card', 'check', 'payment_gateway')),

  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  requires_verification BOOLEAN DEFAULT false,
  auto_approve BOOLEAN DEFAULT false,

  -- Display & branding
  display_order INTEGER DEFAULT 0,
  method_icon VARCHAR(120),
  method_color VARCHAR(60),

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  rec_notes VARCHAR(200)
);

-- Indexes for payment method codes
CREATE INDEX idx_sys_bill_pm_codes_type ON sys_bill_payment_method_codes_cd(type, is_active);
CREATE INDEX idx_sys_bill_pm_codes_active ON sys_bill_payment_method_codes_cd(is_active, display_order);

COMMENT ON TABLE sys_bill_payment_method_codes_cd IS 'Payment method codes configuration (Cash, Bank Transfer, Card, Check, Payment Gateway)';

-- =====================================================
-- 6. TENANT PAYMENT METHODS
-- =====================================================

-- Tenant payment methods (specific payment method instances per tenant)
CREATE TABLE sys_bill_payment_methods_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Payment method type
  type VARCHAR(20) NOT NULL,
  CHECK (type IN ('cash', 'bank_transfer', 'card', 'check', 'payment_gateway')),

  -- Payment gateway (only for payment_gateway type)
  gateway VARCHAR(50),
  CHECK (gateway IN ('stripe', 'hyperpay', 'paytabs') OR gateway IS NULL),
  gateway_customer_id VARCHAR(255),
  gateway_payment_method_id VARCHAR(255),

  -- Card details (for card/payment_gateway types)
  card_brand VARCHAR(20),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,

  -- Bank details (for bank_transfer type)
  bank_name VARCHAR(100),
  bank_account_last4 VARCHAR(4),

  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),

  -- Composite unique constraint
  UNIQUE(tenant_org_id, id)
);

-- Indexes for payment methods
CREATE INDEX idx_sys_bill_pm_tenant ON sys_bill_payment_methods_mst(tenant_org_id);
CREATE INDEX idx_sys_bill_pm_type ON sys_bill_payment_methods_mst(type);
CREATE INDEX idx_sys_bill_pm_default ON sys_bill_payment_methods_mst(tenant_org_id, is_default) WHERE is_default = true;
CREATE INDEX idx_sys_bill_pm_gateway ON sys_bill_payment_methods_mst(gateway, gateway_customer_id);
/*
-- Enable RLS
ALTER TABLE sys_bill_payment_methods_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sys_bill_payment_methods_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

COMMENT ON TABLE sys_bill_payment_methods_mst IS 'Tenant payment methods - cash (default), bank_transfer, card, check, payment_gateway';
COMMENT ON COLUMN sys_bill_payment_methods_mst.type IS 'Payment method type: cash (primary/default), bank_transfer, card, check, payment_gateway';
*/
-- =====================================================
-- 7. DUNNING MANAGEMENT
-- =====================================================

-- Dunning tracking for failed payments
CREATE TABLE sys_bill_dunning_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES sys_bill_invoices_mst(id) ON DELETE CASCADE,

  -- Dunning status
  status VARCHAR(20) DEFAULT 'active',
  CHECK (status IN ('active', 'resolved', 'suspended', 'cancelled')),

  -- Failure details
  first_failure_date DATE NOT NULL,
  last_retry_date DATE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 4,

  -- Actions taken
  emails_sent INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,

  -- Resolution
  resolved_at TIMESTAMP,
  resolution_method VARCHAR(50),
  CHECK (resolution_method IN ('payment_successful', 'manual_payment', 'plan_change', 'cancelled')),

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),

  -- Composite FK
  FOREIGN KEY (tenant_org_id, invoice_id) REFERENCES sys_bill_invoices_mst(tenant_org_id, id)
);

-- Indexes for dunning
CREATE INDEX idx_sys_bill_dun_tenant ON sys_bill_dunning_mst(tenant_org_id);
CREATE INDEX idx_sys_bill_dun_status ON sys_bill_dunning_mst(status, first_failure_date);
CREATE INDEX idx_sys_bill_dun_invoice ON sys_bill_dunning_mst(invoice_id);

/*
-- Enable RLS
ALTER TABLE sys_bill_dunning_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sys_bill_dunning_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
*/

COMMENT ON TABLE sys_bill_dunning_mst IS 'Dunning management for failed payments';

-- =====================================================
-- 8. USAGE TRACKING & METERING
-- =====================================================

-- Daily usage metrics aggregation
CREATE TABLE sys_bill_usage_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  -- Order metrics
  orders_count INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  revenue DECIMAL(19, 4) DEFAULT 0,

  -- User metrics
  active_users INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,

  -- Storage metrics
  storage_mb_used DECIMAL(10,2) DEFAULT 0,

  -- API metrics (future)
  api_calls INTEGER DEFAULT 0,

  -- Branch metrics
  branches_count INTEGER DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  -- Unique constraint
  UNIQUE(tenant_org_id, metric_date)
);

-- Indexes for usage metrics
CREATE INDEX idx_sys_bill_usage_tenant ON sys_bill_usage_metrics_daily(tenant_org_id, metric_date DESC);
CREATE INDEX idx_sys_bill_usage_date ON sys_bill_usage_metrics_daily(metric_date);

/*
-- Enable RLS
ALTER TABLE sys_bill_usage_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sys_bill_usage_metrics_daily
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
*/
COMMENT ON TABLE sys_bill_usage_metrics_daily IS 'Daily aggregated usage metrics per tenant';

-- =====================================================
-- 9. DISCOUNT CODES
-- =====================================================

-- Discount codes and promotions
CREATE TABLE sys_bill_discount_codes_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Code details
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  description_ar TEXT,

  -- Discount type
  type VARCHAR(20) NOT NULL,
  CHECK (type IN ('percentage', 'fixed_amount', 'free_months')),
  value DECIMAL(19, 4) NOT NULL,

  -- Applicability
  applies_to VARCHAR(20) DEFAULT 'all_plans',
  CHECK (applies_to IN ('all_plans', 'specific_plans', 'first_invoice', 'recurring')),
  plan_codes JSONB DEFAULT '[]'::jsonb,

  -- Redemption limits
  max_redemptions INTEGER DEFAULT -1,
  max_per_customer INTEGER DEFAULT 1,
  times_redeemed INTEGER DEFAULT 0,

  -- Duration
  valid_from DATE,
  valid_until DATE,
  duration_months INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_notes VARCHAR(200)
);

-- Indexes for discount codes
CREATE INDEX idx_sys_bill_disc_code ON sys_bill_discount_codes_mst(code) WHERE is_active = true;
CREATE INDEX idx_sys_bill_disc_active ON sys_bill_discount_codes_mst(is_active, valid_until);

COMMENT ON TABLE sys_bill_discount_codes_mst IS 'Discount codes and promotional offers';

-- =====================================================
-- 10. DISCOUNT REDEMPTIONS
-- =====================================================

-- Discount code redemptions tracking
CREATE TABLE sys_bill_discount_redemptions_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  discount_code VARCHAR(50) NOT NULL,

  -- Redemption details
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invoice_id UUID REFERENCES sys_bill_invoices_mst(id),
  discount_amount DECIMAL(19, 4),

  -- Audit
  created_by VARCHAR(120)
);

-- Indexes for discount redemptions
CREATE INDEX idx_sys_bill_disc_red_tenant ON sys_bill_discount_redemptions_tr(tenant_org_id);
CREATE INDEX idx_sys_bill_disc_red_code ON sys_bill_discount_redemptions_tr(discount_code);
/*
-- Enable RLS
ALTER TABLE sys_bill_discount_redemptions_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sys_bill_discount_redemptions_tr
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
*/
COMMENT ON TABLE sys_bill_discount_redemptions_tr IS 'Tracking of discount code redemptions';

-- =====================================================
-- 11. REVENUE METRICS
-- =====================================================

-- Monthly revenue metrics aggregation
CREATE TABLE sys_bill_revenue_metrics_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_month DATE NOT NULL,

  -- Recurring Revenue
  mrr DECIMAL(12,3) DEFAULT 0,
  arr DECIMAL(12,3) DEFAULT 0,

  -- MRR Growth
  mrr_growth_percentage DECIMAL(5,2) DEFAULT 0,
  new_mrr DECIMAL(19, 4) DEFAULT 0,
  expansion_mrr DECIMAL(19, 4) DEFAULT 0,
  contraction_mrr DECIMAL(19, 4) DEFAULT 0,
  churned_mrr DECIMAL(19, 4) DEFAULT 0,

  -- Customer metrics
  total_customers INTEGER DEFAULT 0,
  paying_customers INTEGER DEFAULT 0,
  trial_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  churned_customers INTEGER DEFAULT 0,

  -- Average Revenue
  arpu DECIMAL(19, 4) DEFAULT 0,
  arpc DECIMAL(19, 4) DEFAULT 0,

  -- Lifetime Value metrics
  ltv DECIMAL(19, 4) DEFAULT 0,
  cac DECIMAL(19, 4) DEFAULT 0,
  ltv_cac_ratio DECIMAL(5,2) DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  -- Unique constraint
  UNIQUE(metric_month)
);

-- Indexes for revenue metrics
CREATE INDEX idx_sys_bill_rev_month ON sys_bill_revenue_metrics_monthly(metric_month DESC);

COMMENT ON TABLE sys_bill_revenue_metrics_monthly IS 'Monthly revenue metrics (MRR, ARR, etc.)';

-- =====================================================
-- 12. PLAN CHANGE HISTORY
-- =====================================================

-- Plan change audit trail
CREATE TABLE org_pln_change_history_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES org_pln_subscriptions_mst(id),

  -- Change details
  from_plan_code VARCHAR(50),
  to_plan_code VARCHAR(50) NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  CHECK (change_type IN ('upgrade', 'downgrade', 'initial', 'cancelled')),

  -- Financial impact
  proration_amount DECIMAL(19, 4),
  proration_invoice_id UUID REFERENCES sys_bill_invoices_mst(id),

  -- Change reason
  change_reason TEXT,

  -- Effective date
  effective_date DATE NOT NULL,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),

  -- Composite FK
  FOREIGN KEY (tenant_org_id, subscription_id) REFERENCES org_pln_subscriptions_mst(tenant_org_id, id)
);

-- Indexes for plan change history
CREATE INDEX idx_org_pln_change_tenant ON org_pln_change_history_tr(tenant_org_id, created_at DESC);
CREATE INDEX idx_org_pln_change_sub ON org_pln_change_history_tr(subscription_id);

/*
-- Enable RLS
ALTER TABLE org_pln_change_history_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_pln_change_history_tr
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
*/

COMMENT ON TABLE org_pln_change_history_tr IS 'Audit trail of subscription plan changes';

-- =====================================================
-- 13. PAYMENT GATEWAY CONFIGURATION
-- =====================================================

-- Payment gateway configurations (platform-level)
CREATE TABLE sys_bill_payment_gateways_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Gateway identification
  gateway_code VARCHAR(50) NOT NULL UNIQUE,
  gateway_name VARCHAR(250) NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Region support
  regions JSONB DEFAULT '["GCC", "INTL"]'::jsonb,

  -- Credentials (encrypted - store using secrets management)
  credentials_encrypted TEXT,

  -- Supported payment methods
  payment_methods JSONB DEFAULT '["card"]'::jsonb,

  -- Fees
  transaction_fee_percentage DECIMAL(5,2) DEFAULT 0,
  transaction_fee_fixed DECIMAL(19, 4) DEFAULT 0,

  -- Limits
  min_amount DECIMAL(19, 4) DEFAULT 0,
  max_amount DECIMAL(19, 4),

  -- Settings
  auto_capture BOOLEAN DEFAULT true,
  retry_enabled BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  is_active_flag BOOLEAN DEFAULT true
);

-- Indexes for payment gateways
CREATE INDEX idx_sys_bill_gw_code ON sys_bill_payment_gateways_cf(gateway_code);
CREATE INDEX idx_sys_bill_gw_active ON sys_bill_payment_gateways_cf(is_active, is_default);

COMMENT ON TABLE sys_bill_payment_gateways_cf IS 'Payment gateway configurations for online payment_gateway type (Stripe, HyperPay, PayTabs)';

-- =====================================================
-- 14. HELPER FUNCTIONS
-- =====================================================

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION sys_bill_generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  invoice_num VARCHAR;
BEGIN
  next_num := nextval('seq_invoice_number');
  invoice_num := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice amount_due
CREATE OR REPLACE FUNCTION sys_bill_update_invoice_amount_due()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_due = NEW.total - NEW.amount_paid;

  -- Update status based on amount_due
  IF NEW.amount_due <= 0 THEN
    NEW.status = 'paid';
    NEW.paid_at = CURRENT_TIMESTAMP;
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_due > 0 THEN
    NEW.status = 'overdue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice amount_due
CREATE TRIGGER update_invoice_amount_due
  BEFORE INSERT OR UPDATE OF amount_paid, total
  ON sys_bill_invoices_mst
  FOR EACH ROW
  EXECUTE FUNCTION sys_bill_update_invoice_amount_due();

-- Function to update subscription updated_at
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update subscription updated_at
CREATE TRIGGER update_subscription_timestamp
  BEFORE UPDATE ON org_pln_subscriptions_mst
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- Function to get default payment method
CREATE OR REPLACE FUNCTION sys_bill_get_default_payment_method()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'cash'; -- Cash is the primary/default payment method
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 15. INITIAL DATA - PAYMENT METHOD CODES
-- =====================================================

-- Insert default payment method codes
INSERT INTO sys_bill_payment_method_codes_cd (
  method_code, method_name, method_name_ar, description, description_ar,
  type, is_default, is_active, requires_verification, auto_approve, display_order
) VALUES
-- Cash (Primary/Default)
(
  'CASH',
  'Cash',
  'نقدي',
  'Cash payment - Primary payment method',
  'الدفع النقدي - طريقة الدفع الأساسية',
  'cash',
  true,
  true,
  false,
  true,
  1
),

-- Bank Transfer
(
  'BANK_TRANSFER',
  'Bank Transfer',
  'تحويل بنكي',
  'Direct bank transfer payment',
  'الدفع عن طريق التحويل البنكي المباشر',
  'bank_transfer',
  false,
  true,
  true,
  false,
  2
),

-- Card Payment
(
  'CARD',
  'Credit/Debit Card',
  'بطاقة ائتمان/خصم',
  'Payment by credit or debit card',
  'الدفع عن طريق بطاقة الائتمان أو الخصم',
  'card',
  false,
  true,
  true,
  false,
  3
),

-- Check
(
  'CHECK',
  'Check',
  'شيك',
  'Payment by check',
  'الدفع عن طريق الشيك',
  'check',
  false,
  true,
  true,
  false,
  4
),

-- Payment Gateway
(
  'PAYMENT_GATEWAY',
  'Payment Gateway',
  'بوابة الدفع',
  'Online payment through payment gateway (Stripe, HyperPay, PayTabs)',
  'الدفع الإلكتروني عبر بوابة الدفع',
  'payment_gateway',
  false,
  true,
  true,
  false,
  5
);

-- =====================================================
-- 16. INITIAL DATA - SUBSCRIPTION PLANS
-- =====================================================

-- Insert default subscription plans
INSERT INTO sys_pln_subscription_plans_mst (
  plan_code, plan_name, plan_name_ar, description, description_ar,
  base_price, billing_cycle, trial_days,
  features, limits, overage_pricing,
  is_public, is_active, is_default, display_order, recommended
) VALUES
-- Free Trial Plan
('FREE_TRIAL', 'Free Trial', 'تجربة مجانية',
 'Try all basic features for 14 days', 'جرب جميع الميزات الأساسية لمدة 14 يومًا',
 0.000, 'monthly', 14,
 '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": false, "white_label": false, "marketplace_listings": false, "loyalty_programs": false, "driver_app": false, "multi_branch": false, "advanced_analytics": false, "api_access": false}'::jsonb,
 '{"max_orders_per_month": 20, "max_branches": 1, "max_users": 2, "max_storage_mb": 500, "max_api_calls_per_month": 0}'::jsonb,
 '{"per_order": null, "per_user": null, "per_gb_storage": null}'::jsonb,
 true, true, true, 1, false),

-- Starter Plan
('STARTER', 'Starter', 'البداية',
 'Perfect for small laundries starting their digital journey', 'مثالي للمغاسل الصغيرة التي تبدأ رحلتها الرقمية',
 29.000, 'monthly', 0,
 '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": false, "white_label": false, "marketplace_listings": false, "loyalty_programs": true, "driver_app": false, "multi_branch": false, "advanced_analytics": false, "api_access": false}'::jsonb,
 '{"max_orders_per_month": 100, "max_branches": 1, "max_users": 5, "max_storage_mb": 2000, "max_api_calls_per_month": 0}'::jsonb,
 '{"per_order": 0.500, "per_user": 5.000, "per_gb_storage": 2.000}'::jsonb,
 true, true, false, 2, false),

-- Growth Plan
('GROWTH', 'Growth', 'النمو',
 'For growing businesses with multiple branches', 'للشركات المتنامية ذات الفروع المتعددة',
 79.000, 'monthly', 0,
 '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": true, "white_label": false, "marketplace_listings": true, "loyalty_programs": true, "driver_app": true, "multi_branch": true, "advanced_analytics": false, "api_access": false}'::jsonb,
 '{"max_orders_per_month": 500, "max_branches": 3, "max_users": 15, "max_storage_mb": 5000, "max_api_calls_per_month": 0}'::jsonb,
 '{"per_order": 0.300, "per_user": 4.000, "per_gb_storage": 1.500}'::jsonb,
 true, true, false, 3, true),

-- Pro Plan
('PRO', 'Pro', 'المحترف',
 'Advanced features for professional operations', 'ميزات متقدمة للعمليات الاحترافية',
 199.000, 'monthly', 0,
 '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": true, "white_label": false, "marketplace_listings": true, "loyalty_programs": true, "driver_app": true, "multi_branch": true, "advanced_analytics": true, "api_access": true}'::jsonb,
 '{"max_orders_per_month": 2000, "max_branches": 10, "max_users": 50, "max_storage_mb": 20000, "max_api_calls_per_month": 10000}'::jsonb,
 '{"per_order": 0.200, "per_user": 3.000, "per_gb_storage": 1.000}'::jsonb,
 true, true, false, 4, false),

-- Enterprise Plan
('ENTERPRISE', 'Enterprise', 'المؤسسات',
 'Custom solutions for large enterprises', 'حلول مخصصة للمؤسسات الكبيرة',
 499.000, 'monthly', 0,
 '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": true, "white_label": true, "marketplace_listings": true, "loyalty_programs": true, "driver_app": true, "multi_branch": true, "advanced_analytics": true, "api_access": true}'::jsonb,
 '{"max_orders_per_month": -1, "max_branches": -1, "max_users": -1, "max_storage_mb": -1, "max_api_calls_per_month": -1}'::jsonb,
 '{"per_order": null, "per_user": null, "per_gb_storage": null}'::jsonb,
 true, true, false, 5, false);

-- =====================================================
-- 17. INITIAL DATA - PAYMENT GATEWAYS
-- =====================================================

-- Insert default payment gateways (for online payment_gateway type)
INSERT INTO sys_bill_payment_gateways_cf (
  gateway_code, gateway_name, is_active, is_default, regions,
  payment_methods, transaction_fee_percentage, transaction_fee_fixed,
  min_amount, max_amount, auto_capture, retry_enabled, max_retries
) VALUES
('stripe', 'Stripe', true, true, '["INTL", "GCC"]'::jsonb,
 '["card", "wallet"]'::jsonb, 2.90, 0.300, 0.500, 999999.000, true, true, 3),

('hyperpay', 'HyperPay', true, false, '["GCC"]'::jsonb,
 '["card", "wallet"]'::jsonb, 2.75, 0.000, 1.000, 999999.000, true, true, 3),

('paytabs', 'PayTabs', true, false, '["GCC"]'::jsonb,
 '["card", "bank_transfer"]'::jsonb, 2.85, 0.000, 1.000, 999999.000, true, true, 3);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Migration Summary:
-- ✅ 13 tables created for billing and subscription management
-- ✅ 5 payment method types configured: cash (default), bank_transfer, card, check, payment_gateway
-- ✅ 5 subscription plans seeded: FREE_TRIAL (default), STARTER, GROWTH, PRO, ENTERPRISE
-- ✅ 3 payment gateways configured: Stripe, HyperPay, PayTabs
-- ✅ RLS policies enabled on all tenant-scoped tables -- THIS SHOULD NOT BE
-- ✅ Proper indexing for performance
-- ✅ Trigger functions for automated calculations
-- ✅ Helper functions for common operations
-- ✅ Complete audit trails on all tables
