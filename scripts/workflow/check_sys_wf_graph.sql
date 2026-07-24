-- ==================================================================
-- check_sys_wf_graph.sql
-- Purpose: Graph integrity checks for Workflow Order Advance seeds (0427).
-- Run after applying 0427 (read-only). Fail CI if any check returns rows.
-- ==================================================================

-- 1) Orphan action_trans (missing action / transition / screen)
SELECT 'orphan_action_trans' AS check_code, at.id::text AS detail
FROM public.sys_wf_action_trans_cd at
LEFT JOIN public.sys_wf_actions_cd a ON a.action_code = at.action_code
LEFT JOIN public.sys_wf_transitions_cd t ON t.id = at.transition_id
LEFT JOIN public.sys_wf_screens_cd s ON s.screen_key = at.screen_key
WHERE a.action_code IS NULL OR t.id IS NULL OR s.screen_key IS NULL;

-- 2) Screen membership missing for transition from_status on that screen
SELECT 'membership_gap' AS check_code,
       at.screen_key || ':' || t.from_status || '→' || t.to_status AS detail
FROM public.sys_wf_action_trans_cd at
JOIN public.sys_wf_transitions_cd t ON t.id = at.transition_id
LEFT JOIN public.sys_wf_screen_status_cd m
  ON m.screen_key = at.screen_key
 AND m.status_code = t.from_status
 AND COALESCE(m.is_active, true) = true
WHERE COALESCE(at.is_active, true) = true
  AND m.screen_key IS NULL;

-- 3) Unknown gate codes referenced in gate_set_code
SELECT 'unknown_gate' AS check_code, t.transition_code || ':' || g.gate AS detail
FROM public.sys_wf_transitions_cd t
CROSS JOIN LATERAL unnest(
  string_to_array(regexp_replace(COALESCE(t.gate_set_code, ''), '\s+', '', 'g'), ',')
) AS g(gate)
LEFT JOIN public.sys_wf_gate_defs_cd d ON d.gate_code = g.gate
WHERE COALESCE(t.gate_set_code, '') <> ''
  AND g.gate <> ''
  AND d.gate_code IS NULL;

-- 4) sorting must never appear in catalogs
SELECT 'forbidden_sorting' AS check_code, status_code AS detail
FROM public.sys_wf_statuses_cd
WHERE lower(status_code) = 'sorting'
UNION ALL
SELECT 'forbidden_sorting', from_status
FROM public.sys_wf_transitions_cd
WHERE lower(from_status) = 'sorting' OR lower(to_status) = 'sorting';

-- 5) Expect at least one COMPLETE_PREPARATION mapping
SELECT 'missing_complete_prep' AS check_code, 'COMPLETE_PREPARATION' AS detail
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sys_wf_action_trans_cd
  WHERE action_code = 'COMPLETE_PREPARATION'
    AND COALESCE(is_active, true) = true
);
