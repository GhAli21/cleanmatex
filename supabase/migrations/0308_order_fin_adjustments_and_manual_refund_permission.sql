-- =============================================================================
-- Migration 0308: Order Fin adjustments ledger + manual refund exception permission
-- Purpose:
-- 1. Create org_order_adjustments_dtl as an additive tenant-scoped ledger for
--    approved financial corrections that do not belong in discount/payment/
--    refund fact tables.
-- 2. Seed the elevated refund permission orders:refunds:manual_exception and
--    map it only to privileged roles.
-- Notes:
-- - This migration is additive only.
-- - Adjustments remain separate from the order snapshot header; services must
--   continue to recalculate header values from the supported fact rows.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. org_order_adjustments_dtl
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_order_adjustments_dtl (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL,
  adjustment_type   TEXT NOT NULL,
  amount            DECIMAL(19,4) NOT NULL,
  currency_code     TEXT NOT NULL,
  currency_ex_rate  numeric(22,10) not null default 1,
  reason            TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT,
  updated_info      TEXT,
  rec_status        SMALLINT NOT NULL DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_org_ord_adj_amount_nonzero
    CHECK (amount <> 0),

  CONSTRAINT chk_org_ord_adj_status
    CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REJECTED', 'VOIDED'))
);

COMMENT ON TABLE public.org_order_adjustments_dtl IS
  'Order-level financial corrections ledger. Used for controlled manual adjustments outside payment, refund, and commercial discount facts.';

COMMENT ON COLUMN public.org_order_adjustments_dtl.adjustment_type IS
  'Business reason classifier for the adjustment, e.g. PRICE_CORRECTION, ROUNDING_CORRECTION, WRITE_OFF.';

COMMENT ON COLUMN public.org_order_adjustments_dtl.metadata IS
  'Flexible JSONB payload for approval context, external references, voucher links, and audit breadcrumbs.';

CREATE INDEX IF NOT EXISTS idx_org_ord_adj_tenant
  ON public.org_order_adjustments_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_ord_adj_order
  ON public.org_order_adjustments_dtl (tenant_org_id, order_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_ord_adj_status
  ON public.org_order_adjustments_dtl (tenant_org_id, status, created_at DESC);

ALTER TABLE public.org_order_adjustments_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_order_adjustments_dtl
  ON public.org_order_adjustments_dtl;

CREATE POLICY tenant_isolation_org_order_adjustments_dtl
  ON public.org_order_adjustments_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- 2. Elevated manual refund exception permission
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
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
) VALUES (
  'orders:refunds_manual_exception',
  'Manual Refund Exception',
  'استثناء استرداد يدوي',
  'actions',
  'Create a refund without source lineage when a justified manual exception is required.',
  'إنشاء استرداد بدون ربط بالمصدر عند الحاجة إلى استثناء يدوي مبرر.',
  'Orders',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code = 'orders:refunds_manual_exception'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;
