-- Migration: Create Tenant Lifecycle Management Tables
-- Description: Implements PRD-SAAS-MNG-0002 database schema
-- Author: Platform Team
-- Date: 2025-01-20

-- ============================================================
-- Table: sys_tenant_lifecycle
-- Purpose: Track tenant lifecycle stages, health, and onboarding
-- ============================================================

CREATE TABLE IF NOT EXISTS sys_tenant_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL UNIQUE REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Lifecycle stage
  lifecycle_stage VARCHAR(50) NOT NULL DEFAULT 'trial',
  CHECK (lifecycle_stage IN ('trial', 'active', 'suspended', 'cancelled', 'churned')),

  -- Onboarding tracking
  onboarding_status VARCHAR(50) DEFAULT 'not_started',
  CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed')),
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_checklist JSONB DEFAULT '[]'::jsonb,

  -- Suspension details
  suspension_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspended_by UUID,-- REFERENCES auth_users(id),

  -- Cancellation details
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,-- REFERENCES auth_users(id),
  data_retention_until DATE, -- When to purge data

  -- Health metrics
  health_score DECIMAL(5,2) DEFAULT 0.00 CHECK (health_score BETWEEN 0 AND 100),
  churn_prediction_score DECIMAL(3,2) CHECK (churn_prediction_score BETWEEN 0 AND 1),
  last_health_calculated_at TIMESTAMPTZ,

  -- Activity tracking
  last_activity_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_lifecycle_stage ON sys_tenant_lifecycle(lifecycle_stage);
CREATE INDEX idx_health_score ON sys_tenant_lifecycle(health_score DESC);
CREATE INDEX idx_churn_score ON sys_tenant_lifecycle(churn_prediction_score DESC);
CREATE INDEX idx_last_activity ON sys_tenant_lifecycle(last_activity_at DESC);
CREATE INDEX idx_onboarding_status ON sys_tenant_lifecycle(onboarding_status);

-- ============================================================
-- Table: sys_tenant_metrics_daily
-- Purpose: Daily aggregated metrics for analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS sys_tenant_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  -- Usage metrics
  orders_created INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,

  -- Customer metrics
  active_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,

  -- User metrics
  active_users INTEGER DEFAULT 0,
  total_logins INTEGER DEFAULT 0,

  -- Storage metrics
  storage_mb_used DECIMAL(10,2) DEFAULT 0,

  -- API metrics (future)
  api_calls INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_tenant_metric_date UNIQUE(tenant_org_id, metric_date)
);

-- Indexes for metrics queries
CREATE INDEX idx_metrics_date ON sys_tenant_metrics_daily(metric_date DESC);
CREATE INDEX idx_metrics_tenant_date ON sys_tenant_metrics_daily(tenant_org_id, metric_date DESC);

-- ============================================================
-- Table: hq_tenant_status_history
-- Purpose: Audit trail for lifecycle transitions
-- ============================================================

CREATE TABLE IF NOT EXISTS hq_tenant_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  lifecycle_stage_from VARCHAR(50),
  lifecycle_stage_to VARCHAR(50),
  changed_by UUID, -- References auth_users(id) but not enforced with FK
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  metadata JSONB
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_tenant_status_history_tenant ON hq_tenant_status_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_status_history_date ON hq_tenant_status_history(changed_at DESC);

COMMENT ON TABLE hq_tenant_status_history IS 'Audit trail for tenant status and lifecycle transitions';

-- ============================================================
-- Extended org_tenants_mst columns
-- Purpose: Add fields needed for lifecycle management
-- ============================================================

DO $$
BEGIN
  -- Add slug if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='org_tenants_mst' AND column_name='slug') THEN
    ALTER TABLE org_tenants_mst ADD COLUMN slug VARCHAR(50) UNIQUE;
  END IF;

  -- Add business_type if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='org_tenants_mst' AND column_name='business_type') THEN
    ALTER TABLE org_tenants_mst ADD COLUMN business_type VARCHAR(50);
  END IF;

  -- Add onboarding_completed if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='org_tenants_mst' AND column_name='onboarding_completed') THEN
    ALTER TABLE org_tenants_mst ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
  END IF;

  -- Add regional settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='org_tenants_mst' AND column_name='country_code') THEN
    ALTER TABLE org_tenants_mst
    ADD COLUMN country_code VARCHAR(2) DEFAULT 'OM',
    ADD COLUMN phone_country_code VARCHAR(5) DEFAULT '+968',
    ADD COLUMN date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    ADD COLUMN time_format VARCHAR(5) DEFAULT '24h',
    ADD COLUMN first_day_of_week INTEGER DEFAULT 6; -- Saturday for GCC
  END IF;
END $$;

-- Create unique index on active tenant slugs
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_slug
ON org_tenants_mst(slug)
WHERE is_active = true;

-- ============================================================
-- Function: Auto-create lifecycle record on tenant creation
-- ============================================================

CREATE OR REPLACE FUNCTION create_tenant_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sys_tenant_lifecycle (
    tenant_org_id,
    lifecycle_stage,
    onboarding_status,
    onboarding_checklist,
    health_score,
    created_at
  ) VALUES (
    NEW.id,
    'trial',
    'not_started',
    jsonb_build_array(
      jsonb_build_object('step', 'setup_business_info', 'completed', false, 'required', true, 'order', 1),
      jsonb_build_object('step', 'configure_branding', 'completed', false, 'required', false, 'order', 2),
      jsonb_build_object('step', 'add_products', 'completed', false, 'required', true, 'order', 3),
      jsonb_build_object('step', 'invite_team', 'completed', false, 'required', false, 'order', 4),
      jsonb_build_object('step', 'create_first_order', 'completed', false, 'required', true, 'order', 5),
      jsonb_build_object('step', 'configure_workflows', 'completed', false, 'required', false, 'order', 6)
    ),
    0.0,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (tenant_org_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-lifecycle creation
DROP TRIGGER IF EXISTS trigger_create_tenant_lifecycle ON org_tenants_mst;
CREATE TRIGGER trigger_create_tenant_lifecycle
  AFTER INSERT ON org_tenants_mst
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_lifecycle();

-- ============================================================
-- Function: Update lifecycle updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_lifecycle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lifecycle timestamp updates
DROP TRIGGER IF EXISTS trigger_update_lifecycle_timestamp ON sys_tenant_lifecycle;
CREATE TRIGGER trigger_update_lifecycle_timestamp
  BEFORE UPDATE ON sys_tenant_lifecycle
  FOR EACH ROW
  EXECUTE FUNCTION update_lifecycle_timestamp();

-- ============================================================
-- Grant permissions (adjust as needed)
-- ============================================================

-- Grant permissions to service role
-- GRANT ALL ON sys_tenant_lifecycle TO service_role;
-- GRANT ALL ON sys_tenant_metrics_daily TO service_role;

COMMENT ON TABLE sys_tenant_lifecycle IS 'Tracks tenant lifecycle stages, health scores, and onboarding progress';
COMMENT ON TABLE sys_tenant_metrics_daily IS 'Daily aggregated metrics for tenant analytics and reporting';
