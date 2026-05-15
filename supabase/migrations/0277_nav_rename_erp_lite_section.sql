-- ==================================================================
-- Migration: 0277_nav_rename_erp_lite_section.sql
-- Purpose:   Rename 'erp_lite' navigation section from
--            "ERP-Lite Finance & Accounting" to "ERP-Lite"
-- Project:   cleanmatex
-- Notes:
--   - Label-only rename. Children, roles, paths, permissions unchanged.
--   - Mirrors the label change in web-admin/config/navigation.ts.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

UPDATE public.sys_components_cd
SET 
  label        = 'ERP-Lite',
  label2       = 'إدارة الموارد المخففة',
  description  = 'ERP-Lite finance and accounting section',
  description2 = 'قسم المالية والمحاسبة للنظام المخفف',
  updated_at   = CURRENT_TIMESTAMP
WHERE comp_code = 'erp_lite';

UPDATE sys_components_cd
SET label = 'ERP-Lite- ' || regexp_replace(label, '^(ERP-Lite- *)+', '')
, label2 = 'ERP-Lite- ' || regexp_replace(label2, '^(ERP-Lite- *)+', '')
WHERE comp_code like 'erp_lite%'
and comp_code !='erp_lite'
;



COMMIT;
