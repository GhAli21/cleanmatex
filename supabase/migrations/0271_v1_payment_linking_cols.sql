-- =============================================================================
-- Migration 0271: Payment Config Client Layer — Linking Columns & Foundation Tables
-- 1. Adds new linking + historical snapshot columns to org_payments_dtl_tr
-- 2. Creates org_order_payments_dtl (dedicated order payment rows)
-- 3. Wires FK from org_cash_drawer_movements_dtl.order_payment_id → org_order_payments_dtl
-- 4. Creates org_order_credit_apps_dtl (stored-value applications)
-- 5. Creates org_order_refunds_dtl (refund foundation, no UI in V1)
-- 6. Seeds payment config + cash drawer permissions
--
-- Note: payment_channel already exists from migration 0091 — not added again.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Enhance org_payments_dtl_tr with config linking + historical columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_payments_dtl_tr
  -- Links to new config tables (optional, set when new payment system is used)
  ADD COLUMN IF NOT EXISTS org_payment_method_id         UUID REFERENCES public.org_payment_methods_cf(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_payment_method_id      UUID REFERENCES public.org_branch_payment_methods_cf(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_terminal_id           UUID REFERENCES public.org_payment_terminals_cf(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_drawer_id                UUID REFERENCES public.org_cash_drawers_mst(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_drawer_session_id        UUID REFERENCES public.org_cash_drawer_sessions_mst(id) ON DELETE SET NULL,

  -- Historical snapshots (denormalized — preserved even if sys_payment_method_cd changes)
  ADD COLUMN IF NOT EXISTS payment_method_name           TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_name2          TEXT,

  -- Payment status (links to sys_payment_status_cd)
  ADD COLUMN IF NOT EXISTS payment_status                TEXT DEFAULT 'COMPLETED',

  -- Cash payment details
  ADD COLUMN IF NOT EXISTS tendered_amount               DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS change_returned_amount        DECIMAL(19,4),

  -- Card details (PCI: last 4 digits only — enforced by CHECK)
  ADD COLUMN IF NOT EXISTS card_brand_code               TEXT,
  ADD COLUMN IF NOT EXISTS card_last4                    TEXT,

  -- Authorization details
  ADD COLUMN IF NOT EXISTS auth_code                     TEXT,
  ADD COLUMN IF NOT EXISTS gateway_transaction_id        TEXT,
  ADD COLUMN IF NOT EXISTS gateway_reference             TEXT,
  ADD COLUMN IF NOT EXISTS bank_reference                TEXT,

  -- Idempotency: prevents duplicate submissions from mobile/customer app
  ADD COLUMN IF NOT EXISTS idempotency_key               TEXT,

  -- Operational
  ADD COLUMN IF NOT EXISTS received_by                   UUID,
  ADD COLUMN IF NOT EXISTS branch_id                     UUID;

-- PCI safety: card_last4 can hold at most 4 characters
ALTER TABLE public.org_payments_dtl_tr
  DROP CONSTRAINT IF EXISTS chk_org_pay_dtl_tr_card_last4;

ALTER TABLE public.org_payments_dtl_tr
  ADD CONSTRAINT chk_org_pay_dtl_tr_card_last4
  CHECK (card_last4 IS NULL OR char_length(card_last4) <= 4);

-- Idempotency key must be unique when set
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_pay_dtl_tr_idempotency
  ON public.org_payments_dtl_tr (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Supporting indexes for new linking columns
CREATE INDEX IF NOT EXISTS idx_org_pay_dtl_tr_org_method
  ON public.org_payments_dtl_tr (org_payment_method_id)
  WHERE org_payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_pay_dtl_tr_session
  ON public.org_payments_dtl_tr (cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_pay_dtl_tr_branch
  ON public.org_payments_dtl_tr (branch_id)
  WHERE branch_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. org_order_payments_dtl
--    Dedicated order payment rows (new table, separate from org_payments_dtl_tr).
--    Captures per-order payment details: method, terminal, drawer, gateway, check.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_order_payments_dtl (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                       UUID,
  order_id                        UUID NOT NULL,
  customer_id                     UUID,

  -- Config links (optional — populated when new payment config system is used)
  org_payment_method_id           UUID REFERENCES public.org_payment_methods_cf(id) ON DELETE SET NULL,
  branch_payment_method_id        UUID REFERENCES public.org_branch_payment_methods_cf(id) ON DELETE SET NULL,
  payment_terminal_id             UUID REFERENCES public.org_payment_terminals_cf(id) ON DELETE SET NULL,
  cash_drawer_id                  UUID REFERENCES public.org_cash_drawers_mst(id) ON DELETE SET NULL,
  cash_drawer_session_id          UUID REFERENCES public.org_cash_drawer_sessions_mst(id) ON DELETE SET NULL,

  -- Method identification
  payment_method_code             TEXT NOT NULL,
  payment_method_name_snapshot    TEXT,

  -- Status
  payment_status                  TEXT NOT NULL DEFAULT 'COMPLETED',

  -- Amounts
  amount                          DECIMAL(19,4) NOT NULL,
  currency_code                   TEXT NOT NULL,
  tendered_amount                 DECIMAL(19,4),
  change_returned_amount          DECIMAL(19,4),

  -- Card details (PCI: max 4 digits enforced by CHECK)
  card_brand_code                 TEXT,
  card_last4                      TEXT,

  -- Authorization
  auth_code                       TEXT,
  gateway_code                    TEXT,
  gateway_transaction_id          TEXT,
  gateway_reference               TEXT,

  -- Check/cheque details
  check_no                        TEXT,
  check_bank_name                 TEXT,
  check_due_date                  DATE,
  check_status                    TEXT,

  -- Bank transfer
  bank_reference                  TEXT,

  -- Idempotency: prevents duplicate submissions
  idempotency_key                 TEXT,

  -- Operational
  paid_at                         TIMESTAMPTZ,
  received_by                     UUID,

  -- Audit
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                      UUID,
  created_info                    TEXT,
  updated_at                      TIMESTAMPTZ,
  updated_by                      UUID,
  updated_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  CONSTRAINT chk_org_ord_pay_dtl_amount
    CHECK (amount >= 0),

  CONSTRAINT chk_org_ord_pay_dtl_tendered
    CHECK (tendered_amount IS NULL OR tendered_amount >= 0),

  CONSTRAINT chk_org_ord_pay_dtl_change
    CHECK (change_returned_amount IS NULL OR change_returned_amount >= 0),

  CONSTRAINT chk_org_ord_pay_dtl_card_last4
    CHECK (card_last4 IS NULL OR char_length(card_last4) <= 4)
);

-- Idempotency key must be unique when set
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_ord_pay_dtl_idempotency
  ON public.org_order_payments_dtl (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_ord_pay_dtl_tenant
  ON public.org_order_payments_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_ord_pay_dtl_order
  ON public.org_order_payments_dtl (tenant_org_id, order_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_ord_pay_dtl_session
  ON public.org_order_payments_dtl (cash_drawer_session_id)
  WHERE cash_drawer_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_ord_pay_dtl_branch
  ON public.org_order_payments_dtl (tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.org_order_payments_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_order_payments_dtl
  ON public.org_order_payments_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 3. Wire FK: org_cash_drawer_movements_dtl.order_payment_id → org_order_payments_dtl
--    Deferred from migration 0270 because org_order_payments_dtl did not exist yet.
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_cash_drawer_movements_dtl
  ADD CONSTRAINT fk_org_cdm_order_payment
  FOREIGN KEY (order_payment_id)
  REFERENCES public.org_order_payments_dtl(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 4. org_order_credit_apps_dtl
--    Stored-value applications per order (gift card, wallet, loyalty, advance).
--    NOT a payment row — separate table by design.
--    No UI in V1; FK target for future order checkout flow.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_order_credit_apps_dtl (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  order_id                        UUID NOT NULL,

  credit_type                     TEXT NOT NULL,
  credit_source_id                UUID,

  applied_amount                  DECIMAL(19,4) NOT NULL,
  currency_code                   TEXT NOT NULL,

  reference_no                    TEXT,
  applied_by                      UUID,
  applied_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit
  created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                      TEXT,
  created_info                    TEXT,
  updated_at                      TIMESTAMPTZ,
  updated_by                      TEXT,
  updated_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_org_order_credit_apps_type
    CHECK (credit_type IN ('GIFT_CARD','WALLET','CUSTOMER_CREDIT','LOYALTY_CREDIT','CUSTOMER_ADVANCE')),

  CONSTRAINT chk_org_order_credit_apps_amount
    CHECK (applied_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_org_order_credit_apps_tenant
  ON public.org_order_credit_apps_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_order_credit_apps_order
  ON public.org_order_credit_apps_dtl (tenant_org_id, order_id, is_active);

ALTER TABLE public.org_order_credit_apps_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_order_credit_apps_dtl
  ON public.org_order_credit_apps_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 5. org_order_refunds_dtl
--    Refund tracking foundation. No UI in V1.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_order_refunds_dtl (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  order_id                        UUID NOT NULL,

  original_payment_id             UUID REFERENCES public.org_payments_dtl_tr(id) ON DELETE RESTRICT,
  refund_method_code              TEXT,
  refund_amount                   DECIMAL(19,4) NOT NULL,
  currency_code                   TEXT NOT NULL,

  refund_status                   TEXT NOT NULL DEFAULT 'PENDING',
  refund_reason                   TEXT,
  gateway_refund_id               TEXT,

  cash_drawer_session_id          UUID REFERENCES public.org_cash_drawer_sessions_mst(id) ON DELETE SET NULL,

  approved_by                     UUID,
  approved_at                     TIMESTAMPTZ,
  processed_at                    TIMESTAMPTZ,

  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit
  created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                      TEXT,
  created_info                    TEXT,
  updated_at                      TIMESTAMPTZ,
  updated_by                      TEXT,
  updated_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_org_order_refunds_status
    CHECK (refund_status IN ('PENDING','APPROVED','PROCESSED','FAILED','CANCELLED')),

  CONSTRAINT chk_org_order_refunds_amount
    CHECK (refund_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_org_order_refunds_tenant
  ON public.org_order_refunds_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_order_refunds_order
  ON public.org_order_refunds_dtl (tenant_org_id, order_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_order_refunds_orig_pay
  ON public.org_order_refunds_dtl (original_payment_id)
  WHERE original_payment_id IS NOT NULL;

ALTER TABLE public.org_order_refunds_dtl ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_order_refunds_dtl
  ON public.org_order_refunds_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 6. Permission seeds — payment config + cash drawer
-- -----------------------------------------------------------------------------
INSERT INTO sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('payments:configure',         'Configure Payments',        'إعداد المدفوعات',           'settings', 'Configure tenant payment methods, gateways and terminals', 'إعداد طرق الدفع والبوابات والأجهزة للمستأجر', 'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('payments:view_methods',      'View Payment Methods',      'عرض طرق الدفع',             'read',     'View available and configured payment methods',            'عرض طرق الدفع المتاحة والمعدّة',              'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:view',           'View Cash Drawers',         'عرض الصناديق النقدية',      'read',     'View cash drawers and their sessions',                    'عرض الصناديق النقدية وجلساتها',               'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:open',           'Open Cash Drawer',          'فتح الصندوق النقدي',        'actions',  'Open a new cash drawer session',                          'فتح جلسة جديدة للصندوق النقدي',               'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:close',          'Close Cash Drawer',         'إغلاق الصندوق النقدي',      'actions',  'Close a cash drawer session with count reconciliation',   'إغلاق جلسة الصندوق مع مطابقة العد',           'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:cash_in',        'Cash In',                   'إيداع نقدي',                'actions',  'Record a cash-in movement in a drawer session',           'تسجيل حركة إيداع نقدي في جلسة الصندوق',      'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:cash_out',       'Cash Out',                  'سحب نقدي',                  'actions',  'Record a cash-out movement in a drawer session',          'تسجيل حركة سحب نقدي من جلسة الصندوق',        'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:cash_drop',      'Cash Drop',                 'تحويل نقدي للخزينة',        'actions',  'Record a cash drop to safe within a session',             'تسجيل تحويل نقدي للخزينة خلال الجلسة',        'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:view_movements', 'View Cash Movements',       'عرض الحركات النقدية',       'read',     'View the movement history of a drawer session',           'عرض سجل حركات جلسة الصندوق النقدي',           'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:force_close',    'Force Close Drawer',        'إغلاق إجباري للصندوق',      'actions',  'Force-close a stuck or abandoned drawer session',         'إغلاق جلسة صندوق عالقة أو متروكة إجباريًا',   'Payments', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- Assign to super_admin and tenant_admin
INSERT INTO sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin')
  AND p.code IN (
    'payments:configure', 'payments:view_methods',
    'cash_drawer:view', 'cash_drawer:open', 'cash_drawer:close',
    'cash_drawer:cash_in', 'cash_drawer:cash_out', 'cash_drawer:cash_drop',
    'cash_drawer:view_movements', 'cash_drawer:force_close'
  )
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
