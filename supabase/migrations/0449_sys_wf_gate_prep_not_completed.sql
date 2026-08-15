-- ==================================================================
-- 0449_sys_wf_gate_prep_not_completed.sql
-- Register prep_not_completed gate used by TR_PREP_CANCEL (0436).
-- HQ Validate Graph requires every gate_set_code token in sys_wf_gate_defs_cd.
-- ==================================================================

INSERT INTO public.sys_wf_gate_defs_cd (gate_code, name, name2, description) VALUES
  (
    'prep_not_completed',
    'Cancel only before prep complete',
    'الإلغاء مسموح فقط قبل إكمال التحضير',
    'Blocks cancel from preparing when preparation_status is already completed; use hold or stop instead.'
  )
ON CONFLICT (gate_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
