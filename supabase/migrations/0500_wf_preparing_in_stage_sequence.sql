-- ============================================================
-- Migration: 0500_wf_preparing_in_stage_sequence.sql
-- Purpose:   0499 added Preparation + quick-drop → preparing, but HQ
--            Check policy requires every from/to and Initial status to
--            appear on Overview stage_sequence. SIMPLE v4 PILOT still
--            omitted preparing, so COMPLETE_PREPARATION / HOLD_ORDER_WORK
--            and the four quick-drop init rules failed. Also refresh
--            POS_QUICK_DROP catalog copy: typical start is preparing.
-- Affected:  sys_wf_prof_ver_policy_cf, sys_wf_profile_ver_mst,
--            sys_wf_create_presets_cd
-- Related:   0499 (quick-drop to preparing), 0480 (create presets)
-- ============================================================
-- Do not apply automatically. Edits DRAFT/PILOT only. PUBLISHED stays
-- frozen. After apply, restart HQ platform-api if Check policy still
-- rejects POS_QUICK_DROP+preparing (allowed list lives in HQ TS), then
-- re-run Studio Check policy on SIMPLE v4.
-- ROLLBACK PLAN: remove 'preparing' from SIMPLE v4 stage_sequence when
-- it was inserted by this tag; restore POS_QUICK_DROP descriptions from
-- 0480. No PUBLISHED edits.

BEGIN;
SELECT set_config('cmx.semantic_policy_command', '1', true);

DO $$
DECLARE
  v_tag TEXT := '0500_wf_preparing_in_stage_sequence';
  v_version RECORD;
  v_seq TEXT[];
  v_proc INTEGER;
  v_intake INTEGER;
  v_issues TEXT;
BEGIN
  -- 1) Any DRAFT/PILOT that owns preparing must list it on Overview.
  FOR v_version IN
    SELECT version.version_id
    FROM public.sys_wf_profile_ver_mst AS version
    INNER JOIN public.sys_wf_prof_ver_policy_cf AS policy
      ON policy.version_id = version.version_id
    WHERE version.version_status IN ('DRAFT', 'PILOT')
      AND NOT ('preparing' = ANY (COALESCE(policy.stage_sequence, ARRAY[]::TEXT[])))
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS owner_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
          ON owned.version_id = owner_module.version_id
         AND owned.screen_key = owner_module.screen_key
        WHERE owner_module.version_id = version.version_id
          AND owner_module.screen_key = 'preparation'
          AND owner_module.module_mode = 'primary_owner'
          AND owner_module.is_enabled = true
          AND owner_module.is_active = true
          AND owner_module.rec_status = 1
          AND owned.status_code = 'preparing'
          AND owned.visibility_mode = 'owner'
          AND owned.is_active = true
          AND owned.rec_status = 1
      )
  LOOP
    SELECT policy.stage_sequence
      INTO v_seq
    FROM public.sys_wf_prof_ver_policy_cf AS policy
    WHERE policy.version_id = v_version.version_id;

    v_seq := COALESCE(v_seq, ARRAY[]::TEXT[]);
    v_proc := array_position(v_seq, 'processing');
    v_intake := array_position(v_seq, 'intake');

    IF v_proc IS NOT NULL THEN
      v_seq := v_seq[1:v_proc - 1] || ARRAY['preparing']::TEXT[] || v_seq[v_proc:];
    ELSIF v_intake IS NOT NULL THEN
      v_seq := v_seq[1:v_intake] || ARRAY['preparing']::TEXT[] || v_seq[v_intake + 1:];
    ELSE
      v_seq := v_seq || ARRAY['preparing']::TEXT[];
    END IF;

    UPDATE public.sys_wf_prof_ver_policy_cf
    SET stage_sequence = v_seq,
        updated_at = CURRENT_TIMESTAMP,
        updated_info = v_tag
    WHERE version_id = v_version.version_id;

    UPDATE public.sys_wf_profile_ver_mst
    SET policy_revision = policy_revision + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE version_id = v_version.version_id;

    SELECT string_agg(DISTINCT issue_code, ', ' ORDER BY issue_code) INTO v_issues
    FROM public.sys_wf_prof_ver_live_rpt(v_version.version_id);
    IF v_issues IS NOT NULL THEN
      RAISE EXCEPTION '0500: version % failed structural validation: %', v_version.version_id, v_issues;
    END IF;
  END LOOP;

  -- 2) Catalog copy: POS quick-drop typical start is preparing (bag in hand).
  UPDATE public.sys_wf_create_presets_cd
  SET description =
        'Use for POS quick-drop creates when bags are on the counter but piece detail may be incomplete. Stamps physical intake as received and leaves preparation pending. Typical Initial status: preparing when the profile owns Preparation; intake only when the journey still starts at New order.',
      description2 =
        'يُستخدم لإسقاط نقطة البيع السريع عندما تكون الحقائب على الطاولة وقد تكون تفاصيل القطع غير مكتملة. يختم الاستلام الفعلي كمستلم ويترك التحضير معلقاً. الحالة الابتدائية المعتادة: preparing عندما يملك الملف التحضير؛ intake فقط عندما تبدأ الرحلة عند الطلب الجديد.',
      rec_notes = 'POS quick drop starts at preparing when Preparation owns the journey',
      updated_at = CURRENT_TIMESTAMP,
      updated_info = v_tag
  WHERE create_preset_code = 'POS_QUICK_DROP';
END $$;
COMMIT;
