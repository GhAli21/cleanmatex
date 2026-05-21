-- ==================================================================
-- 0312_org_card_brand_cf_and_seed.sql
-- Purpose:
--   1. Create org_card_brand_cf as the tenant-scoped mirror of
--      sys_card_brand_cd so tenants can override labels, descriptions,
--      ordering, and active state without changing HQ lookup rows.
--   2. Seed every active tenant with one row per active HQ card brand.
--      This keeps payment setup consistent across tenants at rollout.
-- Safety:
--   - Tenant rows are inserted with ON CONFLICT DO NOTHING so reruns do
--     not overwrite tenant-managed customizations.
--   - RLS is enabled because card brand configuration is tenant-scoped.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) org_card_brand_cf — tenant card brand configuration
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_card_brand_cf (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  card_brand_code VARCHAR(50) NOT NULL,
  name          VARCHAR(250) NOT NULL,
  name2         VARCHAR(250),
  description   TEXT,
  description2  TEXT,
  rec_order     INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    VARCHAR(120),
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    VARCHAR(120),
  updated_info  TEXT,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_notes     VARCHAR(200),

  CONSTRAINT fk_ocb_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_ocb_brand
    FOREIGN KEY (card_brand_code)
    REFERENCES public.sys_card_brand_cd(code)
    ON DELETE RESTRICT,

  CONSTRAINT uq_ocb_tenant_brand
    UNIQUE (tenant_org_id, card_brand_code),

  CONSTRAINT chk_ocb_rec_status
    CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.org_card_brand_cf IS 'Tenant-managed card brand configuration copied from sys_card_brand_cd and safely overridable per tenant.';

CREATE INDEX IF NOT EXISTS idx_ocb_tenant
  ON public.org_card_brand_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ocb_tenant_act
  ON public.org_card_brand_cf (tenant_org_id, is_active, rec_order);

ALTER TABLE public.org_card_brand_cf ENABLE ROW LEVEL SECURITY;

-- RLS keeps tenant-admin edits isolated even though card brand codes are
-- sourced from HQ lookups shared by all tenants.
DROP POLICY IF EXISTS rls_ocb_tenant ON public.org_card_brand_cf;

CREATE POLICY rls_ocb_tenant
  ON public.org_card_brand_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ------------------------------------------------------------------
-- 2) Seed org_card_brand_cf from active HQ brands for active tenants
-- ------------------------------------------------------------------
INSERT INTO public.org_card_brand_cf (
  tenant_org_id,
  card_brand_code,
  name,
  name2,
  description,
  description2,
  rec_order,
  is_active,
  created_by,
  created_info,
  rec_status
)
SELECT
  t.id,
  s.code,
  s.name,
  s.name2,
  s.description,
  s.description2,
  s.display_order,
  true,
  '0312_seed',
  'Seeded from sys_card_brand_cd for tenant payment setup',
  1
FROM public.org_tenants_mst t
CROSS JOIN public.sys_card_brand_cd s
WHERE t.is_active = true
  AND COALESCE(t.rec_status, 1) = 1
  AND s.is_active = true
  AND COALESCE(s.rec_status, 1) = 1
ON CONFLICT (tenant_org_id, card_brand_code) DO NOTHING;

COMMIT;
