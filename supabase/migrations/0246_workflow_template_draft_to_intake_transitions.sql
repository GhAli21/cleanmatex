-- ==================================================================
-- 0246_workflow_template_draft_to_intake_transitions.sql
-- Purpose: Allow remote-booking confirm (draft → intake) in template
--          transition graph; cmx_order_transition gates on
--          sys_workflow_template_transitions, not org_workflow_settings_cf.
-- Depends: 0018_workflow_templates.sql, 0023_workflow_transition_function.sql
-- ==================================================================

BEGIN;

-- Manual draft → intake for templates that include an intake stage so
-- confirm-physical-intake (WorkflowService.changeStatus) passes validation.
INSERT INTO sys_workflow_template_transitions (
  template_id,
  from_stage_code,
  to_stage_code,
  requires_scan_ok,
  requires_invoice,
  requires_pod,
  allow_manual,
  auto_when_done,
  is_active
)
SELECT
  t.template_id,
  'draft',
  'intake',
  false,
  false,
  false,
  true,
  false,
  true
FROM sys_workflow_template_cd t
WHERE t.is_active = true
  AND t.template_code IN (
    'WF_SIMPLE',
    'WF_STANDARD',
    'WF_ASSEMBLY_QA',
    'WF_PICKUP_DELIVERY',
    'WF_ISSUE_REPROCESS'
  )
ON CONFLICT (template_id, from_stage_code, to_stage_code) DO NOTHING;

COMMIT;
