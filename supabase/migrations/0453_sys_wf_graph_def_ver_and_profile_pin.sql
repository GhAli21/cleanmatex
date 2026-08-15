-- ==================================================================
-- 0453_sys_wf_graph_def_ver_and_profile_pin.sql
-- Purpose: Immutable global workflow graph definition versions +
--          profile version pin FK + fulfilment policy overlay columns.
-- Author: CleanMateX Development Team
-- Created: 2026-08-15
-- Dependencies: 0444_sys_wf_profiles_and_versions.sql
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) Immutable global graph definition versions (reusable across profiles)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_graph_def_ver_mst (
  graph_def_version_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_no            INTEGER NOT NULL,
  version_status        TEXT NOT NULL DEFAULT 'PUBLISHED',
  catalog_fingerprint   TEXT NOT NULL,
  graph_definition      JSONB NOT NULL,
  definition_checksum   TEXT NOT NULL,
  published_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by          UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            UUID,
  rec_status            SMALLINT NOT NULL DEFAULT 1,
  rec_notes             TEXT,
  CONSTRAINT uq_sys_wf_graph_def_ver_fp UNIQUE (catalog_fingerprint),
  CONSTRAINT chk_sys_wf_graph_def_ver_st CHECK (version_status = 'PUBLISHED'),
  CONSTRAINT chk_sys_wf_graph_def_ver_no CHECK (version_no >= 1)
);

COMMENT ON TABLE public.sys_wf_graph_def_ver_mst IS
  'Immutable snapshot of sys_wf_* catalogs at publish time. Reused when catalog_fingerprint matches.';
COMMENT ON COLUMN public.sys_wf_graph_def_ver_mst.graph_definition IS
  'Pinned statuses, screens, transitions, gates, initial_rules, system screen contracts (schema v1).';
COMMENT ON COLUMN public.sys_wf_graph_def_ver_mst.catalog_fingerprint IS
  'Hash of active catalog rows — dedupe key for find-or-create on profile publish.';

CREATE INDEX IF NOT EXISTS idx_sys_wf_graph_def_ver_pub
  ON public.sys_wf_graph_def_ver_mst (published_at DESC);

-- Immutability: no UPDATE of body, no DELETE
CREATE OR REPLACE FUNCTION public.sys_wf_graph_def_ver_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sys_wf_graph_def_ver_mst: graph definition versions cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.graph_definition IS DISTINCT FROM OLD.graph_definition
       OR NEW.catalog_fingerprint IS DISTINCT FROM OLD.catalog_fingerprint
       OR NEW.definition_checksum IS DISTINCT FROM OLD.definition_checksum
       OR NEW.version_no IS DISTINCT FROM OLD.version_no
       OR NEW.version_status IS DISTINCT FROM OLD.version_status
    THEN
      RAISE EXCEPTION 'sys_wf_graph_def_ver_mst: graph definition body is immutable after insert';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sys_wf_graph_def_ver_immut ON public.sys_wf_graph_def_ver_mst;
CREATE TRIGGER trg_sys_wf_graph_def_ver_immut
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_graph_def_ver_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.sys_wf_graph_def_ver_guard();

-- ------------------------------------------------------------------
-- 2) Extend profile versions — pin graph def + policy overlay at publish
-- ------------------------------------------------------------------
ALTER TABLE public.sys_wf_profile_ver_mst
  ADD COLUMN IF NOT EXISTS wf_graph_def_version_id UUID
    REFERENCES public.sys_wf_graph_def_ver_mst (graph_def_version_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS profile_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_policy_checksum TEXT,
  ADD COLUMN IF NOT EXISTS published_policy_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sys_wf_profile_ver_mst.wf_graph_def_version_id IS
  'Set at publish — FK to immutable global graph def. Required for PUBLISHED versions (enforced in app layer until backfill).';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.profile_policy_json IS
  'Profile overlay frozen at publish: fulfilment modes, enabled-screen summary refs, capability flags snapshot.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.profile_policy_checksum IS
  'Audit checksum of profile_policy_json at publish.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.published_policy_at IS
  'When profile overlay was frozen (usually same moment as publish).';

CREATE INDEX IF NOT EXISTS idx_sys_wf_prof_ver_graph_def
  ON public.sys_wf_profile_ver_mst (wf_graph_def_version_id)
  WHERE wf_graph_def_version_id IS NOT NULL;

-- ------------------------------------------------------------------
-- 3) Extend PUBLISHED immutability guard for new pin/overlay columns
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.version_status = 'PUBLISHED' THEN
      RAISE EXCEPTION
        'sys_wf_profile_ver_mst: cannot delete PUBLISHED version % (profile %)',
        OLD.version_no, OLD.profile_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.version_status = 'PUBLISHED' THEN
    IF NEW.version_status = 'RETIRED'
       AND NEW.profile_id IS NOT DISTINCT FROM OLD.profile_id
       AND NEW.version_no IS NOT DISTINCT FROM OLD.version_no
       AND NEW.name IS NOT DISTINCT FROM OLD.name
       AND NEW.name2 IS NOT DISTINCT FROM OLD.name2
       AND NEW.change_summary IS NOT DISTINCT FROM OLD.change_summary
       AND NEW.change_summary2 IS NOT DISTINCT FROM OLD.change_summary2
       AND NEW.based_on_template_id IS NOT DISTINCT FROM OLD.based_on_template_id
       AND NEW.use_preparation_screen IS NOT DISTINCT FROM OLD.use_preparation_screen
       AND NEW.use_assembly_screen IS NOT DISTINCT FROM OLD.use_assembly_screen
       AND NEW.use_qa_screen IS NOT DISTINCT FROM OLD.use_qa_screen
       AND NEW.use_packing_screen IS NOT DISTINCT FROM OLD.use_packing_screen
       AND NEW.track_individual_piece IS NOT DISTINCT FROM OLD.track_individual_piece
       AND NEW.orders_split_enabled IS NOT DISTINCT FROM OLD.orders_split_enabled
       AND NEW.allow_back_steps IS NOT DISTINCT FROM OLD.allow_back_steps
       AND NEW.config_json IS NOT DISTINCT FROM OLD.config_json
       AND NEW.wf_graph_def_version_id IS NOT DISTINCT FROM OLD.wf_graph_def_version_id
       AND NEW.profile_policy_json IS NOT DISTINCT FROM OLD.profile_policy_json
       AND NEW.profile_policy_checksum IS NOT DISTINCT FROM OLD.profile_policy_checksum
       AND NEW.published_policy_at IS NOT DISTINCT FROM OLD.published_policy_at
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
       AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
    THEN
      NEW.retired_at := COALESCE(NEW.retired_at, CURRENT_TIMESTAMP);
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PUBLISHED version % is immutable (clone to DRAFT instead)',
      OLD.version_no;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
