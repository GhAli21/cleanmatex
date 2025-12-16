-- ==================================================================
-- 0013_workflow_status_system.sql
-- Purpose: Workflow status management and audit trail system
-- Author: CleanMateX Development Team
-- Created: 2025-10-30
-- PRD: 005 - Basic Workflow & Status Transitions
-- Dependencies: 0001_core_schema.sql (org_orders_mst, org_tenants_mst)
-- ==================================================================
-- This migration creates:
-- - Order status history (audit trail)
-- - Workflow configuration tables
-- - Quality gate rules
-- - Default workflow seeds for all tenants
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE 1: org_order_status_history
-- Purpose: Complete audit trail of all order status changes
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_status_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL,
  tenant_org_id     UUID NOT NULL,
  from_status       VARCHAR(50),
  to_status         VARCHAR(50) NOT NULL,
  changed_by        UUID,
  changed_by_name   VARCHAR(255),
  changed_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE org_order_status_history IS 'Complete audit trail of order status changes for compliance and tracking';
COMMENT ON COLUMN org_order_status_history.from_status IS 'Previous status (NULL for initial status)';
COMMENT ON COLUMN org_order_status_history.to_status IS 'New status after change';
COMMENT ON COLUMN org_order_status_history.changed_by IS 'User ID who made the change';
COMMENT ON COLUMN org_order_status_history.changed_by_name IS 'User display name at time of change';
COMMENT ON COLUMN org_order_status_history.notes IS 'Optional notes explaining the status change';
COMMENT ON COLUMN org_order_status_history.metadata IS 'Additional context (IP address, user agent, etc.)';

-- ==================================================================
-- TABLE 2: org_workflow_settings_cf
-- Purpose: Configurable workflow definitions per tenant/service category
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_workflow_settings_cf (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id          UUID NOT NULL,
  service_category_code  VARCHAR(120),
  workflow_steps         JSONB NOT NULL DEFAULT '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb,
  status_transitions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_gate_rules     JSONB DEFAULT '{}'::jsonb,
  is_active              BOOLEAN DEFAULT true,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP,
  created_by             UUID,
  updated_by             UUID,
  UNIQUE(tenant_org_id, service_category_code)
);

COMMENT ON TABLE org_workflow_settings_cf IS 'Configurable workflow definitions allowing different workflows per tenant and service category';
COMMENT ON COLUMN org_workflow_settings_cf.service_category_code IS 'NULL for default workflow, specific code for category-specific workflow';
COMMENT ON COLUMN org_workflow_settings_cf.workflow_steps IS 'Array of status steps in order';
COMMENT ON COLUMN org_workflow_settings_cf.status_transitions IS 'Map of allowed transitions: {"INTAKE": ["PREPARATION", "CANCELLED"]}';
COMMENT ON COLUMN org_workflow_settings_cf.quality_gate_rules IS 'Rules that must pass before certain transitions';

-- ==================================================================
-- TABLE 3: org_workflow_rules
-- Purpose: Fine-grained transition rules and validations
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_workflow_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  from_status       VARCHAR(50) NOT NULL,
  to_status         VARCHAR(50) NOT NULL,
  is_allowed        BOOLEAN DEFAULT true,
  requires_role     VARCHAR(50),
  validation_rules  JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP,
  UNIQUE(tenant_org_id, from_status, to_status)
);

COMMENT ON TABLE org_workflow_rules IS 'Fine-grained transition rules for role-based and conditional workflows';
COMMENT ON COLUMN org_workflow_rules.requires_role IS 'Role required to perform this transition (e.g., "manager")';
COMMENT ON COLUMN org_workflow_rules.validation_rules IS 'Custom validation logic for this transition';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Status history references
ALTER TABLE org_order_status_history
  ADD CONSTRAINT fk_status_history_order
  FOREIGN KEY (order_id)
  REFERENCES org_orders_mst(id) ON DELETE CASCADE;

ALTER TABLE org_order_status_history
  ADD CONSTRAINT fk_status_history_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_order_status_history
  ADD CONSTRAINT fk_status_history_user
  FOREIGN KEY (changed_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- Workflow settings references
ALTER TABLE org_workflow_settings_cf
  ADD CONSTRAINT fk_workflow_settings_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- Workflow rules references
ALTER TABLE org_workflow_rules
  ADD CONSTRAINT fk_workflow_rules_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

-- ==================================================================
-- INDEXES (Performance Optimization)
-- ==================================================================

-- Status history indexes
CREATE INDEX IF NOT EXISTS idx_status_history_order
  ON org_order_status_history(order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_tenant
  ON org_order_status_history(tenant_org_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_user
  ON org_order_status_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_status_history_to_status
  ON org_order_status_history(tenant_org_id, to_status, changed_at DESC);

-- Workflow settings indexes
CREATE INDEX IF NOT EXISTS idx_workflow_settings_tenant
  ON org_workflow_settings_cf(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_workflow_settings_category
  ON org_workflow_settings_cf(tenant_org_id, service_category_code);

CREATE INDEX IF NOT EXISTS idx_workflow_settings_active
  ON org_workflow_settings_cf(tenant_org_id, is_active)
  WHERE is_active = true;

-- Workflow rules indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rules_tenant
  ON org_workflow_rules(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_workflow_rules_transition
  ON org_workflow_rules(tenant_org_id, from_status, to_status);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

-- Enable RLS on all new tables
ALTER TABLE org_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_workflow_settings_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_workflow_rules ENABLE ROW LEVEL SECURITY;

-- Status history policies
CREATE POLICY tenant_isolation_status_history ON org_order_status_history
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_status_history ON org_order_status_history
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Workflow settings policies
CREATE POLICY tenant_isolation_workflow_settings ON org_workflow_settings_cf
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_workflow_settings ON org_workflow_settings_cf
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Workflow rules policies
CREATE POLICY tenant_isolation_workflow_rules ON org_workflow_rules
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_workflow_rules ON org_workflow_rules
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- SEED DATA: Default Workflow Configuration
-- ==================================================================

-- Insert default workflow settings for all existing tenants
INSERT INTO org_workflow_settings_cf (
  tenant_org_id,
  service_category_code,
  workflow_steps,
  status_transitions,
  quality_gate_rules
)
SELECT
  t.id as tenant_org_id,
  NULL as service_category_code,
  '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb as workflow_steps,
  '{
    "DRAFT": ["INTAKE", "CANCELLED"],
    "INTAKE": ["PREPARATION", "CANCELLED"],
    "PREPARATION": ["SORTING", "CANCELLED"],
    "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
    "WASHING": ["DRYING", "CANCELLED"],
    "DRYING": ["FINISHING", "CANCELLED"],
    "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
    "ASSEMBLY": ["QA", "CANCELLED"],
    "QA": ["PACKING", "WASHING", "CANCELLED"],
    "PACKING": ["READY", "CANCELLED"],
    "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
    "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
    "DELIVERED": ["CLOSED"],
    "CLOSED": [],
    "CANCELLED": []
  }'::jsonb as status_transitions,
  '{
    "READY": {
      "requireAllItemsAssembled": true,
      "requireQAPassed": true,
      "requireNoUnresolvedIssues": true
    }
  }'::jsonb as quality_gate_rules
FROM org_tenants_mst t
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- Insert service-specific workflow for "PRESSED_IRONED" category
-- (Skips washing and drying steps, starts from FINISHING)
INSERT INTO org_workflow_settings_cf (
  tenant_org_id,
  service_category_code,
  workflow_steps,
  status_transitions,
  quality_gate_rules
)
SELECT
  t.id as tenant_org_id,
  'PRESSED_IRONED' as service_category_code,
  '["DRAFT","INTAKE","FINISHING","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb as workflow_steps,
  '{
    "DRAFT": ["INTAKE", "CANCELLED"],
    "INTAKE": ["FINISHING", "CANCELLED"],
    "FINISHING": ["PACKING", "CANCELLED"],
    "PACKING": ["READY", "CANCELLED"],
    "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
    "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
    "DELIVERED": ["CLOSED"],
    "CLOSED": [],
    "CANCELLED": []
  }'::jsonb as status_transitions,
  '{
    "READY": {
      "requireAllItemsAssembled": false,
      "requireQAPassed": false,
      "requireNoUnresolvedIssues": true
    }
  }'::jsonb as quality_gate_rules
FROM org_tenants_mst t
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- ==================================================================
-- TRIGGER: Auto-create initial status history entry
-- ==================================================================

CREATE OR REPLACE FUNCTION fn_create_initial_status_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Create initial status history entry when order is created
  INSERT INTO org_order_status_history (
    order_id,
    tenant_org_id,
    from_status,
    to_status,
    changed_by,
    changed_by_name,
    notes
  ) VALUES (
    NEW.id,
    NEW.tenant_org_id,
    NULL,
    NEW.status,
    auth.uid(),
    'System',
    'Order created'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_order_initial_status
  AFTER INSERT ON org_orders_mst
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_initial_status_history();

COMMENT ON FUNCTION fn_create_initial_status_history() IS 'Auto-creates initial status history entry when order is created';

COMMIT;

-- Migration complete: Workflow status system created
