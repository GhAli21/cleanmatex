-- =====================================================
-- 0403_promo_is_auto_apply.sql
-- Explicit auto-apply flag on org_promotions_mst.
-- Replaces the implicit "null promo_code = auto-apply" convention
-- and the matching partial index idx_promotions_auto_apply.
-- =====================================================

BEGIN;

ALTER TABLE public.org_promotions_mst
  ADD COLUMN IF NOT EXISTS is_auto_apply BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.org_promotions_mst.is_auto_apply IS
  'When true, checkout may apply this promotion without a typed code. Independent of promo_code (code-only, auto-only, or both).';

-- Backfill: former null-code rows were treated as auto-apply.
UPDATE public.org_promotions_mst
SET
  is_auto_apply = true,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = COALESCE(updated_info, '') || ' | 0403: backfilled is_auto_apply from null promo_code'
WHERE promo_code IS NULL
  AND is_auto_apply = false;

-- Replace legacy partial index (promo_code IS NULL) with is_auto_apply filter.
DROP INDEX IF EXISTS public.idx_promotions_auto_apply RESTRICT;

CREATE INDEX idx_promotions_auto_apply
  ON public.org_promotions_mst (tenant_org_id, is_active, is_enabled, valid_from, valid_to)
  TABLESPACE pg_default
  WHERE is_auto_apply = true
    AND is_active = true
    AND rec_status = 1;

COMMIT;
