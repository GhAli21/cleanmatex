-- =============================================================================
-- Migration: 0757_ui_branding_flags.sql
-- Purpose:   Branding gates and logo slots for the theme runtime (UI Design System PR-07).
--            1. Two plan flags decide what an Organization may change on its theme:
--                 custom_branding — brand colour, radius and font overrides
--                                   → PRO, ENTERPRISE (copied from tenant_branding_config)
--                 white_label     — app name (and later hiding the CleanMateX mark)
--                                   → ENTERPRISE (copied from tenant_white_label)
--               Both flags already exist but were enabled on no plan. Their three
--               overlapping duplicates (tenant_branding_config, tenant_white_label,
--               white_label_enabled) are deactivated; no app code reads them.
--               branded_receipts, branded_emails, receipt_branding_enabled mean other
--               things and are not touched.
--            2. Two new File Util purposes on TENANT_LOGO, single slot like MAIN:
--                 DARK    — logo for dark surfaces (JPEG, PNG, WebP; MAIN is used when missing)
--                 FAVICON — browser tab icon (PNG only: ICO is not a known File Util
--                           type and cannot be content-checked; every current browser
--                           accepts PNG favicons)
-- Affected:  hq_ff_feature_flags_mst, sys_ff_pln_flag_mappings_dtl (data);
--            sys_file_purpose_cd, sys_file_purpose_mime_dtl (data). No schema change.
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-07.md (Task 5, ruling 6).
-- Plan choice is the owner's business decision and can be changed in HQ without a deploy.
-- =============================================================================

BEGIN;

-- ─── 1. Plan flags ─────────────────────────────────────────────────────────

-- The flag's own plan list (HQ regenerates mappings from it).
UPDATE public.hq_ff_feature_flags_mst
SET enabled_plan_codes = '["PRO", "ENTERPRISE"]'::jsonb,
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_migration',
    updated_info = 'Migration: 0757_ui_branding_flags (plans copied from tenant_branding_config)'
WHERE flag_key = 'custom_branding';

UPDATE public.hq_ff_feature_flags_mst
SET enabled_plan_codes = '["ENTERPRISE"]'::jsonb,
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_migration',
    updated_info = 'Migration: 0757_ui_branding_flags (plans copied from tenant_white_label)'
WHERE flag_key = 'white_label';

-- Per-plan mappings read by hq_ff_get_effective_value (upsert, skill template).
INSERT INTO public.sys_ff_pln_flag_mappings_dtl
  (id, plan_code, flag_key, plan_specific_value, is_enabled, notes, created_at, created_by, created_info, rec_status, is_active)
VALUES
  (gen_random_uuid(), 'FREE_TRIAL', 'custom_branding', NULL, false, 'Not in plan', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'STARTER',    'custom_branding', NULL, false, 'Not in plan', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'GROWTH',     'custom_branding', NULL, false, 'Not in plan', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'PRO',        'custom_branding', NULL, true,  'Enabled: brand colour, radius and font overrides', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', 'custom_branding', NULL, true,  'Enabled: brand colour, radius and font overrides', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'FREE_TRIAL', 'white_label',     NULL, false, 'FREE_TRIAL forced OFF by policy', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'STARTER',    'white_label',     NULL, false, 'Not in plan', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'GROWTH',     'white_label',     NULL, false, 'Not in plan', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'PRO',        'white_label',     NULL, false, 'Not in plan', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', 'white_label',     NULL, true,  'Enabled: app name (white label)', CURRENT_TIMESTAMP, 'system_migration', 'Migration: 0757_ui_branding_flags', 1, true)
ON CONFLICT (plan_code, flag_key) DO UPDATE SET
  plan_specific_value = EXCLUDED.plan_specific_value,
  is_enabled          = EXCLUDED.is_enabled,
  notes               = EXCLUDED.notes,
  updated_at          = CURRENT_TIMESTAMP,
  updated_by          = EXCLUDED.created_by,
  updated_info        = EXCLUDED.created_info;

-- Retire the duplicates (soft: rows kept for audit; nothing reads them).
UPDATE public.hq_ff_feature_flags_mst
SET is_active = false, rec_status = 0, enabled_plan_codes = '[]'::jsonb,
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_migration',
    updated_info = 'Migration: 0757_ui_branding_flags (duplicate of custom_branding / white_label)'
WHERE flag_key IN ('tenant_branding_config', 'tenant_white_label', 'white_label_enabled');

UPDATE public.sys_ff_pln_flag_mappings_dtl
SET is_enabled = false, is_active = false, rec_status = 0,
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_migration',
    updated_info = 'Migration: 0757_ui_branding_flags (flag retired)'
WHERE flag_key IN ('tenant_branding_config', 'tenant_white_label', 'white_label_enabled');

-- ─── 2. Logo purposes ──────────────────────────────────────────────────────

INSERT INTO public.sys_file_purpose_cd
  (category_code, purpose_code, max_files, max_size_bytes, is_default, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('TENANT_LOGO', 'DARK',    1, NULL, false, 'Dark logo', 'الشعار الداكن',
   'Logo shown on dark surfaces; the main logo is used when missing.',
   'الشعار المعروض على الخلفيات الداكنة؛ يُستخدم الشعار الرئيسي عند غيابه.', 220, 'system', '0757_ui_branding_flags'),
  ('TENANT_LOGO', 'FAVICON', 1, NULL, false, 'Browser icon', 'أيقونة المتصفح',
   'Square PNG icon shown in the browser tab (white label).',
   'أيقونة PNG مربعة تظهر في تبويب المتصفح (العلامة البيضاء).', 230, 'system', '0757_ui_branding_flags')
ON CONFLICT (category_code, purpose_code) DO NOTHING;

INSERT INTO public.sys_file_purpose_mime_dtl
  (category_code, purpose_code, mime_type, is_allowed, rec_order, created_by, created_info)
VALUES
  ('TENANT_LOGO', 'DARK',    'image/jpeg', true, 1070, 'system', '0757_ui_branding_flags'),
  ('TENANT_LOGO', 'DARK',    'image/png',  true, 1080, 'system', '0757_ui_branding_flags'),
  ('TENANT_LOGO', 'DARK',    'image/webp', true, 1090, 'system', '0757_ui_branding_flags'),
  ('TENANT_LOGO', 'FAVICON', 'image/png',  true, 1100, 'system', '0757_ui_branding_flags')
ON CONFLICT DO NOTHING;

COMMIT;
