-- ==================================================================
-- 0431_fix_sys_wf_ready_release_membership.sql
-- Purpose: Fix graph check #2 membership_gap —
--          ready_release:packing→ready (bad MARK_READY ↔ TR_PACK_READY map).
--          packing→ready belongs on packing screen via COMPLETE_PACKING only.
-- Author: CleanMateX Development Team
-- Created: 2026-07-24
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- Deactivate invalid action↔transition on ready_release (from_status packing
-- is not a ready_release screen member).
UPDATE public.sys_wf_action_trans_cd at
SET is_active = false
FROM public.sys_wf_transitions_cd t
WHERE at.transition_id = t.id
  AND at.action_code = 'MARK_READY'
  AND at.screen_key = 'ready_release'
  AND t.transition_code = 'TR_PACK_READY'
  AND COALESCE(at.is_active, true) = true;

-- Ensure packing screen owns packing→ready (idempotent)
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key, is_active)
SELECT 'COMPLETE_PACKING', t.id, 'packing', true
FROM public.sys_wf_transitions_cd t
WHERE t.transition_code = 'TR_PACK_READY'
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE
SET is_active = true;

-- Optional: MARK_READY on packing as alias of complete-pack (same edge) — keep off;
-- floor uses COMPLETE_PACKING only.

COMMIT;
