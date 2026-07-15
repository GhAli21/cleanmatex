-- =====================================================
-- 0402_nav_deactivate_marketing_promotions.sql
-- Consolidate marketing promotions nav: deactivate the
-- duplicate /dashboard/marketing/promotions entry. Canonical
-- admin surface is marketing_promos → /dashboard/marketing/promos.
-- =====================================================

BEGIN;

UPDATE public.sys_components_cd
SET
  is_active = false,
  is_navigable = false,
  rec_status = 0,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'SYSTEM',
  updated_info = '0402: deactivated — consolidated into marketing_promos (/promos)',
  rec_notes = COALESCE(rec_notes || ' | ', '') || 'Deprecated 0402: use marketing_promos'
WHERE comp_code = 'marketing_promotions';

COMMIT;
