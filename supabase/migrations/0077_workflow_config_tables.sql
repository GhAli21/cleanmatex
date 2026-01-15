-- ==================================================================
-- 0077_workflow_config_tables.sql
-- Purpose: Configuration tables for Orders workflow system
-- Author: CleanMateX Development Team
-- Created: 2026-01-14
-- Dependencies: 0075_screen_contract_functions_simplified.sql
-- ==================================================================
-- This migration creates configuration tables following naming conventions:
-- - sys_ord_*_cf: System-level configuration tables (can have tenant overrides)
-- - org_ord_*: Tenant-specific data tables
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: org_ord_screen_contracts_cf
-- Purpose: Screen contracts configuration (system defaults + tenant overrides)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_ord_screen_contracts_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID, -- NULL for system default, UUID for tenant override
  screen_key TEXT NOT NULL,
  pre_conditions JSONB NOT NULL,
  required_permissions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(tenant_org_id, screen_key)
);

COMMENT ON TABLE org_ord_screen_contracts_cf IS 'Screen contracts configuration. NULL tenant_org_id = system default, UUID = tenant override';
COMMENT ON COLUMN org_ord_screen_contracts_cf.screen_key IS 'Screen identifier (preparation, processing, assembly, qa, packing, ready_release, driver_delivery, new_order, workboard)';
COMMENT ON COLUMN org_ord_screen_contracts_cf.pre_conditions IS 'JSONB with statuses array and additional filters';
COMMENT ON COLUMN org_ord_screen_contracts_cf.required_permissions IS 'JSONB array of required permission keys';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_ord_screen_contracts_tenant ON org_ord_screen_contracts_cf(tenant_org_id, screen_key);
CREATE INDEX IF NOT EXISTS idx_org_ord_screen_contracts_active ON org_ord_screen_contracts_cf(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_ord_screen_contracts_screen ON org_ord_screen_contracts_cf(screen_key) WHERE tenant_org_id IS NULL;

-- RLS Policies
ALTER TABLE org_ord_screen_contracts_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_org_ord_screen_contracts_select ON org_ord_screen_contracts_cf
  FOR SELECT
  USING (
    tenant_org_id IS NULL OR 
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY rls_org_ord_screen_contracts_insert ON org_ord_screen_contracts_cf
  FOR INSERT
  WITH CHECK (
    tenant_org_id IS NULL OR
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY rls_org_ord_screen_contracts_update ON org_ord_screen_contracts_cf
  FOR UPDATE
  USING (
    tenant_org_id IS NULL OR
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY rls_org_ord_screen_contracts_delete ON org_ord_screen_contracts_cf
  FOR DELETE
  USING (
    tenant_org_id IS NULL OR
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ==================================================================
-- TABLE: sys_ord_custom_validations_cf
-- Purpose: Custom validation functions configuration
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_ord_custom_validations_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID, -- NULL for system default, UUID for tenant override
  screen_key TEXT NOT NULL,
  validation_key TEXT NOT NULL,
  validation_function TEXT, -- Function name to call
  validation_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(tenant_org_id, screen_key, validation_key)
);

COMMENT ON TABLE org_ord_custom_validations_cf IS 'Custom validation functions configuration';
COMMENT ON COLUMN org_ord_custom_validations_cf.validation_function IS 'Database function name to call for validation';
COMMENT ON COLUMN org_ord_custom_validations_cf.validation_config IS 'JSONB configuration for validation function';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_ord_custom_validations_tenant ON org_ord_custom_validations_cf(tenant_org_id, screen_key);
CREATE INDEX IF NOT EXISTS idx_org_ord_custom_validations_active ON org_ord_custom_validations_cf(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE org_ord_custom_validations_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_org_ord_custom_validations_select ON org_ord_custom_validations_cf
  FOR SELECT
  USING (
    tenant_org_id IS NULL OR 
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ==================================================================
-- TABLE: org_ord_transition_events
-- Purpose: Transition events log (tenant-specific data, NOT config)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_ord_transition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  screen TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  event_type TEXT NOT NULL, -- TRANSITION_STARTED, TRANSITION_COMPLETED, TRANSITION_FAILED, WEBHOOK_SENT
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE org_ord_transition_events IS 'Transition events log for audit and webhook triggers (tenant-specific data)';
COMMENT ON COLUMN org_ord_transition_events.event_type IS 'Event type: TRANSITION_STARTED, TRANSITION_COMPLETED, TRANSITION_FAILED, WEBHOOK_SENT';

-- Foreign Keys
ALTER TABLE org_ord_transition_events
  ADD CONSTRAINT fk_transition_events_order
  FOREIGN KEY (order_id, tenant_org_id)
  REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_ord_transition_events_order ON org_ord_transition_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_ord_transition_events_tenant ON org_ord_transition_events(tenant_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_ord_transition_events_type ON org_ord_transition_events(event_type, created_at DESC);

-- RLS Policies
ALTER TABLE org_ord_transition_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_org_ord_transition_events_select ON org_ord_transition_events
  FOR SELECT
  USING (
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ==================================================================
-- TABLE: sys_ord_webhook_subscriptions_cf
-- Purpose: Webhook subscriptions configuration
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_ord_webhook_subscriptions_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID, -- NULL for system default, UUID for tenant override
  screen_key TEXT,
  event_type TEXT NOT NULL, -- TRANSITION_COMPLETED, TRANSITION_FAILED, etc.
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

COMMENT ON TABLE org_ord_webhook_subscriptions_cf IS 'Webhook subscriptions configuration. NULL screen_key = all screens';
COMMENT ON COLUMN org_ord_webhook_subscriptions_cf.event_type IS 'Event type to subscribe to (TRANSITION_COMPLETED, TRANSITION_FAILED, etc.)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_ord_webhook_subscriptions_tenant ON org_ord_webhook_subscriptions_cf(tenant_org_id, screen_key);
CREATE INDEX IF NOT EXISTS idx_org_ord_webhook_subscriptions_active ON org_ord_webhook_subscriptions_cf(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE org_ord_webhook_subscriptions_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_org_ord_webhook_subscriptions_select ON org_ord_webhook_subscriptions_cf
  FOR SELECT
  USING (
    tenant_org_id IS NULL OR 
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ==================================================================
-- TABLE: sys_ord_workflow_template_versions
-- Purpose: Workflow template versioning/history
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_ord_workflow_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES sys_workflow_template_cd(template_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  template_snapshot JSONB NOT NULL,
  change_description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version_number)
);

COMMENT ON TABLE sys_ord_workflow_template_versions IS 'Workflow template versioning for audit and rollback';
COMMENT ON COLUMN sys_ord_workflow_template_versions.template_snapshot IS 'JSONB snapshot of template configuration at this version';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sys_ord_workflow_template_versions_template ON sys_ord_workflow_template_versions(template_id, version_number DESC);

-- RLS Policies
ALTER TABLE sys_ord_workflow_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_sys_ord_workflow_template_versions_select ON sys_ord_workflow_template_versions
  FOR SELECT
  USING (true); -- Read-only for all authenticated users

COMMIT;

