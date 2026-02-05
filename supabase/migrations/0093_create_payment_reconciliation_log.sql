-- Migration 0093: Create org_payment_reconciliation_log for daily cash/card reconciliation
-- Payment & Order Data Enhancement Plan

BEGIN;

CREATE TABLE IF NOT EXISTS org_payment_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  payment_method_code VARCHAR(50) NOT NULL REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT,
  expected_amount DECIMAL(19, 4) NOT NULL,
  actual_amount DECIMAL(19, 4) NOT NULL,
  variance DECIMAL(19, 4) GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
  reconciled_by VARCHAR(120),
  reconciled_at TIMESTAMPTZ,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'variance_noted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  CONSTRAINT uq_recon_tenant_date_method UNIQUE (tenant_org_id, reconciliation_date, payment_method_code)
);

CREATE INDEX IF NOT EXISTS idx_recon_tenant_date ON org_payment_reconciliation_log(tenant_org_id, reconciliation_date DESC);
CREATE INDEX IF NOT EXISTS idx_recon_tenant_status ON org_payment_reconciliation_log(tenant_org_id, status);

ALTER TABLE org_payment_reconciliation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON org_payment_reconciliation_log;
CREATE POLICY tenant_isolation_select ON org_payment_reconciliation_log
  FOR SELECT USING (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_insert ON org_payment_reconciliation_log;
CREATE POLICY tenant_isolation_insert ON org_payment_reconciliation_log
  FOR INSERT WITH CHECK (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_update ON org_payment_reconciliation_log;
CREATE POLICY tenant_isolation_update ON org_payment_reconciliation_log
  FOR UPDATE USING (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
