-- ==================================================================
-- 0041_sys_core_data_infrastructure.sql
-- Purpose: Create core data management infrastructure tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates the foundational infrastructure for managing
-- all system code tables and master data. It provides:
-- 1. Registry table - metadata about all code tables
-- 2. Audit log table - complete change history for code tables
-- 3. Helper functions for code table management
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_code_tables_registry
-- Purpose: Metadata registry for all system code tables
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_code_tables_registry (
  table_name VARCHAR(100) PRIMARY KEY,

  -- Description
  display_name VARCHAR(250) NOT NULL,
  display_name2 VARCHAR(250),                    -- Arabic
  description TEXT,
  description2 TEXT,                             -- Arabic

  -- Configuration
  is_editable BOOLEAN DEFAULT true,              -- Can admins edit values?
  is_extensible BOOLEAN DEFAULT false,           -- Can admins add new values?
  supports_tenant_override BOOLEAN DEFAULT false,

  -- Validation
  code_pattern VARCHAR(100),                     -- Regex for code validation
  max_code_length INTEGER DEFAULT 50,
  requires_unique_name BOOLEAN DEFAULT true,

  -- Display
  category VARCHAR(50),                          -- Group related tables
  display_order INTEGER DEFAULT 0,

  -- Version
  current_version INTEGER DEFAULT 1,
  last_seeded_at TIMESTAMP,

  -- Metadata
  metadata JSONB,
  /*
    Example metadata:
    {
      "icon": "table",
      "color": "#3B82F6",
      "help_text": "Order status codes used throughout the system",
      "documentation_url": "https://docs.cleanmatex.com/...",
      "table_schema": {
        "custom_fields": ["allowed_next_statuses", "default_sla_hours"]
      }
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_code_registry_category
  ON sys_code_tables_registry(category, display_order);

CREATE INDEX IF NOT EXISTS idx_code_registry_editable
  ON sys_code_tables_registry(is_editable, is_extensible);

-- Comments
COMMENT ON TABLE sys_code_tables_registry IS
  'Registry of all system code tables with configuration and metadata';

COMMENT ON COLUMN sys_code_tables_registry.table_name IS
  'Physical table name (e.g., sys_order_status_cd)';

COMMENT ON COLUMN sys_code_tables_registry.is_editable IS
  'Whether platform admins can modify existing values';

COMMENT ON COLUMN sys_code_tables_registry.is_extensible IS
  'Whether platform admins can add new values';

COMMENT ON COLUMN sys_code_tables_registry.supports_tenant_override IS
  'Whether tenants can override values via org_*_cf tables';

-- ==================================================================
-- TABLE: sys_code_table_audit_log
-- Purpose: Complete audit trail for all code table changes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_code_table_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What changed
  table_name VARCHAR(100) NOT NULL,
  record_code VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,                    -- 'INSERT', 'UPDATE', 'DELETE', 'RESTORE'

  -- Before/After
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Who & When
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Context
  change_reason TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Rollback support
  is_rollback BOOLEAN DEFAULT false,
  rollback_of_id UUID REFERENCES sys_code_table_audit_log(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_table
  ON sys_code_table_audit_log(table_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_record
  ON sys_code_table_audit_log(table_name, record_code, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user
  ON sys_code_table_audit_log(changed_by, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON sys_code_table_audit_log(action, changed_at DESC);

-- Comments
COMMENT ON TABLE sys_code_table_audit_log IS
  'Complete audit trail for all changes to system code tables';

COMMENT ON COLUMN sys_code_table_audit_log.old_values IS
  'Complete row values before change (JSON)';

COMMENT ON COLUMN sys_code_table_audit_log.new_values IS
  'Complete row values after change (JSON)';

COMMENT ON COLUMN sys_code_table_audit_log.changed_fields IS
  'Array of field names that were modified';

COMMENT ON COLUMN sys_code_table_audit_log.is_rollback IS
  'True if this change was a rollback of a previous change';

-- ==================================================================
-- FUNCTION: log_code_table_change
-- Purpose: Helper function to log changes to code tables
-- ==================================================================

CREATE OR REPLACE FUNCTION log_code_table_change(
  p_table_name VARCHAR,
  p_record_code VARCHAR,
  p_action VARCHAR,
  p_old_values JSONB,
  p_new_values JSONB,
  p_changed_by UUID,
  p_change_reason TEXT DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_changed_fields TEXT[];
BEGIN
  -- Calculate changed fields for UPDATE actions
  IF p_action = 'UPDATE' AND p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT ARRAY_AGG(key)
    INTO v_changed_fields
    FROM jsonb_each(p_new_values)
    WHERE p_old_values->>key IS DISTINCT FROM p_new_values->>key;
  END IF;

  -- Insert audit log entry
  INSERT INTO sys_code_table_audit_log (
    table_name,
    record_code,
    action,
    old_values,
    new_values,
    changed_fields,
    changed_by,
    changed_at,
    change_reason,
    ip_address,
    user_agent
  ) VALUES (
    p_table_name,
    p_record_code,
    p_action,
    p_old_values,
    p_new_values,
    v_changed_fields,
    p_changed_by,
    CURRENT_TIMESTAMP,
    p_change_reason,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_code_table_change IS
  'Logs a change to a code table with full audit trail information';

-- ==================================================================
-- FUNCTION: get_code_table_history
-- Purpose: Get change history for a specific code value
-- ==================================================================

CREATE OR REPLACE FUNCTION get_code_table_history(
  p_table_name VARCHAR,
  p_record_code VARCHAR,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  action VARCHAR,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  changed_by UUID,
  changed_at TIMESTAMP,
  change_reason TEXT,
  is_rollback BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.old_values,
    l.new_values,
    l.changed_fields,
    l.changed_by,
    l.changed_at,
    l.change_reason,
    l.is_rollback
  FROM sys_code_table_audit_log l
  WHERE l.table_name = p_table_name
    AND l.record_code = p_record_code
  ORDER BY l.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_code_table_history IS
  'Retrieves change history for a specific code value, ordered by most recent';

-- ==================================================================
-- FUNCTION: check_code_table_references
-- Purpose: Check if a code value is referenced in other tables
-- ==================================================================

CREATE OR REPLACE FUNCTION check_code_table_references(
  p_table_name VARCHAR,
  p_record_code VARCHAR
) RETURNS TABLE (
  referencing_table VARCHAR,
  referencing_column VARCHAR,
  reference_count BIGINT
) AS $$
BEGIN
  -- This is a placeholder that will be extended as we add more tables
  -- For now, it returns an empty result set
  -- TODO: Implement reference checking logic based on table_name

  RETURN QUERY
  SELECT
    ''::VARCHAR as referencing_table,
    ''::VARCHAR as referencing_column,
    0::BIGINT as reference_count
  WHERE false; -- Return empty set for now
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_code_table_references IS
  'Checks if a code value is referenced in other tables (prevents orphaned references)';

-- ==================================================================
-- SEED: Initial registry entries for existing code tables
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  category,
  is_editable,
  is_extensible,
  supports_tenant_override,
  display_order
) VALUES
  -- Order Management
  (
    'sys_order_type_cd',
    'Order Types',
    'أنواع الطلبات',
    'order_management',
    true,
    true,
    false,
    1
  ),
  (
    'sys_service_category_cd',
    'Service Categories',
    'فئات الخدمات',
    'services',
    true,
    true,
    true,  -- Tenants can override pricing, turnaround, etc.
    2
  ),
  -- Payment
  (
    'sys_payment_method_cd',
    'Payment Methods',
    'طرق الدفع',
    'billing',
    true,
    true,
    true,
    3
  ),
  (
    'sys_payment_type_cd',
    'Payment Types',
    'أنواع الدفع',
    'billing',
    false,  -- System-controlled
    false,
    false,
    4
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  category = EXCLUDED.category,
  is_editable = EXCLUDED.is_editable,
  is_extensible = EXCLUDED.is_extensible,
  supports_tenant_override = EXCLUDED.supports_tenant_override,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================
