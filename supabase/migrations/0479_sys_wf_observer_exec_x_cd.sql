-- ============================================================
-- Migration: 0479_sys_wf_observer_exec_x_cd.sql
-- Purpose:   Platform catalog for observer-execute exceptions.
--            live_rpt joins this table instead of hardcoding the
--            four named tuples from 0478. Migration-seeded only —
--            not HQ Studio CRUD (platform law, not profile policy).
-- Affected:  sys_wf_observer_exec_x_cd (new), sys_wf_prof_ver_live_rpt
-- Related:   0478, ADR-SAAS-MNG-0010
-- ============================================================
-- Do not edit applied 0470–0478. Agents never apply this migration.
-- ROLLBACK: DROP TABLE sys_wf_observer_exec_x_cd; restore live_rpt from 0478.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_wf_observer_exec_x_cd (
  exception_code TEXT PRIMARY KEY,
  screen_key TEXT NOT NULL
    REFERENCES public.sys_wf_screens_cd (screen_key) ON DELETE RESTRICT,
  action_code TEXT NOT NULL
    REFERENCES public.sys_wf_actions_cd (action_code) ON DELETE RESTRICT,
  from_status TEXT NOT NULL
    REFERENCES public.sys_wf_statuses_cd (status_code) ON DELETE RESTRICT,
  to_status TEXT NOT NULL
    REFERENCES public.sys_wf_statuses_cd (status_code) ON DELETE RESTRICT,
  owner_screen_key TEXT NOT NULL
    REFERENCES public.sys_wf_screens_cd (screen_key) ON DELETE RESTRICT,
  exec_module_mode TEXT NOT NULL,
  required_channel_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL,
  name2 TEXT,
  description TEXT NOT NULL,
  description2 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT chk_wf_obs_exec_mode CHECK (
    exec_module_mode IN ('primary_owner', 'cross_cutting_command')
  ),
  CONSTRAINT uq_wf_obs_exec_tuple UNIQUE (
    screen_key, action_code, from_status, to_status
  )
);

COMMENT ON TABLE public.sys_wf_observer_exec_x_cd IS
  'Platform allowlist of observer-execute exceptions for Check-policy write-lock. Seeded only by migrations; not per-profile Studio config.';
COMMENT ON COLUMN public.sys_wf_observer_exec_x_cd.owner_screen_key IS
  'Primary-owner module that must own from_status while the executing screen observes it.';
COMMENT ON COLUMN public.sys_wf_observer_exec_x_cd.required_channel_code IS
  'Optional required exec channel (e.g. public_web). NULL means no channel constraint beyond ordinary channel presence.';
COMMENT ON COLUMN public.sys_wf_observer_exec_x_cd.description IS
  'English operator/developer explanation of why this observer-execute exception is allowed and what structural conditions must hold.';
COMMENT ON COLUMN public.sys_wf_observer_exec_x_cd.description2 IS
  'Arabic operator/developer explanation of why this observer-execute exception is allowed and what structural conditions must hold.';

CREATE INDEX IF NOT EXISTS idx_sys_wf_obs_exec_active
  ON public.sys_wf_observer_exec_x_cd (is_active, rec_status)
  WHERE is_active = true AND rec_status = 1;

INSERT INTO public.sys_wf_observer_exec_x_cd (
  exception_code, screen_key, action_code, from_status, to_status,
  owner_screen_key, exec_module_mode, required_channel_code,
  is_active, name, name2, description, description2,
  created_info, rec_status, rec_order, rec_notes
) VALUES
  (
    'PICKUP_CONFIRM_READY',
    'pickup_handover', 'CONFIRM_PICKUP', 'ready', 'delivered',
    'ready_release', 'primary_owner', NULL,
    true,
    'Counter pickup from observed ready',
    'استلام من الفرع من جاهز مراقب',
    'Allows pickup_handover to run CONFIRM_PICKUP from ready → delivered while it only Observes ready. ready_release must remain the primary Owner of ready. This is the direct counter-pickup path (allow_direct_counter_pickup still required at runtime). Workboard Observer execute is not covered by this row.',
    'يسمح لوحدة الاستلام من الفرع بتنفيذ تأكيد الاستلام من حالة جاهز إلى مسلم بينما تراقب حالة جاهز فقط. يجب أن تبقى وحدة الإفراج عن الجاهز المالك الأساسي لحالة جاهز. هذا مسار الاستلام المباشر من الطاولة (وما زال allow_direct_counter_pickup مطلوباً وقت التشغيل). تنفيذ لوحة المتابعة بصفة مراقب غير مشمول بهذا الصف.',
    '0479_sys_wf_observer_exec_x_cd',
    1, 10,
    'ADR direct counter pickup; Check-policy write-lock exception'
  ),
  (
    'PUBLIC_OFD_CONFIRM',
    'public_tracking', 'CONFIRM_DELIVERY', 'out_for_delivery', 'delivered',
    'driver_delivery', 'cross_cutting_command', 'public_web',
    true,
    'Public tracking confirm from observed OFD',
    'تأكيد التوصيل العام من في الطريق مراقب',
    'Allows public_tracking (cross_cutting_command) to run CONFIRM_DELIVERY from out_for_delivery → delivered while it Observes OFD. driver_delivery must remain the primary Owner of out_for_delivery. The executable must bind channel public_web. Staff/driver confirms stay on driver_delivery ownership and are not granted by this row.',
    'يسمح لوحدة التتبع العام (أمر عابر) بتنفيذ تأكيد التوصيل من في الطريق للتوصيل إلى مسلم بينما تراقب حالة في الطريق. يجب أن تبقى وحدة توصيل السائق المالك الأساسي لهذه الحالة. يجب ربط التنفيذ بقناة public_web. تأكيد الموظف/السائق يبقى على ملكية توصيل السائق ولا يُمنح بهذا الصف.',
    '0479_sys_wf_observer_exec_x_cd',
    1, 20,
    'Public OFD customer confirm; requires public_web channel'
  ),
  (
    'CANCEL_FROM_INTAKE',
    'canceling', 'CANCEL_ORDER', 'intake', 'cancelled',
    'new_order', 'primary_owner', NULL,
    true,
    'Cancel from observed intake',
    'إلغاء من الاستلام المراقب',
    'Allows canceling to run CANCEL_ORDER from intake → cancelled while it only Observes intake. new_order must remain the primary Owner of intake. Needed so cancel remains available after Check policy forces a single Owner per status (canceling is Observer, not co-Owner).',
    'يسمح لوحدة الإلغاء بتنفيذ إلغاء الطلب من الاستلام إلى ملغى بينما تراقب حالة الاستلام فقط. يجب أن تبقى وحدة الطلب الجديد المالك الأساسي لحالة الاستلام. مطلوب حتى يبقى الإلغاء متاحاً بعد أن تفرض سياسة التحقق مالكاً واحداً لكل حالة (الإلغاء مراقب وليس مالكاً مشتركاً).',
    '0479_sys_wf_observer_exec_x_cd',
    1, 30,
    'Typical-owner model: cancel observes intake owned by new_order'
  ),
  (
    'HOLD_FROM_PROCESSING',
    'order_control', 'HOLD_ORDER_WORK', 'processing', 'on_hold',
    'processing', 'primary_owner', NULL,
    true,
    'Hold from observed processing',
    'تعليق من التشغيل المراقب',
    'Allows order_control to run HOLD_ORDER_WORK from processing → on_hold while it only Observes processing. The processing module must remain the primary Owner of processing. Needed so hold remains available after Check policy forces a single Owner per status (order_control is Observer, not co-Owner). Resume still restores hold_from_status at runtime.',
    'يسمح لوحدة تحكم الطلب بتنفيذ تعليق العمل من التشغيل إلى معلّق بينما تراقب حالة التشغيل فقط. يجب أن تبقى وحدة التشغيل المالك الأساسي لحالة التشغيل. مطلوب حتى يبقى التعليق متاحاً بعد أن تفرض سياسة التحقق مالكاً واحداً لكل حالة (تحكم الطلب مراقب وليس مالكاً مشتركاً). الاستئناف ما زال يعيد hold_from_status وقت التشغيل.',
    '0479_sys_wf_observer_exec_x_cd',
    1, 40,
    'Typical-owner model: hold observes processing owned by processing'
  )
ON CONFLICT (exception_code) DO UPDATE SET
  screen_key = EXCLUDED.screen_key,
  action_code = EXCLUDED.action_code,
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  owner_screen_key = EXCLUDED.owner_screen_key,
  exec_module_mode = EXCLUDED.exec_module_mode,
  required_channel_code = EXCLUDED.required_channel_code,
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.created_info,
  rec_status = 1,
  rec_order = EXCLUDED.rec_order,
  rec_notes = EXCLUDED.rec_notes;

-- Replace 0478 hardcoded exception ORs with catalog join.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_live_rpt(
  p_version_id UUID
)
RETURNS TABLE (
  issue_code TEXT,
  issue_path TEXT,
  exec_id UUID,
  screen_key TEXT,
  action_code TEXT,
  from_status TEXT,
  to_status TEXT,
  owner_screen TEXT,
  rule_code TEXT,
  init_status TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Codes must match HQ WF_LIVE_STRUCTURAL_ISSUE_CODES exactly (DB-mirror).

  RETURN QUERY
  SELECT
    'profile_policy_missing'::TEXT,
    'policy'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_policy_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'initial_rule_missing'::TEXT,
    'initial_rules'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_init_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'profile_no_primary_owner_module'::TEXT,
    'modules'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_module_cf
    WHERE version_id = p_version_id
      AND module_mode = 'primary_owner'
      AND is_enabled = true
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'execution_without_channel'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_exec_ch_cf AS channel
      WHERE channel.exec_id = executable.exec_id
        AND channel.is_active = true
        AND channel.rec_status = 1
    );

  RETURN QUERY
  SELECT
    'confirm_pickup_not_on_pickup_handover'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND executable.action_code = 'CONFIRM_PICKUP'
    AND executable.screen_key <> 'pickup_handover';

  -- Ordinary executables need owner visibility on the executing module.
  -- Platform observer-execute exceptions come from sys_wf_observer_exec_x_cd
  -- (migration-seeded only). Workboard module_mode=observer still cannot execute.
  RETURN QUERY
  SELECT
    'execution_not_from_status_owner'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    (
      SELECT owner_module.screen_key
      FROM public.sys_wf_prof_ver_module_cf AS owner_module
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
        ON owned.version_id = owner_module.version_id
       AND owned.screen_key = owner_module.screen_key
      WHERE owner_module.version_id = executable.version_id
        AND owner_module.module_mode = 'primary_owner'
        AND owner_module.is_enabled = true
        AND owner_module.is_active = true
        AND owner_module.rec_status = 1
        AND owned.status_code = executable.from_status
        AND owned.visibility_mode = 'owner'
        AND owned.is_active = true
        AND owned.rec_status = 1
      ORDER BY owner_module.display_order
      LIMIT 1
    ),
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_observer_exec_x_cd AS exception_row
      WHERE exception_row.is_active = true
        AND exception_row.rec_status = 1
        AND exception_row.screen_key = executable.screen_key
        AND exception_row.action_code = executable.action_code
        AND exception_row.from_status = executable.from_status
        AND exception_row.to_status = executable.to_status
        AND (
          exception_row.required_channel_code IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.sys_wf_prof_ver_exec_ch_cf AS required_channel
            WHERE required_channel.exec_id = executable.exec_id
              AND required_channel.channel_code = exception_row.required_channel_code
              AND required_channel.is_active = true
              AND required_channel.rec_status = 1
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.sys_wf_prof_ver_module_cf AS exec_module
          INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS observed
            ON observed.version_id = exec_module.version_id
           AND observed.screen_key = exec_module.screen_key
          WHERE exec_module.version_id = executable.version_id
            AND exec_module.screen_key = exception_row.screen_key
            AND exec_module.module_mode = exception_row.exec_module_mode
            AND exec_module.is_enabled = true
            AND exec_module.is_active = true
            AND exec_module.rec_status = 1
            AND observed.status_code = exception_row.from_status
            AND observed.visibility_mode = 'observer'
            AND observed.is_active = true
            AND observed.rec_status = 1
        )
        AND EXISTS (
          SELECT 1
          FROM public.sys_wf_prof_ver_module_cf AS owner_module
          INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
            ON owned.version_id = owner_module.version_id
           AND owned.screen_key = owner_module.screen_key
          WHERE owner_module.version_id = executable.version_id
            AND owner_module.screen_key = exception_row.owner_screen_key
            AND owner_module.module_mode = 'primary_owner'
            AND owner_module.is_enabled = true
            AND owner_module.is_active = true
            AND owner_module.rec_status = 1
            AND owned.status_code = exception_row.from_status
            AND owned.visibility_mode = 'owner'
            AND owned.is_active = true
            AND owned.rec_status = 1
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_module_cf AS module_row
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
        ON membership.version_id = module_row.version_id
       AND membership.screen_key = module_row.screen_key
      WHERE module_row.version_id = executable.version_id
        AND module_row.screen_key = executable.screen_key
        AND module_row.module_mode <> 'observer'
        AND module_row.is_enabled = true
        AND module_row.is_active = true
        AND module_row.rec_status = 1
        AND membership.status_code = executable.from_status
        AND membership.visibility_mode = 'owner'
        AND membership.is_active = true
        AND membership.rec_status = 1
    );

  RETURN QUERY
  SELECT
    'initial_rule_status_without_owner'::TEXT,
    'initial_rules.' || initial_rule.rule_code,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    initial_rule.rule_code,
    initial_rule.initial_status
  FROM public.sys_wf_prof_ver_init_cf AS initial_rule
  WHERE initial_rule.version_id = p_version_id
    AND initial_rule.is_active = true
    AND initial_rule.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_module_cf AS module_row
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
        ON membership.version_id = module_row.version_id
       AND membership.screen_key = module_row.screen_key
      WHERE module_row.version_id = initial_rule.version_id
        AND module_row.module_mode = 'primary_owner'
        AND module_row.is_enabled = true
        AND module_row.is_active = true
        AND module_row.rec_status = 1
        AND membership.status_code = initial_rule.initial_status
        AND membership.visibility_mode = 'owner'
        AND membership.is_active = true
        AND membership.rec_status = 1
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) IS
  'Structural completeness report for one profile version. Returns catalog issue_code rows with locators and no EN/AR. HQ Check policy maps the rows; sys_wf_prof_ver_validate_live fails closed when any row exists. Observer-execute exceptions come from sys_wf_observer_exec_x_cd (migration-seeded). Not a runtime policy resolver.';

CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_validate_live(
  p_version_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_codes TEXT := '';
  v_detail TEXT := '';
  v_seen TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_row IN
    SELECT issue_code, issue_path
    FROM public.sys_wf_prof_ver_live_rpt(p_version_id)
    ORDER BY issue_code, issue_path
  LOOP
    IF v_detail <> '' THEN
      v_detail := v_detail || '; ';
    END IF;
    v_detail := v_detail || v_row.issue_code || '@' || COALESCE(v_row.issue_path, '');

    IF NOT (v_row.issue_code = ANY (v_seen)) THEN
      v_seen := array_append(v_seen, v_row.issue_code);
      IF v_codes <> '' THEN
        v_codes := v_codes || ', ';
      END IF;
      v_codes := v_codes || v_row.issue_code;
    END IF;
  END LOOP;

  IF v_codes <> '' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: %',
      v_codes
      USING DETAIL = v_detail;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) IS
  'Write-path fail-closed wrapper around sys_wf_prof_ver_live_rpt for Pilot, Published, and assigned versions. Raises P0001 with catalog codes when the shared report is non-empty. Not a runtime policy resolver or public RPC.';

COMMIT;
