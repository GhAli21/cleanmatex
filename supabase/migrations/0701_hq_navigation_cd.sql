-- =============================================================================
-- 0701_hq_navigation_cd.sql
-- Purpose: Create hq_navigation_cd table for Platform HQ dynamic navigation
--          registry and seed the authoritative CleanMateX SaaS Backoffice
--          navigation hierarchy.
--
-- ARCHITECTURAL BOUNDARY:
--   - sys_components_cd: Tenant application dynamic navigation (cleanmatex).
--   - hq_navigation_cd:  Platform HQ Console dynamic navigation (cleanmatexsaas).
--
-- INTEGRATION NOTES:
--   - Cleanly separates HQ Internal Plane (hq_admin) from Tenant Governance (tenant_gov).
--   - Seeds all 5 primary domains + HQ Admin Console with bilingual labels (EN/AR),
--     Lucide icon identifiers, exact route paths, and bound permission tokens.
--
-- SAFETY & IDEMPOTENCY:
--   - Table created with IF NOT EXISTS.
--   - Data inserted using ON CONFLICT (nav_code) DO UPDATE (upsert safe).
--   - Uses service_role policy for admin management; authenticated SELECT for read.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- 1. TABLE CREATION: hq_navigation_cd
CREATE TABLE IF NOT EXISTS public.hq_navigation_cd (
  nav_id               UUID                 NOT NULL DEFAULT gen_random_uuid(),
  nav_code             TEXT                 NOT NULL,
  parent_nav_code      TEXT                 NULL,
  section_code         TEXT                 NOT NULL,
  label                TEXT                 NOT NULL,
  label2               TEXT                 NOT NULL,
  description          TEXT                 NULL,
  description2         TEXT                 NULL,
  nav_path             TEXT                 NOT NULL,
  nav_icon             VARCHAR(60)          NOT NULL,
  badge                TEXT                 NULL,
  main_permission_code TEXT                 NULL,
  nav_level            INTEGER              NOT NULL DEFAULT 1,
  display_order        INTEGER              NOT NULL DEFAULT 100,
  is_leaf              BOOLEAN              NOT NULL DEFAULT true,
  is_navigable         BOOLEAN              NOT NULL DEFAULT true,
  is_active            BOOLEAN              NOT NULL DEFAULT true,
  is_system            BOOLEAN              NOT NULL DEFAULT true,
  metadata             JSONB                NULL DEFAULT '{}'::jsonb,
  -- Audit fields
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT DEFAULT 'system',
  created_info TEXT,
  
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status SMALLINT DEFAULT 1, -- 0 for soft delete 
  rec_order INTEGER,
  rec_notes TEXT,
  
  CONSTRAINT pk_hq_navigation_cd PRIMARY KEY (nav_id),
  CONSTRAINT ak_hq_nav_code UNIQUE (nav_code)
);

-- Foreign Key: Self-referential parent navigation hierarchy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_hq_nav_parent' AND table_name = 'hq_navigation_cd'
  ) THEN
    ALTER TABLE public.hq_navigation_cd
      ADD CONSTRAINT fk_hq_nav_parent
      FOREIGN KEY (parent_nav_code)
      REFERENCES public.hq_navigation_cd(nav_code)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for performance & hierarchy scanning
CREATE INDEX IF NOT EXISTS idx_hq_nav_section ON public.hq_navigation_cd(section_code, display_order);
CREATE INDEX IF NOT EXISTS idx_hq_nav_parent ON public.hq_navigation_cd(parent_nav_code);
CREATE INDEX IF NOT EXISTS idx_hq_nav_active ON public.hq_navigation_cd(is_active, is_navigable) WHERE is_active = true AND is_navigable = true;
CREATE INDEX IF NOT EXISTS idx_hq_nav_permission ON public.hq_navigation_cd(main_permission_code) WHERE main_permission_code IS NOT NULL;

-- Table and Column Documentation
COMMENT ON TABLE public.hq_navigation_cd IS
  'Platform HQ Console dynamic navigation registry. Independent from tenant sys_components_cd.';
COMMENT ON COLUMN public.hq_navigation_cd.nav_code IS
  'Unique identifier code for the navigation item (e.g. biz_tenants, hq_general_config).';
COMMENT ON COLUMN public.hq_navigation_cd.section_code IS
  'Top-level domain section: business, tenant_gov, comm_growth, dev_platform, hq_admin.';
COMMENT ON COLUMN public.hq_navigation_cd.label IS
  'English user interface label.';
COMMENT ON COLUMN public.hq_navigation_cd.label2 IS
  'Arabic user interface label (RTL).';
COMMENT ON COLUMN public.hq_navigation_cd.nav_path IS
  'Canonical frontend Next.js App Router path.';
COMMENT ON COLUMN public.hq_navigation_cd.nav_icon IS
  'Lucide React icon identifier name.';
COMMENT ON COLUMN public.hq_navigation_cd.main_permission_code IS
  'HQ permission token required to view/access (e.g. hq_general_config:read, users.view).';

-- 2. ROW LEVEL SECURITY
ALTER TABLE public.hq_navigation_cd ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated platform operators can read all navigation registry records.
-- NOTE: We intentionally do NOT restrict to `is_active = true` at the RLS layer so that
--       HQ administrators can view, audit, and reactivate disabled items via the management
--       console. Active filtering for the live sidebar belongs at the query layer (WHERE is_active = true).
DROP POLICY IF EXISTS hq_navigation_read_policy ON public.hq_navigation_cd;
CREATE POLICY hq_navigation_read_policy ON public.hq_navigation_cd
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS hq_navigation_service_role_policy ON public.hq_navigation_cd;
CREATE POLICY hq_navigation_service_role_policy ON public.hq_navigation_cd
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. SEEDING THE AUTHORITATIVE PLATFORM HQ NAVIGATION HIERARCHY

INSERT INTO public.hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, nav_path, nav_icon, nav_level, display_order, is_leaf, is_navigable, main_permission_code, metadata
) VALUES
  -- =========================================================================
  -- SECTION 1: BUSINESS & TENANTS (إدارة الأعمال والمنشآت)
  -- =========================================================================
  ('biz_dashboard', NULL, 'business', 'Dashboard', 'لوحة التحكم', '/', 'LayoutDashboard', 1, 10, true, true, NULL, '{"category": "overview"}'::jsonb),
  ('biz_tenants', NULL, 'business', 'Tenant Organizations', 'منشآت المستأجرين', '/tenants', 'Building2', 1, 20, false, true, NULL, '{"hub": true}'::jsonb),
  ('biz_plans', NULL, 'business', 'Plans & Subscriptions', 'الخطط والاشتراكات', '/billing/plans', 'PackageSearch', 1, 30, true, true, NULL, '{"unified_route": true}'::jsonb),
  ('biz_billing', NULL, 'business', 'Billing & Invoices', 'الفوترة والفواتير', '/billing', 'Receipt', 1, 40, false, true, NULL, '{"hub": true}'::jsonb),
  
  -- Billing Hub Sub-routes
  ('biz_billing_subs', 'biz_billing', 'business', 'Subscriptions', 'الاشتراكات', '/billing/subscriptions', 'CreditCard', 2, 41, true, true, NULL, '{}'::jsonb),
  ('biz_billing_invoices', 'biz_billing', 'business', 'Invoices', 'الفواتير', '/billing/invoices', 'Receipt', 2, 42, true, true, NULL, '{}'::jsonb),
  ('biz_billing_revenue', 'biz_billing', 'business', 'Revenue Analytics', 'تحليلات الإيرادات', '/billing/revenue', 'TrendingUp', 2, 43, true, true, NULL, '{}'::jsonb),
  ('biz_billing_dunning', 'biz_billing', 'business', 'Dunning Recovery', 'إدارة المتأخرات', '/billing/dunning', 'AlertTriangle', 2, 44, true, true, NULL, '{}'::jsonb),

  -- =========================================================================
  -- SECTION 2: TENANT APPLICATION GOVERNANCE (حوكمة وتكوين المنصة للمنشآت)
  -- =========================================================================
  ('tg_sys_settings', NULL, 'tenant_gov', 'Tenant System Settings', 'إعدادات النظام للمنشآت', '/sys-settings', 'Sliders', 1, 100, false, true, NULL, '{"api_contract": "/api/hq/v1/settings"}'::jsonb),
  ('tg_sys_settings_catalog', 'tg_sys_settings', 'tenant_gov', 'Settings Catalog', 'دليل الإعدادات', '/sys-settings/catalog', 'BookOpen', 2, 101, true, true, NULL, '{}'::jsonb),
  ('tg_sys_settings_categories', 'tg_sys_settings', 'tenant_gov', 'Settings Categories', 'تصنيفات الإعدادات', '/sys-settings/categories', 'Layers', 2, 102, true, true, NULL, '{}'::jsonb),
  ('tg_sys_settings_profiles', 'tg_sys_settings', 'tenant_gov', 'System Profiles', 'الملفات التعريفية للنظام', '/sys-settings/profiles', 'Sliders', 2, 103, true, true, NULL, '{}'::jsonb),
  ('tg_sys_settings_constraints', 'tg_sys_settings', 'tenant_gov', 'Plan Constraints', 'قيود الخطط', '/sys-settings/plan-constraints', 'Shield', 2, 104, true, true, NULL, '{}'::jsonb),
  ('tg_sys_settings_assignments', 'tg_sys_settings', 'tenant_gov', 'Tenant Assignments', 'تعيينات المنشآت', '/sys-settings/assignments', 'Users2', 2, 105, true, true, NULL, '{}'::jsonb),
  ('tg_sys_settings_audit', 'tg_sys_settings', 'tenant_gov', 'Settings Audit Trail', 'سجل تدقيق الإعدادات', '/sys-settings/audit', 'History', 2, 106, true, true, NULL, '{}'::jsonb),

  ('tg_access_control', NULL, 'tenant_gov', 'Tenant Access & RBAC', 'التحكم بالوصول للمنشآت', '/access-control', 'ShieldCheck', 1, 110, true, true, NULL, '{"org_rbac_workspace": true}'::jsonb),
  ('tg_feature_flags', NULL, 'tenant_gov', 'Feature Flags Registry', 'أعلام الميزات', '/feature-flags', 'Flag', 1, 120, false, true, NULL, '{"hub": true}'::jsonb),
  ('tg_erp_lite', NULL, 'tenant_gov', 'ERP-Lite Governance', 'حوكمة المحاسبة المبسطة', '/erp-lite-governance', 'BookOpen', 1, 130, false, true, NULL, '{"hub": true}'::jsonb),
  
  ('tg_workflows', NULL, 'tenant_gov', 'Workflows & Policies', 'سير العمل والسياسات', '/workflow-engine-config', 'Workflow', 1, 140, false, true, NULL, '{"hub": true}'::jsonb),
  ('tg_order_change', 'tg_workflows', 'tenant_gov', 'Order Change Config', 'تكوين تعديل الطلبات', '/order-change-config', 'ShieldCheck', 2, 145, true, true, NULL, '{}'::jsonb),

  ('tg_products_items', NULL, 'tenant_gov', 'Products & Catalogs Hub', 'المنتجات والأصناف', '/products-items-config', 'Package', 1, 150, false, true, NULL, '{"hub": true}'::jsonb),
  ('tg_service_catalog', 'tg_products_items', 'tenant_gov', 'Customer & Business Types', 'أنواع العملاء والأنشطة', '/catalog', 'Database', 2, 155, true, true, 'catalog.view', '{}'::jsonb),

  ('tg_system_codes', NULL, 'tenant_gov', 'Master System Codes', 'أكواد النظام المالية', '/system-codes', 'Database', 1, 160, false, true, NULL, '{"hub": true}'::jsonb),
  ('tg_sys_codes_currency', 'tg_system_codes', 'tenant_gov', 'Currency Setup', 'تهيئة العملات', '/system-codes/currency-setup', 'DollarSign', 2, 161, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_rounding', 'tg_system_codes', 'tenant_gov', 'Rounding & Denominations', 'التقريب والفئات النقدية', '/system-codes/currency-rounding', 'Coins', 2, 162, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_fx', 'tg_system_codes', 'tenant_gov', 'Exchange Rates', 'أسعار الصرف', '/system-codes/exchange-rates', 'ArrowLeftRight', 2, 163, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_settlement', 'tg_system_codes', 'tenant_gov', 'Settlement Catalogs', 'فهارس التسوية', '/system-codes/settlement', 'Coins', 2, 164, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_payment', 'tg_system_codes', 'tenant_gov', 'Payment Setup', 'تهيئة الدفع', '/system-codes/payment-setup', 'CreditCard', 2, 165, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_bvm', 'tg_system_codes', 'tenant_gov', 'BVM Catalogs', 'فهارس سندات القبض والصرف', '/system-codes/bvm', 'Receipt', 2, 166, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_cash_pos', 'tg_system_codes', 'tenant_gov', 'Cash & POS Catalogs', 'فهارس نقاط البيع والصناديق', '/system-codes/cash-pos', 'Banknote', 2, 167, true, true, NULL, '{}'::jsonb),
  ('tg_sys_codes_tables', 'tg_system_codes', 'tenant_gov', 'Code Tables Registry', 'سجل جداول الأكواد العامة', '/codes', 'List', 2, 168, true, true, NULL, '{}'::jsonb),

  -- =========================================================================
  -- SECTION 3: COMMUNICATION & GROWTH (مركز التواصل والنمو)
  -- =========================================================================
  ('cg_notifications', NULL, 'comm_growth', 'Notification Hub', 'مركز الإشعارات والاتصالات', '/notifications', 'BellRing', 1, 200, false, true, NULL, '{"hub": true}'::jsonb),
  ('cg_ntf_providers', 'cg_notifications', 'comm_growth', 'Gateway Providers', 'مزودو الخدمة', '/notifications/providers', 'Server', 2, 201, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_channels', 'cg_notifications', 'comm_growth', 'Channels', 'القنوات', '/notifications/channels', 'Radio', 2, 202, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_tenant_config', 'cg_notifications', 'comm_growth', 'Tenant Config', 'تكوين المنشآت', '/notifications/tenant-config', 'ShieldCheck', 2, 203, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_templates', 'cg_notifications', 'comm_growth', 'Templates', 'القوالب', '/notifications/templates', 'LayoutTemplate', 2, 204, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_broadcasts', 'cg_notifications', 'comm_growth', 'Broadcast Center', 'مركز البث العام', '/notifications/broadcasts', 'Megaphone', 2, 205, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_quota', 'cg_notifications', 'comm_growth', 'Quota Management', 'إدارة الحصص', '/notifications/quota', 'BarChart3', 2, 206, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_operations', 'cg_notifications', 'comm_growth', 'Notification Operations', 'عمليات الإشعارات', '/notifications/operations', 'Activity', 2, 207, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_pricing', 'cg_notifications', 'comm_growth', 'Unit Pricing', 'أسعار الوحدات', '/notifications/pricing', 'DollarSign', 2, 208, true, true, NULL, '{}'::jsonb),
  ('cg_ntf_audit', 'cg_notifications', 'comm_growth', 'Notification Audit', 'تدقيق الإشعارات', '/notifications/audit', 'ClipboardList', 2, 209, true, true, NULL, '{}'::jsonb),

  ('cg_marketing', NULL, 'comm_growth', 'Marketing & Growth', 'التسويق والنمو', '/marketing', 'Megaphone', 1, 210, false, true, NULL, '{"hub": true}'::jsonb),
  ('cg_mkt_leads', 'cg_marketing', 'comm_growth', 'Leads', 'العملاء المحتملون', '/marketing/leads', 'Users', 2, 211, true, true, NULL, '{}'::jsonb),
  ('cg_mkt_content', 'cg_marketing', 'comm_growth', 'Campaign Content', 'المحتوى والحملات', '/marketing/content', 'FileText', 2, 212, true, true, NULL, '{}'::jsonb),
  ('cg_mkt_tracking', 'cg_marketing', 'comm_growth', 'Attribution Tracking', 'تتبع الزوار والإحالات', '/marketing/tracking', 'Radio', 2, 213, true, true, NULL, '{}'::jsonb),

  -- =========================================================================
  -- SECTION 4: DEVELOPER & PLATFORM (المطورون والنظام)
  -- =========================================================================
  ('dp_developer_portal', NULL, 'dev_platform', 'Developer Portal', 'بوابة المطورين', '/developer-portal', 'Terminal', 1, 300, false, true, NULL, '{"hub": true}'::jsonb),
  ('dp_dev_docs', 'dp_developer_portal', 'dev_platform', 'Interactive API Docs', 'توثيق واجهة البرمجة', '/developer-portal/docs', 'BookOpen', 2, 301, true, true, NULL, '{}'::jsonb),
  ('dp_dev_keys', 'dp_developer_portal', 'dev_platform', 'API Keys', 'مفاتيح واجهة البرمجة', '/developer-portal/keys', 'Key', 2, 302, true, true, NULL, '{}'::jsonb),
  ('dp_dev_analytics', 'dp_developer_portal', 'dev_platform', 'API Analytics', 'تحليلات واجهة البرمجة', '/developer-portal/analytics', 'BarChart3', 2, 303, true, true, NULL, '{}'::jsonb),

  ('dp_analytics', NULL, 'dev_platform', 'Platform Analytics', 'تحليلات المنصة', '/analytics', 'TrendingUp', 1, 310, true, true, NULL, '{"kpi": true}'::jsonb),

  -- =========================================================================
  -- SECTION 5: HQ ADMIN CONSOLE (إدارة المقر الرئيسي - داخلي)
  -- =========================================================================
  ('hq_console', NULL, 'hq_admin', 'HQ Console Overview', 'نظرة عامة على المقر', '/hq-admin-console', 'LayoutGrid', 1, 400, true, true, 'hq_ops:read', '{"overview": true}'::jsonb),
  ('hq_general_config', NULL, 'hq_admin', 'HQ General Config', 'الإعدادات العامة للمقر', '/hq-admin-console/hq-general-config', 'SlidersHorizontal', 1, 410, true, true, 'hq_general_config:read', '{"table": "hq_general_config"}'::jsonb),
  ('hq_operators', NULL, 'hq_admin', 'Platform Operators', 'مشغلو المنصة', '/users', 'Users', 1, 420, true, true, 'users.view', '{"operator_management": true}'::jsonb),
  ('hq_rbac_roles', NULL, 'hq_admin', 'Platform Roles & RBAC', 'أدوار وصلاحيات المنصة', '/hq-auth/roles', 'Lock', 1, 430, true, true, 'roles.view', '{"hq_rbac": true}'::jsonb),
  ('hq_doc_seq', NULL, 'hq_admin', 'Document Sequences', 'تسلسل المستندات والأكواد', '/doc-seq-config', 'Hash', 1, 440, false, true, 'hq_doc_seq:read', '{"hub": true}'::jsonb),
  ('hq_doc_seq_types', 'hq_doc_seq', 'hq_admin', 'Sequence Types', 'أنواع التسلسل', '/doc-seq-config/types', 'ListOrdered', 2, 441, true, true, 'hq_doc_seq:read', '{}'::jsonb),
  ('hq_doc_seq_counters', 'hq_doc_seq', 'hq_admin', 'Live Counters', 'العدادات النشطة', '/doc-seq-config/counters', 'Hash', 2, 442, true, true, 'hq_doc_seq:read', '{}'::jsonb),
  ('hq_doc_seq_consistency', 'hq_doc_seq', 'hq_admin', 'Code Consistency', 'فحص سلامة الترقيم', '/doc-seq-config/consistency', 'ShieldCheck', 2, 443, true, true, 'hq_doc_seq:read', '{}'::jsonb),

  ('hq_ops', NULL, 'hq_admin', 'Platform Health & Ops', 'صحة وعمليات المنصة', '/ops', 'ServerCog', 1, 450, false, true, 'hq_ops:read', '{"hub": true}'::jsonb),
  ('hq_ops_health', 'hq_ops', 'hq_admin', 'Setup Health', 'فحص صحة الإعداد', '/ops/health', 'HeartPulse', 2, 451, true, true, 'hq_ops:read', '{}'::jsonb),
  ('hq_ops_jobs', 'hq_ops', 'hq_admin', 'Scheduled Jobs', 'وظائف قائمة الانتظار', '/ops/jobs', 'CalendarClock', 2, 452, true, true, 'hq_ops:read', '{}'::jsonb),
  ('hq_ops_operations', 'hq_ops', 'hq_admin', 'Operations Catalog', 'دليل العمليات التشغيلية', '/ops/operations', 'ListChecks', 2, 453, true, true, 'hq_ops:read', '{}'::jsonb),
  ('hq_ops_config', 'hq_ops', 'hq_admin', 'Configuration Registry', 'سجل إعدادات العمليات', '/ops/config', 'Settings2', 2, 454, true, true, 'hq_ops:read', '{}'::jsonb)

ON CONFLICT (nav_code) DO UPDATE SET
  parent_nav_code      = EXCLUDED.parent_nav_code,
  section_code         = EXCLUDED.section_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  nav_path             = EXCLUDED.nav_path,
  nav_icon             = EXCLUDED.nav_icon,
  nav_level            = EXCLUDED.nav_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  main_permission_code = EXCLUDED.main_permission_code,
  metadata             = EXCLUDED.metadata,
  updated_at           = Now(),
  updated_by           = 'migration_0701';

COMMIT;

