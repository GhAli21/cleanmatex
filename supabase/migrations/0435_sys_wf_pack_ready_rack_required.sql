-- ==================================================================
-- 0435_sys_wf_pack_ready_rack_required.sql
-- Purpose: Require rack_location before packing → ready (parity with
--          skip-to-ready edges and RELEASE_* gates).
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0427, 0434
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

UPDATE public.sys_wf_transitions_cd
SET
  gate_set_code = 'rack_required',
  updated_at = CURRENT_TIMESTAMP
WHERE transition_code = 'TR_PACK_READY'
  AND (
    gate_set_code IS NULL
    OR btrim(gate_set_code) = ''
    OR position('rack_required' in gate_set_code) = 0
  );

COMMIT;
