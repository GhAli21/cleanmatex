-- =============================================================================
-- 0537_org_fx_rate_book.sql
-- Tenant Currency & FX, stage 5A-2 —
-- docs/features/Tenant_Currency_FX/implementation_plan_01.md §5.
--
-- Creates the tenant's own exchange-rate book and its supporting tables,
-- mirroring the HQ book (0531) but tenant-scoped:
--
--   1. org_fx_provider_cf      which HQ-curated providers (sys_fx_provider_cd)
--                               this tenant has activated, and for which
--                               currencies. No URL, no secret (T5).
--   2. org_fx_import_batch_mst one row per tenant import run (CSV, Excel, URL
--                               fetch, HQ copy): preview → commit.
--   3. org_fx_rate_mst         the tenant's own rate book. Same shape as the
--                               HQ book (0531 §6) plus tenant_org_id,
--                               provider_code and hq_rate_id (the HQ row a
--                               HQ_COPY rate was copied from — a snapshot, so
--                               a later HQ void never silently changes the
--                               tenant's history).
--
-- Design decisions carried from the plan (IDs in brackets):
--   - Rate direction, NUMERIC(22,10), lifecycle, inverse-as-generated-column,
--     one-live-rate partial unique index: identical to the HQ book (0531).
--   - origin/source/rate-type catalogs are shared with the HQ book (0531);
--     no tenant-specific catalog rows.
--   - C3: a rate pair must have one side be the tenant's base or reporting
--     currency (org_currency_cf), and the other side any active tenant
--     currency — enforced by trigger fn_ofrm_pair_check, so a stray pair the
--     UI never offered cannot be inserted by direct DB access either.
--   - HQ_COPY rows must carry hq_rate_id; URL_FETCH rows must carry
--     provider_code — enforced by CHECK, not just service-layer discipline.
--   - Self-approval allowed and audited (service layer, tenant's existing
--     audit pattern) — same as the HQ book.
--   - No rates are seeded here: rates are market/tenant data.
--
-- Not in this migration: 5A-3 (permissions/navigation/feature-flag —
-- separate migrations via their own skills), 5B services, 5C screen.
--
-- Reversal (forward-only): a future migration would DROP TRIGGER
-- trg_ofrm_pair_check + its function, then DROP TABLE, in order,
-- org_fx_rate_mst, org_fx_import_batch_mst, org_fx_provider_cf — all
-- RESTRICT. Lossless only while no tenant rate/import history exists.
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ── 1. org_fx_provider_cf ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_fx_provider_cf (
  id                UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  provider_code     TEXT NOT NULL,
  currency_codes    TEXT[] NOT NULL DEFAULT '{}',
  rate_type_code    TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetch_at     TIMESTAMPTZ,
  last_fetch_status TEXT,
  last_fetch_error  TEXT,
  rec_status        SMALLINT NOT NULL DEFAULT 1,
  rec_notes         TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT,
  updated_info      TEXT,
  CONSTRAINT pk_ofpc PRIMARY KEY (id),
  CONSTRAINT uq_ofpc_tenant_provider UNIQUE (tenant_org_id, provider_code),
  CONSTRAINT fk_ofpc_tenant      FOREIGN KEY (tenant_org_id)  REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofpc_provider    FOREIGN KEY (provider_code)  REFERENCES public.sys_fx_provider_cd(code),
  CONSTRAINT fk_ofpc_rate_type   FOREIGN KEY (rate_type_code) REFERENCES public.sys_fx_rate_type_cd(code),
  CONSTRAINT chk_ofpc_fetch_status CHECK (last_fetch_status IS NULL OR last_fetch_status IN ('SUCCESS', 'FAILED')),
  CONSTRAINT chk_ofpc_rec_status   CHECK (rec_status IN (0, 1, 2))
);

ALTER TABLE public.org_fx_provider_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_ofpc_tenant ON public.org_fx_provider_cf;
CREATE POLICY pol_ofpc_tenant ON public.org_fx_provider_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_fx_provider_cf IS
  'Which HQ-curated providers (sys_fx_provider_cd) this tenant has activated for URL rate fetching, and for which currencies. No URL or secret is stored here (T5) — those live on the HQ-curated provider row.';
COMMENT ON COLUMN public.org_fx_provider_cf.provider_code IS 'FK sys_fx_provider_cd. Tenants choose from HQ-curated providers only.';
COMMENT ON COLUMN public.org_fx_provider_cf.currency_codes IS 'Currencies this tenant fetches from this provider (subset of the provider''s supported currencies).';
COMMENT ON COLUMN public.org_fx_provider_cf.rate_type_code IS 'Rate type recorded on rates fetched from this provider. NULL = tenant FX default.';
COMMENT ON COLUMN public.org_fx_provider_cf.last_fetch_status IS 'Outcome of the most recent fetch attempt, for the tenant Providers screen.';

-- ── 2. org_fx_import_batch_mst ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_fx_import_batch_mst (
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id  UUID NOT NULL,
  origin_code    TEXT NOT NULL,
  provider_code  TEXT,
  file_name      TEXT,
  file_hash      TEXT,
  status         TEXT NOT NULL DEFAULT 'PREVIEWED',
  total_rows     INTEGER NOT NULL DEFAULT 0,
  valid_rows     INTEGER NOT NULL DEFAULT 0,
  invalid_rows   INTEGER NOT NULL DEFAULT 0,
  error_summary  JSONB NOT NULL DEFAULT '{}'::JSONB,
  preview_rows   JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata       JSONB NOT NULL DEFAULT '{}'::JSONB,
  rec_status     SMALLINT NOT NULL DEFAULT 1,
  rec_notes      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,
  updated_info   TEXT,
  CONSTRAINT pk_ofib PRIMARY KEY (id),
  CONSTRAINT fk_ofib_tenant   FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofib_origin   FOREIGN KEY (origin_code)   REFERENCES public.sys_fx_rate_origin_cd(code),
  CONSTRAINT fk_ofib_provider FOREIGN KEY (provider_code) REFERENCES public.sys_fx_provider_cd(code),
  CONSTRAINT chk_ofib_status  CHECK (status IN ('PREVIEWED', 'COMMITTED', 'FAILED', 'CANCELLED')),
  CONSTRAINT chk_ofib_counts  CHECK (total_rows >= 0 AND valid_rows >= 0 AND invalid_rows >= 0
                                      AND valid_rows + invalid_rows <= total_rows),
  CONSTRAINT chk_ofib_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE INDEX IF NOT EXISTS idx_ofib_tenant_created
  ON public.org_fx_import_batch_mst (tenant_org_id, created_at DESC);

ALTER TABLE public.org_fx_import_batch_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_ofib_tenant ON public.org_fx_import_batch_mst;
CREATE POLICY pol_ofib_tenant ON public.org_fx_import_batch_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_fx_import_batch_mst IS
  'One row per tenant rate-import run (CSV, Excel, URL fetch, HQ copy): preview → commit, per the fill-origins pipeline (Tenant_Currency_FX plan 01 §7.1).';
COMMENT ON COLUMN public.org_fx_import_batch_mst.origin_code IS 'How the batch was obtained (FK sys_fx_rate_origin_cd).';
COMMENT ON COLUMN public.org_fx_import_batch_mst.provider_code IS 'Provider fetched, for URL_FETCH batches (FK sys_fx_provider_cd).';
COMMENT ON COLUMN public.org_fx_import_batch_mst.file_hash IS 'SHA-256 of the uploaded file, to detect re-imports of the same file.';
COMMENT ON COLUMN public.org_fx_import_batch_mst.status IS 'PREVIEWED → COMMITTED | CANCELLED; FAILED when parsing/validation fails.';
COMMENT ON COLUMN public.org_fx_import_batch_mst.error_summary IS 'Row-level validation errors (capped) from the preview step.';
COMMENT ON COLUMN public.org_fx_import_batch_mst.preview_rows IS 'Capped sample of parsed rows shown on the preview screen before commit.';

-- ── 3. org_fx_rate_mst — the tenant's own rate book ──────────────────────────

CREATE TABLE IF NOT EXISTS public.org_fx_rate_mst (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id       UUID NOT NULL,
  from_currency_code  TEXT NOT NULL,
  to_currency_code    TEXT NOT NULL,
  rate_type_code      TEXT NOT NULL,
  source_code         TEXT NOT NULL,
  origin_code         TEXT NOT NULL,
  provider_code       TEXT,
  rate_date           DATE NOT NULL,
  rate_value          NUMERIC(22,10) NOT NULL,
  inverse_rate_value  NUMERIC(22,10) GENERATED ALWAYS AS (ROUND(1 / rate_value, 10)) STORED,
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  source_reference    TEXT,
  import_batch_id     UUID,
  hq_rate_id          UUID,
  approved_at         TIMESTAMPTZ,
  approved_by         TEXT,
  rejected_at         TIMESTAMPTZ,
  rejected_by         TEXT,
  rejection_reason    TEXT,
  voided_at           TIMESTAMPTZ,
  voided_by           TEXT,
  void_reason         TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  rec_status          SMALLINT NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  CONSTRAINT pk_ofrm PRIMARY KEY (id),
  CONSTRAINT fk_ofrm_tenant     FOREIGN KEY (tenant_org_id)      REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofrm_from_ccy   FOREIGN KEY (from_currency_code) REFERENCES public.sys_currency_cd(code),
  CONSTRAINT fk_ofrm_to_ccy     FOREIGN KEY (to_currency_code)   REFERENCES public.sys_currency_cd(code),
  CONSTRAINT fk_ofrm_rate_type  FOREIGN KEY (rate_type_code)     REFERENCES public.sys_fx_rate_type_cd(code),
  CONSTRAINT fk_ofrm_source     FOREIGN KEY (source_code)        REFERENCES public.sys_exchange_rate_source_cd(code),
  CONSTRAINT fk_ofrm_origin     FOREIGN KEY (origin_code)        REFERENCES public.sys_fx_rate_origin_cd(code),
  CONSTRAINT fk_ofrm_provider   FOREIGN KEY (provider_code)      REFERENCES public.sys_fx_provider_cd(code),
  CONSTRAINT fk_ofrm_batch      FOREIGN KEY (import_batch_id)    REFERENCES public.org_fx_import_batch_mst(id),
  CONSTRAINT fk_ofrm_hq_rate    FOREIGN KEY (hq_rate_id)         REFERENCES public.sys_currency_exchange_rate_mst(id),
  CONSTRAINT chk_ofrm_pair      CHECK (from_currency_code <> to_currency_code),
  CONSTRAINT chk_ofrm_rate      CHECK (rate_value > 0),
  CONSTRAINT chk_ofrm_status    CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED', 'VOIDED')),
  CONSTRAINT chk_ofrm_approved  CHECK (status NOT IN ('APPROVED', 'VOIDED')
                                        OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
  CONSTRAINT chk_ofrm_rejected  CHECK (status <> 'REJECTED'
                                        OR (rejected_at IS NOT NULL AND rejected_by IS NOT NULL
                                            AND NULLIF(TRIM(rejection_reason), '') IS NOT NULL)),
  CONSTRAINT chk_ofrm_voided    CHECK (status <> 'VOIDED'
                                        OR (voided_at IS NOT NULL AND voided_by IS NOT NULL
                                            AND NULLIF(TRIM(void_reason), '') IS NOT NULL)),
  CONSTRAINT chk_ofrm_hq_copy   CHECK (origin_code <> 'HQ_COPY' OR hq_rate_id IS NOT NULL),
  CONSTRAINT chk_ofrm_url_fetch CHECK (origin_code <> 'URL_FETCH' OR provider_code IS NOT NULL),
  CONSTRAINT chk_ofrm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.org_fx_rate_mst IS
  'Tenant''s own exchange-rate book (Tenant_Currency_FX plan 01 §5). Same shape and lifecycle as the HQ book (sys_currency_exchange_rate_mst); tenant-scoped and authoritative for that tenant''s transactions. A tenant can be contractually bound to its own bank rate — HQ rates are a default, "Fill from HQ" only copies them in (hq_rate_id keeps the source, so a later HQ void never silently changes tenant history).';
COMMENT ON COLUMN public.org_fx_rate_mst.from_currency_code IS 'Currency being converted from (FK sys_currency_cd). C3: one side of the pair must be the tenant''s base/reporting currency, the other any active tenant currency (enforced by trg_ofrm_pair_check).';
COMMENT ON COLUMN public.org_fx_rate_mst.to_currency_code IS 'Currency being converted to (FK sys_currency_cd). Must differ from from_currency_code.';
COMMENT ON COLUMN public.org_fx_rate_mst.rate_type_code IS 'SPOT | CLOSING | MONTHLY_AVG | CORPORATE … (FK sys_fx_rate_type_cd, shared catalog with the HQ book).';
COMMENT ON COLUMN public.org_fx_rate_mst.source_code IS 'Publisher of the rate (FK sys_exchange_rate_source_cd, shared catalog).';
COMMENT ON COLUMN public.org_fx_rate_mst.origin_code IS 'How the row entered this tenant''s book: MANUAL, HQ_COPY, URL_FETCH, CSV_IMPORT, EXCEL_IMPORT (FK sys_fx_rate_origin_cd, shared catalog).';
COMMENT ON COLUMN public.org_fx_rate_mst.provider_code IS 'HQ-curated provider fetched from, for URL_FETCH rows (FK sys_fx_provider_cd). Required when origin_code = URL_FETCH.';
COMMENT ON COLUMN public.org_fx_rate_mst.rate_value IS 'Units of to_currency per 1 unit of from_currency. NUMERIC(22,10), > 0, never float.';
COMMENT ON COLUMN public.org_fx_rate_mst.inverse_rate_value IS 'Generated 1 / rate_value rounded to 10 dp. DISPLAY ONLY — conversions invert the direct rate at full precision at resolve time.';
COMMENT ON COLUMN public.org_fx_rate_mst.status IS 'DRAFT | APPROVED | REJECTED | VOIDED. Approved rows are never edited — corrected by void + new draft.';
COMMENT ON COLUMN public.org_fx_rate_mst.import_batch_id IS 'Import run that created the row (FK org_fx_import_batch_mst; NULL for manual entry).';
COMMENT ON COLUMN public.org_fx_rate_mst.hq_rate_id IS 'HQ reference rate this row was copied from (FK sys_currency_exchange_rate_mst). Required when origin_code = HQ_COPY; a snapshot, not a live link.';
COMMENT ON COLUMN public.org_fx_rate_mst.approved_by IS 'Tenant user who approved. May equal created_by (self-approval is allowed and audited).';
COMMENT ON COLUMN public.org_fx_rate_mst.rejection_reason IS 'Required when status = REJECTED.';
COMMENT ON COLUMN public.org_fx_rate_mst.void_reason IS 'Required when status = VOIDED.';
COMMENT ON COLUMN public.org_fx_rate_mst.rec_status IS '1=active, 0=soft-deleted (drafts only), 2=archived — never hard-delete.';

-- One live rate per tenant + pair/date/type/source.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofrm_live
  ON public.org_fx_rate_mst
     (tenant_org_id, from_currency_code, to_currency_code, rate_date, rate_type_code, source_code)
  WHERE status IN ('DRAFT', 'APPROVED') AND rec_status = 1;

-- Resolver hot path: latest approved rate on or before a date, for one tenant.
CREATE INDEX IF NOT EXISTS idx_ofrm_resolve
  ON public.org_fx_rate_mst
     (tenant_org_id, from_currency_code, to_currency_code, rate_type_code, rate_date DESC)
  WHERE status = 'APPROVED' AND rec_status = 1;

-- Admin list screen: newest first, filtered by status, for one tenant.
CREATE INDEX IF NOT EXISTS idx_ofrm_date
  ON public.org_fx_rate_mst (tenant_org_id, rate_date DESC, status)
  WHERE rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_ofrm_batch
  ON public.org_fx_rate_mst (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

ALTER TABLE public.org_fx_rate_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_ofrm_tenant ON public.org_fx_rate_mst;
CREATE POLICY pol_ofrm_tenant ON public.org_fx_rate_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- C3: one side of the pair must be the tenant's base/reporting currency; the
-- other side must be any active currency the tenant has (org_currency_cf).
-- Enforced in the DB so a pair the UI never offered cannot be inserted by
-- direct access either — the service layer's own C3 check is defense in depth.
CREATE OR REPLACE FUNCTION public.fn_ofrm_pair_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_is_role BOOLEAN;
  v_to_is_role   BOOLEAN;
  v_from_member  BOOLEAN;
  v_to_member    BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.org_currency_cf c
     WHERE c.tenant_org_id = NEW.tenant_org_id AND c.currency_code = NEW.from_currency_code
       AND c.is_active AND c.rec_status = 1 AND (c.is_base_currency OR c.is_reporting_currency)
  ) INTO v_from_is_role;

  SELECT EXISTS (
    SELECT 1 FROM public.org_currency_cf c
     WHERE c.tenant_org_id = NEW.tenant_org_id AND c.currency_code = NEW.to_currency_code
       AND c.is_active AND c.rec_status = 1 AND (c.is_base_currency OR c.is_reporting_currency)
  ) INTO v_to_is_role;

  SELECT EXISTS (
    SELECT 1 FROM public.org_currency_cf c
     WHERE c.tenant_org_id = NEW.tenant_org_id AND c.currency_code = NEW.from_currency_code
       AND c.is_active AND c.rec_status = 1
  ) INTO v_from_member;

  SELECT EXISTS (
    SELECT 1 FROM public.org_currency_cf c
     WHERE c.tenant_org_id = NEW.tenant_org_id AND c.currency_code = NEW.to_currency_code
       AND c.is_active AND c.rec_status = 1
  ) INTO v_to_member;

  IF NOT ((v_from_is_role AND v_to_member) OR (v_to_is_role AND v_from_member)) THEN
    RAISE EXCEPTION 'FX_RATE_PAIR_INVALID: tenant % rate pair %/% must have one side as the base/reporting currency and the other an active tenant currency', NEW.tenant_org_id, NEW.from_currency_code, NEW.to_currency_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ofrm_pair_check ON public.org_fx_rate_mst;
CREATE TRIGGER trg_ofrm_pair_check
  BEFORE INSERT OR UPDATE OF from_currency_code, to_currency_code ON public.org_fx_rate_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ofrm_pair_check();

COMMENT ON FUNCTION public.fn_ofrm_pair_check() IS
  'C3: rejects an org_fx_rate_mst pair unless one side is the tenant''s base/reporting currency (org_currency_cf) and the other is any active tenant currency (FX_RATE_PAIR_INVALID).';

COMMIT;
