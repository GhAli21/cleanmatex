-- ==================================================================
-- 0514_cmx_p_tmp_scope_and_rec_order_default.sql
-- Purpose: Add is_hq_or_cmx_or_both scope column to cmx_p_tmp so each row
--          declares which app(s) should read it: HQ (cleanmatexsaas
--          platform-api), CMX (this tenant app), or BOTH. Also sets a
--          DEFAULT of 0 on rec_order (added in 0450 with no default) so
--          future inserts don't need to specify it explicitly.
-- Scope: platform HQ (service role). Not tenant-facing.
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

ALTER TABLE public.cmx_p_tmp
  ALTER COLUMN rec_order SET DEFAULT 0;

ALTER TABLE public.cmx_p_tmp
  ADD COLUMN IF NOT EXISTS is_hq_or_cmx_or_both TEXT NOT NULL DEFAULT 'BOTH';

ALTER TABLE public.cmx_p_tmp
  ADD CONSTRAINT cmx_p_tmp_scope_ck
  CHECK (is_hq_or_cmx_or_both IN ('HQ', 'CMX', 'BOTH'));

COMMENT ON COLUMN public.cmx_p_tmp.is_hq_or_cmx_or_both IS
  'Which app(s) should read this row: HQ (cleanmatexsaas platform-api), CMX (this tenant app), or BOTH.';

COMMENT ON COLUMN public.cmx_p_tmp.rec_order IS
  'Sort order when multiple active rows are visible to the same app scope. Lower reads first. Default 0.';

-- Seed the existing row
UPDATE public.cmx_p_tmp
SET is_hq_or_cmx_or_both = 'BOTH'
WHERE is_hq_or_cmx_or_both IS DISTINCT FROM 'BOTH';

COMMIT;
