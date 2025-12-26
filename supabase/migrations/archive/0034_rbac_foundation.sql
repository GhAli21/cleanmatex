-- 0034_rbac_foundation.sql — RBAC Foundation Tables
-- Purpose: Create comprehensive RBAC system with scoped permissions, effective permissions caching, and multi-role support
-- Author: CleanMateX Development Team
-- Created: 2025-01-XX
-- Based on: Auth_RBAC_Scoped_Permissions_v1.0.md

BEGIN;

-- =========================
-- MASTER LAYER (Platform-wide)
-- =========================

-- Permissions table: Defines all available permissions
CREATE TABLE IF NOT EXISTS sys_auth_permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,              -- 'orders.read', 'orders.create', 'workflow.transition', etc.
  name TEXT,                              -- Human-readable name (bilingual: name/name2 pattern can be added)
  name2 TEXT,                             -- Arabic name
  category TEXT,                          -- 'crud', 'actions', 'export', 'management', 'workflow'
  description TEXT,                       -- Description of what this permission allows
  description2 TEXT,
  category_main TEXT,                   -- (Orders, Customers, Inventory, Users, Settings, Reports, Billing, Workflow, Branches, Stores, POS, Routes, Devices)
  for_feature_only SMALLINT DEFAULT 0,    -- 0=no, 1=yes, 2=not always
  for_screen_only SMALLINT DEFAULT 0,     -- 0=no, 1=yes, 2=not always
  feature_code TEXT,
  screen_code TEXT,
  is_internal_use_only NOT NULL DEFAULT false, -- for use by the developers not for public users 
  is_enabled BOOLEAN NOT NULL DEFAULT true, -- to be signed to other users 
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status     SMALLINT DEFAULT 1,
  rec_notes      TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMP,
  updated_by     TEXT,
  updated_info   TEXT,
  
  
  -- Ensure code follows resource:action format (colon separator)
  CONSTRAINT check_permission_code_format CHECK (code ~ '^[a-z_]+:([a-z_]+|\*)$|^\*:\*$')
);

COMMENT ON TABLE sys_auth_permissions IS 'Platform-wide permission definitions';
COMMENT ON COLUMN sys_auth_permissions.code IS 'Permission code in format resource:action (e.g., orders:read, orders:create)';
COMMENT ON COLUMN sys_auth_permissions.category IS 'Permission category for grouping (crud, actions, export, management, workflow)';

-- Roles table: Defines all available roles (system and custom)
CREATE TABLE IF NOT EXISTS sys_auth_roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,              -- 'super_admin', 'tenant_admin', 'operator', 'viewer', etc.
  name TEXT NOT NULL,                     -- Human-readable name
  name2 TEXT,                              -- Arabic name
  description TEXT,                       -- Description of role purpose
  is_system BOOLEAN NOT NULL DEFAULT false, -- true for built-in roles, false for custom roles
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  
  -- System roles must have specific codes
  --CONSTRAINT check_system_role_code CHECK (
    --NOT is_system OR code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'viewer')
  --)
);

COMMENT ON TABLE sys_auth_roles IS 'Role definitions (system and custom)';
COMMENT ON COLUMN sys_auth_roles.is_system IS 'true for built-in system roles, false for tenant-created custom roles';
COMMENT ON COLUMN sys_auth_roles.code IS 'Role code identifier (e.g., tenant_admin, operator, viewer)';

-- Role-Permission mapping: Default permissions for each role
CREATE TABLE IF NOT EXISTS sys_auth_role_default_permissions (
  role_id UUID NOT NULL REFERENCES sys_auth_roles(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES sys_auth_permissions(permission_id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES sys_auth_roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES sys_auth_permissions(code) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true, -- to be signed to other users 
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status     SMALLINT DEFAULT 1,
  rec_notes      TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMP,
  updated_by     TEXT,
  updated_info   TEXT,
  
  PRIMARY KEY (role_id, permission_id)
);
--ALTER TABLE sys_auth_roles ADD CONSTRAINT ak_sys_auth_roles_code UNIQUE (code);
--ALTER TABLE sys_auth_permissions ADD CONSTRAINT ak_sys_auth_permissions_code UNIQUE (code);

--ALTER TABLE sys_auth_role_default_permissions ADD CONSTRAINT fk_role_default_permissions_role_code FOREIGN KEY (role_code) REFERENCES sys_auth_roles (code);
--ALTER TABLE sys_auth_role_default_permissions ADD CONSTRAINT fk_role_default_permissions_perm_code FOREIGN KEY (permission_code) REFERENCES sys_auth_permissions (code);

COMMENT ON TABLE sys_auth_role_default_permissions IS 'Maps default permissions to roles';

-- Indexes for master layer
CREATE INDEX IF NOT EXISTS idx_sys_auth_permissions_code ON sys_auth_permissions(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sys_auth_permissions_category ON sys_auth_permissions(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sys_auth_roles_code ON sys_auth_roles(code);
CREATE INDEX IF NOT EXISTS idx_sys_auth_roles_system ON sys_auth_roles(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_sys_auth_role_perms_role ON sys_auth_role_default_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_sys_auth_role_perms_perm ON sys_auth_role_default_permissions(permission_id);

-- =========================
-- TENANT-LEVEL ASSIGNMENT
-- =========================

-- User role assignments: Multi-role support per user per tenant
CREATE TABLE IF NOT EXISTS org_auth_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES sys_auth_roles(role_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  
  -- One user can have multiple roles per tenant (multi-role support)
  UNIQUE (user_id, tenant_org_id, role_id)
);

COMMENT ON TABLE org_auth_user_roles IS 'User role assignments at tenant level (supports multiple roles per user)';
COMMENT ON COLUMN org_auth_user_roles.role_id IS 'Reference to sys_auth_roles - user can have multiple roles';

-- Indexes for tenant-level assignment
CREATE INDEX IF NOT EXISTS idx_org_auth_user_roles_user ON org_auth_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_roles_tenant ON org_auth_user_roles(tenant_org_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_auth_user_roles_role ON org_auth_user_roles(role_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_auth_user_roles_user_tenant ON org_auth_user_roles(user_id, tenant_org_id) WHERE is_active = true;

-- =========================
-- RESOURCE-BASED ASSIGNMENT (Branch, Store, POS, Route, Device)
-- =========================

-- User resource roles: Roles assigned on specific resources
CREATE TABLE IF NOT EXISTS org_auth_user_resource_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('branch', 'store', 'pos', 'route', 'device')),
  resource_id UUID NOT NULL,              -- PK from the resource table (org_branches_mst, etc.)
  role_id UUID NOT NULL REFERENCES sys_auth_roles(role_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  
  -- One user can have one role per resource
  UNIQUE (user_id, tenant_org_id, resource_type, resource_id, role_id)
);

COMMENT ON TABLE org_auth_user_resource_roles IS 'User role assignments on specific resources (branch/store/POS/route/device)';
COMMENT ON COLUMN org_auth_user_resource_roles.resource_type IS 'Type of resource: branch, store, pos, route, device';
COMMENT ON COLUMN org_auth_user_resource_roles.resource_id IS 'UUID of the resource (e.g., branch_id from org_branches_mst)';

-- Indexes for resource-based assignment
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_roles_user ON org_auth_user_resource_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_roles_tenant ON org_auth_user_resource_roles(tenant_org_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_roles_resource ON org_auth_user_resource_roles(resource_type, resource_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_roles_user_tenant ON org_auth_user_resource_roles(user_id, tenant_org_id) WHERE is_active = true;

-- =========================
-- PER-USER PERMISSION OVERRIDES
-- =========================

-- Global user permission overrides (tenant-wide)
CREATE TABLE IF NOT EXISTS org_auth_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES sys_auth_permissions(permission_id) ON DELETE CASCADE,
  allow BOOLEAN NOT NULL DEFAULT true,    -- true = allow, false = explicit deny
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  
  -- One override per user per permission per tenant
  UNIQUE (user_id, tenant_org_id, permission_id)
);

COMMENT ON TABLE org_auth_user_permissions IS 'Global user permission overrides (tenant-wide, overrides role defaults)';
COMMENT ON COLUMN org_auth_user_permissions.allow IS 'true = allow override, false = explicit deny override';

-- Resource-scoped user permission overrides
CREATE TABLE IF NOT EXISTS org_auth_user_resource_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('branch', 'store', 'pos', 'route', 'device')),
  resource_id UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES sys_auth_permissions(permission_id) ON DELETE CASCADE,
  allow BOOLEAN NOT NULL DEFAULT true,    -- true = allow, false = explicit deny
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  
  -- One override per user per permission per resource
  UNIQUE (user_id, tenant_org_id, resource_type, resource_id, permission_id)
);

COMMENT ON TABLE org_auth_user_resource_permissions IS 'Resource-scoped user permission overrides (most specific, wins)';
COMMENT ON COLUMN org_auth_user_resource_permissions.allow IS 'true = allow override, false = explicit deny override';

-- Indexes for permission overrides
CREATE INDEX IF NOT EXISTS idx_org_auth_user_perms_user ON org_auth_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_perms_tenant ON org_auth_user_permissions(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_perms_perm ON org_auth_user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_perms_user ON org_auth_user_resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_perms_tenant ON org_auth_user_resource_permissions(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_resource_perms_resource ON org_auth_user_resource_permissions(resource_type, resource_id);

-- =========================
-- WORKFLOW ROLES (Multi-Role Support)
-- =========================

-- User workflow role assignments: Separate from user roles, supports multiple workflow roles
CREATE TABLE IF NOT EXISTS org_auth_user_workflow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  workflow_role TEXT NOT NULL CHECK (workflow_role IN (
    'ROLE_RECEPTION',
    'ROLE_PREPARATION',
    'ROLE_PROCESSING',
    'ROLE_QA',
    'ROLE_DELIVERY',
    'ROLE_ADMIN'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  
  -- One user can have multiple workflow roles per tenant (multi-workflow-role support)
  UNIQUE (user_id, tenant_org_id, workflow_role)
);

COMMENT ON TABLE org_auth_user_workflow_roles IS 'Workflow role assignments (separate from user roles, supports multiple workflow roles)';
COMMENT ON COLUMN org_auth_user_workflow_roles.workflow_role IS 'Workflow role code (ROLE_RECEPTION, ROLE_PREPARATION, etc.)';

-- Indexes for workflow roles
CREATE INDEX IF NOT EXISTS idx_org_auth_user_workflow_roles_user ON org_auth_user_workflow_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_org_auth_user_workflow_roles_tenant ON org_auth_user_workflow_roles(tenant_org_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_auth_user_workflow_roles_role ON org_auth_user_workflow_roles(workflow_role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_auth_user_workflow_roles_user_tenant ON org_auth_user_workflow_roles(user_id, tenant_org_id) WHERE is_active = true;

-- =========================
-- EFFECTIVE PERMISSIONS TABLE (Precomputed for Performance)
-- =========================

-- Effective permissions: Precomputed permissions for O(1) RLS checks
-- This table is rebuilt on changes, not queried with joins
CREATE TABLE IF NOT EXISTS cmx_effective_permissions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL,          -- Permission code (e.g., 'orders.read')
  resource_type TEXT,                     -- NULL = tenant-wide, or 'branch', 'store', 'pos', 'route', 'device'
  resource_id UUID,                       -- NULL = tenant-wide, or UUID of resource
  allow BOOLEAN NOT NULL DEFAULT true,    -- Final computed result (true = allowed, false = denied)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index to handle NULLs in composite key
-- This ensures uniqueness while allowing NULL values for tenant-wide permissions
-- Note: We use an index (not a constraint) because we need COALESCE expressions
CREATE UNIQUE INDEX IF NOT EXISTS idx_cmx_effective_perms_unique 
ON cmx_effective_permissions (
  user_id,
  tenant_org_id,
  permission_code,
  COALESCE(resource_type, ''),
  COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::UUID)
);

COMMENT ON TABLE cmx_effective_permissions IS 'Precomputed effective permissions for fast RLS checks (O(1) lookup)';
COMMENT ON COLUMN cmx_effective_permissions.permission_code IS 'Permission code from sys_auth_permissions.code';
COMMENT ON COLUMN cmx_effective_permissions.resource_type IS 'NULL for tenant-wide permissions, or resource type for scoped permissions';
COMMENT ON COLUMN cmx_effective_permissions.resource_id IS 'NULL for tenant-wide permissions, or UUID of resource';
COMMENT ON COLUMN cmx_effective_permissions.allow IS 'Final computed permission result (true = allowed, false = denied)';

-- Critical indexes for fast permission checks
CREATE INDEX IF NOT EXISTS idx_cmx_effective_perms_user_tenant_perm ON cmx_effective_permissions(user_id, tenant_org_id, permission_code);
CREATE INDEX IF NOT EXISTS idx_cmx_effective_perms_tenant_perm ON cmx_effective_permissions(tenant_org_id, permission_code);
CREATE INDEX IF NOT EXISTS idx_cmx_effective_perms_resource ON cmx_effective_permissions(resource_type, resource_id) WHERE resource_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cmx_effective_perms_user_tenant ON cmx_effective_permissions(user_id, tenant_org_id);

-- =========================
-- VALIDATION
-- =========================

DO $$
BEGIN
  -- Verify all tables were created
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'sys_auth_permissions') = 1,
    'sys_auth_permissions table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'sys_auth_roles') = 1,
    'sys_auth_roles table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'sys_auth_role_default_permissions') = 1,
    'sys_auth_role_default_permissions table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'org_auth_user_roles') = 1,
    'org_auth_user_roles table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'org_auth_user_resource_roles') = 1,
    'org_auth_user_resource_roles table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'org_auth_user_permissions') = 1,
    'org_auth_user_permissions table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'org_auth_user_resource_permissions') = 1,
    'org_auth_user_resource_permissions table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'org_auth_user_workflow_roles') = 1,
    'org_auth_user_workflow_roles table not created';
  ASSERT (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'cmx_effective_permissions') = 1,
    'cmx_effective_permissions table not created';

  RAISE NOTICE '✅ RBAC foundation tables created successfully';
END $$;

COMMIT;

-- Rollback instructions (save to 0034_rbac_foundation_rollback.sql if needed):
-- BEGIN;
-- DROP TABLE IF EXISTS cmx_effective_permissions CASCADE;
-- DROP TABLE IF EXISTS org_auth_user_workflow_roles CASCADE;
-- DROP TABLE IF EXISTS org_auth_user_resource_permissions CASCADE;
-- DROP TABLE IF EXISTS org_auth_user_permissions CASCADE;
-- DROP TABLE IF EXISTS org_auth_user_resource_roles CASCADE;
-- DROP TABLE IF EXISTS org_auth_user_roles CASCADE;
-- DROP TABLE IF EXISTS sys_auth_role_default_permissions CASCADE;
-- DROP TABLE IF EXISTS sys_auth_roles CASCADE;
-- DROP TABLE IF EXISTS sys_auth_permissions CASCADE;
-- COMMIT;

