-- ============================================================================
-- Migration: 0495_wf_v2_full_path_profile_seed.sql
-- Purpose: Self-contained normalized profile dedicated to exercising the full
--          plant chain end to end: prep -> processing -> assembly -> QA ->
--          packing -> ready -> staged pickup / simple delivery. It does not
--          clone, read, or depend on any existing seeded profile.
-- Affected: sys_wf_profiles_cd, sys_wf_profile_ver_mst, sys_wf_prof_ver_*
-- Related: 0472 (WF_V2_ASSEMBLY_QA precedent for this exact stage combination),
--          0477/0487 (sys_wf_prof_ver_live_rpt structural report),
--          0476/0494 (sys_wf_prof_ver_validate_live / sys_wf_prof_ver_guard),
--          0480/0481 (create_preset_code catalog + requirement)
-- ============================================================================
-- Do not apply automatically. No tenant assignment is created. The version is
-- taken directly to PILOT (not just Draft) so it can be assigned to a
-- HQ-validated test/demo tenant (org_tenants_mst.is_hq_test_demo = true) for
-- the floor smoke without a separate Studio Pilot click. The migration
-- self-validates via sys_wf_prof_ver_live_rpt (the same structural report HQ
-- Check policy reads) before flipping status, and the DRAFT -> PILOT UPDATE
-- itself re-validates through the sys_wf_prof_ver_guard trigger
-- (sys_wf_prof_ver_validate_live), so it fails closed on any gap rather than
-- landing a half-seeded Pilot version.
-- ROLLBACK PLAN: retire this profile version (version_status = 'RETIRED') or
-- delete the profile header/version rows; nothing else references them until
-- a tenant assignment is created separately.

BEGIN;
SELECT set_config('cmx.semantic_policy_command', '1', true);

INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status, rec_notes
) VALUES (
  'a1000000-0000-4000-8000-000000000075'::UUID,
  'WF_V2_FULL_PATH',
  'Full path V2 workflow',
  'سير عمل المسار الكامل V2',
  'Dedicated test profile exercising every plant stage: preparation, processing, assembly, QA (pass/fail), packing, ready/release, staged pickup, and simple delivery.',
  'ملف اختبار مخصص يغطي جميع مراحل المصنع: التحضير والمعالجة والتجميع وفحص الجودة (نجاح/فشل) والتغليف والجاهزية والاستلام المرحلي والتوصيل البسيط.',
  true, true, 80, 1, '0495_wf_v2_full_path_profile_seed'
) ON CONFLICT (profile_code) DO NOTHING;

DO $$
DECLARE
  v_profile_id UUID;
  v_version_id UUID := 'a1000000-0000-4000-8000-000000000076'::UUID;
  v_issues TEXT;
BEGIN
  SELECT profile_id INTO v_profile_id
  FROM public.sys_wf_profiles_cd
  WHERE profile_code = 'WF_V2_FULL_PATH';

  IF EXISTS (SELECT 1 FROM public.sys_wf_profile_ver_mst WHERE profile_id = v_profile_id AND version_no = 1) THEN
    RAISE EXCEPTION '0495: WF_V2_FULL_PATH v1 already exists; migration will not overwrite a candidate';
  END IF;

  INSERT INTO public.sys_wf_profile_ver_mst (
    version_id, profile_id, version_no, version_status, name, name2,
    change_summary, change_summary2, policy_revision, is_active, rec_status
  ) VALUES (
    v_version_id, v_profile_id, 1, 'DRAFT',
    'Full path policy v1', 'سياسة المسار الكامل الإصدار 1',
    'Dedicated full-chain test candidate: prep, processing, assembly, QA, packing, ready, staged pickup, simple delivery. Structurally self-validated at apply time and taken directly to Pilot.',
    'مرشح اختبار مخصص للسلسلة الكاملة: التحضير، المعالجة، التجميع، فحص الجودة، التغليف، الجاهزية، الاستلام المرحلي، التوصيل البسيط. تم التحقق البنيوي منه ذاتياً عند التطبيق ونُقل مباشرة إلى المرحلة التجريبية.',
    1, true, 1
  );

  INSERT INTO public.sys_wf_prof_ver_policy_cf (
    version_id, policy_schema_version, stage_sequence,
    use_preparation, use_assembly, use_qa, use_packing,
    track_individual_piece, orders_split_enabled, allow_back_steps,
    pickup_enabled, delivery_enabled, public_tracking_enabled,
    require_pickup_release, allow_direct_counter_pickup,
    require_collection_for_pickup, require_delivery_stop, require_collection_for_delivery,
    require_rack_before_release, partial_pickup_enabled, partial_delivery_enabled,
    returns_enabled, otp_enabled, conditional_routing_enabled, is_active, rec_status,
    created_info
  ) VALUES (
    v_version_id, 1,
    ARRAY['draft','intake','preparing','processing','assembly','qa','packing','ready','ready_for_pickup','out_for_delivery','delivered','on_hold','stopped','cancelled'],
    true, true, true, true, false, false, false,
    true, true, true,
    true, false,
    true, false, true,
    true, false, false,
    false, false, false, true, 1,
    '0495_wf_v2_full_path_profile_seed'
  );

  INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order, rec_status)
  SELECT v_version_id, screen_key, true, display_order, 1
  FROM public.sys_wf_screens_cd
  WHERE screen_key IN ('new_order','preparation','processing','assembly','qa','packing','ready_release','pickup_handover','driver_delivery','order_control','canceling','workboard');

  INSERT INTO public.sys_wf_prof_ver_module_cf (version_id, screen_key, module_mode, is_enabled, display_order, is_active, rec_status, created_info)
  VALUES
    (v_version_id,'new_order','primary_owner',true,10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'preparation','primary_owner',true,20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'processing','primary_owner',true,30,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'assembly','primary_owner',true,40,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'qa','primary_owner',true,50,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'packing','primary_owner',true,60,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'ready_release','primary_owner',true,70,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'pickup_handover','primary_owner',true,80,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'driver_delivery','primary_owner',true,90,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'public_tracking','cross_cutting_command',true,100,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','primary_owner',true,110,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'canceling','primary_owner',true,120,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'workboard','observer',true,130,true,1,'0495_wf_v2_full_path_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_mod_st_cf (version_id, screen_key, status_code, visibility_mode, display_order, is_active, rec_status, created_info)
  VALUES
    (v_version_id,'new_order','draft','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'new_order','intake','owner',20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'preparation','preparing','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'processing','processing','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'assembly','assembly','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'qa','qa','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'packing','packing','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'ready_release','ready','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'pickup_handover','ready_for_pickup','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'pickup_handover','delivered','owner',20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'driver_delivery','out_for_delivery','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'driver_delivery','delivered','owner',20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'public_tracking','out_for_delivery','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','processing','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','on_hold','owner',20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','stopped','owner',30,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'canceling','intake','owner',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'canceling','cancelled','owner',20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'workboard','processing','observer',10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'workboard','assembly','observer',20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'workboard','qa','observer',30,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'workboard','packing','observer',40,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'workboard','ready','observer',50,true,1,'0495_wf_v2_full_path_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_exec_cf (version_id,screen_key,action_code,from_status,to_status,transition_kind,requires_expected_version,requires_idempotency,requires_reason,min_reason_length,requires_evidence,display_order,is_active,rec_status,created_info)
  VALUES
    (v_version_id,'new_order','CONFIRM_PHYSICAL_INTAKE','intake','preparing','fixed',true,true,false,0,false,10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'preparation','COMPLETE_PREPARATION','preparing','processing','fixed',true,true,false,0,false,20,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'processing','COMPLETE_PROCESSING','processing','assembly','fixed',true,true,false,0,false,30,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'assembly','COMPLETE_ASSEMBLY','assembly','qa','fixed',true,true,false,0,false,40,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'qa','PASS_QA','qa','packing','fixed',true,true,false,0,false,50,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'qa','FAIL_QA','qa','processing','fixed',true,true,true,10,false,51,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'packing','COMPLETE_PACKING','packing','ready','fixed',true,true,false,0,false,60,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'ready_release','RELEASE_FOR_PICKUP','ready','ready_for_pickup','fixed',true,true,false,0,false,70,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'pickup_handover','CONFIRM_PICKUP','ready_for_pickup','delivered','fixed',true,true,false,0,false,80,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'ready_release','RELEASE_FOR_DELIVERY','ready','out_for_delivery','fixed',true,true,false,0,false,90,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'driver_delivery','CONFIRM_DELIVERY','out_for_delivery','delivered','fixed',true,true,false,0,false,100,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'public_tracking','CONFIRM_DELIVERY','out_for_delivery','delivered','fixed',true,true,false,0,false,101,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','HOLD_ORDER_WORK','processing','on_hold','fixed',true,true,true,10,false,110,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','RESUME_ORDER_WORK','on_hold','processing','resume_from_hold',true,true,true,10,false,111,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'order_control','STOP_ORDER_WORK','on_hold','stopped','fixed',true,true,true,10,false,112,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'canceling','CANCEL_ORDER','intake','cancelled','fixed',true,true,true,10,false,120,true,1,'0495_wf_v2_full_path_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id,channel_code,is_active,rec_status,created_info)
  SELECT execution.exec_id, channel.channel_code, true, 1, '0495_wf_v2_full_path_profile_seed'
  FROM public.sys_wf_prof_ver_exec_cf AS execution
  CROSS JOIN LATERAL unnest(
    CASE
      WHEN execution.screen_key = 'new_order' AND execution.action_code = 'CONFIRM_PHYSICAL_INTAKE' THEN ARRAY['staff_web','pos']
      WHEN execution.screen_key = 'pickup_handover' THEN ARRAY['staff_web','pos']
      WHEN execution.screen_key = 'driver_delivery' THEN ARRAY['staff_web','mobile']
      WHEN execution.screen_key = 'public_tracking' THEN ARRAY['public_web']
      ELSE ARRAY['staff_web']
    END
  ) AS channel(channel_code)
  WHERE execution.version_id = v_version_id;

  INSERT INTO public.sys_wf_prof_ver_exec_gate_cf (exec_id,gate_code,evaluator_version,input_schema_version,parameters_json,blocking_mode,display_order,is_active,rec_status,created_info)
  SELECT execution.exec_id, gate.gate_code, 1, 1, '{}'::jsonb, 'hard_block', gate.display_order, true, 1, '0495_wf_v2_full_path_profile_seed'
  FROM public.sys_wf_prof_ver_exec_cf AS execution
  CROSS JOIN LATERAL (
    VALUES
      ('ready_release','RELEASE_FOR_PICKUP','rack_required',1),
      ('ready_release','RELEASE_FOR_PICKUP','fin_release_eligible',2),
      ('pickup_handover','CONFIRM_PICKUP','pickup_collection_settled',1),
      ('pickup_handover','CONFIRM_PICKUP','pickup_release_valid',2),
      ('ready_release','RELEASE_FOR_DELIVERY','rack_required',1),
      ('ready_release','RELEASE_FOR_DELIVERY','fin_release_eligible',2),
      ('driver_delivery','CONFIRM_DELIVERY','delivery_collection_settled',1),
      ('public_tracking','CONFIRM_DELIVERY','delivery_collection_settled',1)
  ) AS gate(screen_key, action_code, gate_code, display_order)
  WHERE execution.version_id = v_version_id
    AND execution.screen_key = gate.screen_key
    AND execution.action_code = gate.action_code;

  INSERT INTO public.sys_wf_prof_ver_evidence_cf (version_id,fulfilment_channel,evidence_method_code,is_required,minimum_count,display_order,is_active,rec_status,created_info)
  VALUES
    (v_version_id,'pickup','notes',false,0,10,true,1,'0495_wf_v2_full_path_profile_seed'),
    (v_version_id,'delivery','notes',false,0,10,true,1,'0495_wf_v2_full_path_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_init_cf (version_id,rule_code,order_source_code,order_type_id,is_retail,is_quick_drop,initial_status,priority,create_preset_code,is_active,rec_status,created_info)
  SELECT v_version_id,rule_code,source_code,type_id,retail,quick_drop,status_code,priority,preset,true,1,'0495_wf_v2_full_path_profile_seed'
  FROM (VALUES
    ('INIT_POS_RETAIL','pos',NULL::TEXT,true,NULL::BOOLEAN,'delivered',10,'RETAIL_SOLD'),
    ('INIT_POS_QUICK_DROP','pos',NULL::TEXT,false,true,'intake',20,'POS_QUICK_DROP'),
    ('INIT_POS_PROCESSING','pos',NULL::TEXT,false,false,'processing',30,'POS_IN_HAND'),
    ('INIT_MOBILE_DRAFT','customer_mobile_app',NULL::TEXT,false,NULL::BOOLEAN,'draft',40,'REMOTE_DRAFT'),
    ('INIT_WHATSAPP_DRAFT','whatsapp_bot',NULL::TEXT,false,NULL::BOOLEAN,'draft',45,'REMOTE_DRAFT'),
    ('INIT_API_PARTNER_DRAFT','api_partner',NULL::TEXT,false,NULL::BOOLEAN,'draft',46,'REMOTE_DRAFT'),
    ('INIT_B2B_DRAFT','b2b_portal',NULL::TEXT,false,NULL::BOOLEAN,'draft',47,'REMOTE_DRAFT'),
    ('INIT_STAFF_RETAIL','web_admin',NULL::TEXT,true,NULL::BOOLEAN,'delivered',50,'RETAIL_SOLD'),
    ('INIT_STAFF_MOBILE_RETAIL','staff_mobile_app',NULL::TEXT,true,NULL::BOOLEAN,'delivered',51,'RETAIL_SOLD'),
    ('INIT_KIOSK_RETAIL','kiosk',NULL::TEXT,true,NULL::BOOLEAN,'delivered',52,'RETAIL_SOLD'),
    ('INIT_STAFF_QUICK_DROP','web_admin',NULL::TEXT,false,true,'intake',60,'STAFF_IN_HAND'),
    ('INIT_STAFF_MOBILE_QD','staff_mobile_app',NULL::TEXT,false,true,'intake',61,'STAFF_IN_HAND'),
    ('INIT_KIOSK_QUICK_DROP','kiosk',NULL::TEXT,false,true,'intake',62,'STAFF_IN_HAND'),
    ('INIT_STAFF_PROCESSING','web_admin',NULL::TEXT,false,false,'processing',70,'STAFF_IN_HAND'),
    ('INIT_STAFF_MOBILE_PROC','staff_mobile_app',NULL::TEXT,false,false,'processing',71,'STAFF_IN_HAND'),
    ('INIT_KIOSK_PROCESSING','kiosk',NULL::TEXT,false,false,'processing',72,'STAFF_IN_HAND'),
    ('INIT_DEFAULT',NULL::TEXT,NULL::TEXT,NULL::BOOLEAN,NULL::BOOLEAN,'intake',900,'BRANCH_DEFAULT')
  ) AS rule(rule_code,source_code,type_id,retail,quick_drop,status_code,priority,preset);

  -- Self-check against the exact structural report HQ Check policy reads
  -- (sys_wf_prof_ver_live_rpt) before ever flipping this version to Pilot.
  SELECT string_agg(DISTINCT issue_code, ', ' ORDER BY issue_code) INTO v_issues
  FROM public.sys_wf_prof_ver_live_rpt(v_version_id);
  IF v_issues IS NOT NULL THEN
    RAISE EXCEPTION '0495: WF_V2_FULL_PATH v1 failed structural validation: %', v_issues;
  END IF;

  -- DRAFT -> PILOT. sys_wf_prof_ver_guard fires sys_wf_prof_ver_validate_live
  -- again on this UPDATE, so a second, independent gate must also pass.
  UPDATE public.sys_wf_profile_ver_mst
  SET version_status = 'PILOT', updated_at = CURRENT_TIMESTAMP
  WHERE version_id = v_version_id;
END $$;
COMMIT;
