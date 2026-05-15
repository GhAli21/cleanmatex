-- =============================================================================
-- Migration 0269: Payment Config Client Layer — Core Tables
-- Creates tenant-level payment method configuration, branch overrides,
-- and POS terminal management tables.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. org_payment_methods_cf
--    Tenant-level enablement and configuration of HQ payment methods.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_payment_methods_cf (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,

  -- HQ references
  payment_method_code             TEXT NOT NULL REFERENCES public.sys_payment_method_cd(payment_method_code),
  gateway_code                    TEXT REFERENCES public.sys_payment_gateway_cd(code),

  -- Bilingual display
  display_name                    TEXT NOT NULL,
  display_name2                   TEXT,
  description                     TEXT,
  description2                    TEXT,

  -- Nature classification
  payment_nature                  TEXT NOT NULL DEFAULT 'REAL_PAYMENT',

  -- Master toggle
  is_enabled                      BOOLEAN NOT NULL DEFAULT TRUE,

  -- Channel availability
  allowed_in_pos                  BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_in_customer_app         BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_in_staff_app            BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_in_admin_app            BOOLEAN NOT NULL DEFAULT TRUE,

  -- Purpose availability
  allowed_for_pay_now             BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_for_pay_on_collection   BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_for_invoice_payment     BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_for_refund              BOOLEAN NOT NULL DEFAULT TRUE,

  -- Payment behaviour
  supports_partial_payment        BOOLEAN NOT NULL DEFAULT TRUE,
  supports_overpayment            BOOLEAN NOT NULL DEFAULT FALSE,
  supports_change_return          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Validation requirements
  requires_reference              BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval               BOOLEAN NOT NULL DEFAULT FALSE,

  -- Amount limits
  min_amount                      DECIMAL(19,4),
  max_amount                      DECIMAL(19,4),
  currency_code                   TEXT,

  -- Fee config
  fee_type                        TEXT NOT NULL DEFAULT 'NONE',
  fee_amount                      DECIMAL(19,4) NOT NULL DEFAULT 0,
  fee_rate                        DECIMAL(9,4) NOT NULL DEFAULT 0,

  -- Gateway credentials (secrets masked on read — keys suffixed *_key/*_secret/*_webhook_secret)
  gateway_config                  JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- UI / validation config
  ui_config                       JSONB NOT NULL DEFAULT '{}'::JSONB,
  validation_rules                JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Ordering
  display_order                   INTEGER NOT NULL DEFAULT 0,

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

  -- Constraints
  CONSTRAINT chk_org_pay_methods_cf_nature
    CHECK (payment_nature IN ('REAL_PAYMENT','CREDIT_APPLICATION','AR_ALLOCATION','DEFERRED_SETTLEMENT','INTERNAL_ADJUSTMENT')),

  CONSTRAINT chk_org_pay_methods_cf_fee_type
    CHECK (fee_type IN ('NONE','FIXED','PERCENTAGE')),

  CONSTRAINT chk_org_pay_methods_cf_amounts
    CHECK (
      (min_amount IS NULL OR min_amount >= 0)
      AND (max_amount IS NULL OR max_amount >= 0)
      AND (max_amount IS NULL OR min_amount IS NULL OR max_amount >= min_amount)
    ),

  CONSTRAINT chk_org_pay_methods_cf_fees
    CHECK (fee_amount >= 0 AND fee_rate >= 0)
);

-- Expression-based unique: one method_code+gateway combo per tenant (COALESCE not allowed inline)
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_payment_methods_cf
  ON public.org_payment_methods_cf (tenant_org_id, payment_method_code, COALESCE(gateway_code, ''));

CREATE INDEX IF NOT EXISTS idx_org_pay_methods_cf_tenant
  ON public.org_payment_methods_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_pay_methods_cf_t_active
  ON public.org_payment_methods_cf (tenant_org_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_org_pay_methods_cf_method
  ON public.org_payment_methods_cf (payment_method_code);

CREATE INDEX IF NOT EXISTS idx_org_pay_methods_cf_gw
  ON public.org_payment_methods_cf (gateway_code)
  WHERE gateway_code IS NOT NULL;

ALTER TABLE public.org_payment_methods_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_payment_methods_cf
  ON public.org_payment_methods_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 2. org_branch_payment_methods_cf
--    Branch-level overrides of tenant payment method configuration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_branch_payment_methods_cf (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                       UUID NOT NULL,

  org_payment_method_id           UUID NOT NULL REFERENCES public.org_payment_methods_cf(id) ON DELETE CASCADE,

  -- Override toggle (NULL = inherit from tenant method)
  is_enabled                      BOOLEAN,

  -- Channel overrides (NULL = inherit)
  allowed_in_pos                  BOOLEAN,
  allowed_in_customer_app         BOOLEAN,
  allowed_in_staff_app            BOOLEAN,

  -- Purpose overrides (NULL = inherit)
  allowed_for_pay_now             BOOLEAN,
  allowed_for_pay_on_collection   BOOLEAN,
  allowed_for_invoice_payment     BOOLEAN,
  allowed_for_refund              BOOLEAN,

  -- Operational requirements
  cash_drawer_required            BOOLEAN NOT NULL DEFAULT FALSE,
  terminal_required               BOOLEAN NOT NULL DEFAULT FALSE,

  -- Amount overrides (NULL = inherit)
  min_amount                      DECIMAL(19,4),
  max_amount                      DECIMAL(19,4),

  -- Branch-specific gateway config (e.g. merchant ID per branch)
  branch_gateway_config           JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

  display_order                   INTEGER NOT NULL DEFAULT 0,

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

  CONSTRAINT uq_org_branch_pay_methods_cf
    UNIQUE (tenant_org_id, branch_id, org_payment_method_id),

  CONSTRAINT chk_org_br_pay_methods_amounts
    CHECK (
      (min_amount IS NULL OR min_amount >= 0)
      AND (max_amount IS NULL OR max_amount >= 0)
      AND (max_amount IS NULL OR min_amount IS NULL OR max_amount >= min_amount)
    )
);

CREATE INDEX IF NOT EXISTS idx_org_br_pay_methods_tenant
  ON public.org_branch_payment_methods_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_br_pay_methods_branch
  ON public.org_branch_payment_methods_cf (tenant_org_id, branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_br_pay_methods_method
  ON public.org_branch_payment_methods_cf (org_payment_method_id);

ALTER TABLE public.org_branch_payment_methods_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_branch_payment_methods_cf
  ON public.org_branch_payment_methods_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- 3. org_payment_terminals_cf
--    Physical / logical payment terminals per tenant/branch.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_payment_terminals_cf (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id                   UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  branch_id                       UUID,

  terminal_code                   TEXT NOT NULL,
  terminal_name                   TEXT NOT NULL,
  terminal_name2                  TEXT,

  terminal_type                   TEXT NOT NULL,
  gateway_code                    TEXT REFERENCES public.sys_payment_gateway_cd(code),

  serial_no                       TEXT,
  merchant_id                     TEXT,
  terminal_external_id            TEXT,

  is_enabled                      BOOLEAN NOT NULL DEFAULT TRUE,

  config                          JSONB NOT NULL DEFAULT '{}'::JSONB,
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

  CONSTRAINT uq_org_pay_terminals_cf_code
    UNIQUE (tenant_org_id, terminal_code),

  CONSTRAINT chk_org_pay_terminals_type
    CHECK (terminal_type IN ('POS_CARD_TERMINAL','CASH_DRAWER','ONLINE_GATEWAY','BANK_DEVICE','OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_org_pay_terminals_tenant
  ON public.org_payment_terminals_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_pay_terminals_branch
  ON public.org_payment_terminals_cf (tenant_org_id, branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_pay_terminals_gw
  ON public.org_payment_terminals_cf (gateway_code)
  WHERE gateway_code IS NOT NULL;

ALTER TABLE public.org_payment_terminals_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_payment_terminals_cf
  ON public.org_payment_terminals_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());


COMMIT;
