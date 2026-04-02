-- ==================================================================
-- Migration: 0196_erp_lite_default_gov_live.sql
-- Purpose: Make the approved ERP-Lite v1 governance baseline live
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Activates the already-approved v1 HQ package, rules, and policies
--   - Does not create new governance codes or rules
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

UPDATE public.sys_fin_gov_pkg_mst
SET
  status_code = 'PUBLISHED',
  effective_from = COALESCE(effective_from, CURRENT_DATE),
  approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
  approved_by = COALESCE(approved_by, 'system_seed'),
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
  published_by = COALESCE(published_by, 'system_seed'),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0196 - publish default ERP-Lite v1 baseline'
WHERE pkg_code = 'ERP_LITE_V1_CORE'
  AND version_no = 1
  AND is_active = true
  AND rec_status = 1;

UPDATE public.sys_fin_map_rule_mst r
SET
  status_code = 'ACTIVE',
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0196 - activate default ERP-Lite v1 rules'
FROM public.sys_fin_gov_pkg_mst p
WHERE r.pkg_id = p.pkg_id
  AND p.pkg_code = 'ERP_LITE_V1_CORE'
  AND p.version_no = 1
  AND p.is_active = true
  AND p.rec_status = 1
  AND r.is_active = true
  AND r.rec_status = 1;

UPDATE public.sys_fin_auto_post_mst ap
SET
  status_code = 'ACTIVE',
  effective_from = COALESCE(ap.effective_from, CURRENT_DATE),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0196 - activate default ERP-Lite v1 auto-post policies'
FROM public.sys_fin_gov_pkg_mst p
WHERE ap.pkg_id = p.pkg_id
  AND p.pkg_code = 'ERP_LITE_V1_CORE'
  AND p.version_no = 1
  AND p.is_active = true
  AND p.rec_status = 1
  AND ap.is_active = true
  AND ap.rec_status = 1;

COMMIT;
