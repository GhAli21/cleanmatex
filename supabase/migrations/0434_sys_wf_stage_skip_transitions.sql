-- ==================================================================
-- 0434_sys_wf_stage_skip_transitions.sql
-- Purpose: Template-aware leave edges so COMPLETE_* / PASS_QA can skip
--          disabled stages (assembly/qa/packing) — matches floor UI flags.
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0427, 0431
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('TR_PROC_QA',      'processing', 'qa',      'prep_stage_complete', 'orders:transition', 'Processing → QA (skip assembly)', 'معالجة → فحص (تخطي التجميع)'),
  ('TR_PROC_PACK',    'processing', 'packing', 'prep_stage_complete', 'orders:transition', 'Processing → Packing', 'معالجة → تغليف'),
  ('TR_PROC_READY',   'processing', 'ready',   'prep_stage_complete,rack_required', 'orders:transition', 'Processing → Ready', 'معالجة → جاهز'),
  ('TR_ASM_PACK',     'assembly',   'packing', NULL, 'orders:transition', 'Assembly → Packing (skip QA)', 'تجميع → تغليف'),
  ('TR_ASM_READY',    'assembly',   'ready',   'rack_required', 'orders:transition', 'Assembly → Ready', 'تجميع → جاهز'),
  ('TR_QA_READY',     'qa',         'ready',   'rack_required', 'orders:transition', 'QA → Ready (skip packing)', 'فحص → جاهز')
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- Map leave actions to skip edges (same action_code; engine uses preferredToStatus)
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT v.action_code, t.id, v.screen_key
FROM (VALUES
  ('COMPLETE_PROCESSING', 'TR_PROC_QA',    'processing'),
  ('COMPLETE_PROCESSING', 'TR_PROC_PACK',  'processing'),
  ('COMPLETE_PROCESSING', 'TR_PROC_READY', 'processing'),
  ('COMPLETE_ASSEMBLY',   'TR_ASM_PACK',   'assembly'),
  ('COMPLETE_ASSEMBLY',   'TR_ASM_READY',  'assembly'),
  ('PASS_QA',             'TR_QA_READY',   'qa')
) AS v(action_code, transition_code, screen_key)
JOIN public.sys_wf_transitions_cd t ON t.transition_code = v.transition_code
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE
SET is_active = true;

COMMIT;
