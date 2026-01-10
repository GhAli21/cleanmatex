-- Migration: 0072_sys_stng_audit_triggers.sql
-- Description: Create Audit Triggers for Settings Changes
-- Date: 2026-01-08
-- Feature: SAAS Platform Settings Management
-- Dependencies: 0068, 0069, 0070, 0071

-- =====================================================
-- PART 1: Audit Trigger Function for org_tenant_settings_cf
-- =====================================================

-- Function: Audit changes to tenant settings overrides
-- Logs INSERT, UPDATE, DELETE operations to org_stng_audit_log_tr
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action TEXT;
  v_scope TEXT;
  v_changed_by UUID;
  v_changed_by_name VARCHAR(120);
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
  END IF;

  -- Determine scope based on branch_id and user_id
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL THEN
      v_scope := 'USER';
    ELSIF OLD.branch_id IS NOT NULL THEN
      v_scope := 'BRANCH';
    ELSE
      v_scope := 'TENANT';
    END IF;
  ELSE
    IF NEW.user_id IS NOT NULL THEN
      v_scope := 'USER';
    ELSIF NEW.branch_id IS NOT NULL THEN
      v_scope := 'BRANCH';
    ELSE
      v_scope := 'TENANT';
    END IF;
  END IF;

  -- Get changed_by from JWT claims (if available)
  BEGIN
    v_changed_by := (auth.jwt() ->> 'sub')::UUID;
    v_changed_by_name := auth.jwt() ->> 'email';
  EXCEPTION
    WHEN OTHERS THEN
      v_changed_by := NULL;
      v_changed_by_name := 'system';
  END;

  -- Insert audit log
  IF TG_OP = 'DELETE' THEN
    INSERT INTO org_stng_audit_log_tr (
      tenant_org_id,
      stng_code,
      stng_audit_scope,
      stng_audit_action,
      branch_id,
      user_id,
      stng_before_value_jsonb,
      stng_after_value_jsonb,
      stng_change_reason,
      changed_at,
      changed_by,
      changed_by_name,
      created_info
    ) VALUES (
      OLD.tenant_org_id,
      OLD.setting_code,
      v_scope,
      v_action,
      OLD.branch_id,
      OLD.user_id,
      OLD.value_jsonb,
      NULL,
      'Setting override deleted',
      CURRENT_TIMESTAMP,
      v_changed_by,
      v_changed_by_name,
      format('Trigger: %s on %s', TG_OP, TG_TABLE_NAME)
    );

    RETURN OLD;
  ELSE
    INSERT INTO org_stng_audit_log_tr (
      tenant_org_id,
      stng_code,
      stng_audit_scope,
      stng_audit_action,
      branch_id,
      user_id,
      stng_before_value_jsonb,
      stng_after_value_jsonb,
      stng_change_reason,
      changed_at,
      changed_by,
      changed_by_name,
      created_info
    ) VALUES (
      NEW.tenant_org_id,
      NEW.setting_code,
      v_scope,
      v_action,
      NEW.branch_id,
      NEW.user_id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.value_jsonb ELSE NULL END,
      NEW.value_jsonb,
      COALESCE(NEW.stng_override_reason, format('Setting override %s', LOWER(v_action))),
      CURRENT_TIMESTAMP,
      v_changed_by,
      v_changed_by_name,
      format('Trigger: %s on %s', TG_OP, TG_TABLE_NAME)
    );

    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_stng_audit_changes IS 'Audit trigger function that logs all changes to org_tenant_settings_cf';


-- =====================================================
-- PART 2: Create Triggers on org_tenant_settings_cf
-- =====================================================

-- Trigger: Audit INSERT operations
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_insert ON org_tenant_settings_cf;

CREATE TRIGGER trg_stng_audit_insert
  AFTER INSERT ON org_tenant_settings_cf
  FOR EACH ROW
  EXECUTE FUNCTION fn_stng_audit_changes();

COMMENT ON TRIGGER trg_stng_audit_insert ON org_tenant_settings_cf IS 'Logs setting override creation to audit log';


-- Trigger: Audit UPDATE operations
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_update ON org_tenant_settings_cf;

CREATE TRIGGER trg_stng_audit_update
  AFTER UPDATE ON org_tenant_settings_cf
  FOR EACH ROW
  WHEN (OLD.value_jsonb IS DISTINCT FROM NEW.value_jsonb)
  EXECUTE FUNCTION fn_stng_audit_changes();

COMMENT ON TRIGGER trg_stng_audit_update ON org_tenant_settings_cf IS 'Logs setting override updates to audit log (only when value changes)';


-- Trigger: Audit DELETE operations
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_delete ON org_tenant_settings_cf;

CREATE TRIGGER trg_stng_audit_delete
  AFTER DELETE ON org_tenant_settings_cf
  FOR EACH ROW
  EXECUTE FUNCTION fn_stng_audit_changes();

COMMENT ON TRIGGER trg_stng_audit_delete ON org_tenant_settings_cf IS 'Logs setting override deletion to audit log';


-- =====================================================
-- PART 3: Cache Invalidation Trigger
-- =====================================================

-- Function: Invalidate cache on settings change
-- Automatically invalidates cache when settings are modified
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_invalidate_cache_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_scope TEXT;
BEGIN
  -- Get tenant_id and scope
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_org_id;
    IF OLD.user_id IS NOT NULL THEN
      v_scope := 'USER';
    ELSIF OLD.branch_id IS NOT NULL THEN
      v_scope := 'BRANCH';
    ELSE
      v_scope := 'TENANT';
    END IF;
  ELSE
    v_tenant_id := NEW.tenant_org_id;
    IF NEW.user_id IS NOT NULL THEN
      v_scope := 'USER';
    ELSIF NEW.branch_id IS NOT NULL THEN
      v_scope := 'BRANCH';
    ELSE
      v_scope := 'TENANT';
    END IF;
  END IF;

  -- Invalidate cache for the affected scope
  PERFORM fn_stng_invalidate_cache(v_tenant_id, v_scope);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_stng_invalidate_cache_trigger IS 'Trigger function that invalidates settings cache when overrides change';


-- Trigger: Invalidate cache on INSERT
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_invalidate_cache_insert ON org_tenant_settings_cf;

CREATE TRIGGER trg_stng_invalidate_cache_insert
  AFTER INSERT ON org_tenant_settings_cf
  FOR EACH ROW
  EXECUTE FUNCTION fn_stng_invalidate_cache_trigger();


-- Trigger: Invalidate cache on UPDATE
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_invalidate_cache_update ON org_tenant_settings_cf;

CREATE TRIGGER trg_stng_invalidate_cache_update
  AFTER UPDATE ON org_tenant_settings_cf
  FOR EACH ROW
  WHEN (OLD.value_jsonb IS DISTINCT FROM NEW.value_jsonb)
  EXECUTE FUNCTION fn_stng_invalidate_cache_trigger();


-- Trigger: Invalidate cache on DELETE
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_invalidate_cache_delete ON org_tenant_settings_cf;

CREATE TRIGGER trg_stng_invalidate_cache_delete
  AFTER DELETE ON org_tenant_settings_cf
  FOR EACH ROW
  EXECUTE FUNCTION fn_stng_invalidate_cache_trigger();


-- =====================================================
-- PART 4: Profile Change Audit and Cache Invalidation
-- =====================================================

-- Function: Audit profile assignments to tenants
-- Logs when tenants are assigned to profiles
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_audit_profile_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_changed_by UUID;
  v_changed_by_name VARCHAR(120);
BEGIN
  -- Only audit if profile_code changed
  IF TG_OP = 'UPDATE' AND (OLD.stng_profile_code IS DISTINCT FROM NEW.stng_profile_code) THEN
    -- Get changed_by from JWT claims
    BEGIN
      v_changed_by := (auth.jwt() ->> 'sub')::UUID;
      v_changed_by_name := auth.jwt() ->> 'email';
    EXCEPTION
      WHEN OTHERS THEN
        v_changed_by := NULL;
        v_changed_by_name := 'system';
    END;

    -- Log profile assignment change
    INSERT INTO org_stng_audit_log_tr (
      tenant_org_id,
      stng_code,
      stng_audit_scope,
      stng_audit_action,
      stng_before_value_jsonb,
      stng_after_value_jsonb,
      stng_change_reason,
      changed_at,
      changed_by,
      changed_by_name,
      created_info
    ) VALUES (
      NEW.id,
      '_PROFILE_ASSIGNMENT',
      'PROFILE',
      'UPDATE',
      jsonb_build_object('profile_code', OLD.stng_profile_code, 'profile_version', OLD.stng_profile_version_applied, 'profile_locked', OLD.stng_profile_locked),
      jsonb_build_object('profile_code', NEW.stng_profile_code, 'profile_version', NEW.stng_profile_version_applied, 'profile_locked', NEW.stng_profile_locked),
      format('Profile changed from %s to %s', COALESCE(OLD.stng_profile_code, 'NONE'), COALESCE(NEW.stng_profile_code, 'NONE')),
      CURRENT_TIMESTAMP,
      v_changed_by,
      v_changed_by_name,
      format('Trigger: %s on org_tenants_mst', TG_OP)
    );

    -- Invalidate ALL cache for this tenant (profile affects all settings)
    PERFORM fn_stng_invalidate_cache(NEW.id, 'ALL');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_stng_audit_profile_assignment IS 'Audits profile assignments and invalidates cache when profile changes';


-- Trigger: Audit profile assignment changes
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_profile_assignment ON org_tenants_mst;

CREATE TRIGGER trg_stng_audit_profile_assignment
  AFTER UPDATE ON org_tenants_mst
  FOR EACH ROW
  WHEN (OLD.stng_profile_code IS DISTINCT FROM NEW.stng_profile_code)
  EXECUTE FUNCTION fn_stng_audit_profile_assignment();

COMMENT ON TRIGGER trg_stng_audit_profile_assignment ON org_tenants_mst IS 'Logs profile assignment changes and invalidates cache';


-- =====================================================
-- PART 5: Profile Values Change Audit
-- =====================================================

-- Function: Audit profile value changes
-- Logs when profile values are modified
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_audit_profile_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action TEXT;
  v_changed_by UUID;
  v_changed_by_name VARCHAR(120);
  v_affected_tenants INTEGER;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
  END IF;

  -- Get changed_by from JWT claims
  BEGIN
    v_changed_by := (auth.jwt() ->> 'sub')::UUID;
    v_changed_by_name := auth.jwt() ->> 'email';
  EXCEPTION
    WHEN OTHERS THEN
      v_changed_by := NULL;
      v_changed_by_name := 'system';
  END;

  -- Count affected tenants (using this profile or inheriting from it)
  SELECT COUNT(DISTINCT t.id) INTO v_affected_tenants
  FROM org_tenants_mst t
  WHERE t.stng_profile_code = COALESCE(NEW.stng_profile_code, OLD.stng_profile_code)
    OR t.stng_profile_code IN (
      SELECT stng_profile_code
      FROM sys_stng_profiles_mst
      WHERE parent_profile_code = COALESCE(NEW.stng_profile_code, OLD.stng_profile_code)
    );

  -- Log profile value change (for system admin reference)
  -- We log to a tenant_org_id that represents "system" changes
  -- For now, use first active tenant or null
  IF TG_OP = 'DELETE' THEN
    INSERT INTO org_stng_audit_log_tr (
      tenant_org_id,
      stng_code,
      stng_audit_scope,
      stng_audit_action,
      stng_before_value_jsonb,
      stng_after_value_jsonb,
      stng_change_reason,
      changed_at,
      changed_by,
      changed_by_name,
      created_info
    )
    SELECT
      COALESCE((SELECT id FROM org_tenants_mst WHERE is_active = true LIMIT 1), '00000000-0000-0000-0000-000000000000'::UUID),
      OLD.stng_code,
      'PROFILE',
      v_action,
      jsonb_build_object('profile_code', OLD.stng_profile_code, 'value', OLD.stng_value_jsonb),
      NULL,
      format('Profile value deleted from %s (affects %s tenants)', OLD.stng_profile_code, v_affected_tenants),
      CURRENT_TIMESTAMP,
      v_changed_by,
      v_changed_by_name,
      format('Trigger: %s on sys_stng_profile_values_dtl', TG_OP);
  ELSE
    INSERT INTO org_stng_audit_log_tr (
      tenant_org_id,
      stng_code,
      stng_audit_scope,
      stng_audit_action,
      stng_before_value_jsonb,
      stng_after_value_jsonb,
      stng_change_reason,
      changed_at,
      changed_by,
      changed_by_name,
      created_info
    )
    SELECT
      COALESCE((SELECT id FROM org_tenants_mst WHERE is_active = true LIMIT 1), '00000000-0000-0000-0000-000000000000'::UUID),
      NEW.stng_code,
      'PROFILE',
      v_action,
      CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('profile_code', OLD.stng_profile_code, 'value', OLD.stng_value_jsonb) ELSE NULL END,
      jsonb_build_object('profile_code', NEW.stng_profile_code, 'value', NEW.stng_value_jsonb),
      format('Profile value %s in %s (affects %s tenants)', LOWER(v_action), NEW.stng_profile_code, v_affected_tenants),
      CURRENT_TIMESTAMP,
      v_changed_by,
      v_changed_by_name,
      format('Trigger: %s on sys_stng_profile_values_dtl', TG_OP);
  END IF;

  -- Invalidate cache for all tenants using this profile
  -- (Performance consideration: this could be expensive for widely-used profiles)
  -- In production, consider async cache invalidation via queue
  PERFORM fn_stng_invalidate_cache(t.id, 'ALL')
  FROM org_tenants_mst t
  WHERE t.stng_profile_code = COALESCE(NEW.stng_profile_code, OLD.stng_profile_code);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_stng_audit_profile_values IS 'Audits profile value changes and invalidates cache for affected tenants';


-- Trigger: Audit profile value INSERT
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_profile_values_insert ON sys_stng_profile_values_dtl;

CREATE TRIGGER trg_stng_audit_profile_values_insert
  AFTER INSERT ON sys_stng_profile_values_dtl
  FOR EACH ROW
  EXECUTE FUNCTION fn_stng_audit_profile_values();


-- Trigger: Audit profile value UPDATE
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_profile_values_update ON sys_stng_profile_values_dtl;

CREATE TRIGGER trg_stng_audit_profile_values_update
  AFTER UPDATE ON sys_stng_profile_values_dtl
  FOR EACH ROW
  WHEN (OLD.stng_value_jsonb IS DISTINCT FROM NEW.stng_value_jsonb)
  EXECUTE FUNCTION fn_stng_audit_profile_values();


-- Trigger: Audit profile value DELETE
-- ========================================================
DROP TRIGGER IF EXISTS trg_stng_audit_profile_values_delete ON sys_stng_profile_values_dtl;

CREATE TRIGGER trg_stng_audit_profile_values_delete
  AFTER DELETE ON sys_stng_profile_values_dtl
  FOR EACH ROW
  EXECUTE FUNCTION fn_stng_audit_profile_values();


-- =====================================================
-- Summary
-- =====================================================

-- Trigger functions created:
-- 1. fn_stng_audit_changes() - Audit tenant setting overrides
-- 2. fn_stng_invalidate_cache_trigger() - Invalidate cache on changes
-- 3. fn_stng_audit_profile_assignment() - Audit profile assignments
-- 4. fn_stng_audit_profile_values() - Audit profile value changes
--
-- Triggers created:
-- On org_tenant_settings_cf:
--   - trg_stng_audit_insert (audit)
--   - trg_stng_audit_update (audit)
--   - trg_stng_audit_delete (audit)
--   - trg_stng_invalidate_cache_insert (cache)
--   - trg_stng_invalidate_cache_update (cache)
--   - trg_stng_invalidate_cache_delete (cache)
--
-- On org_tenants_mst:
--   - trg_stng_audit_profile_assignment (audit + cache)
--
-- On sys_stng_profile_values_dtl:
--   - trg_stng_audit_profile_values_insert (audit + cache)
--   - trg_stng_audit_profile_values_update (audit + cache)
--   - trg_stng_audit_profile_values_delete (audit + cache)
--
-- Features:
-- - Complete audit trail for all setting changes
-- - Automatic cache invalidation on changes
-- - Profile assignment tracking
-- - Profile value change tracking with affected tenant count
-- - Scope-aware cache invalidation (TENANT, BRANCH, USER, ALL)
--
-- Migration complete! Phase 1 (Database) finished.
-- Ready to run migrations and verify schema.
