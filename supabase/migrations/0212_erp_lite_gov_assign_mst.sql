-- ==================================================================
-- Migration: 0212_erp_lite_gov_assign_mst.sql
-- Purpose: Add explicit tenant-effective governance assignment table and
--          resolution view. Closes DELTA-GOV-001 and DELTA-GOV-002.
--
-- Without this table the posting engine has no deterministic way to
-- select the correct governance package for a tenant at runtime.
-- All tenants default to a single PUBLISHED baseline (Pattern A), but
-- the assignment record makes that selection explicit and auditable.
--
-- New objects:
--   public.org_fin_gov_assign_mst   -- tenant <-> gov-package binding
--   public.vw_fin_effective_gov_for_tenant  -- convenience resolution view
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Table: org_fin_gov_assign_mst
-- One active assignment per tenant determines which published
-- governance package the posting engine resolves rules from.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_fin_gov_assign_mst (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID        NOT NULL,
  pkg_id            UUID        NOT NULL,
  -- assignment_mode: MANUAL (HQ explicitly assigned) or AUTO (system default)
  assignment_mode   VARCHAR(20) NOT NULL DEFAULT 'AUTO',
  status_code       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  effective_from    DATE,
  effective_to      DATE,
  -- is_current: true for exactly one ACTIVE row per tenant
  is_current        BOOLEAN     NOT NULL DEFAULT false,
  approved_at       TIMESTAMP,
  approved_by       VARCHAR(120),
  created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        VARCHAR(120),
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        VARCHAR(120),
  updated_info      TEXT,
  rec_status        SMALLINT    NOT NULL DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         VARCHAR(200),
  is_active         BOOLEAN     NOT NULL DEFAULT true,

  -- referential integrity
  CONSTRAINT fk_ofga_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofga_pkg FOREIGN KEY (pkg_id)
    REFERENCES public.sys_fin_gov_pkg_mst(pkg_id),

  -- status values mirror governance package convention
  CONSTRAINT chk_ofga_status CHECK (
    status_code IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED')
  ),
  CONSTRAINT chk_ofga_mode CHECK (
    assignment_mode IN ('MANUAL', 'AUTO')
  ),
  -- effective_to must be >= effective_from when both are provided
  CONSTRAINT chk_ofga_eff CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  )
);

COMMENT ON TABLE public.org_fin_gov_assign_mst IS
  'Explicit tenant-effective governance package assignment. Exactly one ACTIVE '
  'is_current row per tenant is the runtime posting engine source of truth for '
  'which published governance package governs journal posting for that tenant.';
COMMENT ON COLUMN public.org_fin_gov_assign_mst.is_current IS
  'True for the single current ACTIVE assignment. Enforced by unique partial index.';
COMMENT ON COLUMN public.org_fin_gov_assign_mst.assignment_mode IS
  'MANUAL: explicitly set by HQ. AUTO: created by system default provisioning logic.';
COMMENT ON COLUMN public.org_fin_gov_assign_mst.status_code IS
  'DRAFT→ACTIVE on HQ approval. SUPERSEDED when replaced. INACTIVE to soft-disable.';

-- Hard constraint: only one is_current=true ACTIVE row per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofga_current_tenant
  ON public.org_fin_gov_assign_mst(tenant_org_id)
  WHERE is_current = true
    AND status_code = 'ACTIVE'
    AND is_active = true
    AND rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_ofga_tenant
  ON public.org_fin_gov_assign_mst(tenant_org_id, status_code, is_active);

CREATE INDEX IF NOT EXISTS idx_ofga_pkg
  ON public.org_fin_gov_assign_mst(pkg_id, status_code);

-- RLS: tenant runtime table — must be tenant-isolated
ALTER TABLE public.org_fin_gov_assign_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofga ON public.org_fin_gov_assign_mst;
CREATE POLICY tenant_isolation_ofga ON public.org_fin_gov_assign_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ------------------------------------------------------------------
-- View: vw_fin_effective_gov_for_tenant
-- Returns the single current effective governance package per tenant.
-- Posting engine reads this to resolve rules deterministically.
-- Returns no row for a tenant that has no current active assignment.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_fin_effective_gov_for_tenant AS
SELECT
  a.tenant_org_id,
  a.id                    AS assignment_id,
  a.pkg_id,
  p.pkg_code,
  p.version_no            AS pkg_version,
  p.compat_version,
  p.status_code           AS pkg_status_code,
  p.effective_from        AS pkg_effective_from,
  p.effective_to          AS pkg_effective_to,
  a.effective_from        AS assign_effective_from,
  a.effective_to          AS assign_effective_to,
  a.assignment_mode,
  a.approved_at,
  a.approved_by
FROM public.org_fin_gov_assign_mst a
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_id = a.pkg_id
WHERE a.is_current   = true
  AND a.status_code  = 'ACTIVE'
  AND a.is_active    = true
  AND a.rec_status   = 1
  AND p.status_code  = 'PUBLISHED'
  AND p.rec_status   = 1;

COMMENT ON VIEW public.vw_fin_effective_gov_for_tenant IS
  'Current effective governance package per tenant. Used by the posting engine '
  'to resolve the single authoritative package for rule/policy selection. '
  'Returns zero rows when no valid assignment exists (finance posting will fail).';

COMMIT;
