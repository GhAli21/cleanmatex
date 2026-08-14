-- ==================================================================
-- 0444_sys_wf_profiles_and_versions.sql
-- Purpose: HQ workflow profiles + immutable versions + screen enablement;
--          FK org_wf_profile_assign_cf → profiles; seed WF_V2_STANDARD v1.
-- Author: CleanMateX Development Team
-- Created: 2026-08-14
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql,
--               0018_workflow_templates.sql (optional based_on_template_id)
-- ADR: docs/features/Workflow_Order_Advance/ADR_SYS_WF_PROFILES.md
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) Profile header (HQ-authored operating profiles)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_profiles_cd (
  profile_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_code  TEXT NOT NULL,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    UUID,
  updated_at    TIMESTAMPTZ,
  updated_by    UUID,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_notes     TEXT,
  CONSTRAINT uq_sys_wf_profiles_code UNIQUE (profile_code)
);

COMMENT ON TABLE public.sys_wf_profiles_cd IS
  'HQ workflow operating profiles. Assigned to tenants via org_wf_profile_assign_cf.';
COMMENT ON COLUMN public.sys_wf_profiles_cd.profile_code IS
  'Stable code (e.g. WF_V2_STANDARD). Do not rename after publish/assign.';

CREATE INDEX IF NOT EXISTS idx_sys_wf_profiles_active
  ON public.sys_wf_profiles_cd (is_active)
  WHERE COALESCE(is_active, true) = true AND COALESCE(rec_status, 1) = 1;

-- ------------------------------------------------------------------
-- 2) Profile versions (immutable once PUBLISHED)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_profile_ver_mst (
  version_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              UUID NOT NULL
    REFERENCES public.sys_wf_profiles_cd (profile_id) ON DELETE RESTRICT,
  version_no              INTEGER NOT NULL,
  version_status          TEXT NOT NULL DEFAULT 'DRAFT',
  name                    TEXT,
  name2                   TEXT,
  change_summary          TEXT,
  change_summary2         TEXT,
  based_on_template_id    UUID
    REFERENCES public.sys_workflow_template_cd (template_id) ON DELETE SET NULL,
  use_preparation_screen  BOOLEAN NOT NULL DEFAULT true,
  use_assembly_screen     BOOLEAN NOT NULL DEFAULT true,
  use_qa_screen           BOOLEAN NOT NULL DEFAULT true,
  use_packing_screen      BOOLEAN NOT NULL DEFAULT true,
  track_individual_piece  BOOLEAN NOT NULL DEFAULT false,
  orders_split_enabled    BOOLEAN NOT NULL DEFAULT false,
  allow_back_steps        BOOLEAN NOT NULL DEFAULT false,
  config_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at            TIMESTAMPTZ,
  published_by            UUID,
  retired_at              TIMESTAMPTZ,
  retired_by              UUID,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by              UUID,
  updated_at              TIMESTAMPTZ,
  updated_by              UUID,
  rec_status              SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_sys_wf_prof_ver UNIQUE (profile_id, version_no),
  CONSTRAINT chk_sys_wf_prof_ver_no CHECK (version_no >= 1),
  CONSTRAINT chk_sys_wf_prof_ver_st CHECK (
    version_status IN ('DRAFT', 'PUBLISHED', 'RETIRED')
  ),
  CONSTRAINT chk_sys_wf_prof_ver_pub CHECK (
    version_status <> 'PUBLISHED'
    OR published_at IS NOT NULL
  )
);

COMMENT ON TABLE public.sys_wf_profile_ver_mst IS
  'HQ profile versions. PUBLISHED rows are immutable except retire. Runtime graph stays in sys_wf_* catalogs.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.version_status IS
  'DRAFT | PUBLISHED | RETIRED';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.based_on_template_id IS
  'Optional lineage to legacy sys_workflow_template_cd; not runtime authority for V2 actions.';
COMMENT ON COLUMN public.sys_wf_profile_ver_mst.config_json IS
  'Forward-compatible non-structural prefs only. No executable scripts.';

CREATE INDEX IF NOT EXISTS idx_sys_wf_prof_ver_prof
  ON public.sys_wf_profile_ver_mst (profile_id, version_status);

CREATE INDEX IF NOT EXISTS idx_sys_wf_prof_ver_pub
  ON public.sys_wf_profile_ver_mst (profile_id, version_no)
  WHERE version_status = 'PUBLISHED' AND COALESCE(is_active, true) = true;

-- ------------------------------------------------------------------
-- 3) Enabled screens per version
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_prof_ver_scr_dtl (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID NOT NULL
    REFERENCES public.sys_wf_profile_ver_mst (version_id) ON DELETE RESTRICT,
  screen_key    TEXT NOT NULL
    REFERENCES public.sys_wf_screens_cd (screen_key) ON DELETE RESTRICT,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_sys_wf_prof_ver_scr UNIQUE (version_id, screen_key)
);

COMMENT ON TABLE public.sys_wf_prof_ver_scr_dtl IS
  'Which operational screens a published profile version exposes.';

CREATE INDEX IF NOT EXISTS idx_sys_wf_prof_ver_scr
  ON public.sys_wf_prof_ver_scr_dtl (version_id)
  WHERE COALESCE(is_enabled, true) = true;

-- ------------------------------------------------------------------
-- 4) Immutability guard for PUBLISHED versions
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
    -- Allow only retire + audit fields
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

  -- Screen detail rows: block change when parent version is PUBLISHED
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sys_wf_prof_ver_immut ON public.sys_wf_profile_ver_mst;
CREATE TRIGGER trg_sys_wf_prof_ver_immut
  BEFORE UPDATE OR DELETE ON public.sys_wf_profile_ver_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.sys_wf_prof_ver_guard();

CREATE OR REPLACE FUNCTION public.sys_wf_prof_scr_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_version_id UUID;
BEGIN
  v_version_id := COALESCE(NEW.version_id, OLD.version_id);

  SELECT version_status INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_version_id;

  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_scr_dtl: cannot modify screens of PUBLISHED version %',
      v_version_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sys_wf_prof_scr_guard ON public.sys_wf_prof_ver_scr_dtl;
CREATE TRIGGER trg_sys_wf_prof_scr_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_wf_prof_ver_scr_dtl
  FOR EACH ROW
  EXECUTE FUNCTION public.sys_wf_prof_scr_guard();

-- ------------------------------------------------------------------
-- 5) FKs from assignment table (additive; orphan rows block apply)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_org_wf_asg_profile'
      AND conrelid = 'public.org_wf_profile_assign_cf'::regclass
  ) THEN
    ALTER TABLE public.org_wf_profile_assign_cf
      ADD CONSTRAINT fk_org_wf_asg_profile
      FOREIGN KEY (wf_profile_id)
      REFERENCES public.sys_wf_profiles_cd (profile_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- When version_no is set, it must exist for that profile (NULL version_no = latest at resolve time)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_org_wf_asg_prof_ver'
      AND conrelid = 'public.org_wf_profile_assign_cf'::regclass
  ) THEN
    ALTER TABLE public.org_wf_profile_assign_cf
      ADD CONSTRAINT fk_org_wf_asg_prof_ver
      FOREIGN KEY (wf_profile_id, wf_version_no)
      REFERENCES public.sys_wf_profile_ver_mst (profile_id, version_no)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN public.org_wf_profile_assign_cf.wf_profile_id IS
  'FK → sys_wf_profiles_cd.profile_id (HQ profile).';
COMMENT ON COLUMN public.org_wf_profile_assign_cf.wf_version_no IS
  'Pinned published version; NULL means resolve latest PUBLISHED at order create / read.';

-- ------------------------------------------------------------------
-- 6) Seed WF_V2_STANDARD + published v1 (idempotent)
--    Order: profile → DRAFT version → screens → PUBLISH
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status
)
VALUES (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'WF_V2_STANDARD',
  'Standard V2 workflow',
  'سير عمل قياسي V2',
  'Default HQ profile for Workflow Engine V2. Capabilities + screens; graph remains in sys_wf_* catalogs.',
  'ملف HQ الافتراضي لمحرك سير العمل V2.',
  true,
  true,
  10,
  1
)
ON CONFLICT (profile_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  is_system = true,
  is_active = true,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- Seed uses profile_code lookup for version rows (stable across re-runs).

INSERT INTO public.sys_wf_profile_ver_mst (
  version_id, profile_id, version_no, version_status,
  name, name2, change_summary,
  based_on_template_id,
  use_preparation_screen, use_assembly_screen, use_qa_screen, use_packing_screen,
  track_individual_piece, orders_split_enabled, allow_back_steps,
  is_active, rec_status
)
SELECT
  'a1000000-0000-4000-8000-000000000002'::uuid,
  p.profile_id,
  1,
  'DRAFT',
  'Standard V2 v1',
  'قياسي V2 الإصدار 1',
  'Initial published seed for HQ assign / canary.',
  t.template_id,
  true, true, true, true,
  false, false, false,
  true,
  1
FROM public.sys_wf_profiles_cd p
LEFT JOIN public.sys_workflow_template_cd t
  ON t.template_code = 'WF_STANDARD'
WHERE p.profile_code = 'WF_V2_STANDARD'
ON CONFLICT (profile_id, version_no) DO NOTHING;

INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order)
SELECT
  v.version_id,
  s.screen_key,
  true,
  s.display_order
FROM public.sys_wf_profile_ver_mst v
JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
CROSS JOIN public.sys_wf_screens_cd s
WHERE p.profile_code = 'WF_V2_STANDARD'
  AND v.version_no = 1
  AND v.version_status = 'DRAFT'
  AND s.screen_key IN (
    'new_order',
    'preparation',
    'processing',
    'assembly',
    'qa',
    'packing',
    'ready_release',
    'driver_delivery',
    'order_control',
    'public_tracking',
    'canceling',
    'returning',
    'workboard'
  )
ON CONFLICT (version_id, screen_key) DO NOTHING;

UPDATE public.sys_wf_profile_ver_mst v
SET
  version_status = 'PUBLISHED',
  published_at = COALESCE(v.published_at, CURRENT_TIMESTAMP),
  updated_at = CURRENT_TIMESTAMP
FROM public.sys_wf_profiles_cd p
WHERE p.profile_id = v.profile_id
  AND p.profile_code = 'WF_V2_STANDARD'
  AND v.version_no = 1
  AND v.version_status = 'DRAFT';

COMMIT;
