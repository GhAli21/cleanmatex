-- ==================================================================
-- 0445_sys_wf_profile_presets_seed.sql
-- Purpose: Seed additional HQ V2 operating profiles for common tenant
--          types/levels (Simple, Assembly+QA, Pickup/Delivery,
--          Outsourcing-ready, Issue/Reprocess). No auto tenant assign.
-- Author: CleanMateX Development Team
-- Created: 2026-08-14
-- Dependencies: 0444_sys_wf_profiles_and_versions.sql
-- ADR: docs/features/Workflow_Order_Advance/ADR_SYS_WF_PROFILES.md
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Helper pattern per profile:
--   1) upsert profile header
--   2) insert version_no=1 as DRAFT if missing
--   3) insert enabled screens while DRAFT
--   4) publish DRAFT → PUBLISHED
-- WF_V2_STANDARD already seeded in 0444 — skipped here.
-- ------------------------------------------------------------------

-- ===================== WF_V2_SIMPLE =====================
INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status
) VALUES (
  'a1000000-0000-4000-8000-000000000011'::uuid,
  'WF_V2_SIMPLE',
  'Simple V2 workflow',
  'سير عمل بسيط V2',
  'Lean operating profile for small shops: intake/process/ready/delivery without assembly/QA/packing screens.',
  'ملف تشغيلي مبسط للمحلات الصغيرة.',
  true, true, 20, 1
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

INSERT INTO public.sys_wf_profile_ver_mst (
  version_id, profile_id, version_no, version_status,
  name, name2, change_summary,
  based_on_template_id,
  use_preparation_screen, use_assembly_screen, use_qa_screen, use_packing_screen,
  track_individual_piece, orders_split_enabled, allow_back_steps,
  config_json, is_active, rec_status
)
SELECT
  'a1000000-0000-4000-8000-000000000012'::uuid,
  p.profile_id, 1, 'DRAFT',
  'Simple V2 v1', 'بسيط V2 الإصدار 1',
  'Preset seed for lean / starter tenants.',
  t.template_id,
  false, false, false, false,
  false, false, false,
  jsonb_build_object('preset_tier', 'simple', 'intended_plans', jsonb_build_array('FREE_TRIAL', 'STARTER')),
  true, 1
FROM public.sys_wf_profiles_cd p
LEFT JOIN public.sys_workflow_template_cd t ON t.template_code = 'WF_SIMPLE'
WHERE p.profile_code = 'WF_V2_SIMPLE'
ON CONFLICT (profile_id, version_no) DO NOTHING;

INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order)
SELECT v.version_id, s.screen_key, true, s.display_order
FROM public.sys_wf_profile_ver_mst v
JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
CROSS JOIN public.sys_wf_screens_cd s
WHERE p.profile_code = 'WF_V2_SIMPLE' AND v.version_no = 1 AND v.version_status = 'DRAFT'
  AND s.screen_key IN (
    'new_order', 'processing', 'ready_release', 'driver_delivery',
    'order_control', 'public_tracking', 'workboard', 'canceling'
  )
ON CONFLICT (version_id, screen_key) DO NOTHING;

UPDATE public.sys_wf_profile_ver_mst v
SET version_status = 'PUBLISHED',
    published_at = COALESCE(v.published_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM public.sys_wf_profiles_cd p
WHERE p.profile_id = v.profile_id AND p.profile_code = 'WF_V2_SIMPLE'
  AND v.version_no = 1 AND v.version_status = 'DRAFT';

-- ===================== WF_V2_ASSEMBLY_QA =====================
INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status
) VALUES (
  'a1000000-0000-4000-8000-000000000021'::uuid,
  'WF_V2_ASSEMBLY_QA',
  'Assembly + QA V2 workflow',
  'تجميع وفحص جودة V2',
  'Quality-controlled profile: preparation through packing with assembly and QA enabled.',
  'ملف مضبوط الجودة مع التجميع وفحص الجودة.',
  true, true, 30, 1
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

INSERT INTO public.sys_wf_profile_ver_mst (
  version_id, profile_id, version_no, version_status,
  name, name2, change_summary,
  based_on_template_id,
  use_preparation_screen, use_assembly_screen, use_qa_screen, use_packing_screen,
  track_individual_piece, orders_split_enabled, allow_back_steps,
  config_json, is_active, rec_status
)
SELECT
  'a1000000-0000-4000-8000-000000000022'::uuid,
  p.profile_id, 1, 'DRAFT',
  'Assembly+QA V2 v1', 'تجميع/جودة V2 الإصدار 1',
  'Preset seed for QA-heavy / growth tenants.',
  t.template_id,
  true, true, true, true,
  true, false, false,
  jsonb_build_object('preset_tier', 'quality', 'intended_plans', jsonb_build_array('GROWTH', 'PRO', 'ENTERPRISE')),
  true, 1
FROM public.sys_wf_profiles_cd p
LEFT JOIN public.sys_workflow_template_cd t ON t.template_code = 'WF_ASSEMBLY_QA'
WHERE p.profile_code = 'WF_V2_ASSEMBLY_QA'
ON CONFLICT (profile_id, version_no) DO NOTHING;

INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order)
SELECT v.version_id, s.screen_key, true, s.display_order
FROM public.sys_wf_profile_ver_mst v
JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
CROSS JOIN public.sys_wf_screens_cd s
WHERE p.profile_code = 'WF_V2_ASSEMBLY_QA' AND v.version_no = 1 AND v.version_status = 'DRAFT'
  AND s.screen_key IN (
    'new_order', 'preparation', 'processing', 'assembly', 'qa', 'packing',
    'ready_release', 'driver_delivery', 'order_control', 'public_tracking',
    'canceling', 'returning', 'workboard'
  )
ON CONFLICT (version_id, screen_key) DO NOTHING;

UPDATE public.sys_wf_profile_ver_mst v
SET version_status = 'PUBLISHED',
    published_at = COALESCE(v.published_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM public.sys_wf_profiles_cd p
WHERE p.profile_id = v.profile_id AND p.profile_code = 'WF_V2_ASSEMBLY_QA'
  AND v.version_no = 1 AND v.version_status = 'DRAFT';

-- ===================== WF_V2_PICKUP_DELIVERY =====================
INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status
) VALUES (
  'a1000000-0000-4000-8000-000000000031'::uuid,
  'WF_V2_PICKUP_DELIVERY',
  'Pickup & Delivery V2 workflow',
  'استلام وتوصيل V2',
  'Delivery-oriented profile: prep/process/pack/ready with driver delivery and public tracking emphasized.',
  'ملف موجّه للتوصيل مع شاشة السائق والتتبع العام.',
  true, true, 40, 1
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

INSERT INTO public.sys_wf_profile_ver_mst (
  version_id, profile_id, version_no, version_status,
  name, name2, change_summary,
  based_on_template_id,
  use_preparation_screen, use_assembly_screen, use_qa_screen, use_packing_screen,
  track_individual_piece, orders_split_enabled, allow_back_steps,
  config_json, is_active, rec_status
)
SELECT
  'a1000000-0000-4000-8000-000000000032'::uuid,
  p.profile_id, 1, 'DRAFT',
  'Pickup/Delivery V2 v1', 'استلام/توصيل V2 الإصدار 1',
  'Preset seed for delivery-heavy tenants.',
  t.template_id,
  true, false, false, true,
  false, false, false,
  jsonb_build_object('preset_tier', 'pickup_delivery', 'intended_plans', jsonb_build_array('GROWTH', 'PRO', 'ENTERPRISE')),
  true, 1
FROM public.sys_wf_profiles_cd p
LEFT JOIN public.sys_workflow_template_cd t ON t.template_code = 'WF_PICKUP_DELIVERY'
WHERE p.profile_code = 'WF_V2_PICKUP_DELIVERY'
ON CONFLICT (profile_id, version_no) DO NOTHING;

INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order)
SELECT v.version_id, s.screen_key, true, s.display_order
FROM public.sys_wf_profile_ver_mst v
JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
CROSS JOIN public.sys_wf_screens_cd s
WHERE p.profile_code = 'WF_V2_PICKUP_DELIVERY' AND v.version_no = 1 AND v.version_status = 'DRAFT'
  AND s.screen_key IN (
    'new_order', 'preparation', 'processing', 'packing',
    'ready_release', 'driver_delivery', 'order_control', 'public_tracking',
    'canceling', 'workboard'
  )
ON CONFLICT (version_id, screen_key) DO NOTHING;

UPDATE public.sys_wf_profile_ver_mst v
SET version_status = 'PUBLISHED',
    published_at = COALESCE(v.published_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM public.sys_wf_profiles_cd p
WHERE p.profile_id = v.profile_id AND p.profile_code = 'WF_V2_PICKUP_DELIVERY'
  AND v.version_no = 1 AND v.version_status = 'DRAFT';

-- ===================== WF_V2_OUTSOURCE =====================
-- Outsourcing jobs are V1.2; this profile marks operating intent via config_json
-- and enables the full floor so HQ can assign early without a private graph.
INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status
) VALUES (
  'a1000000-0000-4000-8000-000000000041'::uuid,
  'WF_V2_OUTSOURCE',
  'Outsourcing-ready V2 workflow',
  'جاهز للتعهيد V2',
  'Full floor profile with outsourcing intent flag for Pro/Enterprise. Custody/jobs module remains V1.2.',
  'ملف أرضية كاملة مع تهيئة التعهيد (وحدة التعهيد لاحقاً V1.2).',
  true, true, 50, 1
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

INSERT INTO public.sys_wf_profile_ver_mst (
  version_id, profile_id, version_no, version_status,
  name, name2, change_summary,
  based_on_template_id,
  use_preparation_screen, use_assembly_screen, use_qa_screen, use_packing_screen,
  track_individual_piece, orders_split_enabled, allow_back_steps,
  config_json, is_active, rec_status
)
SELECT
  'a1000000-0000-4000-8000-000000000042'::uuid,
  p.profile_id, 1, 'DRAFT',
  'Outsource-ready V2 v1', 'تعهيد V2 الإصدار 1',
  'Preset seed: outsourcing_enabled intent; graph still global sys_wf_*.',
  t.template_id,
  true, true, true, true,
  true, true, false,
  jsonb_build_object(
    'preset_tier', 'outsourcing',
    'outsourcing_enabled', true,
    'intended_plans', jsonb_build_array('PRO', 'ENTERPRISE')
  ),
  true, 1
FROM public.sys_wf_profiles_cd p
LEFT JOIN public.sys_workflow_template_cd t ON t.template_code = 'WF_STANDARD'
WHERE p.profile_code = 'WF_V2_OUTSOURCE'
ON CONFLICT (profile_id, version_no) DO NOTHING;

INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order)
SELECT v.version_id, s.screen_key, true, s.display_order
FROM public.sys_wf_profile_ver_mst v
JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
CROSS JOIN public.sys_wf_screens_cd s
WHERE p.profile_code = 'WF_V2_OUTSOURCE' AND v.version_no = 1 AND v.version_status = 'DRAFT'
  AND s.screen_key IN (
    'new_order', 'preparation', 'processing', 'assembly', 'qa', 'packing',
    'ready_release', 'driver_delivery', 'order_control', 'public_tracking',
    'canceling', 'returning', 'workboard'
  )
ON CONFLICT (version_id, screen_key) DO NOTHING;

UPDATE public.sys_wf_profile_ver_mst v
SET version_status = 'PUBLISHED',
    published_at = COALESCE(v.published_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM public.sys_wf_profiles_cd p
WHERE p.profile_id = v.profile_id AND p.profile_code = 'WF_V2_OUTSOURCE'
  AND v.version_no = 1 AND v.version_status = 'DRAFT';

-- ===================== WF_V2_ISSUE_REPROCESS =====================
INSERT INTO public.sys_wf_profiles_cd (
  profile_id, profile_code, name, name2, description, description2,
  is_system, is_active, display_order, rec_status
) VALUES (
  'a1000000-0000-4000-8000-000000000051'::uuid,
  'WF_V2_ISSUE_REPROCESS',
  'Issue / Reprocess V2 workflow',
  'مشاكل وإعادة معالجة V2',
  'Exception-oriented profile with back-steps allowed; emphasizes order control, cancel, and return screens.',
  'ملف للاستثناءات مع السماح بالرجوع وتركيز شاشات التحكم والإلغاء والإرجاع.',
  true, true, 60, 1
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

INSERT INTO public.sys_wf_profile_ver_mst (
  version_id, profile_id, version_no, version_status,
  name, name2, change_summary,
  based_on_template_id,
  use_preparation_screen, use_assembly_screen, use_qa_screen, use_packing_screen,
  track_individual_piece, orders_split_enabled, allow_back_steps,
  config_json, is_active, rec_status
)
SELECT
  'a1000000-0000-4000-8000-000000000052'::uuid,
  p.profile_id, 1, 'DRAFT',
  'Issue/Reprocess V2 v1', 'مشاكل/إعادة V2 الإصدار 1',
  'Preset seed mapped from WF_ISSUE_REPROCESS template lineage.',
  t.template_id,
  true, false, true, false,
  false, false, true,
  jsonb_build_object('preset_tier', 'issue_reprocess', 'intended_plans', jsonb_build_array('PRO', 'ENTERPRISE')),
  true, 1
FROM public.sys_wf_profiles_cd p
LEFT JOIN public.sys_workflow_template_cd t ON t.template_code = 'WF_ISSUE_REPROCESS'
WHERE p.profile_code = 'WF_V2_ISSUE_REPROCESS'
ON CONFLICT (profile_id, version_no) DO NOTHING;

INSERT INTO public.sys_wf_prof_ver_scr_dtl (version_id, screen_key, is_enabled, display_order)
SELECT v.version_id, s.screen_key, true, s.display_order
FROM public.sys_wf_profile_ver_mst v
JOIN public.sys_wf_profiles_cd p ON p.profile_id = v.profile_id
CROSS JOIN public.sys_wf_screens_cd s
WHERE p.profile_code = 'WF_V2_ISSUE_REPROCESS' AND v.version_no = 1 AND v.version_status = 'DRAFT'
  AND s.screen_key IN (
    'new_order', 'preparation', 'processing', 'qa', 'ready_release',
    'order_control', 'canceling', 'returning', 'public_tracking', 'workboard'
  )
ON CONFLICT (version_id, screen_key) DO NOTHING;

UPDATE public.sys_wf_profile_ver_mst v
SET version_status = 'PUBLISHED',
    published_at = COALESCE(v.published_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM public.sys_wf_profiles_cd p
WHERE p.profile_id = v.profile_id AND p.profile_code = 'WF_V2_ISSUE_REPROCESS'
  AND v.version_no = 1 AND v.version_status = 'DRAFT';

COMMIT;
