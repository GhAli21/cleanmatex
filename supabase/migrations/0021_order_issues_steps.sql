-- ==================================================================
-- 0021_order_issues_steps.sql
-- Purpose: Order item issues and processing steps tracking for PRD-010
-- Author: CleanMateX Development Team
-- Created: 2025-11-05
-- Dependencies: 0001_core_schema.sql, 0020_orders_workflow_extensions.sql
-- ==================================================================
-- This migration creates:
-- - org_order_item_issues: Issue tracking per item
-- - org_order_item_processing_steps: 5-step processing tracking
-- - Composite FKs with tenant_org_id for multi-tenant isolation
-- - RLS policies for tenant isolation
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE 1: org_order_item_issues
-- Purpose: Track issues (damage, stains, complaints) per order item
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_item_issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  order_id          UUID NOT NULL,
  order_item_id     UUID NOT NULL,
  issue_code        TEXT NOT NULL,
  issue_text        TEXT NOT NULL,
  photo_url         TEXT,
  priority          TEXT DEFAULT 'normal',
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  solved_at         TIMESTAMPTZ,
  solved_by         UUID,
  solved_notes      TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE org_order_item_issues IS 'Track issues (damage, stains, complaints) for individual order items';
COMMENT ON COLUMN org_order_item_issues.issue_code IS 'Issue code: damage, stain, complaint, other';
COMMENT ON COLUMN org_order_item_issues.issue_text IS 'Description of the issue';
COMMENT ON COLUMN org_order_item_issues.photo_url IS 'URL to photo evidence (stored in MinIO/S3)';
COMMENT ON COLUMN org_order_item_issues.priority IS 'Priority: low, normal, high, urgent';
COMMENT ON COLUMN org_order_item_issues.created_by IS 'User who created/identified the issue';
COMMENT ON COLUMN org_order_item_issues.solved_at IS 'Timestamp when issue was resolved';
COMMENT ON COLUMN org_order_item_issues.solved_by IS 'User who resolved the issue';
COMMENT ON COLUMN org_order_item_issues.solved_notes IS 'Notes about resolution';

-- ==================================================================
-- TABLE 2: org_order_item_processing_steps
-- Purpose: Track 5-step processing per order item
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_item_processing_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  order_id          UUID NOT NULL,
  order_item_id     UUID NOT NULL,
  step_code         TEXT NOT NULL,
  step_seq          INTEGER NOT NULL,
  done_by           UUID,
  done_at           TIMESTAMPTZ DEFAULT now(),
  notes             TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE org_order_item_processing_steps IS 'Track 5-step processing workflow per item';
COMMENT ON COLUMN org_order_item_processing_steps.step_code IS 'Step code: sorting, pretreatment, washing, drying, finishing';
COMMENT ON COLUMN org_order_item_processing_steps.step_seq IS 'Sequence number (1-5)';
COMMENT ON COLUMN org_order_item_processing_steps.done_by IS 'User who completed this step';
COMMENT ON COLUMN org_order_item_processing_steps.done_at IS 'Timestamp when step was completed';
COMMENT ON COLUMN org_order_item_processing_steps.notes IS 'Optional notes for this step';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Issue FK to order
ALTER TABLE org_order_item_issues
  ADD CONSTRAINT fk_issue_order
  FOREIGN KEY (order_id)
  REFERENCES org_orders_mst(id) ON DELETE CASCADE;

-- Issue FK to order item
ALTER TABLE org_order_item_issues
  ADD CONSTRAINT fk_issue_order_item
  FOREIGN KEY (order_item_id)
  REFERENCES org_order_items_dtl(id) ON DELETE CASCADE;

-- Issue FK to tenant
ALTER TABLE org_order_item_issues
  ADD CONSTRAINT fk_issue_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- Issue FKs to users
ALTER TABLE org_order_item_issues
  ADD CONSTRAINT fk_issue_created_by
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE org_order_item_issues
  ADD CONSTRAINT fk_issue_solved_by
  FOREIGN KEY (solved_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- Processing step FK to order
ALTER TABLE org_order_item_processing_steps
  ADD CONSTRAINT fk_step_order
  FOREIGN KEY (order_id)
  REFERENCES org_orders_mst(id) ON DELETE CASCADE;

-- Processing step FK to order item
ALTER TABLE org_order_item_processing_steps
  ADD CONSTRAINT fk_step_order_item
  FOREIGN KEY (order_item_id)
  REFERENCES org_order_items_dtl(id) ON DELETE CASCADE;

-- Processing step FK to tenant
ALTER TABLE org_order_item_processing_steps
  ADD CONSTRAINT fk_step_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- Processing step FK to user
ALTER TABLE org_order_item_processing_steps
  ADD CONSTRAINT fk_step_done_by
  FOREIGN KEY (done_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- ==================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================

-- Issue queries by order
CREATE INDEX IF NOT EXISTS idx_issue_order ON org_order_item_issues(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_order_item ON org_order_item_issues(order_item_id, created_at DESC);

-- Issue queries by tenant
CREATE INDEX IF NOT EXISTS idx_issue_tenant ON org_order_item_issues(tenant_org_id, created_at DESC);

-- Unresolved issues
CREATE INDEX IF NOT EXISTS idx_issue_unresolved ON org_order_item_issues(tenant_org_id, solved_at)
  WHERE solved_at IS NULL;

-- Issue queries by priority
CREATE INDEX IF NOT EXISTS idx_issue_priority ON org_order_item_issues(tenant_org_id, priority, created_at DESC)
  WHERE solved_at IS NULL;

-- Processing step queries by order
CREATE INDEX IF NOT EXISTS idx_step_order ON org_order_item_processing_steps(order_id, done_at DESC);
CREATE INDEX IF NOT EXISTS idx_step_order_item ON org_order_item_processing_steps(order_item_id, done_at DESC);

-- Processing step queries by tenant
CREATE INDEX IF NOT EXISTS idx_step_tenant ON org_order_item_processing_steps(tenant_org_id, done_at DESC);

-- Processing step queries by step_code
CREATE INDEX IF NOT EXISTS idx_step_code ON org_order_item_processing_steps(tenant_org_id, step_code, done_at DESC);

-- Composite index for workflow tracking: item + step sequence
CREATE INDEX IF NOT EXISTS idx_step_item_sequence ON org_order_item_processing_steps(order_item_id, step_seq);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

ALTER TABLE org_order_item_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_item_processing_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for issue isolation
CREATE POLICY tenant_isolation_issues ON org_order_item_issues
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_issues ON org_order_item_issues
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for processing step isolation
CREATE POLICY tenant_isolation_steps ON org_order_item_processing_steps
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_steps ON org_order_item_processing_steps
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- CONSTRAINTS
-- ==================================================================

-- Validate step_code enum
ALTER TABLE org_order_item_processing_steps
  ADD CONSTRAINT chk_step_code
  CHECK (step_code IN ('sorting', 'pretreatment', 'washing', 'drying', 'finishing'));

-- Validate step_seq range
ALTER TABLE org_order_item_processing_steps
  ADD CONSTRAINT chk_step_seq
  CHECK (step_seq >= 1 AND step_seq <= 5);

-- Validate priority enum
ALTER TABLE org_order_item_issues
  ADD CONSTRAINT chk_issue_priority
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Validate issue_code enum
ALTER TABLE org_order_item_issues
  ADD CONSTRAINT chk_issue_code
  CHECK (issue_code IN ('damage', 'stain', 'complaint', 'other'));

-- ==================================================================
-- HELPER FUNCTIONS
-- ==================================================================

-- Function to check if all steps are completed for an item
CREATE OR REPLACE FUNCTION is_item_all_steps_done(p_order_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_expected_steps INTEGER := 5;
  v_completed_steps INTEGER;
BEGIN
  SELECT COUNT(DISTINCT step_code) INTO v_completed_steps
  FROM org_order_item_processing_steps
  WHERE order_item_id = p_order_item_id;

  RETURN v_completed_steps >= v_expected_steps;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_item_all_steps_done IS 'Check if all 5 processing steps are completed for an order item';

-- Function to check if item has unresolved issues
CREATE OR REPLACE FUNCTION has_unresolved_issues(p_order_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_order_item_issues
    WHERE order_item_id = p_order_item_id
    AND solved_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION has_unresolved_issues IS 'Check if an order item has unresolved issues';

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_issue_table_exists BOOLEAN;
  v_step_table_exists BOOLEAN;
  v_index_count INTEGER;
BEGIN
  -- Check tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'org_order_item_issues'
  ) INTO v_issue_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'org_order_item_processing_steps'
  ) INTO v_step_table_exists;

  IF NOT v_issue_table_exists THEN
    RAISE EXCEPTION 'org_order_item_issues table not created';
  END IF;

  IF NOT v_step_table_exists THEN
    RAISE EXCEPTION 'org_order_item_processing_steps table not created';
  END IF;

  -- Check indexes exist
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_issue%' OR indexname LIKE 'idx_%_step%';

  IF v_index_count < 10 THEN
    RAISE WARNING 'Expected at least 10 indexes, found %. Some performance indexes may be missing.', v_index_count;
  END IF;

  RAISE NOTICE '✓ Migration 0021 validation passed successfully';
  RAISE NOTICE '  - org_order_item_issues table created';
  RAISE NOTICE '  - org_order_item_processing_steps table created';
  RAISE NOTICE '  - % indexes created', v_index_count;
  RAISE NOTICE '  - Helper functions created';
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Create comprehensive order history table (0022)
-- 2. Implement transition function (0023)

-- TESTING:
-- 1. INSERT test issue: INSERT INTO org_order_item_issues (tenant_org_id, order_id, order_item_id, issue_code, issue_text) VALUES (...);
-- 2. INSERT test step: INSERT INTO org_order_item_processing_steps (tenant_org_id, order_id, order_item_id, step_code, step_seq, done_by) VALUES (...);
-- 3. Test helper functions: SELECT is_item_all_steps_done('item-id'), has_unresolved_issues('item-id');
-- 4. Test RLS: Try querying as different tenants

-- USAGE:
-- When QA rejects an item:
-- 1. Create issue record
-- 2. Set item_is_rejected = true on org_order_items_dtl
-- 3. Update order: has_issue = true, is_rejected = true (if first rejection)
-- 4. Transition order back to processing stage
--
-- When recording processing step:
-- 1. INSERT into org_order_item_processing_steps
-- 2. UPDATE org_order_items_dtl.item_last_step, item_last_step_at, item_last_step_by
-- 3. Check if all steps done: is_item_all_steps_done()
-- 4. If all done, mark item as ready and check if order can transition

