-- Migration: JWT Tenant Sync Enhancements
-- Purpose: Enhanced triggers and monitoring for JWT tenant context management
-- Author: CleanMateX Development Team
-- Created: 2025-01-XX
-- Depends on: 0079_update_user_metadata_tenant.sql

BEGIN;

-- =========================
-- ENHANCED TRIGGER: On auth.users INSERT/UPDATE
-- =========================

-- Enhanced function to ensure tenant context on user creation/update
CREATE OR REPLACE FUNCTION ensure_jwt_tenant_context_on_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_metadata JSONB;
  v_org_user_id UUID;
  v_auth_user_id UUID;

BEGIN
  -- Only process if user_metadata doesn't have tenant_org_id or it's being updated
  IF NEW.raw_user_meta_data IS NULL 
     OR NOT (NEW.raw_user_meta_data ? 'tenant_org_id')
     OR (OLD.raw_user_meta_data IS NOT NULL 
         AND OLD.raw_user_meta_data->>'tenant_org_id' IS DISTINCT FROM NEW.raw_user_meta_data->>'tenant_org_id') THEN
    
    -- Get the most recently accessed tenant for this user
    SELECT tenant_org_id, id --, user_id 
    INTO v_tenant_id, v_org_user_id -- , v_auth_user_id
    FROM org_users_mst
    WHERE user_id = NEW.id
      AND is_active = true
    ORDER BY last_login_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    -- If user has a tenant, ensure it's in metadata
    IF v_tenant_id IS NOT NULL THEN
      -- Get current user_metadata or initialize empty object
      v_user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
      
      -- Update tenant_org_id in metadata if missing or different
      IF NOT (v_user_metadata ? 'tenant_org_id') 
         OR v_user_metadata->>'tenant_org_id' IS DISTINCT FROM v_tenant_id::text THEN
        v_user_metadata := jsonb_set(
          v_user_metadata,
          '{tenant_org_id}',
          to_jsonb(v_tenant_id::text),
          true -- Create if doesn't exist
        );
        v_user_metadata := jsonb_set(
          v_user_metadata,
          '{org_user_id}',
          to_jsonb(v_org_user_id::text),
          true -- Create if doesn't exist
        );

        -- Update the user record
        NEW.raw_user_meta_data := v_user_metadata;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION ensure_jwt_tenant_context_on_auth_user IS 
  'Ensures tenant_org_id is in user_metadata when auth.users record is created or updated';

-- Create trigger on auth.users (if not exists)
DROP TRIGGER IF EXISTS trg_ensure_jwt_tenant_context ON auth.users;
CREATE TRIGGER trg_ensure_jwt_tenant_context
  BEFORE INSERT OR UPDATE OF raw_user_meta_data
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_jwt_tenant_context_on_auth_user();

-- =========================
-- JWT HEALTH MONITORING TABLE
-- =========================

-- Table to track JWT tenant context health metrics
CREATE TABLE IF NOT EXISTS sys_jwt_tenant_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'validation', 'repair', 'refresh', 'switch'
  tenant_id UUID,
  org_user_id UUID,
  auth_user_id UUID,
  had_tenant_context BOOLEAN NOT NULL,
  repair_attempted BOOLEAN DEFAULT false,
  repair_successful BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jwt_health_user ON sys_jwt_tenant_health_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jwt_health_event ON sys_jwt_tenant_health_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jwt_health_repair ON sys_jwt_tenant_health_log(repair_attempted, repair_successful, created_at DESC);

COMMENT ON TABLE sys_jwt_tenant_health_log IS 
  'Tracks JWT tenant context validation, repair, and refresh events for monitoring';

-- =========================
-- FUNCTION: LOG JWT HEALTH EVENT
-- =========================

CREATE OR REPLACE FUNCTION log_jwt_tenant_health_event(
  p_user_id UUID,
  p_event_type VARCHAR,
  p_had_tenant_context BOOLEAN,
  p_tenant_id UUID DEFAULT NULL,
  p_org_user_id UUID DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL,
  p_repair_attempted BOOLEAN DEFAULT false,
  p_repair_successful BOOLEAN DEFAULT false,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO sys_jwt_tenant_health_log (
    user_id,
    event_type,
    tenant_id,
    org_user_id,
    auth_user_id,
    had_tenant_context,
    repair_attempted,
    repair_successful,
    error_message,
    metadata
  ) VALUES (
    p_user_id,
    p_event_type,
    p_tenant_id,
    p_org_user_id,
    p_auth_user_id,
    p_had_tenant_context,
    p_repair_attempted,
    p_repair_successful,
    p_error_message,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_jwt_tenant_health_event IS 
  'Logs JWT tenant context health events for monitoring and alerting';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_jwt_tenant_health_event TO authenticated;
GRANT EXECUTE ON FUNCTION log_jwt_tenant_health_event TO service_role;

-- =========================
-- FUNCTION: GET JWT HEALTH METRICS
-- =========================

CREATE OR REPLACE FUNCTION get_jwt_tenant_health_metrics(
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_events BIGINT,
  events_with_tenant BIGINT,
  events_without_tenant BIGINT,
  events_with_org_user BIGINT,
  events_without_org_user BIGINT,
  events_with_auth_user BIGINT,
  events_without_auth_user BIGINT,
  repair_attempts BIGINT,
  repair_successes BIGINT,
  repair_failures BIGINT,
  coverage_rate NUMERIC,
  repair_success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_events,
    COUNT(*) FILTER (WHERE had_tenant_context = true)::BIGINT AS events_with_tenant,
    COUNT(*) FILTER (WHERE had_tenant_context = false)::BIGINT AS events_without_tenant,
    COUNT(*) FILTER (WHERE org_user_id IS NOT NULL)::BIGINT AS events_with_org_user,
    COUNT(*) FILTER (WHERE org_user_id IS NULL)::BIGINT AS events_without_org_user,
    COUNT(*) FILTER (WHERE auth_user_id IS NOT NULL)::BIGINT AS events_with_auth_user,
    COUNT(*) FILTER (WHERE auth_user_id IS NULL)::BIGINT AS events_without_auth_user,
    COUNT(*) FILTER (WHERE repair_attempted = true)::BIGINT AS repair_attempts,
    COUNT(*) FILTER (WHERE repair_attempted = true AND repair_successful = true)::BIGINT AS repair_successes,
    COUNT(*) FILTER (WHERE repair_attempted = true AND repair_successful = false)::BIGINT AS repair_failures,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE had_tenant_context = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS coverage_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE repair_attempted = true) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE repair_attempted = true AND repair_successful = true)::NUMERIC / 
               COUNT(*) FILTER (WHERE repair_attempted = true)::NUMERIC) * 100, 2)
      ELSE 0
    END AS repair_success_rate
  FROM sys_jwt_tenant_health_log
  WHERE created_at BETWEEN p_start_time AND p_end_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_jwt_tenant_health_metrics IS 
  'Returns JWT tenant context health metrics for the specified time period';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_jwt_tenant_health_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_jwt_tenant_health_metrics TO service_role;

COMMIT;

