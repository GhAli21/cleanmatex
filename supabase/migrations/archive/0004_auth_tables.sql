-- 0004_auth_tables.sql — Authentication & User Management Tables
-- Purpose: Create tables for linking Supabase auth.users to tenants with roles and audit logging
-- Author: CleanMateX Development Team
-- Created: 2025-10-17

BEGIN;

-- =========================
-- USER-TENANT ASSOCIATION
-- =========================

-- Links Supabase auth.users to org_tenants_mst with role assignment
CREATE TABLE IF NOT EXISTS org_users_mst (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- User details
  display_name      VARCHAR(255),
  role              VARCHAR(50) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,

  -- Activity tracking
  last_login_at     TIMESTAMP,
  login_count       INTEGER DEFAULT 0,

  -- Preferences (JSON)
  preferences       JSONB DEFAULT '{}'::jsonb,

  -- Audit fields
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by        VARCHAR(120),
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        VARCHAR(120),
  updated_info      TEXT,
  rec_status        SMALLINT DEFAULT 1,
  rec_notes         VARCHAR(200),

  -- Composite uniqueness: one user can have only one role per tenant
  UNIQUE(user_id, tenant_org_id)
);

-- Indexes for performance
CREATE INDEX idx_org_users_tenant ON org_users_mst(tenant_org_id) WHERE is_active = true;
CREATE INDEX idx_org_users_user ON org_users_mst(user_id);
CREATE INDEX idx_org_users_role ON org_users_mst(tenant_org_id, role) WHERE is_active = true;
CREATE INDEX idx_org_users_last_login ON org_users_mst(last_login_at DESC);

-- Comments for documentation
COMMENT ON TABLE org_users_mst IS 'Links Supabase auth users to tenants with role-based access control';
COMMENT ON COLUMN org_users_mst.user_id IS 'Reference to auth.users (Supabase managed)';
COMMENT ON COLUMN org_users_mst.tenant_org_id IS 'Reference to tenant organization';
COMMENT ON COLUMN org_users_mst.role IS 'User role within tenant: admin, operator, viewer';
COMMENT ON COLUMN org_users_mst.preferences IS 'User preferences (theme, locale, notifications, etc.)';

-- =========================
-- AUDIT LOG (GLOBAL)
-- =========================

-- Comprehensive audit trail for all authentication and authorization actions
CREATE TABLE IF NOT EXISTS sys_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who & Where
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_org_id     UUID REFERENCES org_tenants_mst(id) ON DELETE SET NULL,

  -- What happened
  action            VARCHAR(100) NOT NULL, -- 'login', 'logout', 'role_change', 'user_created', etc.
  entity_type       VARCHAR(100), -- 'user', 'tenant', 'order', etc.
  entity_id         UUID, -- ID of affected entity

  -- Data changes (for update/delete operations)
  old_values        JSONB, -- Previous values (for updates)
  new_values        JSONB, -- New values (for creates/updates)

  -- Request metadata
  ip_address        INET, -- Client IP address
  user_agent        TEXT, -- Browser/client information
  request_id        VARCHAR(120), -- Correlation ID for tracing

  -- Status
  status            VARCHAR(20) DEFAULT 'success', -- 'success', 'failure', 'error'
  error_message     TEXT, -- Error details if status = 'failure' or 'error'

  -- Timestamp
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit queries
CREATE INDEX idx_audit_user ON sys_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_tenant ON sys_audit_log(tenant_org_id, created_at DESC);
CREATE INDEX idx_audit_action ON sys_audit_log(action, created_at DESC);
CREATE INDEX idx_audit_entity ON sys_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON sys_audit_log(created_at DESC);
CREATE INDEX idx_audit_status ON sys_audit_log(status) WHERE status != 'success';

-- Comments
COMMENT ON TABLE sys_audit_log IS 'Comprehensive audit trail for all system actions';
COMMENT ON COLUMN sys_audit_log.action IS 'Action performed (login, logout, create, update, delete, etc.)';
COMMENT ON COLUMN sys_audit_log.old_values IS 'Previous values before change (JSON)';
COMMENT ON COLUMN sys_audit_log.new_values IS 'New values after change (JSON)';
COMMENT ON COLUMN sys_audit_log.request_id IS 'Correlation ID for distributed tracing';

-- =========================
-- HELPER FUNCTION: LOG AUDIT EVENT
-- =========================

-- Function to simplify audit logging from triggers or application code
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_tenant_org_id UUID,
  p_action VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO sys_audit_log (
    user_id,
    tenant_org_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    request_id,
    status,
    error_message
  ) VALUES (
    p_user_id,
    p_tenant_org_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent,
    p_request_id,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_event IS 'Helper function to log audit events consistently';

-- =========================
-- TRIGGER: AUTO-UPDATE LAST LOGIN
-- =========================

-- Automatically update last_login_at when user logs in
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger will be called from application code via function call
  -- when user successfully authenticates
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Actual login tracking will be done via application code calling:
-- UPDATE org_users_mst SET last_login_at = NOW(), login_count = login_count + 1
-- WHERE user_id = auth.uid() AND tenant_org_id = <tenant_id>

-- =========================
-- VALIDATION
-- =========================

-- Verify tables were created
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'org_users_mst') = 1,
    'org_users_mst table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'sys_audit_log') = 1,
    'sys_audit_log table not created';

  RAISE NOTICE '✅ Auth tables created successfully';
END $$;

COMMIT;

-- Rollback instructions (save to 0004_auth_tables_rollback.sql if needed):
-- BEGIN;
-- DROP TABLE IF EXISTS org_users_mst CASCADE;
-- DROP TABLE IF EXISTS sys_audit_log CASCADE;
-- DROP FUNCTION IF EXISTS log_audit_event CASCADE;
-- DROP FUNCTION IF EXISTS update_user_last_login CASCADE;
-- COMMIT;
