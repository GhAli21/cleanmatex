-- ============================================================================
-- Migration: 0488_wf_v2_home_collection_profile_seed.sql
-- Purpose: Self-contained normalized Home Collection profile.  It intentionally
--          does not clone, read, or depend on any existing seeded profile.
--          The candidate remains an unsigned DRAFT for HQ Check policy.
-- ============================================================================
-- Do not apply automatically. No tenant assignment is created.

BEGIN;
SELECT set_config('cmx.semantic_policy_command', '1', true);

INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status, rec_notes
) VALUES (
  'a1000000-0000-4000-8000-000000000073'::UUID,
  'WF_V2_HOME_COLLECTION',
  'Home Collection V2 workflow',
  'سير عمل الاستلام من المنزل V2',
  'Standalone standard plant workflow with optional inbound customer-home collection.',
  'سير عمل مصنع قياسي مستقل مع استلام اختياري من منزل العميل.',
  true, true, 75, 1, '0488_wf_v2_home_collection_profile_seed'
) ON CONFLICT (profile_code) DO NOTHING;

DO $$
DECLARE
  v_profile_id UUID;
  v_version_id UUID := 'a1000000-0000-4000-8000-000000000074'::UUID;
  v_issues TEXT;
BEGIN
  SELECT profile_id INTO v_profile_id
  FROM public.sys_wf_profiles_cd
  WHERE profile_code = 'WF_V2_HOME_COLLECTION';

  IF EXISTS (SELECT 1 FROM public.sys_wf_profile_ver_mst WHERE profile_id = v_profile_id AND version_no = 1) THEN
    RAISE EXCEPTION '0488: WF_V2_HOME_COLLECTION v1 already exists; migration will not overwrite a candidate';
  END IF;

  INSERT INTO public.sys_wf_profile_ver_mst (
    version_id, profile_id, version_no, version_status, name, name2,
    change_summary, change_summary2, policy_revision, is_active, rec_status
  ) VALUES (
    v_version_id, v_profile_id, 1, 'DRAFT',
    'Home Collection policy v1', 'سياسة الاستلام من المنزل الإصدار 1',
    'Standalone Home Collection candidate. Check policy, Compile, and operator smoke are required before Pilot.',
    'مرشح مستقل للاستلام من المنزل. يلزم فحص السياسة والترجمة واختبار المشغل قبل المرحلة التجريبية.',
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
    ARRAY['draft','intake','awaiting_collection','out_for_collection','preparing','processing','packing','ready','ready_for_pickup','out_for_delivery','delivered','on_hold','stopped'],
    true,false,false,true,false,false,false,
    true,true,false,
    false,false,false,false,false,false,
    false,false,false,false,false, true,1,
    '0488_wf_v2_home_collection_profile_seed'
  );

  INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order, rec_status)
  SELECT v_version_id, screen_key, true, display_order, 1
  FROM public.sys_wf_screens_cd
  WHERE screen_key IN ('new_order','home_collection','preparation','processing','packing','ready_release','pickup_handover','driver_delivery','workboard');

  INSERT INTO public.sys_wf_prof_ver_module_cf (version_id, screen_key, module_mode, is_enabled, display_order, is_active, rec_status, created_info)
  VALUES
    (v_version_id,'new_order','primary_owner',true,10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','primary_owner',true,15,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'preparation','primary_owner',true,20,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'processing','primary_owner',true,30,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'packing','primary_owner',true,40,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'ready_release','primary_owner',true,50,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'pickup_handover','primary_owner',true,60,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'driver_delivery','primary_owner',true,70,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'workboard','observer',true,80,true,1,'0488_wf_v2_home_collection_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_mod_st_cf (version_id, screen_key, status_code, visibility_mode, display_order, is_active, rec_status, created_info)
  VALUES
    (v_version_id,'new_order','draft','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'new_order','intake','owner',20,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','awaiting_collection','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','out_for_collection','owner',20,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'preparation','preparing','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'processing','processing','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'packing','packing','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'ready_release','ready','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'pickup_handover','ready_for_pickup','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'pickup_handover','delivered','owner',20,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'driver_delivery','out_for_delivery','owner',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'workboard','awaiting_collection','observer',10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'workboard','out_for_collection','observer',20,true,1,'0488_wf_v2_home_collection_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_exec_cf (version_id,screen_key,action_code,from_status,to_status,transition_kind,requires_expected_version,requires_idempotency,requires_reason,min_reason_length,requires_evidence,display_order,is_active,rec_status,created_info)
  VALUES
    (v_version_id,'new_order','CONFIRM_PHYSICAL_INTAKE','draft','intake','fixed',true,true,false,0,false,10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'new_order','CONFIRM_PHYSICAL_INTAKE','intake','preparing','fixed',true,true,false,0,false,20,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','ASSIGN_HOME_COLLECTION','awaiting_collection','out_for_collection','fixed',true,true,false,0,false,30,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','CONFIRM_HOME_COLLECTION','out_for_collection','intake','fixed',true,true,false,0,false,40,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','FAIL_HOME_COLLECTION','out_for_collection','awaiting_collection','fixed',true,true,true,10,false,50,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'preparation','COMPLETE_PREPARATION','preparing','processing','fixed',true,true,false,0,false,60,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'processing','COMPLETE_PROCESSING','processing','packing','fixed',true,true,false,0,false,70,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'packing','COMPLETE_PACKING','packing','ready','fixed',true,true,false,0,false,80,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'ready_release','RELEASE_FOR_PICKUP','ready','ready_for_pickup','fixed',true,true,false,0,false,90,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'pickup_handover','CONFIRM_PICKUP','ready_for_pickup','delivered','fixed',true,true,false,0,false,100,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'ready_release','RELEASE_FOR_DELIVERY','ready','out_for_delivery','fixed',true,true,false,0,false,110,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'driver_delivery','CONFIRM_DELIVERY','out_for_delivery','delivered','fixed',true,true,false,0,false,120,true,1,'0488_wf_v2_home_collection_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id,channel_code,is_active,rec_status,created_info)
  SELECT execution.exec_id, channel.channel_code, true, 1, '0488_wf_v2_home_collection_profile_seed'
  FROM public.sys_wf_prof_ver_exec_cf AS execution
  CROSS JOIN LATERAL unnest(CASE WHEN execution.screen_key='home_collection' THEN ARRAY['staff_web','mobile'] ELSE ARRAY['staff_web'] END) AS channel(channel_code)
  WHERE execution.version_id=v_version_id;

  INSERT INTO public.sys_wf_prof_ver_evidence_cf (version_id,fulfilment_channel,evidence_method_code,is_required,minimum_count,display_order,is_active,rec_status,created_info)
  VALUES
    (v_version_id,'pickup','notes',false,0,10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'delivery','notes',false,0,10,true,1,'0488_wf_v2_home_collection_profile_seed'),
    (v_version_id,'home_collection','photo',false,0,10,true,1,'0488_wf_v2_home_collection_profile_seed');

  INSERT INTO public.sys_wf_prof_ver_init_cf (version_id,rule_code,order_source_code,order_type_id,is_retail,is_quick_drop,initial_status,priority,create_preset_code,is_active,rec_status,created_info)
  SELECT v_version_id,rule_code,source_code,type_id,retail,quick_drop,status_code,priority,preset,true,1,'0488_wf_v2_home_collection_profile_seed'
  FROM (VALUES
    ('INIT_POS_RETAIL','pos',NULL::TEXT,true,NULL::BOOLEAN,'delivered',10,'RETAIL_SOLD'),('INIT_POS_QUICK_DROP','pos',NULL::TEXT,false,true,'intake',20,'POS_QUICK_DROP'),('INIT_POS_PROCESSING','pos',NULL::TEXT,false,false,'processing',30,'POS_IN_HAND'),
    ('INIT_MOBILE_HOME_COLLECTION','customer_mobile_app','HOME_COLLECTION',false,NULL::BOOLEAN,'awaiting_collection',40,'HOME_COLLECTION_PENDING'),('INIT_MOBILE_CND','customer_mobile_app','COLLECTION_AND_DELIVERY',false,NULL::BOOLEAN,'awaiting_collection',45,'HOME_COLLECTION_PENDING'),('INIT_MOBILE_DRAFT','customer_mobile_app',NULL::TEXT,false,NULL::BOOLEAN,'draft',50,'REMOTE_DRAFT'),
    ('INIT_WHATSAPP_DRAFT','whatsapp_bot',NULL::TEXT,false,NULL::BOOLEAN,'draft',55,'REMOTE_DRAFT'),('INIT_API_PARTNER_DRAFT','api_partner',NULL::TEXT,false,NULL::BOOLEAN,'draft',56,'REMOTE_DRAFT'),('INIT_B2B_DRAFT','b2b_portal',NULL::TEXT,false,NULL::BOOLEAN,'draft',57,'REMOTE_DRAFT'),
    ('INIT_STAFF_RETAIL','web_admin',NULL::TEXT,true,NULL::BOOLEAN,'delivered',60,'RETAIL_SOLD'),('INIT_STAFF_MOBILE_RETAIL','staff_mobile_app',NULL::TEXT,true,NULL::BOOLEAN,'delivered',61,'RETAIL_SOLD'),('INIT_KIOSK_RETAIL','kiosk',NULL::TEXT,true,NULL::BOOLEAN,'delivered',62,'RETAIL_SOLD'),
    ('INIT_STAFF_QUICK_DROP','web_admin',NULL::TEXT,false,true,'intake',70,'STAFF_IN_HAND'),('INIT_STAFF_MOBILE_QD','staff_mobile_app',NULL::TEXT,false,true,'intake',71,'STAFF_IN_HAND'),('INIT_KIOSK_QUICK_DROP','kiosk',NULL::TEXT,false,true,'intake',72,'STAFF_IN_HAND'),
    ('INIT_STAFF_PROCESSING','web_admin',NULL::TEXT,false,false,'processing',80,'STAFF_IN_HAND'),('INIT_STAFF_MOBILE_PROC','staff_mobile_app',NULL::TEXT,false,false,'processing',81,'STAFF_IN_HAND'),('INIT_KIOSK_PROCESSING','kiosk',NULL::TEXT,false,false,'processing',82,'STAFF_IN_HAND'),
    ('INIT_DEFAULT',NULL::TEXT,NULL::TEXT,NULL::BOOLEAN,NULL::BOOLEAN,'intake',900,'BRANCH_DEFAULT')
  ) AS rule(rule_code,source_code,type_id,retail,quick_drop,status_code,priority,preset);

  UPDATE public.sys_wf_profile_ver_mst SET policy_revision=1,current_artifact_id=NULL,compiled_schema_version=NULL,compiled_checksum=NULL,compiled_at=NULL,compiled_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE version_id=v_version_id;
  SELECT string_agg(DISTINCT issue_code, ', ' ORDER BY issue_code) INTO v_issues FROM public.sys_wf_prof_ver_live_rpt(v_version_id);
  IF v_issues IS NOT NULL THEN RAISE EXCEPTION '0488: standalone WF_V2_HOME_COLLECTION DRAFT failed structural validation: %',v_issues; END IF;
END $$;
COMMIT;
