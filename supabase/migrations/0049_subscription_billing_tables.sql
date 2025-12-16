-- ==================================================================
-- 0049_subscription_billing_tables.sql
-- Purpose: Create Subscription & Billing code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for subscription and billing:
-- 1. sys_plans_mst - Subscription plan codes (FREE, STARTER, GROWTH, PRO, ENTERPRISE)
-- 2. sys_plan_features_cd - Plan feature codes
-- 3. sys_billing_cycle_cd - Billing cycle codes (MONTHLY, QUARTERLY, ANNUAL)
-- ==================================================================
-- Note: sys_pln_subscription_plans_mst exists as a master table with full plan details.
--       This sys_plans_mst is a code table for plan type references.
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_plans_mst
-- Purpose: Subscription plan type codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_plans_mst (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Plan Configuration
  plan_tier VARCHAR(20),                            -- 'free', 'starter', 'growth', 'pro', 'enterprise'
  max_tenants INTEGER,                              -- NULL = unlimited
  max_users_per_tenant INTEGER,                     -- NULL = unlimited
  max_storage_gb INTEGER,                           -- NULL = unlimited

  -- Pricing Reference
  base_price_monthly DECIMAL(15,2),
  base_price_annual DECIMAL(15,2),
  currency_code VARCHAR(10) DEFAULT 'SAR',

  -- Features Summary
  includes_features VARCHAR(50)[],                  -- Array of feature codes

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System plans cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "trial_days": 14,
      "setup_fee": 0,
      "recommended": false,
      "popular": false,
      "upgrade_path": ["STARTER", "GROWTH", "PRO"],
      "downgrade_allowed": true
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_plans_active
  ON sys_plans_mst(is_active, display_order);

CREATE INDEX idx_plans_tier
  ON sys_plans_mst(plan_tier, is_active);

-- Comments
COMMENT ON TABLE sys_plans_mst IS
  'Subscription plan type codes (FREE, STARTER, GROWTH, PRO, ENTERPRISE)';

COMMENT ON COLUMN sys_plans_mst.code IS
  'Unique plan code (e.g., FREE, STARTER, GROWTH, PRO, ENTERPRISE)';

COMMENT ON COLUMN sys_plans_mst.plan_tier IS
  'Plan tier level (free, starter, growth, pro, enterprise)';

-- ==================================================================
-- TABLE: sys_plan_features_cd
-- Purpose: Plan feature codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_plan_features_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Feature Classification
  feature_category VARCHAR(50),                     -- 'billing', 'analytics', 'integration', 'customization', 'support'
  feature_type VARCHAR(50),                         -- 'boolean', 'limit', 'addon'
  default_value TEXT,                               -- Default value (true/false, number, etc.)

  -- Limits (for limit-type features)
  max_value INTEGER,                                -- Maximum allowed value
  unit VARCHAR(20),                                 -- Unit of measurement (users, gb, api_calls, etc.)

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System features cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "requires_upgrade": true,
      "upgrade_to": ["PRO", "ENTERPRISE"],
      "addon_available": true,
      "addon_price_monthly": 50,
      "help_url": "https://docs.cleanmatex.com/features/api-access"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_plan_features_active
  ON sys_plan_features_cd(is_active, display_order);

CREATE INDEX idx_plan_features_category
  ON sys_plan_features_cd(feature_category, is_active);

-- Comments
COMMENT ON TABLE sys_plan_features_cd IS
  'Plan feature codes (MULTI_BRANCH, API_ACCESS, CUSTOM_BRANDING, etc.)';

COMMENT ON COLUMN sys_plan_features_cd.code IS
  'Unique feature code (e.g., MULTI_BRANCH, API_ACCESS, CUSTOM_BRANDING)';

COMMENT ON COLUMN sys_plan_features_cd.feature_type IS
  'Type of feature: boolean (on/off), limit (numeric limit), addon (optional addon)';

-- ==================================================================
-- TABLE: sys_billing_cycle_cd
-- Purpose: Billing cycle codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_billing_cycle_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Cycle Configuration
  cycle_type VARCHAR(20) NOT NULL,                 -- 'monthly', 'quarterly', 'annual', 'custom'
  months INTEGER NOT NULL,                          -- Number of months (1, 3, 12, etc.)
  days INTEGER DEFAULT 0,                          -- Additional days (for custom cycles)

  -- Pricing
  discount_percentage DECIMAL(5,2) DEFAULT 0,      -- Discount compared to monthly
  is_prepaid BOOLEAN DEFAULT true,                  -- Is payment upfront or postpaid

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System cycles cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "popular": true,
      "recommended": false,
      "minimum_commitment_months": 12,
      "cancellation_policy": "prorated_refund"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_billing_cycle_active
  ON sys_billing_cycle_cd(is_active, display_order);

CREATE INDEX idx_billing_cycle_type
  ON sys_billing_cycle_cd(cycle_type, is_active);

-- Comments
COMMENT ON TABLE sys_billing_cycle_cd IS
  'Billing cycle codes (MONTHLY, QUARTERLY, ANNUAL, etc.)';

COMMENT ON COLUMN sys_billing_cycle_cd.code IS
  'Unique cycle code (e.g., MONTHLY, QUARTERLY, ANNUAL)';

COMMENT ON COLUMN sys_billing_cycle_cd.months IS
  'Number of months in this billing cycle';

-- ==================================================================
-- SEED DATA: sys_plans_mst
-- ==================================================================

INSERT INTO sys_plans_mst (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  plan_tier,
  max_tenants,
  max_users_per_tenant,
  max_storage_gb,
  base_price_monthly,
  base_price_annual,
  currency_code,
  includes_features,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  (
    'FREE',
    'Free Plan',
    'الخطة المجانية',
    'Free plan with basic features for small businesses',
    'خطة مجانية مع ميزات أساسية للشركات الصغيرة',
    1,
    'gift',
    '#10B981',
    'free',
    NULL,
    1,
    1,
    0,
    0,
    'SAR',
    ARRAY['BASIC_REPORTS', 'EMAIL_SUPPORT'],
    true,
    true,
    true,
    '{"trial_days": 0, "setup_fee": 0, "recommended": false, "popular": false, "upgrade_path": ["STARTER"], "downgrade_allowed": false}'::jsonb
  ),
  (
    'STARTER',
    'Starter Plan',
    'خطة البداية',
    'Starter plan for growing businesses',
    'خطة البداية للشركات النامية',
    2,
    'rocket',
    '#3B82F6',
    'starter',
    NULL,
    5,
    10,
    99,
    990,
    'SAR',
    ARRAY['BASIC_REPORTS', 'EMAIL_SUPPORT', 'MULTI_BRANCH', 'BASIC_ANALYTICS'],
    false,
    true,
    true,
    '{"trial_days": 14, "setup_fee": 0, "recommended": true, "popular": true, "upgrade_path": ["GROWTH", "PRO"], "downgrade_allowed": true}'::jsonb
  ),
  (
    'GROWTH',
    'Growth Plan',
    'خطة النمو',
    'Growth plan for expanding businesses',
    'خطة النمو للشركات المتوسعة',
    3,
    'trending-up',
    '#8B5CF6',
    'growth',
    NULL,
    20,
    50,
    299,
    2990,
    'SAR',
    ARRAY['ADVANCED_REPORTS', 'PRIORITY_SUPPORT', 'MULTI_BRANCH', 'ADVANCED_ANALYTICS', 'API_ACCESS'],
    false,
    true,
    true,
    '{"trial_days": 14, "setup_fee": 0, "recommended": false, "popular": false, "upgrade_path": ["PRO"], "downgrade_allowed": true}'::jsonb
  ),
  (
    'PRO',
    'Professional Plan',
    'الخطة الاحترافية',
    'Professional plan for established businesses',
    'الخطة الاحترافية للشركات الراسخة',
    4,
    'award',
    '#F59E0B',
    'pro',
    NULL,
    100,
    200,
    799,
    7990,
    'SAR',
    ARRAY['ADVANCED_REPORTS', 'PRIORITY_SUPPORT', 'MULTI_BRANCH', 'ADVANCED_ANALYTICS', 'API_ACCESS', 'CUSTOM_BRANDING', 'WHITE_LABEL'],
    false,
    true,
    true,
    '{"trial_days": 14, "setup_fee": 0, "recommended": false, "popular": false, "upgrade_path": ["ENTERPRISE"], "downgrade_allowed": true}'::jsonb
  ),
  (
    'ENTERPRISE',
    'Enterprise Plan',
    'خطة المؤسسات',
    'Enterprise plan with custom features and dedicated support',
    'خطة المؤسسات مع ميزات مخصصة ودعم مخصص',
    5,
    'building-2',
    '#EF4444',
    'enterprise',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'SAR',
    ARRAY['ADVANCED_REPORTS', 'DEDICATED_SUPPORT', 'MULTI_BRANCH', 'ADVANCED_ANALYTICS', 'API_ACCESS', 'CUSTOM_BRANDING', 'WHITE_LABEL', 'CUSTOM_INTEGRATIONS'],
    false,
    true,
    true,
    '{"trial_days": 30, "setup_fee": 0, "recommended": false, "popular": false, "upgrade_path": [], "downgrade_allowed": false}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  plan_tier = EXCLUDED.plan_tier,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_plan_features_cd
-- ==================================================================

INSERT INTO sys_plan_features_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  feature_category,
  feature_type,
  default_value,
  max_value,
  unit,
  is_system,
  is_active,
  metadata
) VALUES
  -- Billing Features
  (
    'PDF_INVOICES',
    'PDF Invoices',
    'فواتير PDF',
    'Generate and download PDF invoices',
    'إنشاء وتنزيل فواتير PDF',
    1,
    'file-text',
    '#3B82F6',
    'billing',
    'boolean',
    'true',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": false, "help_url": "https://docs.cleanmatex.com/features/pdf-invoices"}'::jsonb
  ),
  (
    'WHATSAPP_RECEIPTS',
    'WhatsApp Receipts',
    'إيصالات واتساب',
    'Send receipts via WhatsApp',
    'إرسال الإيصالات عبر واتساب',
    2,
    'message-circle',
    '#25D366',
    'billing',
    'boolean',
    'true',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": false, "help_url": "https://docs.cleanmatex.com/features/whatsapp-receipts"}'::jsonb
  ),
  (
    'IN_APP_RECEIPTS',
    'In-App Receipts',
    'إيصالات داخل التطبيق',
    'Generate receipts within the application',
    'إنشاء الإيصالات داخل التطبيق',
    3,
    'receipt',
    '#10B981',
    'billing',
    'boolean',
    'true',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": false}'::jsonb
  ),
  -- Branch & Multi-Location Features
  (
    'MULTI_BRANCH',
    'Multi-Branch',
    'متعدد الفروع',
    'Support for multiple branches',
    'دعم الفروع المتعددة',
    10,
    'building',
    '#8B5CF6',
    'customization',
    'limit',
    '1',
    NULL,
    'branches',
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["STARTER", "GROWTH", "PRO", "ENTERPRISE"], "addon_available": false}'::jsonb
  ),
  (
    'MULTI_USER',
    'Multi-User',
    'متعدد المستخدمين',
    'Support for multiple users',
    'دعم المستخدمين المتعددين',
    11,
    'users',
    '#3B82F6',
    'customization',
    'limit',
    '1',
    NULL,
    'users',
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["STARTER", "GROWTH", "PRO", "ENTERPRISE"], "addon_available": true, "addon_price_monthly": 10}'::jsonb
  ),
  -- Analytics & Reporting Features
  (
    'BASIC_REPORTS',
    'Basic Reports',
    'التقارير الأساسية',
    'Basic reporting and analytics',
    'التقارير والتحليلات الأساسية',
    20,
    'bar-chart',
    '#10B981',
    'analytics',
    'boolean',
    'true',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": false}'::jsonb
  ),
  (
    'ADVANCED_REPORTS',
    'Advanced Reports',
    'التقارير المتقدمة',
    'Advanced reporting with custom dashboards',
    'التقارير المتقدمة مع لوحات معلومات مخصصة',
    21,
    'trending-up',
    '#8B5CF6',
    'analytics',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["GROWTH", "PRO", "ENTERPRISE"]}'::jsonb
  ),
  (
    'ADVANCED_ANALYTICS',
    'Advanced Analytics',
    'التحليلات المتقدمة',
    'Advanced analytics with predictive insights',
    'التحليلات المتقدمة مع الرؤى التنبؤية',
    22,
    'activity',
    '#F59E0B',
    'analytics',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["GROWTH", "PRO", "ENTERPRISE"]}'::jsonb
  ),
  -- Integration Features
  (
    'API_ACCESS',
    'API Access',
    'الوصول إلى API',
    'REST API access for integrations',
    'الوصول إلى REST API للتكاملات',
    30,
    'code',
    '#6366F1',
    'integration',
    'limit',
    '0',
    1000,
    'api_calls_per_month',
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["GROWTH", "PRO", "ENTERPRISE"], "addon_available": true, "addon_price_monthly": 50}'::jsonb
  ),
  (
    'WEBHOOKS',
    'Webhooks',
    'Webhooks',
    'Webhook notifications for events',
    'إشعارات Webhook للأحداث',
    31,
    'webhook',
    '#8B5CF6',
    'integration',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["PRO", "ENTERPRISE"]}'::jsonb
  ),
  (
    'CUSTOM_INTEGRATIONS',
    'Custom Integrations',
    'تكاملات مخصصة',
    'Custom integration development',
    'تطوير تكاملات مخصصة',
    32,
    'puzzle',
    '#EF4444',
    'integration',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["ENTERPRISE"]}'::jsonb
  ),
  -- Customization Features
  (
    'CUSTOM_BRANDING',
    'Custom Branding',
    'العلامة التجارية المخصصة',
    'Custom logo and branding',
    'الشعار والعلامة التجارية المخصصة',
    40,
    'palette',
    '#F59E0B',
    'customization',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["PRO", "ENTERPRISE"]}'::jsonb
  ),
  (
    'WHITE_LABEL',
    'White Label',
    'العلامة البيضاء',
    'Fully white-labeled solution',
    'حل بالعلامة البيضاء بالكامل',
    41,
    'shield',
    '#EF4444',
    'customization',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["PRO", "ENTERPRISE"]}'::jsonb
  ),
  -- Support Features
  (
    'EMAIL_SUPPORT',
    'Email Support',
    'دعم البريد الإلكتروني',
    'Email support during business hours',
    'دعم البريد الإلكتروني خلال ساعات العمل',
    50,
    'mail',
    '#10B981',
    'support',
    'boolean',
    'true',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": false}'::jsonb
  ),
  (
    'PRIORITY_SUPPORT',
    'Priority Support',
    'دعم ذو أولوية',
    'Priority email and chat support',
    'دعم البريد الإلكتروني والدردشة ذو الأولوية',
    51,
    'headphones',
    '#3B82F6',
    'support',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["GROWTH", "PRO", "ENTERPRISE"]}'::jsonb
  ),
  (
    'DEDICATED_SUPPORT',
    'Dedicated Support',
    'دعم مخصص',
    'Dedicated support manager',
    'مدير دعم مخصص',
    52,
    'user-check',
    '#EF4444',
    'support',
    'boolean',
    'false',
    NULL,
    NULL,
    true,
    true,
    '{"requires_upgrade": true, "upgrade_to": ["ENTERPRISE"]}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  feature_category = EXCLUDED.feature_category,
  feature_type = EXCLUDED.feature_type,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_billing_cycle_cd
-- ==================================================================

INSERT INTO sys_billing_cycle_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  cycle_type,
  months,
  days,
  discount_percentage,
  is_prepaid,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  (
    'MONTHLY',
    'Monthly',
    'شهري',
    'Monthly billing cycle',
    'دورة فوترة شهرية',
    1,
    'calendar',
    '#3B82F6',
    'monthly',
    1,
    0,
    0,
    true,
    true,
    true,
    true,
    '{"popular": true, "recommended": false, "minimum_commitment_months": 1, "cancellation_policy": "end_of_period"}'::jsonb
  ),
  (
    'QUARTERLY',
    'Quarterly',
    'ربع سنوي',
    'Quarterly billing cycle (3 months)',
    'دورة فوترة ربع سنوية (3 أشهر)',
    2,
    'calendar-days',
    '#8B5CF6',
    'quarterly',
    3,
    0,
    5,
    true,
    false,
    true,
    true,
    '{"popular": false, "recommended": false, "minimum_commitment_months": 3, "cancellation_policy": "prorated_refund"}'::jsonb
  ),
  (
    'ANNUAL',
    'Annual',
    'سنوي',
    'Annual billing cycle (12 months)',
    'دورة فوترة سنوية (12 شهراً)',
    3,
    'calendar-check',
    '#10B981',
    'annual',
    12,
    0,
    15,
    true,
    false,
    true,
    true,
    '{"popular": true, "recommended": true, "minimum_commitment_months": 12, "cancellation_policy": "prorated_refund"}'::jsonb
  ),
  (
    'BIANNUAL',
    'Bi-Annual',
    'نصف سنوي',
    'Bi-annual billing cycle (6 months)',
    'دورة فوترة نصف سنوية (6 أشهر)',
    4,
    'calendar-range',
    '#F59E0B',
    'custom',
    6,
    0,
    8,
    true,
    false,
    true,
    true,
    '{"popular": false, "recommended": false, "minimum_commitment_months": 6, "cancellation_policy": "prorated_refund"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  cycle_type = EXCLUDED.cycle_type,
  months = EXCLUDED.months,
  discount_percentage = EXCLUDED.discount_percentage,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_plans_mst',
    'Subscription Plans',
    'خطط الاشتراك',
    'Subscription plan type codes',
    'رموز أنواع خطط الاشتراك',
    'Subscription & Billing',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "credit-card", "color": "#3B82F6", "help_text": "Manage subscription plan types"}'::jsonb
  ),
  (
    'sys_plan_features_cd',
    'Plan Features',
    'ميزات الخطة',
    'Plan feature codes',
    'رموز ميزات الخطة',
    'Subscription & Billing',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "sparkles", "color": "#8B5CF6", "help_text": "Manage plan feature codes"}'::jsonb
  ),
  (
    'sys_billing_cycle_cd',
    'Billing Cycles',
    'دورات الفوترة',
    'Billing cycle codes',
    'رموز دورات الفوترة',
    'Subscription & Billing',
    3,
    true,
    true,
    false,
    true,
    '{"icon": "calendar", "color": "#10B981", "help_text": "Manage billing cycle codes"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

