-- ============================================================
-- Migration: 0486_wf_hold_edges_expand.sql
-- Purpose:   T3 hold hardening — HOLD_ORDER_WORK edges from every
--            allowlisted plant status the live profile already owns
--            (not only processing). Observer-execute catalog rows so
--            Check policy still allows order_control to Observe the
--            typical Owner. Resume remains resume_from_hold.
-- Affected:  sys_wf_observer_exec_x_cd, sys_wf_prof_ver_mod_st_cf,
--            sys_wf_prof_ver_exec_cf, sys_wf_prof_ver_exec_ch_cf,
--            sys_wf_profile_ver_mst.policy_revision
-- Related:   0436, 0479, 04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md §3.5
-- ============================================================
-- Do not edit applied 0470–0485. Agents never apply this migration.

BEGIN;

CREATE TEMP TABLE tmp_wf_hold_versions (
  version_id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO tmp_wf_hold_versions (version_id)
SELECT DISTINCT init_row.version_id
FROM public.sys_wf_prof_ver_init_cf AS init_row
WHERE init_row.is_active = true
  AND init_row.rec_status = 1;

-- Platform observer-execute exceptions (live_rpt joins this catalog).
INSERT INTO public.sys_wf_observer_exec_x_cd (
  exception_code, screen_key, action_code, from_status, to_status,
  owner_screen_key, exec_module_mode, required_channel_code,
  is_active, name, name2, description, description2,
  created_info, rec_status, rec_order, rec_notes
) VALUES
  (
    'HOLD_FROM_PREPARING',
    'order_control', 'HOLD_ORDER_WORK', 'preparing', 'on_hold',
    'preparation', 'primary_owner', NULL,
    true,
    'Hold from observed preparing',
    'تعليق من التحضير المراقب',
    'Allows order_control HOLD_ORDER_WORK from preparing → on_hold while it only Observes preparing. preparation must remain the primary Owner of preparing.',
    'يسمح لوحدة تحكم الطلب بتعليق العمل من التحضير إلى معلّق بينما تراقب حالة التحضير فقط. يجب أن تبقى وحدة التحضير المالك الأساسي.',
    '0486_wf_hold_edges_expand', 1, 41,
    'Typical-owner model: hold observes preparing owned by preparation'
  ),
  (
    'HOLD_FROM_ASSEMBLY',
    'order_control', 'HOLD_ORDER_WORK', 'assembly', 'on_hold',
    'assembly', 'primary_owner', NULL,
    true,
    'Hold from observed assembly',
    'تعليق من التجميع المراقب',
    'Allows order_control HOLD_ORDER_WORK from assembly → on_hold while it only Observes assembly. assembly must remain the primary Owner of assembly.',
    'يسمح لوحدة تحكم الطلب بتعليق العمل من التجميع إلى معلّق بينما تراقب حالة التجميع فقط. يجب أن تبقى وحدة التجميع المالك الأساسي.',
    '0486_wf_hold_edges_expand', 1, 42,
    'Typical-owner model: hold observes assembly owned by assembly'
  ),
  (
    'HOLD_FROM_QA',
    'order_control', 'HOLD_ORDER_WORK', 'qa', 'on_hold',
    'qa', 'primary_owner', NULL,
    true,
    'Hold from observed QA',
    'تعليق من الفحص المراقب',
    'Allows order_control HOLD_ORDER_WORK from qa → on_hold while it only Observes qa. qa must remain the primary Owner of qa.',
    'يسمح لوحدة تحكم الطلب بتعليق العمل من الفحص إلى معلّق بينما تراقب حالة الفحص فقط. يجب أن تبقى وحدة الفحص المالك الأساسي.',
    '0486_wf_hold_edges_expand', 1, 43,
    'Typical-owner model: hold observes qa owned by qa'
  ),
  (
    'HOLD_FROM_PACKING',
    'order_control', 'HOLD_ORDER_WORK', 'packing', 'on_hold',
    'packing', 'primary_owner', NULL,
    true,
    'Hold from observed packing',
    'تعليق من التغليف المراقب',
    'Allows order_control HOLD_ORDER_WORK from packing → on_hold while it only Observes packing. packing must remain the primary Owner of packing.',
    'يسمح لوحدة تحكم الطلب بتعليق العمل من التغليف إلى معلّق بينما تراقب حالة التغليف فقط. يجب أن تبقى وحدة التغليف المالك الأساسي.',
    '0486_wf_hold_edges_expand', 1, 44,
    'Typical-owner model: hold observes packing owned by packing'
  ),
  (
    'HOLD_FROM_READY',
    'order_control', 'HOLD_ORDER_WORK', 'ready', 'on_hold',
    'ready_release', 'primary_owner', NULL,
    true,
    'Hold from observed ready',
    'تعليق من الجاهز المراقب',
    'Allows order_control HOLD_ORDER_WORK from ready → on_hold while it only Observes ready. ready_release must remain the primary Owner of ready.',
    'يسمح لوحدة تحكم الطلب بتعليق العمل من الجاهز إلى معلّق بينما تراقب حالة الجاهز فقط. يجب أن تبقى وحدة الإفراج عن الجاهز المالك الأساسي.',
    '0486_wf_hold_edges_expand', 1, 45,
    'Typical-owner model: hold observes ready owned by ready_release'
  ),
  (
    'HOLD_FROM_OFD',
    'order_control', 'HOLD_ORDER_WORK', 'out_for_delivery', 'on_hold',
    'driver_delivery', 'primary_owner', NULL,
    true,
    'Hold from observed out for delivery',
    'تعليق من التوصيل المراقب',
    'Allows order_control HOLD_ORDER_WORK from out_for_delivery → on_hold while it only Observes out_for_delivery. driver_delivery must remain the primary Owner of out_for_delivery.',
    'يسمح لوحدة تحكم الطلب بتعليق العمل من في الطريق للتوصيل إلى معلّق بينما تراقب الحالة فقط. يجب أن تبقى وحدة توصيل السائق المالك الأساسي.',
    '0486_wf_hold_edges_expand', 1, 46,
    'Typical-owner model: hold observes OFD owned by driver_delivery'
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst DISABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

SELECT set_config('cmx.semantic_policy_command', '1', true);

-- Observer membership + HOLD exec only when the typical Owner already owns the status.
DO $$
DECLARE
  version_rec RECORD;
  seed RECORD;
  v_exec_id UUID;
BEGIN
  FOR version_rec IN SELECT version_id FROM tmp_wf_hold_versions LOOP
    FOR seed IN
      SELECT *
      FROM (VALUES
        ('preparing',        'preparation',     5),
        ('processing',       'processing',     10),
        ('assembly',         'assembly',       20),
        ('qa',               'qa',             30),
        ('packing',          'packing',        40),
        ('ready',            'ready_release',  50),
        ('out_for_delivery', 'driver_delivery', 60)
      ) AS allowlist(from_status, owner_screen, display_order)
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS owner_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
          ON owned.version_id = owner_module.version_id
         AND owned.screen_key = owner_module.screen_key
        INNER JOIN public.sys_wf_prof_ver_module_cf AS control_module
          ON control_module.version_id = owner_module.version_id
         AND control_module.screen_key = 'order_control'
        WHERE owner_module.version_id = version_rec.version_id
          AND owner_module.screen_key = seed.owner_screen
          AND owner_module.module_mode = 'primary_owner'
          AND owner_module.is_enabled = true
          AND owner_module.is_active = true
          AND owner_module.rec_status = 1
          AND owned.status_code = seed.from_status
          AND owned.visibility_mode = 'owner'
          AND owned.is_active = true
          AND owned.rec_status = 1
          AND control_module.module_mode = 'primary_owner'
          AND control_module.is_enabled = true
          AND control_module.is_active = true
          AND control_module.rec_status = 1
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
        version_id, screen_key, status_code, visibility_mode, display_order,
        is_active, rec_status, created_info
      ) VALUES (
        version_rec.version_id, 'order_control', seed.from_status, 'observer',
        seed.display_order, true, 1, '0486_wf_hold_edges_expand'
      )
      ON CONFLICT (version_id, screen_key, status_code) DO UPDATE SET
        visibility_mode = 'observer',
        display_order = EXCLUDED.display_order,
        is_active = true,
        rec_status = 1,
        updated_at = CURRENT_TIMESTAMP,
        updated_info = EXCLUDED.created_info;

      INSERT INTO public.sys_wf_prof_ver_exec_cf (
        version_id, screen_key, action_code, from_status, to_status,
        transition_kind, requires_expected_version, requires_idempotency,
        requires_reason, min_reason_length, requires_evidence,
        display_order, is_active, rec_status, created_info
      ) VALUES (
        version_rec.version_id, 'order_control', 'HOLD_ORDER_WORK',
        seed.from_status, 'on_hold',
        'fixed', true, true, true, 10, false,
        110 + seed.display_order, true, 1, '0486_wf_hold_edges_expand'
      )
      ON CONFLICT (version_id, screen_key, action_code, from_status, to_status)
      DO UPDATE SET
        transition_kind = EXCLUDED.transition_kind,
        requires_expected_version = EXCLUDED.requires_expected_version,
        requires_idempotency = EXCLUDED.requires_idempotency,
        requires_reason = EXCLUDED.requires_reason,
        min_reason_length = EXCLUDED.min_reason_length,
        is_active = true,
        rec_status = 1,
        updated_at = CURRENT_TIMESTAMP,
        updated_info = EXCLUDED.created_info
      RETURNING exec_id INTO v_exec_id;

      INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (
        exec_id, channel_code, is_active, rec_status
      ) VALUES (
        v_exec_id, 'staff_web', true, 1
      )
      ON CONFLICT (exec_id, channel_code) DO UPDATE SET
        is_active = true,
        rec_status = 1,
        updated_at = CURRENT_TIMESTAMP;
    END LOOP;
  END LOOP;
END $$;

UPDATE public.sys_wf_profile_ver_mst AS version_row
SET
  policy_revision = version_row.policy_revision + 1,
  updated_at = CURRENT_TIMESTAMP
WHERE version_row.version_id IN (
  SELECT touched.version_id FROM tmp_wf_hold_versions AS touched
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst ENABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

COMMIT;
