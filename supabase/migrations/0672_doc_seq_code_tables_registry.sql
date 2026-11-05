--
-- Migration 0672_doc_seq_code_tables_registry.sql
-- Human-Friendly Codes, P1 (DB engine), migration 7 of 7.
--
-- Purpose: list the six new lookup tables in sys_code_tables_registry so HQ Core Data Management shows them.
--   All six are registered READ-ONLY (is_editable = false, is_extensible = false) for now:
--   the generic HQ Core Data screen reads and writes a column named "code", but these tables key on
--   scope_code / module_code / sub_system_code / category_code / manage_level_code / doc_type_code.
--   metadata.code_column names the real key column. P8 (HQ) teaches the screen to use metadata.code_column
--   and then flips sys_modules_cd, sys_module_sub_systems_cd and sys_doc_seq_category_cd to editable.
--   sys_doc_seq_type_cd stays read-only here; it gets its own HQ screen (P8).
-- ON CONFLICT (table_name) DO NOTHING: a row already added by hand is kept.
--
-- Affected: sys_code_tables_registry (6 rows inserted).
-- Related:  0042 (registry), migrations scope_modules and doc_seq_type_config.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.7.
-- APPLY ORDER: 7 of 7 in P1 (last). After applying: SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR'; expect 0 rows.
-- ROLLBACK PLAN (forward-only repo; write a new migration):
--   DELETE FROM public.sys_code_tables_registry WHERE table_name IN ('sys_saas_scope_cd','sys_modules_cd',
--     'sys_module_sub_systems_cd','sys_doc_seq_category_cd','sys_doc_seq_manage_level_cd','sys_doc_seq_type_cd')
--     AND created_info = 'doc_seq_code_tables_registry';
--
BEGIN;
SET LOCAL lock_timeout = '10s';

INSERT INTO public.sys_code_tables_registry (
  table_name, display_name, display_name2, description, description2, category, display_order,
  is_editable, is_extensible, supports_tenant_override, code_pattern, max_code_length, requires_unique_name,
  metadata, created_by, created_info, rec_status
) VALUES
  ('sys_saas_scope_cd', 'SaaS Scopes', 'نطاقات المنصة',
   'Who owns data: TENANT_ORG, SYS, HQ. Fixed set used by modules and document numbering.',
   'من يملك البيانات: TENANT_ORG و SYS و HQ. مجموعة ثابتة.',
   'Platform Structure', 10, false, false, false, '^[A-Z][A-Z0-9_]{1,29}$', 30, true,
   '{"code_column": "scope_code", "short_code_column": "short_code", "help_text": "Fixed set; changes need a migration."}'::jsonb,
   'migration', 'doc_seq_code_tables_registry', 1),
  ('sys_modules_cd', 'Modules', 'الوحدات',
   'Product modules per scope (orders, ERP, auth, billing ...). Each has a unique 3-5 letter short code.',
   'وحدات المنتج لكل نطاق، ولكل وحدة رمز مختصر فريد من 3 إلى 5 أحرف.',
   'Platform Structure', 20, false, false, false, '^[A-Z][A-Z0-9_]{1,29}$', 30, true,
   '{"code_column": "module_code", "short_code_column": "short_code", "parent_table": "sys_saas_scope_cd", "help_text": "Read-only until the HQ screen supports code_column (P8)."}'::jsonb,
   'migration', 'doc_seq_code_tables_registry', 1),
  ('sys_module_sub_systems_cd', 'Module Sub-systems', 'الأنظمة الفرعية للوحدات',
   'Sub-systems inside each module. Key is (module_code, sub_system_code); short code is unique across all.',
   'الأنظمة الفرعية داخل كل وحدة، والرمز المختصر فريد على مستوى الكل.',
   'Platform Structure', 30, false, false, false, '^[A-Z][A-Z0-9_]{1,29}$', 30, false,
   '{"code_column": "sub_system_code", "key_columns": ["module_code", "sub_system_code"], "short_code_column": "short_code", "parent_table": "sys_modules_cd", "help_text": "Read-only until the HQ screen supports code_column (P8)."}'::jsonb,
   'migration', 'doc_seq_code_tables_registry', 1),
  ('sys_doc_seq_category_cd', 'Document Number Categories', 'فئات أرقام المستندات',
   'Groups of numbered data: CATALOG, MASTER_DATA, TRANSACTION.',
   'مجموعات البيانات المرقمة: CATALOG و MASTER_DATA و TRANSACTION.',
   'Document Numbering', 40, false, false, false, '^[A-Z][A-Z0-9_]{1,29}$', 30, true,
   '{"code_column": "category_code", "help_text": "Read-only until the HQ screen supports code_column (P8)."}'::jsonb,
   'migration', 'doc_seq_code_tables_registry', 1),
  ('sys_doc_seq_manage_level_cd', 'Document Number Manage Levels', 'مستويات إدارة أرقام المستندات',
   'Who generates a code: GENERAL (shared engine), DOMAIN, MANUAL, NONE. Fixed set; the engine depends on it.',
   'من يولد الرمز: GENERAL أو DOMAIN أو MANUAL أو NONE. مجموعة ثابتة.',
   'Document Numbering', 50, false, false, false, '^[A-Z][A-Z0-9_]{1,29}$', 30, true,
   '{"code_column": "manage_level_code", "help_text": "Fixed set; changes need a migration."}'::jsonb,
   'migration', 'doc_seq_code_tables_registry', 1),
  ('sys_doc_seq_type_cd', 'Document Number Types', 'أنواع أرقام المستندات',
   'Every numbered document or record: format, reset policy, owner, reserved type prefix and how it works.',
   'كل مستند أو سجل مرقم: الصيغة وسياسة إعادة الترقيم والمالك والبادئة المحجوزة.',
   'Document Numbering', 60, false, false, false, '^[A-Z][A-Z0-9_]{1,29}$', 30, true,
   '{"code_column": "doc_type_code", "short_code_column": "type_prefix", "help_text": "Managed on the dedicated HQ Document Numbering screen (P8)."}'::jsonb,
   'migration', 'doc_seq_code_tables_registry', 1)
ON CONFLICT (table_name) DO NOTHING;

COMMIT;
