-- ============================================================================
-- 0454_sys_wf_profile_ver_unpublish.sql
-- Allow HQ to unpublish a PUBLISHED profile version back to DRAFT for edit,
-- then republish (rebuild/re-pin graph def via existing publish pipeline).
--
-- Rules:
--   PUBLISHED → DRAFT: status + clear publish timestamps only (content/pin unchanged)
--   PUBLISHED → RETIRED: unchanged (existing retire path)
--   In-flight orders keep last wf_graph_def_version_id while draft; tenant loader
--   resolves pin by profile_id+version_no without requiring PUBLISHED.
--   Active tenant assigns may remain; new order create still requires PUBLISHED.
--
-- DO NOT APPLY via agent tools — review and apply manually.
-- ============================================================================

BEGIN;

COMMENT ON COLUMN public.sys_wf_profile_ver_mst.version_status IS
  'DRAFT | PUBLISHED | RETIRED. PUBLISHED may transition to RETIRED or back to DRAFT (unpublish). '
  'DRAFT edits are allowed; republish rebuilds/re-pins graph def.';

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
    -- Retire path (unchanged)
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

    -- Unpublish path: PUBLISHED → DRAFT (clear publish stamps only; keep last pin for orders)
    IF NEW.version_status = 'DRAFT'
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
       AND NEW.published_at IS NULL
       AND NEW.published_by IS NULL
       AND NEW.published_policy_at IS NULL
    THEN
      NEW.retired_at := NULL;
      NEW.retired_by := NULL;
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PUBLISHED version % is immutable (unpublish to DRAFT or retire)',
      OLD.version_no;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
