-- ==================================================================
-- 0025_deprecate_old_workflow.sql
-- Purpose: Mark old workflow tables as deprecated (PRD-005 → PRD-010)
-- Created: 2025-11-05
-- Dependencies: All PRD-010 migrations
-- ==================================================================
-- This migration deprecates old workflow system in favor of new PRD-010 system
-- Tables are marked with comments, NOT dropped, to preserve existing data
-- New system uses: sys_workflow_template_*, org_tenant_workflow_*, org_order_history
-- ==================================================================

BEGIN;

-- ==================================================================
-- MARK OLD TABLES AS DEPRECATED
-- ==================================================================

-- Mark org_order_status_history as deprecated
COMMENT ON TABLE org_order_status_history IS 
  'DEPRECATED: Use org_order_history instead. This table is kept for backward compatibility only. '
  'All new status changes should go to org_order_history with action_type = STATUS_CHANGE. '
  'Migration completed in 0022_order_history_canonical.sql';

-- Mark org_workflow_settings_cf as deprecated
COMMENT ON TABLE org_workflow_settings_cf IS 
  'DEPRECATED: Replaced by sys_workflow_template_* system (PRD-010). '
  'New system supports global templates with tenant-level configuration via '
  'org_tenant_workflow_templates_cf and org_tenant_workflow_settings_cf';

-- Mark org_workflow_rules as deprecated if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'org_workflow_rules'
  ) THEN
    EXECUTE 'COMMENT ON TABLE org_workflow_rules IS 
      ''DEPRECATED: Replaced by sys_workflow_template_transitions in PRD-010 system. 
      Use workflow templates for transition rules instead.''';
  END IF;
END $$;

-- ==================================================================
-- CREATE MIGRATION VIEWS FOR BACKWARD COMPATIBILITY (Optional)
-- ==================================================================

-- View to help transition code using old status_history to new history
CREATE OR REPLACE VIEW org_order_status_history_legacy AS
SELECT 
  id,
  order_id,
  tenant_org_id,
  from_status AS from_value,
  to_status AS to_value,
  changed_by AS done_by,
  changed_at AS done_at,
  notes,
  metadata AS payload
FROM org_order_status_history;

COMMENT ON VIEW org_order_status_history_legacy IS 
  'Legacy view for backward compatibility. Maps old org_order_status_history to new structure';

-- ==================================================================
-- ALERT IF OLD TABLES ARE STILL BEING USED
-- ==================================================================

DO $$
DECLARE
  v_recent_status_history INTEGER;
  v_recent_workflow_settings INTEGER;
BEGIN
  -- Check for recent inserts into old tables
  SELECT COUNT(*) INTO v_recent_status_history
  FROM org_order_status_history
  WHERE created_at > NOW() - INTERVAL '7 days';

  SELECT COUNT(*) INTO v_recent_workflow_settings
  FROM org_workflow_settings_cf
  WHERE updated_at > NOW() - INTERVAL '7 days';

  IF v_recent_status_history > 0 THEN
    RAISE WARNING 'Found % recent inserts to deprecated org_order_status_history. Update code to use org_order_history instead.', v_recent_status_history;
  END IF;

  IF v_recent_workflow_settings > 0 THEN
    RAISE WARNING 'Found % recent updates to deprecated org_workflow_settings_cf. Update code to use new template system.', v_recent_workflow_settings;
  END IF;

  RAISE NOTICE 'Migration verification complete. Check warnings above if any.';
END $$;

COMMIT;

-- ==================================================================
-- NOTES
-- ==================================================================
-- Old tables are NOT dropped to preserve data integrity
-- Applications should gradually migrate to new PRD-010 system:
-- 1. New code → Use PRD-010 tables exclusively
-- 2. Old code → Continue working via deprecation comments
-- 3. Migration → 0024_migrate_existing_orders.sql handles data migration
-- 4. Cleanup → Can be dropped in future major version after full migration
-- ==================================================================

