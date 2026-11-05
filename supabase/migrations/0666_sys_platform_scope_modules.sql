--
-- Migration 0666_sys_platform_scope_modules.sql
-- Human-Friendly Codes, P1 (DB engine), migration 1 of 7.
--
-- Purpose: the shared platform lookups every document-sequence row points at.
--   sys_saas_scope_cd          who owns the data (TENANT_ORG / SYS / HQ)
--   sys_modules_cd             product modules, each owned by one scope
--   sys_module_sub_systems_cd  sub-systems inside a module
-- Every row carries short_code (2-5 capital letters, unique within its table). Short codes are used alone in
-- screens, logs and scan payloads, so sub-system short codes are unique across ALL modules, not per module.
-- Seed approved 2026-10-30 (plan section 20.1 / INVENTORY section 6, user decisions A-01): journals belong to ERP;
-- tenant modules include notifications, auth, RBAC, settings, audit, reports, integrations, branches; HQ modules
-- include ops, billing, plans, tenants, support, marketing, auth, RBAC, notifications, settings, audit, core data,
-- feature flags, developer portal.
--
-- Affected: sys_saas_scope_cd, sys_modules_cd, sys_module_sub_systems_cd (all new).
-- Related:  0575_auth_session_registry.sql (lookup RLS pattern), 0264_hq_currency_catalog_hardening.sql (trg_set_updated_at).
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.1.
-- APPLY ORDER: 1 of 7 in P1. Next: doc_seq_type_config.
-- ROLLBACK PLAN (forward-only repo; write a new migration):
--   DROP TABLE public.sys_module_sub_systems_cd RESTRICT; DROP TABLE public.sys_modules_cd RESTRICT;
--   DROP TABLE public.sys_saas_scope_cd RESTRICT;  (fails safely while sys_doc_seq_type_cd references them)
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- ------------------------------------------------------------
-- 1. sys_saas_scope_cd
-- ------------------------------------------------------------
CREATE TABLE public.sys_saas_scope_cd (
  scope_code   TEXT    NOT NULL,                     -- Stored scope value (exact case), e.g. TENANT_ORG.
  short_code   TEXT    NOT NULL,                     -- 2-5 capital letters for screens and logs.
  name         TEXT    NOT NULL,                     -- English display name.
  name2        TEXT,                                 -- Arabic display name.
  description  TEXT,                                 -- English description.
  description2 TEXT,                                 -- Arabic description.
  display_order INTEGER NOT NULL DEFAULT 0,          -- Order in pick lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  
  CONSTRAINT pk_sys_saas_scope_cd PRIMARY KEY (scope_code),
  CONSTRAINT ck_saas_scope_code CHECK (scope_code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT ck_saas_scope_short CHECK (short_code ~ '^[A-Z]{2,5}$'),
  CONSTRAINT uq_saas_scope_short UNIQUE (short_code)
);
COMMENT ON TABLE public.sys_saas_scope_cd IS 'Data ownership scopes: TENANT_ORG (one tenant), SYS (platform-wide), HQ (platform back office). Fixed set.';
COMMENT ON COLUMN public.sys_saas_scope_cd.scope_code IS 'Stored scope value (exact case). Mirrored in TS constants.';
COMMENT ON COLUMN public.sys_saas_scope_cd.short_code IS '2-5 capital letters, unique; used alone in screens and logs.';
COMMENT ON COLUMN public.sys_saas_scope_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_saas_scope_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_saas_scope_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_saas_scope_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_saas_scope_cd.display_order IS 'Order in pick lists.';
COMMENT ON COLUMN public.sys_saas_scope_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_saas_scope_cd.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_saas_scope_cd.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_saas_scope_cd.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_saas_scope_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_saas_scope_cd.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_saas_scope_cd.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_saas_scope_cd.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_saas_scope_cd.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_saas_scope_cd.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_saas_scope_code ON public.sys_saas_scope_cd IS 'Scope codes are UPPER_SNAKE, 2-30 chars.';
COMMENT ON CONSTRAINT ck_saas_scope_short ON public.sys_saas_scope_cd IS 'Short code is 2-5 capital letters.';
COMMENT ON CONSTRAINT uq_saas_scope_short ON public.sys_saas_scope_cd IS 'Short codes are unique.';

-- ------------------------------------------------------------
-- 2. sys_modules_cd
-- ------------------------------------------------------------
CREATE TABLE public.sys_modules_cd (
  module_code  TEXT    NOT NULL,                     -- Stored module value, e.g. ORDERS.
  short_code   TEXT    NOT NULL,                     -- 2-5 capital letters.
  scope_code   TEXT    NOT NULL,                     -- Owning scope (FK sys_saas_scope_cd).
  name         TEXT    NOT NULL,                     -- English display name.
  name2        TEXT,                                 -- Arabic display name.
  description  TEXT,                                 -- English description.
  description2 TEXT,                                 -- Arabic description.
  display_order INTEGER NOT NULL DEFAULT 0,          -- Order in pick lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_modules_cd PRIMARY KEY (module_code),
  CONSTRAINT ck_modules_code CHECK (module_code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT ck_modules_short CHECK (short_code ~ '^[A-Z]{2,5}$'),
  CONSTRAINT uq_modules_short UNIQUE (short_code),
  CONSTRAINT fk_modules_scope FOREIGN KEY (scope_code)
    REFERENCES public.sys_saas_scope_cd (scope_code) ON DELETE RESTRICT
);
CREATE INDEX idx_modules_scope ON public.sys_modules_cd (scope_code);
COMMENT ON TABLE public.sys_modules_cd IS 'Product modules. Each module belongs to one scope. Admin-extensible lookup.';
COMMENT ON COLUMN public.sys_modules_cd.module_code IS 'Stored module value (exact case). Mirrored in TS constants.';
COMMENT ON COLUMN public.sys_modules_cd.short_code IS '2-5 capital letters, unique; used alone in screens and logs.';
COMMENT ON COLUMN public.sys_modules_cd.scope_code IS 'Owning scope (sys_saas_scope_cd). A doc type in another scope is reported as WARN by vw_doc_seq_consistency.';
COMMENT ON COLUMN public.sys_modules_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_modules_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_modules_cd.description IS 'English description (what the module covers).';
COMMENT ON COLUMN public.sys_modules_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_modules_cd.display_order IS 'Order in pick lists.';
COMMENT ON COLUMN public.sys_modules_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_modules_cd.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_modules_cd.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_modules_cd.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_modules_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_modules_cd.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_modules_cd.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_modules_cd.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_modules_cd.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_modules_cd.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_modules_code ON public.sys_modules_cd IS 'Module codes are UPPER_SNAKE, 2-30 chars.';
COMMENT ON CONSTRAINT ck_modules_short ON public.sys_modules_cd IS 'Short code is 2-5 capital letters.';
COMMENT ON CONSTRAINT uq_modules_short ON public.sys_modules_cd IS 'Short codes are unique.';
COMMENT ON CONSTRAINT fk_modules_scope ON public.sys_modules_cd IS 'Owning scope; RESTRICT keeps scopes in use.';
COMMENT ON INDEX public.idx_modules_scope IS 'Supports the scope FK and scope filters.';

-- ------------------------------------------------------------
-- 3. sys_module_sub_systems_cd
-- ------------------------------------------------------------
CREATE TABLE public.sys_module_sub_systems_cd (
  module_code     TEXT    NOT NULL,                  -- Parent module (FK sys_modules_cd).
  sub_system_code TEXT    NOT NULL,                  -- Stored sub-system value, unique within the module.
  short_code      TEXT    NOT NULL,                  -- 2-5 capital letters, unique across all modules.
  name            TEXT    NOT NULL,                  -- English display name.
  name2           TEXT,                              -- Arabic display name.
  description     TEXT,                              -- English description.
  description2    TEXT,                              -- Arabic description.
  display_order   INTEGER NOT NULL DEFAULT 0,        -- Order in pick lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_module_sub_systems_cd PRIMARY KEY (module_code, sub_system_code),
  CONSTRAINT ck_mod_subsys_code CHECK (sub_system_code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT ck_mod_subsys_short CHECK (short_code ~ '^[A-Z]{2,5}$'),
  CONSTRAINT uq_mod_subsys_short UNIQUE (short_code),
  CONSTRAINT fk_mod_subsys_module FOREIGN KEY (module_code)
    REFERENCES public.sys_modules_cd (module_code) ON DELETE RESTRICT
);
COMMENT ON TABLE public.sys_module_sub_systems_cd IS 'Sub-systems inside a module. Admin-extensible lookup.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.module_code IS 'Parent module (sys_modules_cd).';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.sub_system_code IS 'Stored sub-system value (exact case), unique within its module.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.short_code IS '2-5 capital letters, unique across ALL modules (used alone in screens, logs and scan payloads).';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.display_order IS 'Order in pick lists.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_module_sub_systems_cd.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_mod_subsys_code ON public.sys_module_sub_systems_cd IS 'Sub-system codes are UPPER_SNAKE, 2-30 chars.';
COMMENT ON CONSTRAINT ck_mod_subsys_short ON public.sys_module_sub_systems_cd IS 'Short code is 2-5 capital letters.';
COMMENT ON CONSTRAINT uq_mod_subsys_short ON public.sys_module_sub_systems_cd IS 'Short codes are unique across all modules.';
COMMENT ON CONSTRAINT fk_mod_subsys_module ON public.sys_module_sub_systems_cd IS 'Parent module; RESTRICT keeps modules in use.';

-- ------------------------------------------------------------
-- 4. Security and triggers
-- ------------------------------------------------------------
ALTER TABLE public.sys_saas_scope_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY saas_scope_read ON public.sys_saas_scope_cd
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);
COMMENT ON POLICY saas_scope_read ON public.sys_saas_scope_cd IS 'Signed-in users may read live, active rows; there is no write policy (writes are service_role only).';
REVOKE ALL ON TABLE public.sys_saas_scope_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.sys_saas_scope_cd FROM authenticated;
GRANT SELECT ON TABLE public.sys_saas_scope_cd TO authenticated;
GRANT ALL ON TABLE public.sys_saas_scope_cd TO service_role;
CREATE TRIGGER trg_saas_scope_upd
  BEFORE UPDATE ON public.sys_saas_scope_cd
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_saas_scope_upd ON public.sys_saas_scope_cd IS 'Sets updated_at on every update.';

ALTER TABLE public.sys_modules_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_read ON public.sys_modules_cd
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);
COMMENT ON POLICY modules_read ON public.sys_modules_cd IS 'Signed-in users may read live, active rows; there is no write policy (writes are service_role only).';
REVOKE ALL ON TABLE public.sys_modules_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.sys_modules_cd FROM authenticated;
GRANT SELECT ON TABLE public.sys_modules_cd TO authenticated;
GRANT ALL ON TABLE public.sys_modules_cd TO service_role;
CREATE TRIGGER trg_modules_upd
  BEFORE UPDATE ON public.sys_modules_cd
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_modules_upd ON public.sys_modules_cd IS 'Sets updated_at on every update.';

ALTER TABLE public.sys_module_sub_systems_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY mod_subsys_read ON public.sys_module_sub_systems_cd
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);
COMMENT ON POLICY mod_subsys_read ON public.sys_module_sub_systems_cd IS 'Signed-in users may read live, active rows; there is no write policy (writes are service_role only).';
REVOKE ALL ON TABLE public.sys_module_sub_systems_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.sys_module_sub_systems_cd FROM authenticated;
GRANT SELECT ON TABLE public.sys_module_sub_systems_cd TO authenticated;
GRANT ALL ON TABLE public.sys_module_sub_systems_cd TO service_role;
CREATE TRIGGER trg_mod_subsys_upd
  BEFORE UPDATE ON public.sys_module_sub_systems_cd
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_mod_subsys_upd ON public.sys_module_sub_systems_cd IS 'Sets updated_at on every update.';

-- ------------------------------------------------------------
-- 5. Seed (approved 2026-10-30)
-- ------------------------------------------------------------
INSERT INTO public.sys_saas_scope_cd (scope_code, short_code, name, name2, description, display_order, created_by, created_info) VALUES
  ('TENANT_ORG', 'ORG', 'Organization', 'المنشأة', 'Data owned by one tenant organization (tenant_org_id).', 10, 'migration', 'sys_platform_scope_modules'),
  ('SYS', 'SYS', 'Platform-wide', 'على مستوى المنصة', 'Platform-wide data shared by all tenants (no tenant_org_id).', 20, 'migration', 'sys_platform_scope_modules'),
  ('HQ', 'HQ', 'Platform administration', 'إدارة المنصة', 'HQ / SaaS back-office data, used by the HQ console only.', 30, 'migration', 'sys_platform_scope_modules');

INSERT INTO public.sys_modules_cd (module_code, short_code, scope_code, name, name2, description, display_order, created_by, created_info) VALUES
  ('ORDERS', 'ORD', 'TENANT_ORG', 'Orders', 'الطلبات', 'Orders, items, pieces', 10, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'FIN', 'TENANT_ORG', 'Finance', 'المالية', 'AR, refunds, vouchers, store credit, gift cards, AR operations', 20, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'ERP', 'TENANT_ORG', 'ERP Lite', 'تخطيط الموارد', 'Journals, expenses, petty cash, procurement, AP, bank, allocation, costing', 30, 'migration', 'sys_platform_scope_modules'),
  ('TAX', 'TAX', 'TENANT_ORG', 'Tax', 'الضرائب', 'Tax documents', 40, 'migration', 'sys_platform_scope_modules'),
  ('POS', 'POS', 'TENANT_ORG', 'Point of sale', 'نقاط البيع', 'POS sessions, cash drawers, Z-reports', 50, 'migration', 'sys_platform_scope_modules'),
  ('CRM', 'CRM', 'TENANT_ORG', 'Customers', 'العملاء', 'Customers', 60, 'migration', 'sys_platform_scope_modules'),
  ('CATALOG', 'CAT', 'TENANT_ORG', 'Catalog', 'الكتالوج', 'Products and services', 70, 'migration', 'sys_platform_scope_modules'),
  ('INVENTORY', 'INV', 'TENANT_ORG', 'Inventory', 'المخزون', 'Stock items and stock transactions', 80, 'migration', 'sys_platform_scope_modules'),
  ('B2B', 'BIZ', 'TENANT_ORG', 'Business clients', 'عملاء الأعمال', 'Contracts, statements', 90, 'migration', 'sys_platform_scope_modules'),
  ('DELIVERY', 'DLV', 'TENANT_ORG', 'Delivery', 'التوصيل', 'Routes', 100, 'migration', 'sys_platform_scope_modules'),
  ('WORKFLOW', 'WFL', 'TENANT_ORG', 'Workflow', 'سير العمل', 'Workflow profiles and transitions', 110, 'migration', 'sys_platform_scope_modules'),
  ('NTF', 'NTF', 'TENANT_ORG', 'Notifications', 'الإشعارات', 'Notification templates and deliveries', 120, 'migration', 'sys_platform_scope_modules'),
  ('AUTH', 'AUTH', 'TENANT_ORG', 'Authentication', 'المصادقة', 'Sign-in and sessions', 130, 'migration', 'sys_platform_scope_modules'),
  ('RBAC', 'RBAC', 'TENANT_ORG', 'Roles and permissions', 'الأدوار والصلاحيات', 'Roles, permissions', 140, 'migration', 'sys_platform_scope_modules'),
  ('SETTINGS', 'STNG', 'TENANT_ORG', 'Settings', 'الإعدادات', 'Tenant settings', 150, 'migration', 'sys_platform_scope_modules'),
  ('AUDIT', 'AUD', 'TENANT_ORG', 'Audit', 'التدقيق', 'Audit logs', 160, 'migration', 'sys_platform_scope_modules'),
  ('REPORTS', 'RPT', 'TENANT_ORG', 'Reports', 'التقارير', 'Reports', 170, 'migration', 'sys_platform_scope_modules'),
  ('INTEGRATIONS', 'INTG', 'TENANT_ORG', 'Integrations', 'التكاملات', 'Payment gateways, API clients', 180, 'migration', 'sys_platform_scope_modules'),
  ('BRANCHES', 'BRN', 'TENANT_ORG', 'Branches', 'الفروع', 'Branches', 190, 'migration', 'sys_platform_scope_modules'),
  ('CORE', 'CORE', 'SYS', 'Core', 'الأساسي', 'Users and shared platform identities', 200, 'migration', 'sys_platform_scope_modules'),
  ('CURRENCY', 'CUR', 'SYS', 'Currencies', 'العملات', 'Currency catalog and FX rates', 210, 'migration', 'sys_platform_scope_modules'),
  ('HQ_TENANTS', 'HTNT', 'HQ', 'Tenant management', 'إدارة المستأجرين', 'Tenants, tenant maintenance', 220, 'migration', 'sys_platform_scope_modules'),
  ('HQ_BILLING', 'HBIL', 'HQ', 'Platform billing', 'فوترة المنصة', 'SaaS invoices, payments', 230, 'migration', 'sys_platform_scope_modules'),
  ('HQ_PLANS', 'HPLN', 'HQ', 'Plans and subscriptions', 'الخطط والاشتراكات', 'Plans, subscriptions', 240, 'migration', 'sys_platform_scope_modules'),
  ('HQ_OPS', 'HOPS', 'HQ', 'Platform operations', 'عمليات المنصة', 'Ops jobs, operations, config, health', 250, 'migration', 'sys_platform_scope_modules'),
  ('HQ_SUPPORT', 'HSUP', 'HQ', 'Support', 'الدعم', 'Support tickets', 260, 'migration', 'sys_platform_scope_modules'),
  ('HQ_CRM', 'HCRM', 'HQ', 'Platform marketing', 'تسويق المنصة', 'Marketing leads, content, tracking', 270, 'migration', 'sys_platform_scope_modules'),
  ('HQ_AUTH', 'HAUTH', 'HQ', 'HQ authentication', 'مصادقة المنصة', 'HQ sign-in and sessions', 280, 'migration', 'sys_platform_scope_modules'),
  ('HQ_RBAC', 'HRBAC', 'HQ', 'HQ roles and permissions', 'أدوار وصلاحيات المنصة', 'HQ roles, permissions', 290, 'migration', 'sys_platform_scope_modules'),
  ('HQ_NTF', 'HNTF', 'HQ', 'HQ notifications', 'إشعارات المنصة', 'Platform notification deliveries', 300, 'migration', 'sys_platform_scope_modules'),
  ('HQ_SETTINGS', 'HSTNG', 'HQ', 'HQ settings', 'إعدادات المنصة', 'General config, document sequences', 310, 'migration', 'sys_platform_scope_modules'),
  ('HQ_AUDIT', 'HAUD', 'HQ', 'HQ audit', 'تدقيق المنصة', 'HQ audit logs', 320, 'migration', 'sys_platform_scope_modules'),
  ('HQ_CORE_DATA', 'HCDM', 'HQ', 'Core data management', 'إدارة البيانات الأساسية', 'Code tables', 330, 'migration', 'sys_platform_scope_modules'),
  ('HQ_FLAGS', 'HFFL', 'HQ', 'Feature flags', 'مفاتيح الميزات', 'Feature flags', 340, 'migration', 'sys_platform_scope_modules'),
  ('HQ_DEV', 'HDEV', 'HQ', 'Developer portal', 'بوابة المطورين', 'Developer portal', 350, 'migration', 'sys_platform_scope_modules');

INSERT INTO public.sys_module_sub_systems_cd (module_code, sub_system_code, short_code, name, name2, display_order, created_by, created_info) VALUES
  ('ORDERS', 'ORDER', 'ORDR', 'Order', 'الطلب', 10, 'migration', 'sys_platform_scope_modules'),
  ('ORDERS', 'ORDER_ITEM', 'ORDI', 'Order item', 'بند الطلب', 20, 'migration', 'sys_platform_scope_modules'),
  ('ORDERS', 'ORDER_PIECE', 'ORDP', 'Order piece', 'قطعة الطلب', 30, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'AR', 'FAR', 'Accounts receivable', 'الذمم المدينة', 40, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'REFUND', 'FREF', 'Refunds', 'المبالغ المستردة', 50, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'VOUCHER', 'FVCH', 'Vouchers', 'السندات', 60, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'STORE_CREDIT', 'FSCN', 'Store credit', 'رصيد المتجر', 70, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'GIFT_CARD', 'FGCD', 'Gift cards', 'بطاقات الهدايا', 80, 'migration', 'sys_platform_scope_modules'),
  ('FIN', 'AR_OPS', 'FARO', 'AR operations', 'عمليات الذمم المدينة', 90, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'JOURNAL', 'EJRL', 'Journals', 'القيود اليومية', 100, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'EXPENSE', 'EEXP', 'Expenses', 'المصروفات', 110, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'PETTY_CASH', 'EPCH', 'Petty cash', 'العهدة النقدية', 120, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'PROCUREMENT', 'EPRC', 'Procurement', 'المشتريات', 130, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'AP', 'EAPY', 'Accounts payable', 'الذمم الدائنة', 140, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'BANK', 'EBNK', 'Bank', 'البنوك', 150, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'ALLOCATION', 'EALC', 'Allocation', 'التوزيع', 160, 'migration', 'sys_platform_scope_modules'),
  ('ERP', 'COSTING', 'ECST', 'Costing', 'التكاليف', 170, 'migration', 'sys_platform_scope_modules'),
  ('TAX', 'TAX_DOC', 'TDOC', 'Tax documents', 'المستندات الضريبية', 180, 'migration', 'sys_platform_scope_modules'),
  ('POS', 'POS_SESSION', 'PSES', 'POS sessions', 'جلسات نقاط البيع', 190, 'migration', 'sys_platform_scope_modules'),
  ('POS', 'CASH_DRAWER', 'PCDR', 'Cash drawers', 'أدراج النقد', 200, 'migration', 'sys_platform_scope_modules'),
  ('POS', 'Z_REPORT', 'PZRP', 'Z-reports', 'تقارير Z', 210, 'migration', 'sys_platform_scope_modules'),
  ('CRM', 'CUSTOMER', 'CCUS', 'Customers', 'العملاء', 220, 'migration', 'sys_platform_scope_modules'),
  ('CATALOG', 'PRODUCT', 'CPRD', 'Products', 'المنتجات', 230, 'migration', 'sys_platform_scope_modules'),
  ('INVENTORY', 'STOCK_ITEM', 'ISTK', 'Stock items', 'أصناف المخزون', 240, 'migration', 'sys_platform_scope_modules'),
  ('INVENTORY', 'STOCK_TRX', 'ISTX', 'Stock transactions', 'حركات المخزون', 250, 'migration', 'sys_platform_scope_modules'),
  ('B2B', 'CONTRACT', 'BCON', 'Contracts', 'العقود', 260, 'migration', 'sys_platform_scope_modules'),
  ('B2B', 'STATEMENT', 'BSTM', 'Statements', 'كشوف الحساب', 270, 'migration', 'sys_platform_scope_modules'),
  ('DELIVERY', 'ROUTE', 'DRTE', 'Routes', 'مسارات التوصيل', 280, 'migration', 'sys_platform_scope_modules'),
  ('WORKFLOW', 'WF_PROFILE', 'WPRF', 'Workflow profiles', 'ملفات سير العمل', 290, 'migration', 'sys_platform_scope_modules'),
  ('NTF', 'NTF_TEMPLATE', 'NTPL', 'Notification templates', 'قوالب الإشعارات', 300, 'migration', 'sys_platform_scope_modules'),
  ('NTF', 'NTF_DELIVERY', 'NDLV', 'Notification deliveries', 'إرسال الإشعارات', 310, 'migration', 'sys_platform_scope_modules'),
  ('AUTH', 'SESSION', 'ASES', 'Sessions', 'الجلسات', 320, 'migration', 'sys_platform_scope_modules'),
  ('RBAC', 'ROLE', 'RROL', 'Roles', 'الأدوار', 330, 'migration', 'sys_platform_scope_modules'),
  ('RBAC', 'PERMISSION', 'RPRM', 'Permissions', 'الصلاحيات', 340, 'migration', 'sys_platform_scope_modules'),
  ('SETTINGS', 'TENANT_SETTING', 'STST', 'Tenant settings', 'إعدادات المنشأة', 350, 'migration', 'sys_platform_scope_modules'),
  ('AUDIT', 'AUDIT_LOG', 'AULG', 'Audit log', 'سجل التدقيق', 360, 'migration', 'sys_platform_scope_modules'),
  ('REPORTS', 'REPORT', 'RRPT', 'Reports', 'التقارير', 370, 'migration', 'sys_platform_scope_modules'),
  ('INTEGRATIONS', 'PAYMENT_GATEWAY', 'IPGW', 'Payment gateways', 'بوابات الدفع', 380, 'migration', 'sys_platform_scope_modules'),
  ('INTEGRATIONS', 'API_CLIENT', 'IAPI', 'API clients', 'عملاء الواجهة البرمجية', 390, 'migration', 'sys_platform_scope_modules'),
  ('BRANCHES', 'BRANCH', 'BBRN', 'Branches', 'الفروع', 400, 'migration', 'sys_platform_scope_modules'),
  ('CORE', 'USER', 'CUSR', 'Users', 'المستخدمون', 410, 'migration', 'sys_platform_scope_modules'),
  ('CURRENCY', 'CURRENCY_CD', 'XCUR', 'Currencies', 'العملات', 420, 'migration', 'sys_platform_scope_modules'),
  ('CURRENCY', 'FX_RATE', 'XFXR', 'Exchange rates', 'أسعار الصرف', 430, 'migration', 'sys_platform_scope_modules'),
  ('HQ_TENANTS', 'TENANT', 'HTEN', 'Tenants', 'المستأجرون', 440, 'migration', 'sys_platform_scope_modules'),
  ('HQ_TENANTS', 'TENANT_MAINT', 'HTMN', 'Tenant maintenance', 'صيانة المستأجرين', 450, 'migration', 'sys_platform_scope_modules'),
  ('HQ_BILLING', 'SAAS_INVOICE', 'HINV', 'SaaS invoices', 'فواتير المنصة', 460, 'migration', 'sys_platform_scope_modules'),
  ('HQ_BILLING', 'PAYMENT', 'HPAY', 'SaaS payments', 'مدفوعات المنصة', 470, 'migration', 'sys_platform_scope_modules'),
  ('HQ_PLANS', 'PLAN', 'HPLA', 'Plans', 'الخطط', 480, 'migration', 'sys_platform_scope_modules'),
  ('HQ_PLANS', 'SUBSCRIPTION', 'HSUB', 'Subscriptions', 'الاشتراكات', 490, 'migration', 'sys_platform_scope_modules'),
  ('HQ_OPS', 'OPS_JOB', 'HJOB', 'Ops jobs', 'مهام التشغيل', 500, 'migration', 'sys_platform_scope_modules'),
  ('HQ_OPS', 'OPS_OPERATION', 'HOPR', 'Ops operations', 'عمليات التشغيل', 510, 'migration', 'sys_platform_scope_modules'),
  ('HQ_OPS', 'OPS_CONFIG', 'HCFG', 'Ops config', 'إعدادات التشغيل', 520, 'migration', 'sys_platform_scope_modules'),
  ('HQ_OPS', 'OPS_HEALTH', 'HHLT', 'Ops health', 'صحة المنصة', 530, 'migration', 'sys_platform_scope_modules'),
  ('HQ_SUPPORT', 'TICKET', 'HTKT', 'Support tickets', 'تذاكر الدعم', 540, 'migration', 'sys_platform_scope_modules'),
  ('HQ_CRM', 'LEAD', 'HLED', 'Marketing leads', 'العملاء المحتملون', 550, 'migration', 'sys_platform_scope_modules'),
  ('HQ_CRM', 'CONTENT', 'HCNT', 'Marketing content', 'المحتوى التسويقي', 560, 'migration', 'sys_platform_scope_modules'),
  ('HQ_CRM', 'TRACKING', 'HTRK', 'Marketing tracking', 'التتبع التسويقي', 570, 'migration', 'sys_platform_scope_modules'),
  ('HQ_AUTH', 'HQ_SESSION', 'HSES', 'HQ sessions', 'جلسات المنصة', 580, 'migration', 'sys_platform_scope_modules'),
  ('HQ_RBAC', 'HQ_ROLE', 'HROL', 'HQ roles', 'أدوار المنصة', 590, 'migration', 'sys_platform_scope_modules'),
  ('HQ_RBAC', 'HQ_PERMISSION', 'HPRM', 'HQ permissions', 'صلاحيات المنصة', 600, 'migration', 'sys_platform_scope_modules'),
  ('HQ_NTF', 'HQ_NTF_DELIVERY', 'HNDL', 'HQ notification deliveries', 'إرسال إشعارات المنصة', 610, 'migration', 'sys_platform_scope_modules'),
  ('HQ_SETTINGS', 'GENERAL_CONFIG', 'HGCF', 'General config', 'الإعدادات العامة', 620, 'migration', 'sys_platform_scope_modules'),
  ('HQ_SETTINGS', 'DOC_SEQ', 'HDSQ', 'Document sequences', 'تسلسل المستندات', 630, 'migration', 'sys_platform_scope_modules'),
  ('HQ_AUDIT', 'HQ_AUDIT_LOG', 'HAUL', 'HQ audit log', 'سجل تدقيق المنصة', 640, 'migration', 'sys_platform_scope_modules'),
  ('HQ_CORE_DATA', 'CODE_TABLE', 'HCTB', 'Code tables', 'جداول الرموز', 650, 'migration', 'sys_platform_scope_modules'),
  ('HQ_FLAGS', 'FEATURE_FLAG', 'HFFG', 'Feature flags', 'مفاتيح الميزات', 660, 'migration', 'sys_platform_scope_modules'),
  ('HQ_DEV', 'DEV_PORTAL', 'HDVP', 'Developer portal', 'بوابة المطورين', 670, 'migration', 'sys_platform_scope_modules');

-- Post-check: counts match the approved seed.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.sys_saas_scope_cd) <> 3
     OR (SELECT count(*) FROM public.sys_modules_cd) <> 35
     OR (SELECT count(*) FROM public.sys_module_sub_systems_cd) <> 67 THEN
    RAISE EXCEPTION 'sys_platform_scope_modules: seed count mismatch';
  END IF;
END $$;

COMMIT;
