-- =====================================================
-- Migration: HQ Platform Management Tables
-- Purpose: Create tables for Platform HQ Console
-- PRD: PRD-SAAS-MNG-0011 (Standalone Module Architecture)
-- Date: 2025-11-15
-- =====================================================

-- =====================================================
-- 1. HQ Roles Table
-- =====================================================

CREATE TABLE IF NOT EXISTS hq_roles (
    role_code VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(250) NOT NULL,
    role_name_ar VARCHAR(250),
    role_description TEXT,
    role_description_ar TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system_role BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_hq_roles_active ON hq_roles(is_active);

-- Add comment
COMMENT ON TABLE hq_roles IS 'Platform HQ Console - Role definitions with permissions';
COMMENT ON COLUMN hq_roles.permissions IS 'JSONB array of permission strings, e.g., ["tenants.*", "plans.view"]';
COMMENT ON COLUMN hq_roles.is_system_role IS 'System roles cannot be deleted or modified';

-- =====================================================
-- 2. HQ Users Table
-- =====================================================

CREATE TABLE IF NOT EXISTS hq_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    full_name_ar VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role_code VARCHAR(50) NOT NULL REFERENCES hq_roles(role_code) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    password_changed_at TIMESTAMPTZ DEFAULT now(),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    CONSTRAINT hq_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hq_users_email ON hq_users(email);
CREATE INDEX IF NOT EXISTS idx_hq_users_role ON hq_users(role_code);
CREATE INDEX IF NOT EXISTS idx_hq_users_active ON hq_users(is_active);
CREATE INDEX IF NOT EXISTS idx_hq_users_last_login ON hq_users(last_login_at DESC);

-- Add comments
COMMENT ON TABLE hq_users IS 'Platform HQ Console - Admin users with separate authentication from tenant users';
COMMENT ON COLUMN hq_users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN hq_users.mfa_secret IS 'TOTP secret for 2FA (encrypted)';
COMMENT ON COLUMN hq_users.failed_login_attempts IS 'Counter for failed login attempts, reset on successful login';
COMMENT ON COLUMN hq_users.locked_until IS 'Account locked until this timestamp after multiple failed logins';

-- =====================================================
-- 3. HQ Audit Logs Table
-- =====================================================

CREATE TABLE IF NOT EXISTS hq_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES hq_users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Partitioning ready: include created_at in indexes
    CONSTRAINT hq_audit_logs_action_not_empty CHECK (action != '')
);

-- Indexes for performance (optimized for querying)
CREATE INDEX IF NOT EXISTS idx_hq_audit_user ON hq_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hq_audit_action ON hq_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hq_audit_resource ON hq_audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hq_audit_created ON hq_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hq_audit_user_email ON hq_audit_logs(user_email) WHERE user_email IS NOT NULL;

-- Add comments
COMMENT ON TABLE hq_audit_logs IS 'Platform HQ Console - Immutable audit trail of all administrative actions';
COMMENT ON COLUMN hq_audit_logs.user_email IS 'Denormalized email for audit trail even if user is deleted';
COMMENT ON COLUMN hq_audit_logs.details IS 'JSONB with before/after values, request data, etc.';
COMMENT ON COLUMN hq_audit_logs.success IS 'Whether the action completed successfully';

-- =====================================================
-- 4. HQ Session Tokens Table (Optional - for token management)
-- =====================================================

CREATE TABLE IF NOT EXISTS hq_session_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES hq_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT hq_session_tokens_expires_future CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hq_session_user ON hq_session_tokens(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_hq_session_token ON hq_session_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_hq_session_expires ON hq_session_tokens(expires_at);

-- Add comments
COMMENT ON TABLE hq_session_tokens IS 'Platform HQ Console - JWT session management and refresh tokens';
COMMENT ON COLUMN hq_session_tokens.token_hash IS 'SHA256 hash of the JWT token for revocation';

-- =====================================================
-- 5. Seed Default Roles
-- =====================================================

INSERT INTO hq_roles (role_code, role_name, role_name_ar, role_description, permissions, is_system_role, is_active) VALUES
(
    'SUPER_ADMIN',
    'Super Administrator',
    'مدير النظام الرئيسي',
    'Full system access - all permissions across all modules',
    '["*"]'::jsonb,
    true,
    true
),
(
    'TECH_ADMIN',
    'Technical Administrator',
    'المسؤول التقني',
    'Technical operations - workflows, catalogs, system codes, infrastructure',
    '["tenants.view", "tenants.edit", "workflows.*", "catalog.*", "codes.*", "system.*"]'::jsonb,
    true,
    true
),
(
    'BUSINESS_ADMIN',
    'Business Administrator',
    'مسؤول الأعمال',
    'Business operations - plans, subscriptions, billing, analytics',
    '["tenants.view", "plans.*", "subscriptions.*", "billing.*", "analytics.*", "reports.*"]'::jsonb,
    true,
    true
),
(
    'SUPPORT',
    'Support Agent',
    'وكيل الدعم',
    'Customer support - view tenants, customers, tickets, impersonation',
    '["tenants.view", "customers.view", "customers.edit", "tickets.*", "impersonate.*"]'::jsonb,
    true,
    true
),
(
    'ANALYST',
    'Business Analyst',
    'محلل أعمال',
    'Analytics and reporting - read-only access to analytics and reports',
    '["analytics.*", "reports.*", "tenants.view", "plans.view", "subscriptions.view"]'::jsonb,
    true,
    true
),
(
    'VIEWER',
    'Read-Only Viewer',
    'مشاهد فقط',
    'Read-only access to all modules for monitoring and auditing',
    '["*.view"]'::jsonb,
    false,
    true
)
ON CONFLICT (role_code) DO NOTHING;

-- =====================================================
-- 6. Update Timestamp Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for hq_roles
DROP TRIGGER IF EXISTS update_hq_roles_updated_at ON hq_roles;
CREATE TRIGGER update_hq_roles_updated_at
    BEFORE UPDATE ON hq_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for hq_users
DROP TRIGGER IF EXISTS update_hq_users_updated_at ON hq_users;
CREATE TRIGGER update_hq_users_updated_at
    BEFORE UPDATE ON hq_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. Row-Level Security (RLS)
-- =====================================================

-- Enable RLS on tables (even though SERVICE_ROLE_KEY bypasses it)
-- This is for defense-in-depth in case anon key is used accidentally
ALTER TABLE hq_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_session_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_roles;
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_users;
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_audit_logs;
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_session_tokens;

-- Create restrictive policies (deny all access via anon key)
-- These tables should ONLY be accessed via SERVICE_ROLE_KEY from platform-api
CREATE POLICY "HQ tables are only accessible via service role"
    ON hq_roles
    FOR ALL
    TO authenticated, anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "HQ tables are only accessible via service role"
    ON hq_users
    FOR ALL
    TO authenticated, anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "HQ tables are only accessible via service role"
    ON hq_audit_logs
    FOR ALL
    TO authenticated, anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "HQ tables are only accessible via service role"
    ON hq_session_tokens
    FOR ALL
    TO authenticated, anon
    USING (false)
    WITH CHECK (false);

-- =====================================================
-- 8. Grant Permissions
-- =====================================================

-- Grant access to authenticated role (for service role key)
GRANT ALL ON hq_roles TO authenticated;
GRANT ALL ON hq_users TO authenticated;
GRANT ALL ON hq_audit_logs TO authenticated;
GRANT ALL ON hq_session_tokens TO authenticated;

-- Grant access to service_role
GRANT ALL ON hq_roles TO service_role;
GRANT ALL ON hq_users TO service_role;
GRANT ALL ON hq_audit_logs TO service_role;
GRANT ALL ON hq_session_tokens TO service_role;

-- =====================================================
-- 9. Helper Functions (Optional)
-- =====================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION hq_user_has_permission(
    p_user_id UUID,
    p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_permissions JSONB;
    v_permission_item TEXT;
BEGIN
    -- Get user's role permissions
    SELECT r.permissions INTO v_permissions
    FROM hq_users u
    JOIN hq_roles r ON u.role_code = r.role_code
    WHERE u.id = p_user_id AND u.is_active = true AND r.is_active = true;

    IF v_permissions IS NULL THEN
        RETURN false;
    END IF;

    -- Check for wildcard (super admin)
    IF v_permissions ? '*' THEN
        RETURN true;
    END IF;

    -- Check for exact permission
    IF v_permissions ? p_permission THEN
        RETURN true;
    END IF;

    -- Check for wildcard permissions (e.g., "tenants.*" matches "tenants.view")
    FOR v_permission_item IN SELECT jsonb_array_elements_text(v_permissions)
    LOOP
        IF v_permission_item LIKE '%.*' THEN
            IF p_permission LIKE REPLACE(v_permission_item, '.*', '.%') THEN
                RETURN true;
            END IF;
        END IF;
    END LOOP;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION hq_user_has_permission IS 'Check if HQ user has a specific permission based on their role';

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verify tables were created
DO $$
BEGIN
    RAISE NOTICE 'HQ Platform tables migration completed successfully';
    RAISE NOTICE 'Created tables: hq_roles, hq_users, hq_audit_logs, hq_session_tokens';
    RAISE NOTICE 'Seeded % default roles', (SELECT COUNT(*) FROM hq_roles);
    RAISE NOTICE 'RLS policies applied - tables only accessible via SERVICE_ROLE_KEY';
END $$;
