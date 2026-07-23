-- ==================================================================
-- 0420_nav_settings_workflows_permission.sql
-- Align workflows nav main_permission_code with page access contract
-- ==================================================================

BEGIN;

UPDATE sys_components_cd
SET
  main_permission_code = 'settings:workflow',
  updated_at = NOW()
WHERE comp_code = 'settings_workflows';

COMMIT;
