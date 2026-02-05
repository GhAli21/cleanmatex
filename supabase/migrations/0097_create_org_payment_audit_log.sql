-- 0097_create_org_payment_audit_log.sql
-- Purpose: Append-only audit log for payment transactions (CREATED, CANCELLED, REFUNDED, NOTES_UPDATED)
-- Pattern: Follows org_order_history / org_payment_reconciliation_log RLS

BEGIN;

CREATE TABLE IF NOT EXISTS org_payment_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  payment_id    UUID NOT NULL,
  action_type   VARCHAR(30) NOT NULL,
  before_value  JSONB,
  after_value   JSONB,
  changed_by    VARCHAR(120),
  changed_at    TIMESTAMPTZ DEFAULT now(),
  metadata      JSONB
);

COMMENT ON TABLE org_payment_audit_log IS 'Append-only audit trail for payment transactions';
COMMENT ON COLUMN org_payment_audit_log.action_type IS 'CREATED, CANCELLED, REFUNDED, NOTES_UPDATED';
COMMENT ON COLUMN org_payment_audit_log.before_value IS 'Snapshot of relevant fields before change';
COMMENT ON COLUMN org_payment_audit_log.after_value IS 'Snapshot after change';

ALTER TABLE org_payment_audit_log
  ADD CONSTRAINT fk_payment_audit_tenant
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

ALTER TABLE org_payment_audit_log
  ADD CONSTRAINT fk_payment_audit_payment
  FOREIGN KEY (payment_id) REFERENCES org_payments_dtl_tr(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_payment ON org_payment_audit_log(tenant_org_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_changed ON org_payment_audit_log(tenant_org_id, changed_at DESC);

ALTER TABLE org_payment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON org_payment_audit_log;
CREATE POLICY tenant_isolation_select ON org_payment_audit_log
  FOR SELECT USING (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_insert ON org_payment_audit_log;
CREATE POLICY tenant_isolation_insert ON org_payment_audit_log
  FOR INSERT WITH CHECK (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
