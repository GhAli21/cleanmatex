-- =============================================================================
-- 0655_oc_edit_rule_revision_on_save.sql
-- HQ Edit Policy Save advances policy_revision once in platform-api.
-- This trigger stops bumping the revision on every rule row.
-- Apply this migration before deploying the HQ API that writes changed cells.
-- sys_oc_edit_policy_save is unchanged and is no longer called by HQ.
-- Existing EXECUTE grants are unchanged; this file does not reissue them.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_oc_edit_rule_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_policy_id UUID;
  v_lifecycle TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: rule policy identity is immutable' USING ERRCODE = '23514';
  END IF;

  v_policy_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.edit_policy_id ELSE NEW.edit_policy_id END;

  -- Lock the header so a Published or Retired policy cannot change under this write.
  SELECT policy.lifecycle_status INTO v_lifecycle
  FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = v_policy_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: policy % does not exist', v_policy_id USING ERRCODE = '23514';
  END IF;
  IF v_lifecycle IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: % policy rules are immutable', v_lifecycle USING ERRCODE = '23514';
  END IF;

  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_statuses_cd AS status
    WHERE status.status_code = NEW.workflow_status
      AND status.rec_status = 1
      AND status.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: workflow status % is not active', NEW.workflow_status USING ERRCODE = '23514';
  END IF;

  -- policy_revision is not changed here. HQ Save updates the header once, by exactly 1.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sys_oc_edit_rule_guard() IS
  'Blocks rule writes on Published and Retired Edit Policies and rejects an inactive workflow status. Does not change policy_revision; HQ Save advances that once for a Draft or Pilot.';

COMMENT ON TRIGGER trg_sys_oc_edit_rule_guard ON public.sys_oc_edit_policy_rule_dtl IS
  'Protects published matrices and active global statuses. Revision advances in the HQ save, once per save, not once per rule row.';

COMMIT;
