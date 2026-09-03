-- ============================================================
-- Migration: 0484_wf_home_collection_profile_seed.sql
-- Purpose:   T2 profile policy for home collection on every live
--            profile version (published policy with active init rules):
--            module, status ownership, executables, mobile init rules,
--            optional photo evidence. Requires 0483 catalog.
-- Related:   04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md §4.1, WP-T2
-- ============================================================
-- Do not edit applied 0470–0483. Agents never apply this migration.

BEGIN;

CREATE TEMP TABLE tmp_wf_hc_versions (
  version_id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO tmp_wf_hc_versions (version_id)
SELECT DISTINCT init_row.version_id
FROM public.sys_wf_prof_ver_init_cf AS init_row
WHERE init_row.is_active = true
  AND init_row.rec_status = 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst DISABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

SELECT set_config('cmx.semantic_policy_command', '1', true);

-- Module: inbound home collection (between new_order and preparation)
INSERT INTO public.sys_wf_prof_ver_module_cf (
  version_id, screen_key, module_mode, is_enabled, display_order,
  is_active, rec_status, created_info
)
SELECT
  version_row.version_id,
  'home_collection',
  'primary_owner',
  true,
  15,
  true,
  1,
  '0484_wf_home_collection_profile_seed'
FROM tmp_wf_hc_versions AS version_row
ON CONFLICT (version_id, screen_key) DO UPDATE SET
  module_mode = EXCLUDED.module_mode,
  is_enabled = true,
  display_order = EXCLUDED.display_order,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.created_info;

-- Status ownership on home_collection screen
INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
  version_id, screen_key, status_code, visibility_mode, display_order,
  is_active, rec_status, created_info
)
SELECT version_row.version_id, seed.screen_key, seed.status_code,
       seed.visibility_mode, seed.display_order, true, 1,
       '0484_wf_home_collection_profile_seed'
FROM tmp_wf_hc_versions AS version_row
CROSS JOIN (
  VALUES
    ('home_collection', 'awaiting_collection', 'owner', 10),
    ('home_collection', 'out_for_collection', 'owner', 20)
) AS seed(screen_key, status_code, visibility_mode, display_order)
ON CONFLICT (version_id, screen_key, status_code) DO UPDATE SET
  visibility_mode = EXCLUDED.visibility_mode,
  display_order = EXCLUDED.display_order,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.created_info;

-- Workboard observers (supervisor visibility)
INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
  version_id, screen_key, status_code, visibility_mode, display_order,
  is_active, rec_status, created_info
)
SELECT version_row.version_id, seed.screen_key, seed.status_code,
       seed.visibility_mode, seed.display_order, true, 1,
       '0484_wf_home_collection_profile_seed'
FROM tmp_wf_hc_versions AS version_row
CROSS JOIN (
  VALUES
    ('workboard', 'awaiting_collection', 'observer', 70),
    ('workboard', 'out_for_collection', 'observer', 71)
) AS seed(screen_key, status_code, visibility_mode, display_order)
ON CONFLICT (version_id, screen_key, status_code) DO UPDATE SET
  visibility_mode = EXCLUDED.visibility_mode,
  display_order = EXCLUDED.display_order,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.created_info;

-- Executables + channels
DO $$
DECLARE
  version_rec RECORD;
  v_exec_id UUID;
BEGIN
  FOR version_rec IN SELECT version_id FROM tmp_wf_hc_versions LOOP
    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id, screen_key, action_code, from_status, to_status,
      transition_kind, requires_expected_version, requires_idempotency,
      requires_reason, min_reason_length, requires_evidence,
      display_order, is_active, rec_status, created_info
    ) VALUES (
      version_rec.version_id, 'home_collection', 'ASSIGN_HOME_COLLECTION',
      'awaiting_collection', 'out_for_collection',
      'fixed', true, true, false, 0, false,
      10, true, 1, '0484_wf_home_collection_profile_seed'
    )
    ON CONFLICT (version_id, screen_key, action_code, from_status, to_status)
    DO UPDATE SET
      transition_kind = EXCLUDED.transition_kind,
      requires_reason = false,
      min_reason_length = 0,
      display_order = EXCLUDED.display_order,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = EXCLUDED.created_info
    RETURNING exec_id INTO v_exec_id;

    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id, channel_code, is_active, rec_status)
    VALUES
      (v_exec_id, 'staff_web', true, 1),
      (v_exec_id, 'mobile', true, 1)
    ON CONFLICT (exec_id, channel_code) DO UPDATE SET
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP;

    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id, screen_key, action_code, from_status, to_status,
      transition_kind, requires_expected_version, requires_idempotency,
      requires_reason, min_reason_length, requires_evidence,
      display_order, is_active, rec_status, created_info
    ) VALUES (
      version_rec.version_id, 'home_collection', 'CONFIRM_HOME_COLLECTION',
      'out_for_collection', 'intake',
      'fixed', true, true, false, 0, false,
      20, true, 1, '0484_wf_home_collection_profile_seed'
    )
    ON CONFLICT (version_id, screen_key, action_code, from_status, to_status)
    DO UPDATE SET
      transition_kind = EXCLUDED.transition_kind,
      requires_reason = false,
      min_reason_length = 0,
      display_order = EXCLUDED.display_order,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = EXCLUDED.created_info
    RETURNING exec_id INTO v_exec_id;

    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id, channel_code, is_active, rec_status)
    VALUES
      (v_exec_id, 'staff_web', true, 1),
      (v_exec_id, 'mobile', true, 1)
    ON CONFLICT (exec_id, channel_code) DO UPDATE SET
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP;

    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id, screen_key, action_code, from_status, to_status,
      transition_kind, requires_expected_version, requires_idempotency,
      requires_reason, min_reason_length, requires_evidence,
      display_order, is_active, rec_status, created_info
    ) VALUES (
      version_rec.version_id, 'home_collection', 'FAIL_HOME_COLLECTION',
      'out_for_collection', 'awaiting_collection',
      'fixed', true, true, true, 10, false,
      30, true, 1, '0484_wf_home_collection_profile_seed'
    )
    ON CONFLICT (version_id, screen_key, action_code, from_status, to_status)
    DO UPDATE SET
      transition_kind = EXCLUDED.transition_kind,
      requires_reason = true,
      min_reason_length = 10,
      display_order = EXCLUDED.display_order,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = EXCLUDED.created_info
    RETURNING exec_id INTO v_exec_id;

    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id, channel_code, is_active, rec_status)
    VALUES
      (v_exec_id, 'staff_web', true, 1),
      (v_exec_id, 'mobile', true, 1)
    ON CONFLICT (exec_id, channel_code) DO UPDATE SET
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP;

    INSERT INTO public.sys_wf_prof_ver_evidence_cf (
      version_id, fulfilment_channel, evidence_method_code,
      is_required, minimum_count, display_order, is_active, rec_status, created_info
    ) VALUES (
      version_rec.version_id, 'home_collection', 'photo',
      false, 0, 10, true, 1, '0484_wf_home_collection_profile_seed'
    )
    ON CONFLICT (version_id, fulfilment_channel, evidence_method_code) DO UPDATE SET
      is_required = false,
      display_order = EXCLUDED.display_order,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = EXCLUDED.created_info;

    INSERT INTO public.sys_wf_prof_ver_evidence_cf (
      version_id, fulfilment_channel, evidence_method_code,
      is_required, minimum_count, display_order, is_active, rec_status, created_info
    ) VALUES (
      version_rec.version_id, 'home_collection', 'notes',
      false, 0, 20, true, 1, '0484_wf_home_collection_profile_seed'
    )
    ON CONFLICT (version_id, fulfilment_channel, evidence_method_code) DO UPDATE SET
      is_required = false,
      display_order = EXCLUDED.display_order,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = EXCLUDED.created_info;
  END LOOP;
END $$;

-- Mobile Initial rules for home-collection fulfilment types (priority 40/45)
INSERT INTO public.sys_wf_prof_ver_init_cf (
  version_id, rule_code, order_source_code, order_type_id,
  is_retail, is_quick_drop, initial_status, priority,
  create_preset_code, is_active, rec_status, created_info
)
SELECT
  version_row.version_id,
  seed.rule_code,
  seed.order_source_code,
  seed.order_type_id,
  false,
  NULL::BOOLEAN,
  seed.initial_status,
  seed.priority,
  'HOME_COLLECTION_PENDING',
  true,
  1,
  '0484_wf_home_collection_profile_seed'
FROM tmp_wf_hc_versions AS version_row
CROSS JOIN (
  VALUES
    ('INIT_MOBILE_HOME_COLLECTION', 'customer_mobile_app', 'HOME_COLLECTION', 'awaiting_collection', 40),
    ('INIT_MOBILE_CND', 'customer_mobile_app', 'COLLECTION_AND_DELIVERY', 'awaiting_collection', 45)
) AS seed(rule_code, order_source_code, order_type_id, initial_status, priority)
ON CONFLICT (version_id, rule_code) DO UPDATE SET
  order_source_code = EXCLUDED.order_source_code,
  order_type_id = EXCLUDED.order_type_id,
  is_retail = EXCLUDED.is_retail,
  is_quick_drop = EXCLUDED.is_quick_drop,
  initial_status = EXCLUDED.initial_status,
  priority = EXCLUDED.priority,
  create_preset_code = EXCLUDED.create_preset_code,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.created_info;

UPDATE public.sys_wf_profile_ver_mst AS version_row
SET
  policy_revision = version_row.policy_revision + 1,
  updated_at = CURRENT_TIMESTAMP
WHERE version_row.version_id IN (
  SELECT touched.version_id FROM tmp_wf_hc_versions AS touched
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
