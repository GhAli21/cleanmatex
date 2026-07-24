-- ==================================================================
-- 0428_org_wf_release_records.sql
-- Purpose: Workflow Order Advance V1.0 — release records (Ready ≠ release)
--          for partial fulfilment / pickup & delivery release audit.
-- Author: CleanMateX Development Team
-- Created: 2026-07-24
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_wf_release_mst (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  order_id          UUID NOT NULL,
  release_type      TEXT NOT NULL,
  release_status    TEXT NOT NULL DEFAULT 'pending',
  state_version_at  BIGINT,
  released_at       TIMESTAMPTZ,
  released_by       UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        UUID,
  updated_at        TIMESTAMPTZ,
  updated_by        UUID,
  rec_status        SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_org_wf_rel_type CHECK (
    release_type IN ('pickup', 'delivery', 'partial')
  ),
  CONSTRAINT chk_org_wf_rel_status CHECK (
    release_status IN ('pending', 'released', 'voided', 'fulfilled')
  )
);

COMMENT ON TABLE public.org_wf_release_mst IS
  'Order release records — Ready ≠ release (Workflow Order Advance V1.0).';

CREATE INDEX IF NOT EXISTS idx_org_wf_rel_tenant_ord
  ON public.org_wf_release_mst (tenant_org_id, order_id);

CREATE TABLE IF NOT EXISTS public.org_wf_release_ln (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  release_id        UUID NOT NULL REFERENCES public.org_wf_release_mst (id),
  order_item_id     UUID,
  qty_released      DECIMAL(19, 4) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rec_status        SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_org_wf_rel_ln_rel
  ON public.org_wf_release_ln (tenant_org_id, release_id);

ALTER TABLE public.org_wf_release_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_wf_release_ln ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_wf_release_mst'
      AND policyname = 'tenant_isolation_org_wf_release_mst'
  ) THEN
    CREATE POLICY tenant_isolation_org_wf_release_mst
      ON public.org_wf_release_mst
      FOR ALL
      USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_wf_release_ln'
      AND policyname = 'tenant_isolation_org_wf_release_ln'
  ) THEN
    CREATE POLICY tenant_isolation_org_wf_release_ln
      ON public.org_wf_release_ln
      FOR ALL
      USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

COMMIT;
