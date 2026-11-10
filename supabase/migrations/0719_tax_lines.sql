-- =============================================================================
-- Migration: 0719_tax_lines.sql
-- Program:   Tax Engine T4 / M5 — the tax record
-- Plan:      docs/features/Tax_Config/TAX_ENGINE_PLAN.md §4.3, §6
-- Builds on: 0708 (doc types), 0712 (fn_audit_touch_row), 0718 (tax codes, rules, periods)
-- Purpose:
--   One row per tax applied to one source line of any document: the record that
--   returns, posting and tax documents are built from.
--     PROVISIONAL  the document can still change; rows are replaced with it
--     FINAL        the tax point has passed; rows never change, corrections are
--                  reversal rows
--   Nothing writes to this table yet, so existing behaviour does not change.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_tax_lines_tr (
  id                      UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id           UUID          NOT NULL,
  source_doc_type_code    TEXT          NOT NULL,
  source_doc_id           UUID          NOT NULL,
  source_doc_no           TEXT          NULL,
  source_doc_line_id      UUID          NULL,
  source_doc_sub_line_id  UUID          NULL,
  line_status             TEXT          NOT NULL DEFAULT 'PROVISIONAL',
  tax_point_at            TIMESTAMPTZ   NULL,
  tax_date                DATE          NOT NULL,
  tax_flow_code           TEXT          NOT NULL,
  branch_id               UUID          NULL,
  party_type              TEXT          NULL,
  party_id                UUID          NULL,
  tax_code                TEXT          NOT NULL,
  tax_profile_id          UUID          NULL,
  tax_rule_id             UUID          NULL,
  tax_category_code       TEXT          NOT NULL,
  exempt_reason_code      TEXT          NULL,
  calc_level              TEXT          NOT NULL DEFAULT 'LINE',
  rate                    DECIMAL(5,2)  NULL,
  fixed_amount            DECIMAL(19,4) NULL,
  taxable_amount          DECIMAL(19,4) NOT NULL,
  tax_amount              DECIMAL(19,4) NOT NULL,
  recoverable_amount      DECIMAL(19,4) NOT NULL DEFAULT 0,
  currency_code           TEXT          NOT NULL,
  base_currency_code      TEXT          NOT NULL,
  base_taxable_amount     DECIMAL(19,4) NOT NULL,
  base_tax_amount         DECIMAL(19,4) NOT NULL,
  fx_rate                 DECIMAL(22,10) NULL,
  fx_rate_date            DATE          NULL,
  fx_rate_source          TEXT          NULL,
  fx_rate_id              UUID          NULL,
  compound_base           BOOLEAN       NOT NULL DEFAULT false,
  applied_seq             SMALLINT      NOT NULL DEFAULT 1,
  reverses_tax_line_id    UUID          NULL,
  report_box_code         TEXT          NULL,
  period_id               UUID          NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by              TEXT          NULL,
  created_info            TEXT          NULL,
  updated_at              TIMESTAMPTZ   NULL,
  updated_by              TEXT          NULL,
  updated_info            TEXT          NULL,
  updated_count           INTEGER       NOT NULL DEFAULT 0,
  deleted_at              TIMESTAMPTZ   NULL,
  deleted_by              TEXT          NULL,
  deleted_info            TEXT          NULL,
  rec_status              SMALLINT      NOT NULL DEFAULT 1,
  rec_order               INTEGER       NULL,
  rec_notes               TEXT          NULL,
  is_active               BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT pk_org_tax_lines PRIMARY KEY (id),
  CONSTRAINT uq_otl_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT fk_otl_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_doc_type FOREIGN KEY (source_doc_type_code) REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_branch FOREIGN KEY (branch_id, tenant_org_id) REFERENCES public.org_branches_mst (id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_profile FOREIGN KEY (tenant_org_id, tax_profile_id) REFERENCES public.org_tax_profiles_cf (tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_rule FOREIGN KEY (tenant_org_id, tax_rule_id) REFERENCES public.org_tax_rules_cf (tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_category FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_currency FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_base_currency FOREIGN KEY (base_currency_code) REFERENCES public.sys_currency_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_reverses FOREIGN KEY (tenant_org_id, reverses_tax_line_id) REFERENCES public.org_tax_lines_tr (tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_otl_period FOREIGN KEY (tenant_org_id, period_id) REFERENCES public.org_tax_periods_mst (tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_otl_status CHECK (line_status IN ('PROVISIONAL', 'FINAL')),
  CONSTRAINT ck_otl_final CHECK (line_status <> 'FINAL' OR tax_point_at IS NOT NULL),
  CONSTRAINT ck_otl_flow CHECK (tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING')),
  CONSTRAINT ck_otl_calc_level CHECK (calc_level IN ('LINE', 'DOCUMENT')),
  CONSTRAINT ck_otl_party CHECK ((party_type IS NULL AND party_id IS NULL) OR (party_type IN ('CUSTOMER', 'SUPPLIER') AND party_id IS NOT NULL)),
  CONSTRAINT ck_otl_amount_kind CHECK (rate IS NULL OR fixed_amount IS NULL),
  CONSTRAINT ck_otl_rate CHECK (rate IS NULL OR (rate >= 0 AND rate <= 100)),
  CONSTRAINT ck_otl_recoverable CHECK (tax_flow_code = 'INPUT' OR recoverable_amount = 0),
  CONSTRAINT ck_otl_fx CHECK (
    (currency_code = base_currency_code AND base_taxable_amount = taxable_amount AND base_tax_amount = tax_amount
       AND fx_rate IS NULL AND fx_rate_date IS NULL AND fx_rate_source IS NULL AND fx_rate_id IS NULL)
    OR (currency_code <> base_currency_code AND fx_rate IS NOT NULL AND fx_rate > 0)
  ),
  CONSTRAINT ck_otl_reversal CHECK (reverses_tax_line_id IS NULL OR line_status = 'FINAL'),
  CONSTRAINT ck_otl_seq CHECK (applied_seq >= 1),
  CONSTRAINT ck_otl_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_tax_lines_tr IS 'One row per tax applied to one source line of any document. PROVISIONAL rows are replaced with the document; FINAL rows never change and are corrected by reversal rows. Returns, posting and tax documents read from here.';
COMMENT ON COLUMN public.org_tax_lines_tr.id IS 'Row id.';
COMMENT ON COLUMN public.org_tax_lines_tr.tenant_org_id IS 'Organization.';
COMMENT ON COLUMN public.org_tax_lines_tr.source_doc_type_code IS 'Type of the document that carries this tax (registry code).';
COMMENT ON COLUMN public.org_tax_lines_tr.source_doc_id IS 'Id of that document. No FK: the source table depends on the type.';
COMMENT ON COLUMN public.org_tax_lines_tr.source_doc_no IS 'Human-friendly number of the document, kept for reports.';
COMMENT ON COLUMN public.org_tax_lines_tr.source_doc_line_id IS 'Line of the document; NULL for a document-level tax.';
COMMENT ON COLUMN public.org_tax_lines_tr.source_doc_sub_line_id IS 'Sub-line (piece) of the line, when taxed per piece.';
COMMENT ON COLUMN public.org_tax_lines_tr.line_status IS 'PROVISIONAL while the document can change; FINAL from the tax point on.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_point_at IS 'Moment the tax became due. Required once FINAL.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_date IS 'Date the tax belongs to, used to pick the return period.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_flow_code IS 'OUTPUT (sales), INPUT (purchases) or WITHHOLDING.';
COMMENT ON COLUMN public.org_tax_lines_tr.branch_id IS 'Branch of the supply; NULL when the document has none.';
COMMENT ON COLUMN public.org_tax_lines_tr.party_type IS 'CUSTOMER or SUPPLIER; NULL for an anonymous sale.';
COMMENT ON COLUMN public.org_tax_lines_tr.party_id IS 'Id of the party. No FK: the table depends on party_type.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_code IS 'Tax code applied, kept even if the code is later retired.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_profile_id IS 'Exact tax code version applied. NULL only for old orders taxed from the retired organization rate.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_rule_id IS 'Rule that chose the code; NULL when no rule was involved (old orders, manual correction).';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_category_code IS 'Tax category at the time of calculation.';
COMMENT ON COLUMN public.org_tax_lines_tr.exempt_reason_code IS 'Exemption reason for a non-standard category.';
COMMENT ON COLUMN public.org_tax_lines_tr.calc_level IS 'LINE or DOCUMENT.';
COMMENT ON COLUMN public.org_tax_lines_tr.rate IS 'Percent applied; NULL for a fixed amount.';
COMMENT ON COLUMN public.org_tax_lines_tr.fixed_amount IS 'Fixed amount applied; NULL for a percent.';
COMMENT ON COLUMN public.org_tax_lines_tr.taxable_amount IS 'Base taxed, in the document currency. Negative on a reversal.';
COMMENT ON COLUMN public.org_tax_lines_tr.tax_amount IS 'Tax, in the document currency. Negative on a reversal.';
COMMENT ON COLUMN public.org_tax_lines_tr.recoverable_amount IS 'Part of the input tax that can be reclaimed; zero for other flows.';
COMMENT ON COLUMN public.org_tax_lines_tr.currency_code IS 'Document currency.';
COMMENT ON COLUMN public.org_tax_lines_tr.base_currency_code IS 'Base currency of the organization at the time.';
COMMENT ON COLUMN public.org_tax_lines_tr.base_taxable_amount IS 'taxable_amount in the base currency.';
COMMENT ON COLUMN public.org_tax_lines_tr.base_tax_amount IS 'tax_amount in the base currency.';
COMMENT ON COLUMN public.org_tax_lines_tr.fx_rate IS 'base_amount = amount × fx_rate. NULL when the currencies are the same.';
COMMENT ON COLUMN public.org_tax_lines_tr.fx_rate_date IS 'Date of the rate.';
COMMENT ON COLUMN public.org_tax_lines_tr.fx_rate_source IS 'Where the rate came from.';
COMMENT ON COLUMN public.org_tax_lines_tr.fx_rate_id IS 'Rate row used, when there is one.';
COMMENT ON COLUMN public.org_tax_lines_tr.compound_base IS 'True when the base included earlier taxes on the line.';
COMMENT ON COLUMN public.org_tax_lines_tr.applied_seq IS 'Order of this tax on the line (1 = first).';
COMMENT ON COLUMN public.org_tax_lines_tr.reverses_tax_line_id IS 'The FINAL line this row reverses, fully or partly.';
COMMENT ON COLUMN public.org_tax_lines_tr.report_box_code IS 'Return box this line reports in. FK arrives with the return boxes (M7).';
COMMENT ON COLUMN public.org_tax_lines_tr.period_id IS 'Return period, set when the line is finalized.';
COMMENT ON COLUMN public.org_tax_lines_tr.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_tax_lines_tr.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.org_tax_lines_tr.created_info IS 'Extra context about the creation.';
COMMENT ON COLUMN public.org_tax_lines_tr.updated_at IS 'When the row last changed (trigger).';
COMMENT ON COLUMN public.org_tax_lines_tr.updated_by IS 'Who last changed the row.';
COMMENT ON COLUMN public.org_tax_lines_tr.updated_info IS 'Extra context about the last change.';
COMMENT ON COLUMN public.org_tax_lines_tr.updated_count IS 'How many times the row changed (trigger).';
COMMENT ON COLUMN public.org_tax_lines_tr.deleted_at IS 'Soft-delete time. Not used on FINAL rows.';
COMMENT ON COLUMN public.org_tax_lines_tr.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_tax_lines_tr.deleted_info IS 'Why the row was soft-deleted.';
COMMENT ON COLUMN public.org_tax_lines_tr.rec_status IS 'Record status: 0 deleted, 1 active, 2 archived.';
COMMENT ON COLUMN public.org_tax_lines_tr.rec_order IS 'Optional manual order.';
COMMENT ON COLUMN public.org_tax_lines_tr.rec_notes IS 'Optional notes.';
COMMENT ON COLUMN public.org_tax_lines_tr.is_active IS 'False when the row is switched off.';

COMMENT ON CONSTRAINT uq_otl_tenant_id ON public.org_tax_lines_tr IS 'Tenant-scoped key for the reversal reference.';
COMMENT ON CONSTRAINT fk_otl_tenant ON public.org_tax_lines_tr IS 'Organization must exist.';
COMMENT ON CONSTRAINT fk_otl_doc_type ON public.org_tax_lines_tr IS 'Document type must be registered.';
COMMENT ON CONSTRAINT fk_otl_branch ON public.org_tax_lines_tr IS 'Branch of the same organization.';
COMMENT ON CONSTRAINT fk_otl_profile ON public.org_tax_lines_tr IS 'Tax code version of the same organization.';
COMMENT ON CONSTRAINT fk_otl_rule ON public.org_tax_lines_tr IS 'Tax rule of the same organization.';
COMMENT ON CONSTRAINT fk_otl_category ON public.org_tax_lines_tr IS 'Tax category must exist.';
COMMENT ON CONSTRAINT fk_otl_currency ON public.org_tax_lines_tr IS 'Document currency must exist.';
COMMENT ON CONSTRAINT fk_otl_base_currency ON public.org_tax_lines_tr IS 'Base currency must exist.';
COMMENT ON CONSTRAINT fk_otl_reverses ON public.org_tax_lines_tr IS 'A reversal points to a line of the same organization.';
COMMENT ON CONSTRAINT fk_otl_period ON public.org_tax_lines_tr IS 'Return period of the same organization.';
COMMENT ON CONSTRAINT ck_otl_status ON public.org_tax_lines_tr IS 'Allowed line statuses.';
COMMENT ON CONSTRAINT ck_otl_final ON public.org_tax_lines_tr IS 'A FINAL line records its tax point.';
COMMENT ON CONSTRAINT ck_otl_flow ON public.org_tax_lines_tr IS 'Allowed tax flows.';
COMMENT ON CONSTRAINT ck_otl_calc_level ON public.org_tax_lines_tr IS 'Allowed calculation levels.';
COMMENT ON CONSTRAINT ck_otl_party ON public.org_tax_lines_tr IS 'Party type and id are set together.';
COMMENT ON CONSTRAINT ck_otl_amount_kind ON public.org_tax_lines_tr IS 'A tax is a percent or a fixed amount, never both.';
COMMENT ON CONSTRAINT ck_otl_rate ON public.org_tax_lines_tr IS 'Rate is between 0 and 100.';
COMMENT ON CONSTRAINT ck_otl_recoverable ON public.org_tax_lines_tr IS 'Only input tax can be reclaimed.';
COMMENT ON CONSTRAINT ck_otl_fx ON public.org_tax_lines_tr IS 'Same currency: base equals amount and no rate. Different currency: a positive rate is required.';
COMMENT ON CONSTRAINT ck_otl_reversal ON public.org_tax_lines_tr IS 'A reversal is itself FINAL.';
COMMENT ON CONSTRAINT ck_otl_seq ON public.org_tax_lines_tr IS 'Sequence starts at 1.';
COMMENT ON CONSTRAINT ck_otl_rec_status ON public.org_tax_lines_tr IS 'Allowed record statuses.';

-- Indexes: the three read paths from the plan, then FK support.
CREATE INDEX IF NOT EXISTS idx_otl_source    ON public.org_tax_lines_tr (tenant_org_id, source_doc_type_code, source_doc_id);
CREATE INDEX IF NOT EXISTS idx_otl_date_flow ON public.org_tax_lines_tr (tenant_org_id, tax_date, tax_flow_code);
CREATE INDEX IF NOT EXISTS idx_otl_period    ON public.org_tax_lines_tr (tenant_org_id, period_id) WHERE period_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otl_profile   ON public.org_tax_lines_tr (tenant_org_id, tax_profile_id) WHERE tax_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otl_rule      ON public.org_tax_lines_tr (tenant_org_id, tax_rule_id) WHERE tax_rule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otl_reverses  ON public.org_tax_lines_tr (tenant_org_id, reverses_tax_line_id) WHERE reverses_tax_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otl_branch    ON public.org_tax_lines_tr (tenant_org_id, branch_id) WHERE branch_id IS NOT NULL;

-- A retried write must fail rather than double the provisional tax. FINAL rows are
-- not covered: a document can be taxed again after a full reversal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_otl_provisional
  ON public.org_tax_lines_tr (tenant_org_id, source_doc_type_code, source_doc_id, source_doc_line_id, source_doc_sub_line_id, applied_seq)
  NULLS NOT DISTINCT WHERE line_status = 'PROVISIONAL';

COMMENT ON INDEX public.idx_otl_source IS 'All tax lines of a document.';
COMMENT ON INDEX public.idx_otl_date_flow IS 'Tax lines by date and flow, for returns.';
COMMENT ON INDEX public.idx_otl_period IS 'Tax lines of a return period.';
COMMENT ON INDEX public.idx_otl_profile IS 'FK support; also the used-version check.';
COMMENT ON INDEX public.idx_otl_rule IS 'FK support.';
COMMENT ON INDEX public.idx_otl_reverses IS 'FK support; finds the reversals of a line.';
COMMENT ON INDEX public.idx_otl_branch IS 'FK support.';
COMMENT ON INDEX public.uq_otl_provisional IS 'One provisional row per document line, sub-line and tax position (NULLs compared as equal).';

-- FINAL rows are the legal record: no change, no delete. A closed period takes no new FINAL row.
CREATE OR REPLACE FUNCTION public.fn_otl_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.line_status = 'FINAL' THEN
      RAISE EXCEPTION 'TAX_LINE_FINAL: a final tax line cannot be deleted; post a reversal' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.line_status = 'FINAL' THEN
    RAISE EXCEPTION 'TAX_LINE_FINAL: a final tax line cannot be changed; post a reversal' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.line_status = 'FINAL' AND NEW.period_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.org_tax_periods_mst p
                  WHERE p.tenant_org_id = NEW.tenant_org_id AND p.id = NEW.period_id AND p.status = 'CLOSED') THEN
    RAISE EXCEPTION 'TAX_PERIOD_CLOSED: this tax period is closed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_otl_guard() IS
  'BEFORE INSERT/UPDATE/DELETE on org_tax_lines_tr: FINAL rows never change or disappear, and no row can become FINAL in a CLOSED period.';

DROP TRIGGER IF EXISTS trg_otl_guard ON public.org_tax_lines_tr;
CREATE TRIGGER trg_otl_guard BEFORE INSERT OR UPDATE OR DELETE ON public.org_tax_lines_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_otl_guard();
COMMENT ON TRIGGER trg_otl_guard ON public.org_tax_lines_tr IS 'Keeps FINAL rows immutable and respects closed periods.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_tax_lines_tr;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_tax_lines_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_tax_lines_tr IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.org_tax_lines_tr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_tax_lines_tr ON public.org_tax_lines_tr;
CREATE POLICY tenant_isolation_org_tax_lines_tr ON public.org_tax_lines_tr
  FOR ALL USING (tenant_org_id = (SELECT current_tenant_id())) WITH CHECK (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY tenant_isolation_org_tax_lines_tr ON public.org_tax_lines_tr IS 'Rows are visible and writable only for the current organization.';

REVOKE ALL ON public.org_tax_lines_tr FROM PUBLIC, anon;   -- tax records are never public

-- A code version with a tax line is in use, as promised in 0718.
CREATE OR REPLACE FUNCTION public.fn_tax_profile_is_used(p_tenant UUID, p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_order_items_dtl       WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_order_taxes_dtl       WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_order_item_pieces_dtl WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_order_charges_dtl     WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_tax_lines_tr          WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id);
$$;

COMMENT ON FUNCTION public.fn_tax_profile_is_used(UUID, UUID) IS
  'True when a tax code version is referenced by any order row or tax line of the organization.';

COMMIT;
