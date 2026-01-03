-- 0005_tenant_enhancements.sql
-- PRD-002: Tenant Onboarding & Management Enhancements
-- Created: 2025-10-18
-- Author: CleanMateX Development Team

BEGIN;

-- =========================
-- ENHANCE org_tenants_mst
-- =========================

-- Add branding and configuration columns
ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS brand_color_primary VARCHAR(7) DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS brand_color_secondary VARCHAR(7) DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "mon": {"open": "08:00", "close": "18:00"},
    "tue": {"open": "08:00", "close": "18:00"},
    "wed": {"open": "08:00", "close": "18:00"},
    "thu": {"open": "08:00", "close": "18:00"},
    "fri": {"open": "08:00", "close": "18:00"},
    "sat": {"open": "09:00", "close": "14:00"},
    "sun": null
  }'::JSONB,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{
    "pdf_invoices": false,
    "whatsapp_receipts": true,
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
  }'::JSONB;

-- Add comments for documentation
COMMENT ON COLUMN org_tenants_mst.logo_url IS 'URL to tenant logo (stored in MinIO/S3)';
COMMENT ON COLUMN org_tenants_mst.brand_color_primary IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN org_tenants_mst.brand_color_secondary IS 'Secondary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN org_tenants_mst.business_hours IS 'Weekly business hours in JSON format';
COMMENT ON COLUMN org_tenants_mst.feature_flags IS 'Enabled features for this tenant (based on subscription plan)';

-- =========================
-- ENHANCE org_subscriptions_mst
-- =========================

-- Add subscription management columns
ALTER TABLE org_subscriptions_mst
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN org_subscriptions_mst.auto_renew IS 'Whether subscription will auto-renew at end of billing period';
COMMENT ON COLUMN org_subscriptions_mst.cancellation_date IS 'Date when subscription was cancelled (null if active)';
COMMENT ON COLUMN org_subscriptions_mst.cancellation_reason IS 'Reason for cancellation (for analytics)';

-- =========================
-- CREATE org_usage_tracking
-- =========================

CREATE TABLE IF NOT EXISTS org_usage_tracking (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  orders_count      INTEGER DEFAULT 0,
  users_count       INTEGER DEFAULT 0,
  branches_count    INTEGER DEFAULT 0,
  storage_mb        NUMERIC(10,2) DEFAULT 0,
  api_calls         INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_org_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_period ON org_usage_tracking(tenant_org_id, period_start DESC);

COMMENT ON TABLE org_usage_tracking IS 'Tracks resource usage per tenant per billing period';
COMMENT ON COLUMN org_usage_tracking.period_start IS 'Start of the tracking period (typically 1st of month)';
COMMENT ON COLUMN org_usage_tracking.period_end IS 'End of the tracking period (typically last day of month)';
COMMENT ON COLUMN org_usage_tracking.orders_count IS 'Number of orders created in this period';
COMMENT ON COLUMN org_usage_tracking.users_count IS 'Number of active users in this period';
COMMENT ON COLUMN org_usage_tracking.branches_count IS 'Number of active branches';
COMMENT ON COLUMN org_usage_tracking.storage_mb IS 'Storage used in MB (files, images, etc.)';
COMMENT ON COLUMN org_usage_tracking.api_calls IS 'Number of API calls made (for future usage tracking)';

-- =========================
-- CREATE sys_plan_limits
-- =========================

CREATE TABLE IF NOT EXISTS sys_plan_limits (
  plan_code         VARCHAR(50) PRIMARY KEY,
  plan_name         VARCHAR(100) NOT NULL,
  plan_name2        VARCHAR(100),
  plan_description  TEXT,
  plan_description2 TEXT,
  orders_limit      INTEGER NOT NULL,
  users_limit       INTEGER NOT NULL,
  branches_limit    INTEGER NOT NULL,
  storage_mb_limit  INTEGER NOT NULL,
  price_monthly     NUMERIC(10,2) NOT NULL,
  price_yearly      NUMERIC(10,2),
  feature_flags     JSONB NOT NULL,
  is_public         BOOLEAN DEFAULT true,
  display_order     INTEGER,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sys_plan_limits IS 'Defines subscription plan tiers and their limits';
COMMENT ON COLUMN sys_plan_limits.plan_code IS 'Unique identifier for the plan (e.g., free, starter, growth)';
COMMENT ON COLUMN sys_plan_limits.plan_name IS 'Display name in English';
COMMENT ON COLUMN sys_plan_limits.plan_name2 IS 'Display name in Arabic';
COMMENT ON COLUMN sys_plan_limits.orders_limit IS 'Maximum orders per month (-1 for unlimited)';
COMMENT ON COLUMN sys_plan_limits.users_limit IS 'Maximum active users (-1 for unlimited)';
COMMENT ON COLUMN sys_plan_limits.branches_limit IS 'Maximum branches (-1 for unlimited)';
COMMENT ON COLUMN sys_plan_limits.storage_mb_limit IS 'Maximum storage in MB (-1 for unlimited)';
COMMENT ON COLUMN sys_plan_limits.price_monthly IS 'Monthly price in OMR';
COMMENT ON COLUMN sys_plan_limits.price_yearly IS 'Yearly price in OMR (discounted)';
COMMENT ON COLUMN sys_plan_limits.feature_flags IS 'Features enabled in this plan';
COMMENT ON COLUMN sys_plan_limits.is_public IS 'Whether plan is visible to customers';
COMMENT ON COLUMN sys_plan_limits.display_order IS 'Order for displaying plans (lower = shown first)';

-- =========================
-- SEED PLAN DATA
-- =========================

INSERT INTO sys_plan_limits (
  plan_code,
  plan_name,
  plan_name2,
  plan_description,
  plan_description2,
  orders_limit,
  users_limit,
  branches_limit,
  storage_mb_limit,
  price_monthly,
  price_yearly,
  feature_flags,
  display_order
) VALUES
-- Free Trial Plan
(
  'FREE_TRIAL',
  'Free Trial',
  'تجربة مجانية',
  'Perfect for getting started and trying out CleanMateX',
  'مثالي للبدء وتجربة CleanMateX',
  20,
  2,
  1,
  100,
  0,
  0,
  '{
    "pdf_invoices": false,
    "whatsapp_receipts": true,
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
  }'::JSONB,
  1
),
-- Starter Plan
(
  'starter',
  'Starter',
  'المبتدئ',
  'Great for small laundries just getting started',
  'رائع للمغاسل الصغيرة التي بدأت للتو',
  100,
  5,
  1,
  500,
  29,
  290,
  '{
    "pdf_invoices": true,
    "whatsapp_receipts": true,
    "in_app_receipts": true,
    "printing": false,
    "b2b_contracts": false,
    "white_label": false,
    "marketplace_listings": false,
    "loyalty_programs": true,
    "driver_app": false,
    "multi_branch": false,
    "advanced_analytics": false,
    "api_access": false
  }'::JSONB,
  2
),
-- Growth Plan
(
  'growth',
  'Growth',
  'النمو',
  'Ideal for growing businesses with multiple locations',
  'مثالي للشركات المتنامية مع مواقع متعددة',
  500,
  15,
  3,
  2000,
  79,
  790,
  '{
    "pdf_invoices": true,
    "whatsapp_receipts": true,
    "in_app_receipts": true,
    "printing": true,
    "b2b_contracts": false,
    "white_label": false,
    "marketplace_listings": true,
    "loyalty_programs": true,
    "driver_app": true,
    "multi_branch": true,
    "advanced_analytics": false,
    "api_access": false
  }'::JSONB,
  3
),
-- Pro Plan
(
  'pro',
  'Pro',
  'الاحترافي',
  'Advanced features for professional operations',
  'ميزات متقدمة للعمليات الاحترافية',
  2000,
  50,
  10,
  10000,
  199,
  1990,
  '{
    "pdf_invoices": true,
    "whatsapp_receipts": true,
    "in_app_receipts": true,
    "printing": true,
    "b2b_contracts": true,
    "white_label": false,
    "marketplace_listings": true,
    "loyalty_programs": true,
    "driver_app": true,
    "multi_branch": true,
    "advanced_analytics": true,
    "api_access": true
  }'::JSONB,
  4
),
-- Enterprise Plan
(
  'enterprise',
  'Enterprise',
  'المؤسسات',
  'Custom solution for large organizations',
  'حل مخصص للمؤسسات الكبيرة',
  -1,
  -1,
  -1,
  -1,
  0,
  0,
  '{
    "pdf_invoices": true,
    "whatsapp_receipts": true,
    "in_app_receipts": true,
    "printing": true,
    "b2b_contracts": true,
    "white_label": true,
    "marketplace_listings": true,
    "loyalty_programs": true,
    "driver_app": true,
    "multi_branch": true,
    "advanced_analytics": true,
    "api_access": true
  }'::JSONB,
  5
)
ON CONFLICT (plan_code) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  plan_name2 = EXCLUDED.plan_name2,
  plan_description = EXCLUDED.plan_description,
  plan_description2 = EXCLUDED.plan_description2,
  orders_limit = EXCLUDED.orders_limit,
  users_limit = EXCLUDED.users_limit,
  branches_limit = EXCLUDED.branches_limit,
  storage_mb_limit = EXCLUDED.storage_mb_limit,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  feature_flags = EXCLUDED.feature_flags,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- =========================
-- VALIDATION
-- =========================

-- Verify plan limits seeded
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM sys_plan_limits) = 5, 'Expected 5 plans to be seeded';
  ASSERT (SELECT COUNT(*) FROM sys_plan_limits WHERE is_public = true) = 5, 'All plans should be public';
END $$;

COMMIT;

-- Migration completed successfully
-- Next steps:
-- 1. Verify with: SELECT * FROM sys_plan_limits ORDER BY display_order;
-- 2. Test tenant creation with default feature_flags
-- 3. Test usage tracking table functionality
