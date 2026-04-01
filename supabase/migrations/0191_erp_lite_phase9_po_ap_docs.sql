-- ==================================================================
-- Migration: 0191_erp_lite_phase9_po_ap_docs.sql
-- Purpose: Create ERP-Lite Phase 9 PO and AP invoice document foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 9 - V2 Treasury + Suppliers + AP/PO
-- Notes: Schema-only foundation. No receiving, posting, or workflow logic here.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_po_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  branch_id UUID,
  po_no VARCHAR(40) NOT NULL,
  po_date DATE NOT NULL,
  expected_date DATE,
  currency_code VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(19, 4) NOT NULL DEFAULT 1,
  subtotal_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  status_code VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_ofpo_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofpo_no UNIQUE (tenant_org_id, po_no),
  CONSTRAINT fk_ofpo_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofpo_supp FOREIGN KEY (supplier_id, tenant_org_id)
    REFERENCES public.org_fin_supp_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofpo_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofpo_tot CHECK (
    subtotal_amount >= 0
    AND tax_amount >= 0
    AND total_amount >= 0
    AND total_amount = subtotal_amount + tax_amount
  ),
  CONSTRAINT chk_ofpo_stat CHECK (
    status_code IN ('DRAFT', 'APPROVED', 'ISSUED', 'PARTIAL', 'CLOSED', 'CANCELLED')
  )
);

COMMENT ON TABLE public.org_fin_po_mst IS
  'Tenant purchase-order master supporting supplier procurement lifecycle.';

CREATE INDEX IF NOT EXISTS idx_ofpo_tenant
  ON public.org_fin_po_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofpo_supp
  ON public.org_fin_po_mst(tenant_org_id, supplier_id, po_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofpo_stat
  ON public.org_fin_po_mst(tenant_org_id, status_code, is_active);

CREATE TABLE IF NOT EXISTS public.org_fin_po_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  po_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  branch_id UUID,
  usage_code_id UUID,
  description TEXT NOT NULL,
  description2 TEXT,
  qty_ordered DECIMAL(19, 4) NOT NULL DEFAULT 0,
  qty_received DECIMAL(19, 4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(19, 4) NOT NULL DEFAULT 0,
  net_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  gross_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_ofpd_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofpd_line UNIQUE (tenant_org_id, po_id, line_no),
  CONSTRAINT fk_ofpd_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofpd_po FOREIGN KEY (po_id, tenant_org_id)
    REFERENCES public.org_fin_po_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofpd_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofpd_usage FOREIGN KEY (usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT chk_ofpd_line CHECK (line_no >= 1),
  CONSTRAINT chk_ofpd_qty CHECK (qty_ordered >= 0 AND qty_received >= 0),
  CONSTRAINT chk_ofpd_amt CHECK (
    unit_price >= 0
    AND net_amount >= 0
    AND tax_amount >= 0
    AND gross_amount >= 0
    AND gross_amount = net_amount + tax_amount
  )
);

COMMENT ON TABLE public.org_fin_po_dtl IS
  'Tenant purchase-order detail lines supporting later receiving and AP traceability.';

CREATE INDEX IF NOT EXISTS idx_ofpd_tenant
  ON public.org_fin_po_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofpd_po
  ON public.org_fin_po_dtl(tenant_org_id, po_id, line_no);

CREATE TABLE IF NOT EXISTS public.org_fin_ap_inv_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  branch_id UUID,
  po_id UUID,
  ap_inv_no VARCHAR(40) NOT NULL,
  supplier_inv_no VARCHAR(80),
  invoice_date DATE NOT NULL,
  due_date DATE,
  currency_code VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(19, 4) NOT NULL DEFAULT 1,
  subtotal_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  open_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  status_code VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_ofai_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofai_no UNIQUE (tenant_org_id, ap_inv_no),
  CONSTRAINT fk_ofai_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofai_supp FOREIGN KEY (supplier_id, tenant_org_id)
    REFERENCES public.org_fin_supp_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofai_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofai_po FOREIGN KEY (po_id, tenant_org_id)
    REFERENCES public.org_fin_po_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofai_amt CHECK (
    subtotal_amount >= 0
    AND tax_amount >= 0
    AND total_amount >= 0
    AND open_amount >= 0
    AND total_amount = subtotal_amount + tax_amount
    AND open_amount <= total_amount
  ),
  CONSTRAINT chk_ofai_stat CHECK (
    status_code IN ('DRAFT', 'POSTED', 'PARTIAL', 'PAID', 'VOID')
  ),
  CONSTRAINT chk_ofai_due CHECK (
    due_date IS NULL
    OR due_date >= invoice_date
  )
);

COMMENT ON TABLE public.org_fin_ap_inv_mst IS
  'Tenant AP invoice master supporting supplier payables and later AP aging.';

CREATE INDEX IF NOT EXISTS idx_ofai_tenant
  ON public.org_fin_ap_inv_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofai_supp
  ON public.org_fin_ap_inv_mst(tenant_org_id, supplier_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofai_stat
  ON public.org_fin_ap_inv_mst(tenant_org_id, status_code, due_date);

CREATE TABLE IF NOT EXISTS public.org_fin_ap_inv_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  ap_inv_id UUID NOT NULL,
  po_line_id UUID,
  line_no INTEGER NOT NULL,
  branch_id UUID,
  usage_code_id UUID,
  description TEXT NOT NULL,
  description2 TEXT,
  net_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  gross_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_ofad_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofad_line UNIQUE (tenant_org_id, ap_inv_id, line_no),
  CONSTRAINT fk_ofad_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofad_inv FOREIGN KEY (ap_inv_id, tenant_org_id)
    REFERENCES public.org_fin_ap_inv_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofad_po FOREIGN KEY (po_line_id, tenant_org_id)
    REFERENCES public.org_fin_po_dtl(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofad_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofad_usage FOREIGN KEY (usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT chk_ofad_line CHECK (line_no >= 1),
  CONSTRAINT chk_ofad_amt CHECK (
    net_amount >= 0
    AND tax_amount >= 0
    AND gross_amount >= 0
    AND gross_amount = net_amount + tax_amount
  )
);

COMMENT ON TABLE public.org_fin_ap_inv_dtl IS
  'Tenant AP invoice detail supporting supplier-invoice to PO-line traceability.';

CREATE INDEX IF NOT EXISTS idx_ofad_tenant
  ON public.org_fin_ap_inv_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofad_inv
  ON public.org_fin_ap_inv_dtl(tenant_org_id, ap_inv_id, line_no);

ALTER TABLE public.org_fin_po_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_po_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_ap_inv_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_ap_inv_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofpo ON public.org_fin_po_mst;
CREATE POLICY tenant_isolation_ofpo ON public.org_fin_po_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofpd ON public.org_fin_po_dtl;
CREATE POLICY tenant_isolation_ofpd ON public.org_fin_po_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofai ON public.org_fin_ap_inv_mst;
CREATE POLICY tenant_isolation_ofai ON public.org_fin_ap_inv_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofad ON public.org_fin_ap_inv_dtl;
CREATE POLICY tenant_isolation_ofad ON public.org_fin_ap_inv_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;

