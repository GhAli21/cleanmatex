-- ==================================================================
-- 0450_cmx_p_tmp.sql
-- Purpose: HQ temp parameter row. chk_isuuid toggles UUID DTO checks
--          (default false = skip UUID format validation).
-- Scope: platform HQ (service role). Not tenant-facing.
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cmx_p_tmp (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chk_isuuid    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    VARCHAR(120),
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    VARCHAR(120),
  updated_info  TEXT,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     VARCHAR(200),
  is_active     BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.cmx_p_tmp IS
  'HQ temp parameter singleton. chk_isuuid: when true, workflow-engine-config validates tenant_org_id as UUID.';
COMMENT ON COLUMN public.cmx_p_tmp.chk_isuuid IS
  'When true, HQ DTO UUID checks run. Default false skips UUID format checks.';

INSERT INTO public.cmx_p_tmp (chk_isuuid, rec_notes, rec_order)
SELECT false, 'Default: do not enforce UUID format on tenant_org_id', 1
WHERE NOT EXISTS (SELECT 1 FROM public.cmx_p_tmp);

ALTER TABLE public.cmx_p_tmp ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cmx_p_tmp FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cmx_p_tmp TO service_role;

COMMIT;
