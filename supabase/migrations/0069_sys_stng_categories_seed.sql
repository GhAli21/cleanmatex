-- Migration: 0069_sys_stng_categories_seed.sql
-- Description: Seed 8 categories for Settings & Configuration System
-- Date: 2026-01-08
-- Feature: SAAS Platform Settings Management
-- Dependencies: 0068_sys_stng_categories_and_profiles_schema.sql

-- =====================================================
-- Seed Settings Categories
-- =====================================================

-- Insert categories in order
INSERT INTO sys_stng_categories_cd (
  stng_category_code,
  stng_category_name,
  stng_category_name2,
  stng_category_desc,
  stng_category_desc2,
  stng_category_order,
  stng_category_icon,
  created_by,
  is_active
) VALUES
  -- 1. GENERAL: General application settings
  (
    'GENERAL',
    'General Settings',
    'الإعدادات العامة',
    'General application configuration and preferences',
    'التكوين العام للتطبيق والتفضيلات',
    1,
    'settings',
    'system_admin',
    true
  ),

  -- 2. WORKFLOW: Order processing and workflow settings
  (
    'WORKFLOW',
    'Workflow Settings',
    'إعدادات سير العمل',
    'Order processing workflow, status transitions, and automation rules',
    'سير عمل معالجة الطلبات وانتقالات الحالة وقواعد الأتمتة',
    2,
    'workflow',
    'system_admin',
    true
  ),

  -- 3. FINANCE: Financial and accounting settings
  (
    'FINANCE',
    'Finance & Accounting',
    'المالية والمحاسبة',
    'Tax rates, payment terms, currency, and accounting configuration',
    'معدلات الضرائب وشروط الدفع والعملة وتكوين المحاسبة',
    3,
    'dollar-sign',
    'system_admin',
    true
  ),

  -- 4. RECEIPTS: Receipt generation and formatting
  (
    'RECEIPTS',
    'Receipts & Invoices',
    'الإيصالات والفواتير',
    'Receipt templates, formats, and invoice generation settings',
    'قوالب الإيصالات والتنسيقات وإعدادات إنشاء الفواتير',
    4,
    'receipt',
    'system_admin',
    true
  ),

  -- 5. NOTIFICATIONS: Notification preferences
  (
    'NOTIFICATIONS',
    'Notifications',
    'الإشعارات',
    'SMS, email, and push notification settings and templates',
    'إعدادات وقوالب الرسائل القصيرة والبريد الإلكتروني والإشعارات الفورية',
    5,
    'bell',
    'system_admin',
    true
  ),

  -- 6. BRANDING: UI branding and customization
  (
    'BRANDING',
    'Branding & UI',
    'العلامة التجارية والواجهة',
    'Logo, colors, themes, and user interface customization',
    'الشعار والألوان والمظاهر وتخصيص واجهة المستخدم',
    6,
    'palette',
    'system_admin',
    true
  ),

  -- 7. SECURITY: Security and privacy settings
  (
    'SECURITY',
    'Security & Privacy',
    'الأمان والخصوصية',
    'Authentication, authorization, session management, and data privacy',
    'المصادقة والتفويض وإدارة الجلسات وخصوصية البيانات',
    7,
    'shield',
    'system_admin',
    true
  ),

  -- 8. INTEGRATION: Third-party integrations
  (
    'INTEGRATION',
    'Integrations',
    'التكاملات',
    'Third-party service integrations and API configuration',
    'تكاملات الخدمات الخارجية وتكوين واجهة برمجة التطبيقات',
    8,
    'plug',
    'system_admin',
    true
  )

ON CONFLICT (stng_category_code) DO UPDATE SET
  stng_category_name = EXCLUDED.stng_category_name,
  stng_category_name2 = EXCLUDED.stng_category_name2,
  stng_category_desc = EXCLUDED.stng_category_desc,
  stng_category_desc2 = EXCLUDED.stng_category_desc2,
  stng_category_order = EXCLUDED.stng_category_order,
  stng_category_icon = EXCLUDED.stng_category_icon,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';


-- =====================================================
-- Verification Query
-- =====================================================

-- Verify categories were inserted
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count FROM sys_stng_categories_cd WHERE is_active = true;

  IF category_count = 8 THEN
    RAISE NOTICE 'SUCCESS: All 8 categories seeded successfully';
  ELSE
    RAISE WARNING 'WARNING: Expected 8 categories, found %', category_count;
  END IF;
END $$;


-- =====================================================
-- Summary
-- =====================================================

-- Categories seeded:
-- 1. GENERAL - General application settings
-- 2. WORKFLOW - Order processing and workflow
-- 3. FINANCE - Financial and accounting
-- 4. RECEIPTS - Receipt and invoice generation
-- 5. NOTIFICATIONS - Notification preferences
-- 6. BRANDING - UI branding and customization
-- 7. SECURITY - Security and privacy
-- 8. INTEGRATION - Third-party integrations
--
-- Each category includes:
-- - English and Arabic names
-- - English and Arabic descriptions
-- - Display order
-- - Icon reference (Lucide icon names)
