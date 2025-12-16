-- ==================================================================
-- 0016_workflow_engine_enhancements.sql
-- Purpose: Align workflow engine schema with PRD-010 guardrails
-- - Enforce composite FK to tenant-enabled service categories
-- - Add compound index for common history queries
-- Author: CleanMateX Development Team
-- Created: 2025-10-31
-- Dependencies: 0013_workflow_status_system.sql, 0001_core_schema.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- FK: org_workflow_settings_cf (tenant_org_id, service_category_code)
-- → org_service_category_cf(tenant_org_id, service_category_code)
-- Note: Allows NULL service_category_code for default workflow.
-- ==================================================================

-- Pre-FK data hygiene: remove invalid codes and backfill missing org_service_category_cf rows
-- 1) Delete category-specific workflow settings that reference non-existent system categories
DELETE FROM org_workflow_settings_cf w
USING (
  SELECT w2.tenant_org_id, w2.service_category_code
  FROM org_workflow_settings_cf w2
  LEFT JOIN sys_service_category_cd s
    ON s.service_category_code = w2.service_category_code
  WHERE w2.service_category_code IS NOT NULL
    AND s.service_category_code IS NULL
) d
WHERE w.tenant_org_id = d.tenant_org_id
  AND w.service_category_code = d.service_category_code;

-- 2) Ensure org_service_category_cf has rows for all referenced valid category codes
INSERT INTO org_service_category_cf (tenant_org_id, service_category_code)
SELECT DISTINCT w.tenant_org_id, w.service_category_code
FROM org_workflow_settings_cf w
JOIN sys_service_category_cd s
  ON s.service_category_code = w.service_category_code
WHERE w.service_category_code IS NOT NULL
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'fk_workflow_settings_category'
      AND tc.table_name = 'org_workflow_settings_cf'
  ) THEN
    ALTER TABLE org_workflow_settings_cf
      ADD CONSTRAINT fk_workflow_settings_category
      FOREIGN KEY (tenant_org_id, service_category_code)
      REFERENCES org_service_category_cf(tenant_org_id, service_category_code)
      ON DELETE CASCADE;
  END IF;
END$$;

-- ==================================================================
-- INDEX: History frequent access pattern by tenant + order + time
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_status_history_tenant_order
  ON org_order_status_history(tenant_org_id, order_id, changed_at DESC);

COMMIT;

-- Migration complete: Workflow engine enhancements


