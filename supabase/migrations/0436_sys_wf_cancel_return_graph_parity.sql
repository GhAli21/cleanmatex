-- ==================================================================
-- 0436_sys_wf_cancel_return_graph_parity.sql
-- Purpose: Align cancel/return engine graph with Enhanced RPC parity:
--          cancel from draft + out_for_delivery; return from closed.
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0427
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('TR_DRAFT_CANCEL', 'draft',             'cancelled', NULL, 'orders:transition',
   'Cancel from draft', 'إلغاء من المسودة'),
  ('TR_OFD_CANCEL',   'out_for_delivery',  'cancelled', NULL, 'orders:transition',
   'Cancel from out for delivery', 'إلغاء من التوصيل'),
  ('TR_CLOSED_RETURN','closed',            'returned',  NULL, 'orders:transition',
   'Return from closed', 'إرجاع من المغلق')
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- Ensure terminal status used by return-from-closed edge exists
INSERT INTO public.sys_wf_statuses_cd (status_code, name, name2, is_terminal, display_order)
VALUES ('closed', 'Closed', 'مغلق', true, 200)
ON CONFLICT (status_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_terminal = EXCLUDED.is_terminal,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- Screen membership (canceling / returning)
INSERT INTO public.sys_wf_screen_status_cd (screen_key, status_code, display_order, is_active)
VALUES
  ('canceling', 'draft',            5,  true),
  ('canceling', 'out_for_delivery', 75, true),
  ('returning', 'closed',           20, true)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- Action ↔ transition maps
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT v.action_code, t.id, v.screen_key
FROM (VALUES
  ('CANCEL_ORDER', 'TR_DRAFT_CANCEL',  'canceling'),
  ('CANCEL_ORDER', 'TR_OFD_CANCEL',    'canceling'),
  ('RETURN_ORDER', 'TR_CLOSED_RETURN', 'returning')
) AS v(action_code, transition_code, screen_key)
JOIN public.sys_wf_transitions_cd t ON t.transition_code = v.transition_code
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE
SET is_active = true;

COMMIT;
