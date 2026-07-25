-- ==================================================================
-- 0436_sys_wf_cancel_hold_stop_adr.sql
-- Purpose: ADR_CANCEL_RETURN_RULES (Accepted 2026-07-25) —
--   * Cancel allowlist: draft + intake + preparing (prep_not_completed gate)
--   * HOLD_ORDER_WORK / RESUME_ORDER_WORK / STOP_ORDER_WORK
--   * Terminal status stopped + hold_from_status on org_orders_mst
--   * Return sub-order deferred to V1.1 (no active return edges here)
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0427
-- DO NOT APPLY automatically — review then run via normal DB process.
-- Replaces unapplied drafts: cancel_return_graph_parity + hold_stop_narrow.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) Order column for resume target
-- ------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS hold_from_status TEXT;

COMMENT ON COLUMN public.org_orders_mst.hold_from_status IS
  'Operational status before HOLD_ORDER_WORK; used by RESUME_ORDER_WORK.';

-- ------------------------------------------------------------------
-- 2) Statuses: stopped (+ closed catalog for future/close flows)
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_statuses_cd (status_code, name, name2, display_order, is_terminal)
VALUES
  ('stopped', 'Stopped', 'متوقف', 140, true),
  ('closed',  'Closed',  'مغلق',  200, true)
ON CONFLICT (status_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_terminal = EXCLUDED.is_terminal,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 3) Screen: order_control
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_screens_cd (screen_key, name, name2, display_order)
VALUES ('order_control', 'Order control', 'تحكم الطلب', 95)
ON CONFLICT (screen_key) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 4) Actions
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_actions_cd (action_code, name, name2, permission_code, display_order)
VALUES
  ('HOLD_ORDER_WORK',   'Hold order work',   'تعليق العمل',       'orders:transition', 145),
  ('RESUME_ORDER_WORK', 'Resume order work', 'استئناف العمل',     'orders:transition', 146),
  ('STOP_ORDER_WORK',   'Stop order work',   'إيقاف نهائي للعمل', 'orders:transition', 147)
ON CONFLICT (action_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  permission_code = EXCLUDED.permission_code,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 5) Narrow cancel graph (draft/intake/preparing only)
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('TR_DRAFT_CANCEL', 'draft', 'cancelled', NULL, 'orders:transition',
   'Cancel from draft', 'إلغاء من المسودة')
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- Preparing cancel only while prep incomplete
UPDATE public.sys_wf_transitions_cd
SET
  gate_set_code = 'prep_not_completed',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP
WHERE transition_code = 'TR_PREP_CANCEL';

UPDATE public.sys_wf_transitions_cd
SET is_active = true, updated_at = CURRENT_TIMESTAMP
WHERE transition_code = 'TR_INTAKE_CANCEL';

-- Deactivate cancel edges outside ADR allowlist
UPDATE public.sys_wf_transitions_cd
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE transition_code IN (
  'TR_PROC_CANCEL',
  'TR_ASM_CANCEL',
  'TR_QA_CANCEL',
  'TR_PACK_CANCEL',
  'TR_READY_CANCEL',
  'TR_HOLD_CANCEL',
  'TR_OFD_CANCEL'
);

-- ------------------------------------------------------------------
-- 6) Hold / resume / stop transitions
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('TR_PREP_HOLD',   'preparing',        'on_hold',    NULL, 'orders:transition', 'Preparing → Hold', 'تحضير → تعليق'),
  ('TR_PROC_HOLD',   'processing',       'on_hold',    NULL, 'orders:transition', 'Processing → Hold', 'معالجة → تعليق'),
  ('TR_ASM_HOLD',    'assembly',         'on_hold',    NULL, 'orders:transition', 'Assembly → Hold', 'تجميع → تعليق'),
  ('TR_QA_HOLD',     'qa',               'on_hold',    NULL, 'orders:transition', 'QA → Hold', 'فحص → تعليق'),
  ('TR_PACK_HOLD',   'packing',          'on_hold',    NULL, 'orders:transition', 'Packing → Hold', 'تغليف → تعليق'),
  ('TR_READY_HOLD',  'ready',            'on_hold',    NULL, 'orders:transition', 'Ready → Hold', 'جاهز → تعليق'),
  ('TR_OFD_HOLD',    'out_for_delivery', 'on_hold',    NULL, 'orders:transition', 'OFD → Hold', 'توصيل → تعليق'),
  -- Resume: engine overrides to_status from hold_from_status
  ('TR_HOLD_RESUME', 'on_hold',          'processing', NULL, 'orders:transition', 'Resume from hold', 'استئناف من التعليق'),
  ('TR_PREP_STOP',   'preparing',        'stopped',    NULL, 'orders:transition', 'Stop from preparing', 'إيقاف من التحضير'),
  ('TR_PROC_STOP',   'processing',       'stopped',    NULL, 'orders:transition', 'Stop from processing', 'إيقاف من المعالجة'),
  ('TR_ASM_STOP',    'assembly',         'stopped',    NULL, 'orders:transition', 'Stop from assembly', 'إيقاف من التجميع'),
  ('TR_QA_STOP',     'qa',               'stopped',    NULL, 'orders:transition', 'Stop from QA', 'إيقاف من الفحص'),
  ('TR_PACK_STOP',   'packing',          'stopped',    NULL, 'orders:transition', 'Stop from packing', 'إيقاف من التغليف'),
  ('TR_READY_STOP',  'ready',            'stopped',    NULL, 'orders:transition', 'Stop from ready', 'إيقاف من الجاهز'),
  ('TR_OFD_STOP',    'out_for_delivery', 'stopped',    NULL, 'orders:transition', 'Stop from OFD', 'إيقاف من التوصيل'),
  ('TR_HOLD_STOP',   'on_hold',          'stopped',    NULL, 'orders:transition', 'Stop from hold', 'إيقاف من التعليق')
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 7) Screen membership
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_screen_status_cd (screen_key, status_code, display_order, is_active)
VALUES
  ('canceling',     'draft',            5,  true),
  ('canceling',     'intake',           10, true),
  ('canceling',     'preparing',        20, true),
  ('order_control', 'preparing',        5,  true),
  ('order_control', 'processing',       10, true),
  ('order_control', 'assembly',         20, true),
  ('order_control', 'qa',               30, true),
  ('order_control', 'packing',          40, true),
  ('order_control', 'ready',            50, true),
  ('order_control', 'out_for_delivery', 60, true),
  ('order_control', 'on_hold',          70, true)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

UPDATE public.sys_wf_screen_status_cd
SET is_active = false
WHERE screen_key = 'canceling'
  AND status_code NOT IN ('draft', 'intake', 'preparing');

-- Return screen inactive for V1.0 (sub-order is V1.1)
UPDATE public.sys_wf_screen_status_cd
SET is_active = false
WHERE screen_key = 'returning';

-- ------------------------------------------------------------------
-- 8) Action ↔ transition maps
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key, is_active)
SELECT 'CANCEL_ORDER', t.id, 'canceling', true
FROM public.sys_wf_transitions_cd t
WHERE t.transition_code IN ('TR_DRAFT_CANCEL', 'TR_INTAKE_CANCEL', 'TR_PREP_CANCEL')
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE
SET is_active = true;

UPDATE public.sys_wf_action_trans_cd at
SET is_active = false
FROM public.sys_wf_transitions_cd t
WHERE at.transition_id = t.id
  AND at.action_code = 'CANCEL_ORDER'
  AND at.screen_key = 'canceling'
  AND t.from_status NOT IN ('draft', 'intake', 'preparing');

-- Deactivate return graph until V1.1 sub-order
UPDATE public.sys_wf_transitions_cd
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE transition_code IN ('TR_DELIV_RETURN', 'TR_CLOSED_RETURN');

UPDATE public.sys_wf_action_trans_cd
SET is_active = false
WHERE action_code = 'RETURN_ORDER';

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key, is_active)
SELECT v.action_code, t.id, 'order_control', true
FROM (VALUES
  ('HOLD_ORDER_WORK',   'TR_PREP_HOLD'),
  ('HOLD_ORDER_WORK',   'TR_PROC_HOLD'),
  ('HOLD_ORDER_WORK',   'TR_ASM_HOLD'),
  ('HOLD_ORDER_WORK',   'TR_QA_HOLD'),
  ('HOLD_ORDER_WORK',   'TR_PACK_HOLD'),
  ('HOLD_ORDER_WORK',   'TR_READY_HOLD'),
  ('HOLD_ORDER_WORK',   'TR_OFD_HOLD'),
  ('RESUME_ORDER_WORK', 'TR_HOLD_RESUME'),
  ('STOP_ORDER_WORK',   'TR_PREP_STOP'),
  ('STOP_ORDER_WORK',   'TR_PROC_STOP'),
  ('STOP_ORDER_WORK',   'TR_ASM_STOP'),
  ('STOP_ORDER_WORK',   'TR_QA_STOP'),
  ('STOP_ORDER_WORK',   'TR_PACK_STOP'),
  ('STOP_ORDER_WORK',   'TR_READY_STOP'),
  ('STOP_ORDER_WORK',   'TR_OFD_STOP'),
  ('STOP_ORDER_WORK',   'TR_HOLD_STOP')
) AS v(action_code, transition_code)
JOIN public.sys_wf_transitions_cd t ON t.transition_code = v.transition_code
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE
SET is_active = true;

COMMIT;
