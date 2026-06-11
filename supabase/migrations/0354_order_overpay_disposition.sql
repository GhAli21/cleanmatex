-- ==================================================================
-- Migration: 0354_order_overpay_disposition.sql
-- Purpose: Audit table for explicit overpayment disposition at checkout
--          (ADR-047). Seeds RBAC permissions for disposition destinations.
-- ADR: docs/features/Order_Fin/ADR/ADR-047-Overpayment-Disposition.md
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Disposition type codes (mirror TypeScript OVERPAYMENT_DISPOSITION_TYPES)
-- ------------------------------------------------------------------

CREATE TABLE org_order_overpay_disp_dtl (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  order_id            UUID NOT NULL,
  branch_id           UUID,
  voucher_id          UUID,
  disposition_type    TEXT NOT NULL,
  amount              DECIMAL(19, 4) NOT NULL,
  currency_code       TEXT NOT NULL,
  -- Client leg reference for RETURN_CHANGE; wallet/advance/credit note id otherwise
  target_ref          TEXT,
  cash_leg_ref        TEXT,
  note_reason         TEXT,
  idempotency_key     TEXT,
  rec_status          SMALLINT NOT NULL DEFAULT 1,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  rec_order           INTEGER,
  rec_notes           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  CONSTRAINT org_order_overpay_disp_dtl_amt_chk
    CHECK (amount > 0),
  CONSTRAINT org_order_overpay_disp_dtl_type_chk
    CHECK (disposition_type IN (
      'RETURN_CHANGE',
      'TO_WALLET',
      'TO_ADVANCE',
      'TO_CREDIT_NOTE'
    )),
  CONSTRAINT org_order_overpay_disp_dtl_tenant_order_fk
    FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES org_orders_mst (id, tenant_org_id)
    ON DELETE RESTRICT
);

COMMENT ON TABLE org_order_overpay_disp_dtl IS
  'Explicit routing of checkout excess (change, wallet, advance, credit note). ADR-047.';
COMMENT ON COLUMN org_order_overpay_disp_dtl.disposition_type IS
  'RETURN_CHANGE | TO_WALLET | TO_ADVANCE | TO_CREDIT_NOTE';
COMMENT ON COLUMN org_order_overpay_disp_dtl.target_ref IS
  'Created entity id (wallet ledger row, advance id, credit note id) or voucher ref for change';
COMMENT ON COLUMN org_order_overpay_disp_dtl.cash_leg_ref IS
  'Client legRef for RETURN_CHANGE — links to settlement leg identity';
COMMENT ON COLUMN org_order_overpay_disp_dtl.idempotency_key IS
  'Matches submit-order idempotencyKey for replay-safe inserts';

CREATE INDEX idx_ord_overpay_disp_tenant
  ON org_order_overpay_disp_dtl (tenant_org_id);
CREATE INDEX idx_ord_overpay_disp_tenant_order
  ON org_order_overpay_disp_dtl (tenant_org_id, order_id);
CREATE INDEX idx_ord_overpay_disp_tenant_created
  ON org_order_overpay_disp_dtl (tenant_org_id, created_at DESC);
CREATE UNIQUE INDEX uq_ord_overpay_disp_idempotency
  ON org_order_overpay_disp_dtl (tenant_org_id, idempotency_key, disposition_type, cash_leg_ref)
  WHERE idempotency_key IS NOT NULL AND disposition_type = 'RETURN_CHANGE';

CREATE UNIQUE INDEX uq_ord_overpay_disp_idempotency_simple
  ON org_order_overpay_disp_dtl (tenant_org_id, idempotency_key, disposition_type)
  WHERE idempotency_key IS NOT NULL AND disposition_type <> 'RETURN_CHANGE';

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------

ALTER TABLE org_order_overpay_disp_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_order_overpay_disp_dtl ON org_order_overpay_disp_dtl;
CREATE POLICY tenant_isolation_org_order_overpay_disp_dtl ON org_order_overpay_disp_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_order_overpay_disp_dtl ON org_order_overpay_disp_dtl;
CREATE POLICY service_role_org_order_overpay_disp_dtl ON org_order_overpay_disp_dtl
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ------------------------------------------------------------------
-- Permissions (ADR-047)
-- ------------------------------------------------------------------

INSERT INTO sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
) VALUES
  (
    'orders:overpayment_dispose',
    'Dispose Checkout Overpayment',
    'تصرف فائض الدفع عند الإنهاء',
    'actions',
    'Route checkout excess to change, wallet, advance, or credit note',
    'توجيه فائض الدفع عند الإنهاء إلى الباقي أو المحفظة أو السلفة أو إشعار الدائن',
    'Orders',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  ),
  (
    'orders:overpayment_to_wallet',
    'Overpayment to Wallet',
    'فائض الدفع إلى المحفظة',
    'actions',
    'Credit customer wallet from checkout overpayment',
    'إيداع فائض الدفع في محفظة العميل',
    'Orders',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  ),
  (
    'orders:overpayment_to_advance',
    'Overpayment to Advance',
    'فائض الدفع إلى سلفة',
    'actions',
    'Issue customer advance from checkout overpayment',
    'إصدار سلفة للعميل من فائض الدفع',
    'Orders',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  ),
  (
    'orders:overpayment_to_credit_note',
    'Overpayment to Credit Note',
    'فائض الدفع إلى إشعار دائن',
    'actions',
    'Issue credit note from checkout overpayment',
    'إصدار إشعار دائن من فائض الدفع',
    'Orders',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'operator', 'branch_manager')
  AND p.code IN (
    'orders:overpayment_dispose',
    'orders:overpayment_to_wallet',
    'orders:overpayment_to_advance',
    'orders:overpayment_to_credit_note'
  )
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
