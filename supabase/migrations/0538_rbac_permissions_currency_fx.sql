-- =============================================================================
-- Migration 0538 — Tenant Currency & FX, stage 5A-3: permissions
-- docs/features/Tenant_Currency_FX/implementation_plan_01.md §7.3
--
-- 8 new permissions for the tenant currency portfolio (org_currency_cf) and
-- the tenant rate book (org_fx_rate_mst, 0537):
--
--   currencies:view            read the tenant's currency portfolio
--   currencies:manage          add/configure a foreign currency, context toggles
--   currencies:set_base        change the base (functional) currency — ELEVATED,
--                               DB-locked once the tenant has orders (0532 C6)
--   fx_rates:view               read the tenant rate book
--   fx_rates:manage              create/edit/void a draft or approved rate
--   fx_rates:approve             approve a draft rate (self-approval allowed,
--                               audited per plan P5)
--   fx_rates:import              run a CSV/Excel/URL/HQ-copy import batch
--   fx_rates:manual_override    type a manual rate that bypasses the resolved
--                               book rate on a document — ELEVATED
--
-- Role defaults: mandatory base (super_admin, tenant_admin, admin) always get
-- everything. View/manage/import extend to accountant + finance_manager
-- (+ branch_manager for view, so branch staff can see what currency is in
-- use without being able to change it). approve is finance approval authority
-- (finance_manager). view also extends to viewer — confirmed against the live
-- role defaults that viewer already holds :view/:read across every other
-- domain including finance-adjacent ones (cash_drawer:view,
-- finance_reports:view, invoices:read, pricing:read, stored_value:view_*) —
-- omitting currencies/fx_rates would be an inconsistency, not a deliberate
-- restriction. The two ELEVATED permissions (set_base, manual_override) stay
-- mandatory-base-only — a base-currency change or a bypassed book rate is a
-- one-time/high-impact action, not routine finance work.
--
-- Owner rule: no maker ≠ checker — holding the permission is the only gate,
-- the same user may perform consecutive steps (e.g. draft + self-approve).
--
-- Reversal (forward migration):
--   UPDATE sys_auth_role_default_permissions SET is_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
--    WHERE permission_code IN ('currencies:view','currencies:manage','currencies:set_base',
--      'fx_rates:view','fx_rates:manage','fx_rates:approve','fx_rates:import','fx_rates:manual_override');
--   UPDATE sys_auth_permissions SET is_enabled = FALSE, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
--    WHERE code IN (same list).
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Permission definitions
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('currencies:view',
   'View Tenant Currencies',
   'عرض عملات المنشأة',
   'read',
   'View the tenant''s configured currencies (base, reporting, foreign) and their context settings.',
   'عرض العملات المهيأة للمستأجر (الأساسية، إعداد التقارير، الأجنبية) وإعدادات سياقها.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('currencies:manage',
   'Manage Tenant Currencies',
   'إدارة عملات المنشأة',
   'actions',
   'Add a foreign currency and configure its context toggles (sales, payments, cash, AR), FX defaults and pricing mode.',
   'إضافة عملة أجنبية وضبط إعدادات سياقها (المبيعات، المدفوعات، النقدية، الذمم) والإعدادات الافتراضية للصرف ووضع التسعير.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('currencies:set_base',
   'Set Base Currency',
   'تحديد العملة الأساسية',
   'actions',
   'Change the tenant''s base (functional) currency. Locked in the database once the tenant has orders.',
   'تغيير العملة الأساسية (الوظيفية) للمستأجر. تُقفل في قاعدة البيانات بمجرد وجود طلبات للمستأجر.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('fx_rates:view',
   'View Exchange Rates',
   'عرض أسعار الصرف',
   'read',
   'View the tenant''s own exchange-rate book.',
   'عرض دفتر أسعار الصرف الخاص بالمنشأة.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('fx_rates:manage',
   'Manage Exchange Rates',
   'إدارة أسعار الصرف',
   'actions',
   'Create, edit or void a draft or approved exchange rate in the tenant rate book.',
   'إنشاء أو تعديل أو إلغاء سعر صرف (مسودة أو معتمد) في دفتر أسعار الصرف الخاص بالمنشأة.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('fx_rates:approve',
   'Approve Exchange Rates',
   'اعتماد أسعار الصرف',
   'actions',
   'Approve a draft exchange rate. Self-approval is allowed and audited.',
   'اعتماد سعر صرف بحالة مسودة. يُسمح بالاعتماد الذاتي ويُسجَّل في التدقيق.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('fx_rates:import',
   'Import Exchange Rates',
   'استيراد أسعار الصرف',
   'actions',
   'Run a rate import batch (CSV, Excel, URL fetch, or copy from CleanMateX HQ).',
   'تشغيل دفعة استيراد أسعار صرف (CSV، Excel، استيراد عبر رابط، أو نسخ من المقر الرئيسي CleanMateX).',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('fx_rates:manual_override',
   'Override Exchange Rate Manually',
   'تجاوز سعر الصرف يدوياً',
   'actions',
   'Type a manual exchange rate on a document, bypassing the resolved rate book.',
   'إدخال سعر صرف يدوي على مستند، متجاوزاً السعر المحسوب من دفتر الأسعار.',
   'Currency', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status,
  updated_at    = CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 2. Role defaults — mandatory base roles get all 8 permissions
-- -----------------------------------------------------------------------------
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = TRUE,
  is_active  = TRUE,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code IN (
    'currencies:view', 'currencies:manage', 'currencies:set_base',
    'fx_rates:view', 'fx_rates:manage', 'fx_rates:approve', 'fx_rates:import', 'fx_rates:manual_override'
  );

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN (
    'currencies:view', 'currencies:manage', 'currencies:set_base',
    'fx_rates:view', 'fx_rates:manage', 'fx_rates:approve', 'fx_rates:import', 'fx_rates:manual_override'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 3. Role defaults — view extends to accountant, finance_manager,
--    branch_manager, viewer (viewer already holds :view/:read for every
--    other domain — see note above)
-- -----------------------------------------------------------------------------
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = TRUE,
  is_active  = TRUE,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('accountant', 'finance_manager', 'branch_manager', 'viewer')
  AND permission_code IN ('currencies:view', 'fx_rates:view');

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('accountant', 'finance_manager', 'branch_manager', 'viewer')
  AND p.code IN ('currencies:view', 'fx_rates:view')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 4. Role defaults — manage/import extend to accountant, finance_manager
-- -----------------------------------------------------------------------------
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = TRUE,
  is_active  = TRUE,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('accountant', 'finance_manager')
  AND permission_code IN ('currencies:manage', 'fx_rates:manage', 'fx_rates:import');

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('accountant', 'finance_manager')
  AND p.code IN ('currencies:manage', 'fx_rates:manage', 'fx_rates:import')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 5. Role defaults — approve extends to finance_manager (approval authority)
-- -----------------------------------------------------------------------------
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = TRUE,
  is_active  = TRUE,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code = 'finance_manager'
  AND permission_code = 'fx_rates:approve';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'finance_manager'
  AND p.code = 'fx_rates:approve'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_role TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['super_admin', 'tenant_admin', 'admin'] LOOP
    IF (SELECT COUNT(DISTINCT permission_code) FROM public.sys_auth_role_default_permissions
         WHERE role_code = v_role
           AND permission_code IN (
             'currencies:view', 'currencies:manage', 'currencies:set_base',
             'fx_rates:view', 'fx_rates:manage', 'fx_rates:approve', 'fx_rates:import', 'fx_rates:manual_override'
           )
           AND is_enabled) < 8 THEN
      RAISE EXCEPTION 'currency/fx permission role defaults incomplete for mandatory role %', v_role;
    END IF;
  END LOOP;

  FOREACH v_role IN ARRAY ARRAY['accountant', 'finance_manager', 'branch_manager', 'viewer'] LOOP
    IF (SELECT COUNT(DISTINCT permission_code) FROM public.sys_auth_role_default_permissions
         WHERE role_code = v_role
           AND permission_code IN ('currencies:view', 'fx_rates:view')
           AND is_enabled) < 2 THEN
      RAISE EXCEPTION 'currencies:view/fx_rates:view role defaults incomplete for %', v_role;
    END IF;
  END LOOP;

  FOREACH v_role IN ARRAY ARRAY['accountant', 'finance_manager'] LOOP
    IF (SELECT COUNT(DISTINCT permission_code) FROM public.sys_auth_role_default_permissions
         WHERE role_code = v_role
           AND permission_code IN ('currencies:manage', 'fx_rates:manage', 'fx_rates:import')
           AND is_enabled) < 3 THEN
      RAISE EXCEPTION 'currencies:manage/fx_rates:manage/fx_rates:import role defaults incomplete for %', v_role;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
     WHERE role_code = 'finance_manager' AND permission_code = 'fx_rates:approve' AND is_enabled
  ) THEN
    RAISE EXCEPTION 'fx_rates:approve role default missing for finance_manager';
  END IF;
END $$;

COMMIT;
