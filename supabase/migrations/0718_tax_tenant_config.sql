-- =============================================================================
-- Migration: 0718_tax_tenant_config.sql
-- Program:   Tax Engine T3 / M3 — tenant tax configuration
-- Plan:      docs/features/Tax_Config/TAX_ENGINE_PLAN.md §4 (L2–L5), §4.1, §4.7, §6
-- Builds on: 0712_tax_kits_catalog.sql (kits, starter packages, party classes,
--            fn_audit_touch_row)
-- Purpose:
--   Gives every organization its own copy of a country tax kit, so it can be
--   reviewed, confirmed and (in Advanced mode) adjusted.
--     org_tax_config_cf          one row per organization: chosen package, kit
--                                version, Basic/Advanced, status (pending → active)
--     org_tax_profiles_cf        evolved into versioned tax codes (tax_code,
--                                version_no, category, flow, recoverable %, source …)
--     org_tax_item_classes_cf    item tax classes copied from the kit
--     org_tax_rules_cf           which tax codes apply (match criteria)
--     org_tax_rule_codes_dtl     ordered tax codes a rule yields
--     org_tax_periods_mst        tax periods (open / closed) for returns (T7)
--     org_product_data_mst       + tax_item_class_code
--     org_branches_mst           + emirate_code (UAE return splits sales by emirate)
--     org_customers_mst / org_fin_supp_mst  + tax_party_class_code, tax_country
--     fn_tax_kit_apply()         copies a package's kit into an organization
--                                (pending candidate; idempotent; reports conflicts)
--     fn_tax_config_confirm()    readiness check + activation
--   At the end every organization without a config gets a pending candidate
--   from its starter package (full seed rule).
-- Not changed yet (later steps):
--   Today's order tax engine (lib/commercial/tax.ts) still picks profiles by
--   is_default / applies_to; kit rows are inserted with is_default = false and
--   applies_to NULL, so they do not change any order tax until T4 switches the
--   engine to rules. Legacy applies_to / is_default conversion = M4.
--   Permissions / navigation rows for the new screens ship with those screens.
-- Rollback: drop the two functions and the guard/mark functions; drop the new
--   columns on products, branches, customers, suppliers; drop tables in reverse
--   order (RESTRICT); drop the added profile columns / constraints / triggers;
--   created_by / updated_by on profiles can stay TEXT (uuid text is valid).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Organization tax configuration ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_tax_config_cf (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id      UUID        NOT NULL,
  starter_pkg_code   TEXT        NOT NULL,
  kit_code           TEXT        NOT NULL,
  kit_version_id     UUID        NOT NULL,
  segment_code       TEXT        NOT NULL,
  setup_mode         TEXT        NOT NULL DEFAULT 'BASIC',
  status             TEXT        NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  tax_enabled        BOOLEAN     NOT NULL DEFAULT false,
  applied_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by         TEXT        NOT NULL,
  last_apply_summary JSONB       NULL,
  confirmed_at       TIMESTAMPTZ NULL,
  confirmed_by       TEXT        NULL,
  confirm_note       TEXT        NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by         TEXT        NULL,
  created_info       TEXT        NULL,
  updated_at         TIMESTAMPTZ NULL,
  updated_by         TEXT        NULL,
  updated_info       TEXT        NULL,
  updated_count      INTEGER     NOT NULL DEFAULT 0,
  deleted_at         TIMESTAMPTZ NULL,
  deleted_by         TEXT        NULL,
  deleted_info       TEXT        NULL,
  rec_status         SMALLINT    NOT NULL DEFAULT 1,
  rec_order          INTEGER     NULL,
  rec_notes          TEXT        NULL,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_tax_config PRIMARY KEY (id),
  CONSTRAINT uq_otc_tenant UNIQUE (tenant_org_id),
  CONSTRAINT fk_otc_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otc_pkg FOREIGN KEY (starter_pkg_code) REFERENCES public.sys_starter_pkg_mst (pkg_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otc_kit FOREIGN KEY (kit_code) REFERENCES public.sys_tax_kits_mst (kit_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otc_kit_ver FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otc_segment FOREIGN KEY (segment_code) REFERENCES public.sys_tax_segment_cd (segment_code) ON DELETE RESTRICT,
  CONSTRAINT ck_otc_mode CHECK (setup_mode IN ('BASIC', 'ADVANCED')),
  CONSTRAINT ck_otc_status CHECK (status IN ('PENDING_CONFIRMATION', 'ACTIVE', 'DISABLED')),
  CONSTRAINT ck_otc_confirmed CHECK (status <> 'ACTIVE' OR (confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)),
  CONSTRAINT ck_otc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_tax_config_cf IS 'Tax setup of one organization: the starter package and kit version applied, Basic/Advanced mode and whether the setup is confirmed. One row per organization.';
COMMENT ON COLUMN public.org_tax_config_cf.id IS 'Row id.';
COMMENT ON COLUMN public.org_tax_config_cf.tenant_org_id IS 'Organization (one config row each).';
COMMENT ON COLUMN public.org_tax_config_cf.starter_pkg_code IS 'Starter package applied (country × segment). Copied to org_tenants_mst.starter_pkg_code on confirm.';
COMMENT ON COLUMN public.org_tax_config_cf.kit_code IS 'Tax kit the package points to.';
COMMENT ON COLUMN public.org_tax_config_cf.kit_version_id IS 'Kit version whose codes, classes and rules were copied.';
COMMENT ON COLUMN public.org_tax_config_cf.segment_code IS 'Business situation chosen by the package; selects segment-only kit rules.';
COMMENT ON COLUMN public.org_tax_config_cf.setup_mode IS 'BASIC = plain-words screen, kit rows only; ADVANCED = codes, rules and classes editable. Set from the package on first apply, then owned by the organization.';
COMMENT ON COLUMN public.org_tax_config_cf.status IS 'PENDING_CONFIRMATION = kit copied, not yet confirmed (orders are not taxed by the new engine); ACTIVE = confirmed; DISABLED = tax switched off by the organization.';
COMMENT ON COLUMN public.org_tax_config_cf.tax_enabled IS 'True when the active setup charges tax (false for no-VAT kits and while pending).';
COMMENT ON COLUMN public.org_tax_config_cf.applied_at IS 'When the kit was last applied.';
COMMENT ON COLUMN public.org_tax_config_cf.applied_by IS 'Who last applied the kit (user id, HQ user id or migration tag).';
COMMENT ON COLUMN public.org_tax_config_cf.last_apply_summary IS 'Result of the last fn_tax_kit_apply call: counts and conflicts (rows the organization changed, left untouched).';
COMMENT ON COLUMN public.org_tax_config_cf.confirmed_at IS 'When the setup was last confirmed. Kept across re-apply as history; NULL = never confirmed.';
COMMENT ON COLUMN public.org_tax_config_cf.confirmed_by IS 'Who last confirmed (owner, or HQ support on the owner''s behalf).';
COMMENT ON COLUMN public.org_tax_config_cf.confirm_note IS 'Reason recorded at confirmation (required when HQ activates on the owner''s behalf).';
COMMENT ON CONSTRAINT uq_otc_tenant ON public.org_tax_config_cf IS 'One tax config per organization.';
COMMENT ON CONSTRAINT fk_otc_tenant ON public.org_tax_config_cf IS 'Organization must exist.';
COMMENT ON CONSTRAINT fk_otc_pkg ON public.org_tax_config_cf IS 'Starter package must exist.';
COMMENT ON CONSTRAINT fk_otc_kit ON public.org_tax_config_cf IS 'Kit must exist.';
COMMENT ON CONSTRAINT fk_otc_kit_ver ON public.org_tax_config_cf IS 'Kit version must exist.';
COMMENT ON CONSTRAINT fk_otc_segment ON public.org_tax_config_cf IS 'Segment must exist.';
COMMENT ON CONSTRAINT ck_otc_mode ON public.org_tax_config_cf IS 'Allowed setup modes.';
COMMENT ON CONSTRAINT ck_otc_status ON public.org_tax_config_cf IS 'Allowed statuses.';
COMMENT ON CONSTRAINT ck_otc_confirmed ON public.org_tax_config_cf IS 'An active setup always records who confirmed it and when.';
COMMENT ON CONSTRAINT ck_otc_rec_status ON public.org_tax_config_cf IS 'Allowed record statuses.';

-- ─── 2. Tax codes: evolve org_tax_profiles_cf ───────────────────────────────

-- Audit "by" columns become TEXT like every newer table, so HQ, tenant users
-- and migrations can all be recorded (an existing uuid value is valid text).
ALTER TABLE public.org_tax_profiles_cf ALTER COLUMN created_by TYPE TEXT USING created_by::text;
ALTER TABLE public.org_tax_profiles_cf ALTER COLUMN updated_by TYPE TEXT USING updated_by::text;

ALTER TABLE public.org_tax_profiles_cf
  ADD COLUMN IF NOT EXISTS tax_code           TEXT          NULL,
  ADD COLUMN IF NOT EXISTS version_no         INTEGER       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS amount_kind        TEXT          NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS fixed_amount       DECIMAL(19,4) NULL,
  ADD COLUMN IF NOT EXISTS calc_level         TEXT          NOT NULL DEFAULT 'LINE',
  ADD COLUMN IF NOT EXISTS tax_category_code  TEXT          NULL,
  ADD COLUMN IF NOT EXISTS exempt_reason_code TEXT          NULL,
  ADD COLUMN IF NOT EXISTS tax_flow_code      TEXT          NOT NULL DEFAULT 'OUTPUT',
  ADD COLUMN IF NOT EXISTS recoverable_pct    DECIMAL(7,4)  NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_reverse_charge  BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority           SMALLINT      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source             TEXT          NOT NULL DEFAULT 'TENANT',
  ADD COLUMN IF NOT EXISTS kit_version_id     UUID          NULL,
  ADD COLUMN IF NOT EXISTS is_tenant_modified BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_count      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS deleted_by         TEXT          NULL,
  ADD COLUMN IF NOT EXISTS deleted_info       TEXT          NULL,
  ADD COLUMN IF NOT EXISTS rec_order          INTEGER       NULL,
  ADD COLUMN IF NOT EXISTS rec_notes          TEXT          NULL;

-- Rate is entered by the organization for the generic kit, and a fixed levy has no rate.
ALTER TABLE public.org_tax_profiles_cf ALTER COLUMN rate DROP NOT NULL;

-- Backfill the 11 demo profiles (legacy, created before kits): a stable code per
-- organization and a category from what the row means today. M4 turns their
-- applies_to / is_default into rules.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_org_id ORDER BY created_at, id) AS n
    FROM public.org_tax_profiles_cf
   WHERE tax_code IS NULL
)
UPDATE public.org_tax_profiles_cf p
   SET tax_code = 'LEGACY_' || lpad(n.n::text, 2, '0'),
       tax_category_code = CASE
         WHEN 'EXEMPT_SERVICE' = ANY (COALESCE(p.applies_to, '{}')) THEN 'EXEMPT'
         WHEN p.rate = 0 THEN 'ZERO_RATED'
         ELSE 'STANDARD' END,
       updated_by = 'migration_0718', updated_info = 'Tax engine M3: legacy profile code backfill'
  FROM numbered n
 WHERE n.id = p.id;

ALTER TABLE public.org_tax_profiles_cf ALTER COLUMN tax_code SET NOT NULL;
ALTER TABLE public.org_tax_profiles_cf ALTER COLUMN tax_category_code SET NOT NULL;

-- Tax types now come from the catalog (adds WHT and levies from 0712).
ALTER TABLE public.org_tax_profiles_cf DROP CONSTRAINT IF EXISTS org_tax_profiles_cf_tax_type_check RESTRICT;

ALTER TABLE public.org_tax_profiles_cf
  ADD CONSTRAINT fk_otp_tax_type FOREIGN KEY (tax_type) REFERENCES public.sys_tax_types_cd (tax_type) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_otp_category FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd (code) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_otp_kit_ver FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  ADD CONSTRAINT uq_otp_code_version UNIQUE (tenant_org_id, tax_code, version_no),
  ADD CONSTRAINT ck_otp_version CHECK (version_no >= 1),
  ADD CONSTRAINT ck_otp_amount_kind CHECK (amount_kind IN ('PERCENT', 'FIXED')),
  ADD CONSTRAINT ck_otp_amount CHECK (
        (amount_kind = 'PERCENT' AND fixed_amount IS NULL)
     OR (amount_kind = 'FIXED' AND rate IS NULL AND fixed_amount IS NOT NULL AND fixed_amount >= 0)),
  ADD CONSTRAINT ck_otp_calc_level CHECK (calc_level IN ('LINE', 'DOCUMENT')),
  ADD CONSTRAINT ck_otp_vat_line CHECK (tax_type <> 'VAT' OR calc_level = 'LINE'),
  ADD CONSTRAINT ck_otp_flow CHECK (tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING')),
  ADD CONSTRAINT ck_otp_recoverable CHECK (recoverable_pct >= 0 AND recoverable_pct <= 100),
  ADD CONSTRAINT ck_otp_source CHECK (source IN ('HQ_KIT', 'TENANT')),
  ADD CONSTRAINT ck_otp_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  ADD CONSTRAINT ck_otp_rec_status CHECK (rec_status IN (0, 1, 2));

CREATE INDEX IF NOT EXISTS idx_otp_tenant_code ON public.org_tax_profiles_cf (tenant_org_id, tax_code, version_no DESC);

COMMENT ON TABLE  public.org_tax_profiles_cf IS 'Tax codes of an organization (one row per code version). Copied from the tax kit (source HQ_KIT) or created by the organization (TENANT). A version used by an order is never changed: a change is a new version.';
COMMENT ON COLUMN public.org_tax_profiles_cf.created_by IS 'Who created the row (user id, HQ user id or migration tag).';
COMMENT ON COLUMN public.org_tax_profiles_cf.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_tax_profiles_cf.rate IS 'Percent rate 0–100 for PERCENT codes; NULL = not entered yet (generic kit) or a FIXED levy.';
COMMENT ON COLUMN public.org_tax_profiles_cf.tax_type IS 'Tax type (sys_tax_types_cd): VAT, GST, WHT, levies, CUSTOM.';
COMMENT ON COLUMN public.org_tax_profiles_cf.tax_code IS 'Stable code of the tax (e.g. VAT_STD); rules point to it; versions share it.';
COMMENT ON COLUMN public.org_tax_profiles_cf.version_no IS 'Version of the code; a used version is frozen, a change creates version + 1.';
COMMENT ON COLUMN public.org_tax_profiles_cf.amount_kind IS 'PERCENT of the taxable amount, or FIXED amount per line / document.';
COMMENT ON COLUMN public.org_tax_profiles_cf.fixed_amount IS 'Fixed amount for FIXED codes, in the order currency.';
COMMENT ON COLUMN public.org_tax_profiles_cf.calc_level IS 'LINE = computed per line; DOCUMENT = once per document after document discount. VAT is always LINE.';
COMMENT ON COLUMN public.org_tax_profiles_cf.tax_category_code IS 'Tax category (sys_tax_category_cd): STANDARD, ZERO_RATED, EXEMPT, OUT_OF_SCOPE.';
COMMENT ON COLUMN public.org_tax_profiles_cf.exempt_reason_code IS 'Reason code shown on invoices for EXEMPT / ZERO_RATED (sys_tax_exempt_reason_cd.code for the organization country; not a FK because that table is keyed by country + code).';
COMMENT ON COLUMN public.org_tax_profiles_cf.tax_flow_code IS 'OUTPUT (sales), INPUT (purchases) or WITHHOLDING (payments).';
COMMENT ON COLUMN public.org_tax_profiles_cf.recoverable_pct IS 'Share of input tax that can be reclaimed (0–100); the rest becomes cost.';
COMMENT ON COLUMN public.org_tax_profiles_cf.is_reverse_charge IS 'True = reverse charge: the buyer accounts for the tax (input + output pair).';
COMMENT ON COLUMN public.org_tax_profiles_cf.priority IS 'Calculation order when several codes stack on one line.';
COMMENT ON COLUMN public.org_tax_profiles_cf.source IS 'HQ_KIT = copied from the tax kit; TENANT = created by the organization.';
COMMENT ON COLUMN public.org_tax_profiles_cf.kit_version_id IS 'Kit version this row came from (NULL for TENANT rows).';
COMMENT ON COLUMN public.org_tax_profiles_cf.is_tenant_modified IS 'True once the organization changed an HQ_KIT row; kit re-apply then leaves it untouched and reports a conflict.';
COMMENT ON COLUMN public.org_tax_profiles_cf.display_order IS 'Order in lists.';
COMMENT ON COLUMN public.org_tax_profiles_cf.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_tax_profiles_cf.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_tax_profiles_cf.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_tax_profiles_cf.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_tax_profiles_cf.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.org_tax_profiles_cf.rec_notes IS 'Free-text notes.';
COMMENT ON CONSTRAINT fk_otp_tax_type ON public.org_tax_profiles_cf IS 'Tax type must exist in the catalog.';
COMMENT ON CONSTRAINT fk_otp_category ON public.org_tax_profiles_cf IS 'Tax category must exist.';
COMMENT ON CONSTRAINT fk_otp_kit_ver ON public.org_tax_profiles_cf IS 'Source kit version must exist.';
COMMENT ON CONSTRAINT uq_otp_code_version ON public.org_tax_profiles_cf IS 'One row per code version per organization.';
COMMENT ON CONSTRAINT ck_otp_version ON public.org_tax_profiles_cf IS 'Versions start at 1.';
COMMENT ON CONSTRAINT ck_otp_amount_kind ON public.org_tax_profiles_cf IS 'Allowed amount kinds.';
COMMENT ON CONSTRAINT ck_otp_amount ON public.org_tax_profiles_cf IS 'PERCENT codes have no fixed amount; FIXED codes have a non-negative amount and no rate.';
COMMENT ON CONSTRAINT ck_otp_calc_level ON public.org_tax_profiles_cf IS 'Allowed calculation levels.';
COMMENT ON CONSTRAINT ck_otp_vat_line ON public.org_tax_profiles_cf IS 'VAT is always computed per line (each line keeps its tax split).';
COMMENT ON CONSTRAINT ck_otp_flow ON public.org_tax_profiles_cf IS 'Allowed tax flows.';
COMMENT ON CONSTRAINT ck_otp_recoverable ON public.org_tax_profiles_cf IS 'Recoverable share is a percent.';
COMMENT ON CONSTRAINT ck_otp_source ON public.org_tax_profiles_cf IS 'Allowed sources.';
COMMENT ON CONSTRAINT ck_otp_dates ON public.org_tax_profiles_cf IS 'Effective end is not before its start.';
COMMENT ON CONSTRAINT ck_otp_rec_status ON public.org_tax_profiles_cf IS 'Allowed record statuses.';
COMMENT ON INDEX public.idx_otp_tenant_code IS 'Latest version of a code per organization (kit apply, rule resolution).';

-- "Used" lookups below need these; the existing FKs had no supporting index.
CREATE INDEX IF NOT EXISTS idx_oid_tax_profile ON public.org_order_items_dtl (tenant_org_id, tax_profile_id) WHERE tax_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otx_tax_profile ON public.org_order_taxes_dtl (tenant_org_id, tax_profile_id) WHERE tax_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opd_tax_profile ON public.org_order_item_pieces_dtl (tenant_org_id, tax_profile_id) WHERE tax_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocd_tax_profile ON public.org_order_charges_dtl (tenant_org_id, tax_profile_id) WHERE tax_profile_id IS NOT NULL;
COMMENT ON INDEX public.idx_oid_tax_profile IS 'Order items by tax code version (tax code in-use check).';
COMMENT ON INDEX public.idx_otx_tax_profile IS 'Order tax summary rows by tax code version (in-use check).';
COMMENT ON INDEX public.idx_opd_tax_profile IS 'Order pieces by tax code version (in-use check).';
COMMENT ON INDEX public.idx_ocd_tax_profile IS 'Order charges by tax code version (in-use check).';

CREATE OR REPLACE FUNCTION public.fn_tax_profile_is_used(p_tenant UUID, p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_order_items_dtl       WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_order_taxes_dtl       WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_order_item_pieces_dtl WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.org_order_charges_dtl     WHERE tenant_org_id = p_tenant AND tax_profile_id = p_profile_id);
$$;

COMMENT ON FUNCTION public.fn_tax_profile_is_used(UUID, UUID) IS
  'True when a tax code version is referenced by any order row of the organization. M5 adds org_tax_lines_tr to this check.';

REVOKE ALL ON FUNCTION public.fn_tax_profile_is_used(UUID, UUID) FROM PUBLIC, anon;   -- internal helper; RLS still applies to callers

-- Freezes a used code version: its tax-defining fields cannot change and it
-- cannot be deleted (org_order_taxes_dtl would otherwise silently lose the link).
-- Names, effective_to, is_active and display order stay editable.
CREATE OR REPLACE FUNCTION public.fn_otp_guard_used()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.fn_tax_profile_is_used(OLD.tenant_org_id, OLD.id) THEN
      RAISE EXCEPTION 'TAX_CODE_IN_USE: tax code % version % is used by orders and cannot be deleted', OLD.tax_code, OLD.version_no
        USING ERRCODE = 'P0001', HINT = 'Set an end date or deactivate it instead.';
    END IF;
    RETURN OLD;
  END IF;

  IF (OLD.tax_code, OLD.version_no, OLD.tax_type, OLD.rate, OLD.amount_kind, OLD.fixed_amount, OLD.calc_level,
      OLD.tax_category_code, OLD.tax_flow_code, OLD.recoverable_pct, OLD.is_reverse_charge, OLD.is_compound,
      OLD.priority, OLD.effective_from, OLD.rounding_level, OLD.rounding_mode, OLD.output_decimal_places,
      OLD.rounding_increment_minor, OLD.tenant_org_id)
     IS DISTINCT FROM
     (NEW.tax_code, NEW.version_no, NEW.tax_type, NEW.rate, NEW.amount_kind, NEW.fixed_amount, NEW.calc_level,
      NEW.tax_category_code, NEW.tax_flow_code, NEW.recoverable_pct, NEW.is_reverse_charge, NEW.is_compound,
      NEW.priority, NEW.effective_from, NEW.rounding_level, NEW.rounding_mode, NEW.output_decimal_places,
      NEW.rounding_increment_minor, NEW.tenant_org_id)
     AND public.fn_tax_profile_is_used(OLD.tenant_org_id, OLD.id) THEN
    RAISE EXCEPTION 'TAX_CODE_IN_USE: tax code % version % is used by orders and cannot be changed', OLD.tax_code, OLD.version_no
      USING ERRCODE = 'P0001', HINT = 'Create a new version of the code instead.';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_otp_guard_used() IS
  'BEFORE UPDATE/DELETE on org_tax_profiles_cf: a code version used by orders keeps its tax-defining fields and is never deleted (change = new version).';

-- Marks a kit-copied row as changed by the organization, so a kit re-apply
-- leaves it alone. fn_tax_kit_apply sets app.tax_kit_apply = on for its own writes.
CREATE OR REPLACE FUNCTION public.fn_tax_mark_modified()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.source = 'HQ_KIT' AND COALESCE(current_setting('app.tax_kit_apply', true), '') <> 'on' THEN
    NEW.is_tenant_modified := true;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_tax_mark_modified() IS
  'BEFORE UPDATE: an HQ_KIT row updated outside fn_tax_kit_apply gets is_tenant_modified = true (shared by tax codes, item classes and rules).';

DROP TRIGGER IF EXISTS trg_otp_guard_used ON public.org_tax_profiles_cf;
CREATE TRIGGER trg_otp_guard_used BEFORE UPDATE OR DELETE ON public.org_tax_profiles_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_otp_guard_used();
COMMENT ON TRIGGER trg_otp_guard_used ON public.org_tax_profiles_cf IS 'Freezes used tax code versions.';

DROP TRIGGER IF EXISTS trg_otp_mark_modified ON public.org_tax_profiles_cf;
CREATE TRIGGER trg_otp_mark_modified BEFORE UPDATE ON public.org_tax_profiles_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_tax_mark_modified();
COMMENT ON TRIGGER trg_otp_mark_modified ON public.org_tax_profiles_cf IS 'Flags kit rows the organization changed.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_tax_profiles_cf;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_tax_profiles_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_tax_profiles_cf IS 'Keeps updated_at and updated_count current.';

-- ─── 3. Item tax classes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_tax_item_classes_cf (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id      UUID        NOT NULL,
  class_code         TEXT        NOT NULL,
  tax_flow_code      TEXT        NOT NULL,
  name               TEXT        NOT NULL,
  name2              TEXT        NULL,
  description        TEXT        NULL,
  description2       TEXT        NULL,
  is_default         BOOLEAN     NOT NULL DEFAULT false,
  display_order      INTEGER     NOT NULL DEFAULT 0,
  source             TEXT        NOT NULL DEFAULT 'TENANT',
  kit_version_id     UUID        NULL,
  is_tenant_modified BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by         TEXT        NULL,
  created_info       TEXT        NULL,
  updated_at         TIMESTAMPTZ NULL,
  updated_by         TEXT        NULL,
  updated_info       TEXT        NULL,
  updated_count      INTEGER     NOT NULL DEFAULT 0,
  deleted_at         TIMESTAMPTZ NULL,
  deleted_by         TEXT        NULL,
  deleted_info       TEXT        NULL,
  rec_status         SMALLINT    NOT NULL DEFAULT 1,
  rec_order          INTEGER     NULL,
  rec_notes          TEXT        NULL,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_tax_item_cls PRIMARY KEY (id),
  CONSTRAINT uq_otic_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_otic_tenant_code UNIQUE (tenant_org_id, class_code),
  CONSTRAINT fk_otic_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otic_kit_ver FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT ck_otic_flow CHECK (tax_flow_code IN ('OUTPUT', 'INPUT')),
  CONSTRAINT ck_otic_source CHECK (source IN ('HQ_KIT', 'TENANT')),
  CONSTRAINT ck_otic_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_otic_one_default
  ON public.org_tax_item_classes_cf (tenant_org_id, tax_flow_code) WHERE is_default AND is_active AND rec_status = 1;

COMMENT ON TABLE  public.org_tax_item_classes_cf IS 'Item tax classes of an organization (laundry service, goods, delivery fee, tip …). Products and expense lines carry a class; tax rules match on it.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.id IS 'Row id.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.tenant_org_id IS 'Organization.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.class_code IS 'Stable class code (same codes as the kit, e.g. LAUNDRY_SERVICE).';
COMMENT ON COLUMN public.org_tax_item_classes_cf.tax_flow_code IS 'OUTPUT = sales classes; INPUT = purchase classes.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.name IS 'English name.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.description IS 'English explanation in plain words.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.description2 IS 'Arabic explanation in plain words.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.is_default IS 'Class given to new products (OUTPUT) / purchase lines (INPUT); one per flow.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.display_order IS 'Order in pickers.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.source IS 'HQ_KIT = copied from the tax kit; TENANT = created by the organization.';
COMMENT ON COLUMN public.org_tax_item_classes_cf.kit_version_id IS 'Kit version this row came from (NULL for TENANT rows).';
COMMENT ON COLUMN public.org_tax_item_classes_cf.is_tenant_modified IS 'True once the organization changed an HQ_KIT row; kit re-apply leaves it untouched.';
COMMENT ON CONSTRAINT uq_otic_tenant_id ON public.org_tax_item_classes_cf IS 'Tenant-scoped key for composite references.';
COMMENT ON CONSTRAINT uq_otic_tenant_code ON public.org_tax_item_classes_cf IS 'One class per code per organization; target of product / rule class FKs.';
COMMENT ON CONSTRAINT fk_otic_tenant ON public.org_tax_item_classes_cf IS 'Organization must exist.';
COMMENT ON CONSTRAINT fk_otic_kit_ver ON public.org_tax_item_classes_cf IS 'Source kit version must exist.';
COMMENT ON CONSTRAINT ck_otic_flow ON public.org_tax_item_classes_cf IS 'Allowed flows.';
COMMENT ON CONSTRAINT ck_otic_source ON public.org_tax_item_classes_cf IS 'Allowed sources.';
COMMENT ON CONSTRAINT ck_otic_rec_status ON public.org_tax_item_classes_cf IS 'Allowed record statuses.';
COMMENT ON INDEX public.uq_otic_one_default IS 'At most one active default class per flow per organization.';

-- Products carry their class (replaces tax_supply_code; conversion in M4).
ALTER TABLE public.org_product_data_mst ADD COLUMN IF NOT EXISTS tax_item_class_code TEXT NULL;
COMMENT ON COLUMN public.org_product_data_mst.tax_item_class_code IS 'Item tax class of the product (org_tax_item_classes_cf); tax rules match on it. Set to the kit default class when a kit is applied.';
ALTER TABLE public.org_product_data_mst
  ADD CONSTRAINT fk_opd_tax_item_class FOREIGN KEY (tenant_org_id, tax_item_class_code)
    REFERENCES public.org_tax_item_classes_cf (tenant_org_id, class_code) ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_opd_tax_item_class ON public.org_product_data_mst IS 'Product class must be a class of the same organization.';
CREATE INDEX IF NOT EXISTS idx_opd_tax_item_class ON public.org_product_data_mst (tenant_org_id, tax_item_class_code) WHERE tax_item_class_code IS NOT NULL;
COMMENT ON INDEX public.idx_opd_tax_item_class IS 'Products by tax class (FK support, class usage checks).';

-- ─── 4. Tax rules + rule codes ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_tax_rules_cf (
  id                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id           UUID        NOT NULL,
  rule_code               TEXT        NOT NULL,
  doc_type_code           TEXT        NULL,
  tax_flow_code           TEXT        NULL,
  branch_id               UUID        NULL,
  place_of_supply_country TEXT        NULL,
  tax_item_class_code     TEXT        NULL,
  party_tax_class_code    TEXT        NULL,
  party_country_scope     TEXT        NULL,
  service_category_code   TEXT        NULL,
  effective_from          DATE        NOT NULL,
  effective_to            DATE        NULL,
  priority                SMALLINT    NOT NULL DEFAULT 100,
  name                    TEXT        NOT NULL,
  name2                   TEXT        NULL,
  source                  TEXT        NOT NULL DEFAULT 'TENANT',
  kit_version_id          UUID        NULL,
  is_tenant_modified      BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by              TEXT        NULL,
  created_info            TEXT        NULL,
  updated_at              TIMESTAMPTZ NULL,
  updated_by              TEXT        NULL,
  updated_info            TEXT        NULL,
  updated_count           INTEGER     NOT NULL DEFAULT 0,
  deleted_at              TIMESTAMPTZ NULL,
  deleted_by              TEXT        NULL,
  deleted_info            TEXT        NULL,
  rec_status              SMALLINT    NOT NULL DEFAULT 1,
  rec_order               INTEGER     NULL,
  rec_notes               TEXT        NULL,
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_tax_rules PRIMARY KEY (id),
  CONSTRAINT uq_otr_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_otr_tenant_code UNIQUE (tenant_org_id, rule_code),
  CONSTRAINT fk_otr_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_doc_type FOREIGN KEY (doc_type_code) REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_branch FOREIGN KEY (branch_id, tenant_org_id) REFERENCES public.org_branches_mst (id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_pos_country FOREIGN KEY (place_of_supply_country) REFERENCES public.sys_country_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_item_class FOREIGN KEY (tenant_org_id, tax_item_class_code) REFERENCES public.org_tax_item_classes_cf (tenant_org_id, class_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_party_class FOREIGN KEY (party_tax_class_code) REFERENCES public.sys_tax_party_class_cd (party_class_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_svc_cat FOREIGN KEY (service_category_code) REFERENCES public.sys_service_category_cd (service_category_code) ON DELETE RESTRICT,
  CONSTRAINT fk_otr_kit_ver FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT ck_otr_flow CHECK (tax_flow_code IS NULL OR tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING')),
  CONSTRAINT ck_otr_scope CHECK (party_country_scope IS NULL OR party_country_scope IN ('DOMESTIC', 'GCC', 'FOREIGN')),
  CONSTRAINT ck_otr_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_otr_source CHECK (source IN ('HQ_KIT', 'TENANT')),
  CONSTRAINT ck_otr_rec_status CHECK (rec_status IN (0, 1, 2))
);

-- Two active rules with identical criteria and start date can never both win;
-- overlapping dates with equal criteria are refused by the rules service at save.
CREATE UNIQUE INDEX IF NOT EXISTS uq_otr_criteria
  ON public.org_tax_rules_cf (tenant_org_id, doc_type_code, tax_flow_code, branch_id, place_of_supply_country,
                              tax_item_class_code, party_tax_class_code, party_country_scope, service_category_code, effective_from)
  NULLS NOT DISTINCT WHERE is_active AND rec_status = 1;
CREATE INDEX IF NOT EXISTS idx_otr_tenant_flow ON public.org_tax_rules_cf (tenant_org_id, tax_flow_code, priority) WHERE is_active AND rec_status = 1;
CREATE INDEX IF NOT EXISTS idx_otr_branch ON public.org_tax_rules_cf (tenant_org_id, branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otr_item_class ON public.org_tax_rules_cf (tenant_org_id, tax_item_class_code) WHERE tax_item_class_code IS NOT NULL;

COMMENT ON TABLE  public.org_tax_rules_cf IS 'Tax rules of an organization: which tax codes apply to a line. Criteria NULL = any; the most specific matching rule wins, then lowest priority. No match with tax enabled = NO_TAX_RULE error (never a silent zero).';
COMMENT ON COLUMN public.org_tax_rules_cf.id IS 'Row id.';
COMMENT ON COLUMN public.org_tax_rules_cf.tenant_org_id IS 'Organization.';
COMMENT ON COLUMN public.org_tax_rules_cf.rule_code IS 'Stable rule code (kit rule code for HQ_KIT rows).';
COMMENT ON COLUMN public.org_tax_rules_cf.doc_type_code IS 'Criterion: document type (sys_doc_seq_type_cd); NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.tax_flow_code IS 'Criterion: OUTPUT / INPUT / WITHHOLDING; NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.branch_id IS 'Criterion: branch; NULL = any branch.';
COMMENT ON COLUMN public.org_tax_rules_cf.place_of_supply_country IS 'Criterion: country where the supply takes place; NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.tax_item_class_code IS 'Criterion: item tax class; NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.party_tax_class_code IS 'Criterion: customer / supplier tax class; NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.party_country_scope IS 'Criterion: DOMESTIC, GCC or FOREIGN party; NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.service_category_code IS 'Criterion: service category; NULL = any.';
COMMENT ON COLUMN public.org_tax_rules_cf.effective_from IS 'First day the rule applies.';
COMMENT ON COLUMN public.org_tax_rules_cf.effective_to IS 'Last day the rule applies; NULL = open-ended.';
COMMENT ON COLUMN public.org_tax_rules_cf.priority IS 'Tie-break between equally specific rules: lower wins.';
COMMENT ON COLUMN public.org_tax_rules_cf.name IS 'English explanation shown in the explain preview.';
COMMENT ON COLUMN public.org_tax_rules_cf.name2 IS 'Arabic explanation.';
COMMENT ON COLUMN public.org_tax_rules_cf.source IS 'HQ_KIT = copied from the tax kit; TENANT = created by the organization.';
COMMENT ON COLUMN public.org_tax_rules_cf.kit_version_id IS 'Kit version this row came from (NULL for TENANT rows).';
COMMENT ON COLUMN public.org_tax_rules_cf.is_tenant_modified IS 'True once the organization changed an HQ_KIT rule; kit re-apply leaves it untouched.';
COMMENT ON CONSTRAINT uq_otr_tenant_id ON public.org_tax_rules_cf IS 'Tenant-scoped key; target of rule code FK.';
COMMENT ON CONSTRAINT uq_otr_tenant_code ON public.org_tax_rules_cf IS 'One rule per code per organization.';
COMMENT ON CONSTRAINT fk_otr_tenant ON public.org_tax_rules_cf IS 'Organization must exist.';
COMMENT ON CONSTRAINT fk_otr_doc_type ON public.org_tax_rules_cf IS 'Document type must be registered.';
COMMENT ON CONSTRAINT fk_otr_branch ON public.org_tax_rules_cf IS 'Branch must belong to the same organization (parent key order id, tenant_org_id).';
COMMENT ON CONSTRAINT fk_otr_pos_country ON public.org_tax_rules_cf IS 'Country must exist.';
COMMENT ON CONSTRAINT fk_otr_item_class ON public.org_tax_rules_cf IS 'Class must belong to the same organization.';
COMMENT ON CONSTRAINT fk_otr_party_class ON public.org_tax_rules_cf IS 'Party class must exist.';
COMMENT ON CONSTRAINT fk_otr_svc_cat ON public.org_tax_rules_cf IS 'Service category must exist.';
COMMENT ON CONSTRAINT fk_otr_kit_ver ON public.org_tax_rules_cf IS 'Source kit version must exist.';
COMMENT ON CONSTRAINT ck_otr_flow ON public.org_tax_rules_cf IS 'Allowed flows.';
COMMENT ON CONSTRAINT ck_otr_scope ON public.org_tax_rules_cf IS 'Allowed party country scopes.';
COMMENT ON CONSTRAINT ck_otr_dates ON public.org_tax_rules_cf IS 'Effective end is not before its start.';
COMMENT ON CONSTRAINT ck_otr_source ON public.org_tax_rules_cf IS 'Allowed sources.';
COMMENT ON CONSTRAINT ck_otr_rec_status ON public.org_tax_rules_cf IS 'Allowed record statuses.';
COMMENT ON INDEX public.uq_otr_criteria IS 'No two active rules with the same criteria and start date (NULL criteria compared as equal).';
COMMENT ON INDEX public.idx_otr_tenant_flow IS 'Active rules of an organization by flow (facts loader).';
COMMENT ON INDEX public.idx_otr_branch IS 'Rules by branch (FK support).';
COMMENT ON INDEX public.idx_otr_item_class IS 'Rules by item class (FK support).';

CREATE TABLE IF NOT EXISTS public.org_tax_rule_codes_dtl (
  tenant_org_id UUID        NOT NULL,
  rule_id       UUID        NOT NULL,
  seq_no        SMALLINT    NOT NULL,
  tax_code      TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  updated_count INTEGER     NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ NULL,
  deleted_by    TEXT        NULL,
  deleted_info  TEXT        NULL,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  rec_order     INTEGER     NULL,
  rec_notes     TEXT        NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_tax_rule_codes PRIMARY KEY (tenant_org_id, rule_id, seq_no),
  CONSTRAINT uq_otrc_rule_code UNIQUE (tenant_org_id, rule_id, tax_code),
  CONSTRAINT fk_otrc_rule FOREIGN KEY (tenant_org_id, rule_id) REFERENCES public.org_tax_rules_cf (tenant_org_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_otrc_seq CHECK (seq_no >= 1),
  CONSTRAINT ck_otrc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_tax_rule_codes_dtl IS 'Tax codes a rule yields, in calculation order (several = stacked taxes, e.g. VAT + levy).';
COMMENT ON COLUMN public.org_tax_rule_codes_dtl.tenant_org_id IS 'Organization.';
COMMENT ON COLUMN public.org_tax_rule_codes_dtl.rule_id IS 'Rule (org_tax_rules_cf).';
COMMENT ON COLUMN public.org_tax_rule_codes_dtl.seq_no IS 'Order of the code within the rule (1 = first).';
COMMENT ON COLUMN public.org_tax_rule_codes_dtl.tax_code IS 'Tax code (org_tax_profiles_cf.tax_code); the version effective on the tax date is used. Checked by trigger (no FK: the code key includes the version).';
COMMENT ON CONSTRAINT pk_org_tax_rule_codes ON public.org_tax_rule_codes_dtl IS 'One code per position per rule.';
COMMENT ON CONSTRAINT uq_otrc_rule_code ON public.org_tax_rule_codes_dtl IS 'A code appears once per rule.';
COMMENT ON CONSTRAINT fk_otrc_rule ON public.org_tax_rule_codes_dtl IS 'Rule must belong to the same organization.';
COMMENT ON CONSTRAINT ck_otrc_seq ON public.org_tax_rule_codes_dtl IS 'Positions start at 1.';
COMMENT ON CONSTRAINT ck_otrc_rec_status ON public.org_tax_rule_codes_dtl IS 'Allowed record statuses.';

CREATE OR REPLACE FUNCTION public.fn_otrc_check_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.org_tax_profiles_cf p
                  WHERE p.tenant_org_id = NEW.tenant_org_id AND p.tax_code = NEW.tax_code AND p.rec_status = 1) THEN
    RAISE EXCEPTION 'TAX_RULE_UNKNOWN_CODE: tax code % does not exist for this organization', NEW.tax_code USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_otrc_check_code() IS 'BEFORE INSERT/UPDATE on org_tax_rule_codes_dtl: the tax code must exist for the same organization.';

DROP TRIGGER IF EXISTS trg_otrc_check_code ON public.org_tax_rule_codes_dtl;
CREATE TRIGGER trg_otrc_check_code BEFORE INSERT OR UPDATE OF tax_code, tenant_org_id ON public.org_tax_rule_codes_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_otrc_check_code();
COMMENT ON TRIGGER trg_otrc_check_code ON public.org_tax_rule_codes_dtl IS 'Validates the referenced tax code.';

-- ─── 5. Tax periods ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_tax_periods_mst (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id  UUID        NOT NULL,
  period_start   DATE        NOT NULL,
  period_end     DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'OPEN',
  closed_at      TIMESTAMPTZ NULL,
  closed_by      TEXT        NULL,
  reopened_at    TIMESTAMPTZ NULL,
  reopened_by    TEXT        NULL,
  reopen_reason  TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT        NULL,
  created_info   TEXT        NULL,
  updated_at     TIMESTAMPTZ NULL,
  updated_by     TEXT        NULL,
  updated_info   TEXT        NULL,
  updated_count  INTEGER     NOT NULL DEFAULT 0,
  deleted_at     TIMESTAMPTZ NULL,
  deleted_by     TEXT        NULL,
  deleted_info   TEXT        NULL,
  rec_status     SMALLINT    NOT NULL DEFAULT 1,
  rec_order      INTEGER     NULL,
  rec_notes      TEXT        NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_tax_periods PRIMARY KEY (id),
  CONSTRAINT uq_otpm_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_otpm_tenant_start UNIQUE (tenant_org_id, period_start),
  CONSTRAINT fk_otpm_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT ck_otpm_dates CHECK (period_end >= period_start),
  CONSTRAINT ck_otpm_status CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT ck_otpm_closed CHECK (status <> 'CLOSED' OR (closed_at IS NOT NULL AND closed_by IS NOT NULL)),
  CONSTRAINT ck_otpm_reopen CHECK (reopened_at IS NULL OR (reopened_by IS NOT NULL AND NULLIF(btrim(reopen_reason), '') IS NOT NULL)),
  CONSTRAINT ck_otpm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_tax_periods_mst IS 'Tax return periods of an organization. A CLOSED period blocks back-dated final tax lines; reopening needs a reason.';
COMMENT ON COLUMN public.org_tax_periods_mst.id IS 'Row id.';
COMMENT ON COLUMN public.org_tax_periods_mst.tenant_org_id IS 'Organization.';
COMMENT ON COLUMN public.org_tax_periods_mst.period_start IS 'First day of the period.';
COMMENT ON COLUMN public.org_tax_periods_mst.period_end IS 'Last day of the period.';
COMMENT ON COLUMN public.org_tax_periods_mst.status IS 'OPEN or CLOSED.';
COMMENT ON COLUMN public.org_tax_periods_mst.closed_at IS 'When the period was last closed.';
COMMENT ON COLUMN public.org_tax_periods_mst.closed_by IS 'Who last closed the period.';
COMMENT ON COLUMN public.org_tax_periods_mst.reopened_at IS 'When the period was last reopened.';
COMMENT ON COLUMN public.org_tax_periods_mst.reopened_by IS 'Who last reopened the period.';
COMMENT ON COLUMN public.org_tax_periods_mst.reopen_reason IS 'Why the period was reopened (required).';
COMMENT ON CONSTRAINT uq_otpm_tenant_id ON public.org_tax_periods_mst IS 'Tenant-scoped key for composite references (tax lines, M5).';
COMMENT ON CONSTRAINT uq_otpm_tenant_start ON public.org_tax_periods_mst IS 'One period per start date per organization.';
COMMENT ON CONSTRAINT fk_otpm_tenant ON public.org_tax_periods_mst IS 'Organization must exist.';
COMMENT ON CONSTRAINT ck_otpm_dates ON public.org_tax_periods_mst IS 'Period end is not before its start.';
COMMENT ON CONSTRAINT ck_otpm_status ON public.org_tax_periods_mst IS 'Allowed statuses.';
COMMENT ON CONSTRAINT ck_otpm_closed ON public.org_tax_periods_mst IS 'A closed period records who closed it and when.';
COMMENT ON CONSTRAINT ck_otpm_reopen ON public.org_tax_periods_mst IS 'A reopen records who, when and why.';
COMMENT ON CONSTRAINT ck_otpm_rec_status ON public.org_tax_periods_mst IS 'Allowed record statuses.';

CREATE OR REPLACE FUNCTION public.fn_otpm_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.rec_status = 1 AND EXISTS (
       SELECT 1 FROM public.org_tax_periods_mst p
        WHERE p.tenant_org_id = NEW.tenant_org_id AND p.id <> NEW.id AND p.rec_status = 1
          AND daterange(p.period_start, p.period_end, '[]') && daterange(NEW.period_start, NEW.period_end, '[]')) THEN
    RAISE EXCEPTION 'TAX_PERIOD_OVERLAP: period % – % overlaps another period', NEW.period_start, NEW.period_end USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_otpm_no_overlap() IS 'BEFORE INSERT/UPDATE on org_tax_periods_mst: periods of one organization never overlap.';

DROP TRIGGER IF EXISTS trg_otpm_no_overlap ON public.org_tax_periods_mst;
CREATE TRIGGER trg_otpm_no_overlap BEFORE INSERT OR UPDATE OF period_start, period_end, rec_status, tenant_org_id ON public.org_tax_periods_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_otpm_no_overlap();
COMMENT ON TRIGGER trg_otpm_no_overlap ON public.org_tax_periods_mst IS 'Prevents overlapping periods.';

-- ─── 6. Branch, customer and supplier tax columns ───────────────────────────

ALTER TABLE public.org_branches_mst ADD COLUMN IF NOT EXISTS emirate_code TEXT NULL;
COMMENT ON COLUMN public.org_branches_mst.emirate_code IS 'UAE emirate of the branch (ISO 3166-2:AE suffix: AZ, DU, SH, AJ, UQ, RK, FU). Required for UAE branches: the VAT 201 return splits sales by emirate (boxes 1a–1g). Checked at tax confirmation.';
ALTER TABLE public.org_branches_mst
  ADD CONSTRAINT ck_obm_emirate CHECK (emirate_code IS NULL OR emirate_code IN ('AZ', 'DU', 'SH', 'AJ', 'UQ', 'RK', 'FU'));
COMMENT ON CONSTRAINT ck_obm_emirate ON public.org_branches_mst IS 'The seven UAE emirates.';

ALTER TABLE public.org_customers_mst
  ADD COLUMN IF NOT EXISTS tax_party_class_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS tax_country          TEXT NULL;
COMMENT ON COLUMN public.org_customers_mst.tax_party_class_code IS 'Customer tax class (sys_tax_party_class_cd); NULL = the default class (individual). VAT number stays in tax_id.';
COMMENT ON COLUMN public.org_customers_mst.tax_country IS 'Country of the customer for tax (sys_country_cd); NULL = same as the organization.';
ALTER TABLE public.org_customers_mst
  ADD CONSTRAINT fk_ocm_tax_party_class FOREIGN KEY (tax_party_class_code) REFERENCES public.sys_tax_party_class_cd (party_class_code) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ocm_tax_country FOREIGN KEY (tax_country) REFERENCES public.sys_country_cd (code) ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_ocm_tax_party_class ON public.org_customers_mst IS 'Customer tax class must exist.';
COMMENT ON CONSTRAINT fk_ocm_tax_country ON public.org_customers_mst IS 'Customer tax country must exist.';

ALTER TABLE public.org_fin_supp_mst
  ADD COLUMN IF NOT EXISTS tax_party_class_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS tax_country          TEXT NULL;
COMMENT ON COLUMN public.org_fin_supp_mst.tax_party_class_code IS 'Supplier tax class (sys_tax_party_class_cd); FOREIGN suppliers drive reverse charge. VAT number stays in tax_reg_no.';
COMMENT ON COLUMN public.org_fin_supp_mst.tax_country IS 'Country of the supplier for tax (sys_country_cd); NULL = same as the organization.';
ALTER TABLE public.org_fin_supp_mst
  ADD CONSTRAINT fk_ofs_tax_party_class FOREIGN KEY (tax_party_class_code) REFERENCES public.sys_tax_party_class_cd (party_class_code) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ofs_tax_country FOREIGN KEY (tax_country) REFERENCES public.sys_country_cd (code) ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_ofs_tax_party_class ON public.org_fin_supp_mst IS 'Supplier tax class must exist.';
COMMENT ON CONSTRAINT fk_ofs_tax_country ON public.org_fin_supp_mst IS 'Supplier tax country must exist.';

-- ─── 7. Standard audit comments, triggers, RLS for the new tables ───────────

DO $$
DECLARE
  t TEXT;
  c RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_tax_config_cf', 'org_tax_item_classes_cf', 'org_tax_rules_cf', 'org_tax_rule_codes_dtl', 'org_tax_periods_mst']
  LOOP
    FOR c IN
      SELECT * FROM (VALUES
        ('created_at',    'When the row was created.'),
        ('created_by',    'Who created the row (user id, HQ user id or migration tag).'),
        ('created_info',  'Creation context (screen, function, migration).'),
        ('updated_at',    'When the row was last updated (set by trigger).'),
        ('updated_by',    'Who last updated the row.'),
        ('updated_info',  'Last update context.'),
        ('updated_count', 'Number of updates (incremented by trigger).'),
        ('deleted_at',    'When the row was soft-deleted.'),
        ('deleted_by',    'Who soft-deleted the row.'),
        ('deleted_info',  'Soft-delete context.'),
        ('rec_status',    'Record status: 1 active, 0 deleted, 2 archived.'),
        ('rec_order',     'Optional manual ordering.'),
        ('rec_notes',     'Free-text notes.'),
        ('is_active',     'False = hidden / not used; history stays.')
      ) AS v(col, note)
    LOOP
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', t, c.col, c.note);
    END LOOP;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t, 'Keeps updated_at and updated_count current.');

    -- Same tenant isolation as org_tax_profiles_cf; anon gets nothing.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON public.%I', t, t);
    EXECUTE format('CREATE POLICY tenant_isolation_%s ON public.%I FOR ALL USING (tenant_org_id = (SELECT current_tenant_id())) WITH CHECK (tenant_org_id = (SELECT current_tenant_id()))', t, t);
    EXECUTE format('COMMENT ON POLICY tenant_isolation_%s ON public.%I IS %L', t, t, 'Rows are visible and writable only for the current organization.');
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_otic_mark_modified ON public.org_tax_item_classes_cf;
CREATE TRIGGER trg_otic_mark_modified BEFORE UPDATE ON public.org_tax_item_classes_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_tax_mark_modified();
COMMENT ON TRIGGER trg_otic_mark_modified ON public.org_tax_item_classes_cf IS 'Flags kit rows the organization changed.';

DROP TRIGGER IF EXISTS trg_otr_mark_modified ON public.org_tax_rules_cf;
CREATE TRIGGER trg_otr_mark_modified BEFORE UPDATE ON public.org_tax_rules_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_tax_mark_modified();
COMMENT ON TRIGGER trg_otr_mark_modified ON public.org_tax_rules_cf IS 'Flags kit rows the organization changed.';

-- ─── 8. fn_tax_config_confirm ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_tax_config_confirm(p_tenant UUID, p_actor TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_cfg      public.org_tax_config_cf%ROWTYPE;
  v_pkg      public.sys_starter_pkg_mst%ROWTYPE;
  v_kind     TEXT;
  v_country  TEXT;
  v_org_reg  TEXT;
  v_errors   TEXT[] := '{}';
  v_info     TEXT := 'fn_tax_config_confirm';
BEGIN
  IF p_tenant IS NULL OR NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_CONFIRM_BAD_INPUT: tenant and actor are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_cfg FROM public.org_tax_config_cf WHERE tenant_org_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_CONFIRM_NO_CONFIG: no tax kit has been applied to this organization' USING ERRCODE = 'P0002';
  END IF;
  IF v_cfg.status = 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true, 'errors', '[]'::jsonb);
  END IF;

  SELECT * INTO v_pkg FROM public.sys_starter_pkg_mst WHERE pkg_code = v_cfg.starter_pkg_code;
  SELECT kit_kind INTO v_kind FROM public.sys_tax_kits_mst WHERE kit_code = v_cfg.kit_code;
  SELECT upper(country), NULLIF(btrim(tax_registration_no), '') INTO v_country, v_org_reg
    FROM public.org_tenants_mst WHERE id = p_tenant;

  -- Readiness: everything the engine needs to tax an order correctly.
  IF EXISTS (SELECT 1 FROM public.org_tax_profiles_cf
              WHERE tenant_org_id = p_tenant AND is_active AND rec_status = 1
                AND amount_kind = 'PERCENT' AND rate IS NULL AND tax_category_code = 'STANDARD') THEN
    v_errors := v_errors || 'TAX_RATE_MISSING';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.org_tax_rules_cf
                  WHERE tenant_org_id = p_tenant AND is_active AND rec_status = 1
                    AND (tax_flow_code = 'OUTPUT' OR tax_flow_code IS NULL)) THEN
    v_errors := v_errors || 'TAX_NO_SALES_RULE';
  END IF;

  -- A VAT setup needs a registration number for every active branch (its own or the organization's).
  IF v_kind <> 'NO_VAT' AND v_org_reg IS NULL
     AND (NOT EXISTS (SELECT 1 FROM public.org_branches_mst b WHERE b.tenant_org_id = p_tenant AND b.is_active AND b.rec_status = 1)
          OR EXISTS (SELECT 1 FROM public.org_branches_mst b
                      WHERE b.tenant_org_id = p_tenant AND b.is_active AND b.rec_status = 1
                        AND NULLIF(btrim(b.tax_registration_no), '') IS NULL)) THEN
    v_errors := v_errors || 'TAX_REGISTRATION_MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_branches_mst b
              WHERE b.tenant_org_id = p_tenant AND b.is_active AND b.rec_status = 1
                AND COALESCE(upper(b.country), v_country) = 'AE' AND b.emirate_code IS NULL) THEN
    v_errors := v_errors || 'TAX_EMIRATE_MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_product_data_mst
              WHERE tenant_org_id = p_tenant AND is_active AND rec_status = 1 AND tax_item_class_code IS NULL) THEN
    v_errors := v_errors || 'TAX_PRODUCT_CLASS_MISSING';
  END IF;

  IF cardinality(v_errors) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors));
  END IF;

  -- First confirmation only: take the package's price mode and calendar. Later
  -- confirmations keep what the organization has set since (never silently changed).
  IF v_cfg.confirmed_at IS NULL THEN
    UPDATE public.org_tenants_mst
       SET tax_pricing_mode = 'TAX_' || v_pkg.tax_pricing_mode,
           calendar_template_code = COALESCE(calendar_template_code, v_pkg.calendar_template_code),
           updated_at = now(), updated_by = p_actor, updated_info = v_info
     WHERE id = p_tenant;
  END IF;

  UPDATE public.org_tenants_mst
     SET starter_pkg_code = v_cfg.starter_pkg_code, updated_at = now(), updated_by = p_actor, updated_info = v_info
   WHERE id = p_tenant AND starter_pkg_code IS DISTINCT FROM v_cfg.starter_pkg_code;

  -- When the tax document is issued (D13): the package's events on, any other event off.
  INSERT INTO public.org_tax_doc_triggers_cfg (tenant_org_id, trigger_event, document_type, is_enabled, created_by, created_info)
  SELECT p_tenant, t.trigger_event, t.document_type, true, p_actor, v_info
    FROM public.sys_starter_pkg_trig_dtl t
   WHERE t.pkg_code = v_cfg.starter_pkg_code AND t.is_active AND t.rec_status = 1
  ON CONFLICT (tenant_org_id, trigger_event) DO UPDATE
     SET document_type = EXCLUDED.document_type, is_enabled = true, is_active = true, rec_status = 1,
         updated_at = now(), updated_by = p_actor, updated_info = v_info;

  UPDATE public.org_tax_doc_triggers_cfg c
     SET is_enabled = false, updated_at = now(), updated_by = p_actor, updated_info = v_info
   WHERE c.tenant_org_id = p_tenant AND c.is_enabled
     AND NOT EXISTS (SELECT 1 FROM public.sys_starter_pkg_trig_dtl t
                      WHERE t.pkg_code = v_cfg.starter_pkg_code AND t.trigger_event = c.trigger_event
                        AND t.is_active AND t.rec_status = 1);

  UPDATE public.org_tax_config_cf
     SET status = 'ACTIVE', tax_enabled = (v_kind <> 'NO_VAT'),
         confirmed_at = now(), confirmed_by = p_actor, confirm_note = NULLIF(btrim(p_note), ''),
         updated_by = p_actor, updated_info = v_info
   WHERE tenant_org_id = p_tenant;

  RETURN jsonb_build_object('ok', true, 'already_active', false, 'errors', '[]'::jsonb,
                            'tax_enabled', v_kind <> 'NO_VAT', 'first_confirmation', v_cfg.confirmed_at IS NULL);
END $$;

COMMENT ON FUNCTION public.fn_tax_config_confirm(UUID, TEXT, TEXT) IS
  'Activates an organization''s pending tax setup after readiness checks (rates entered, a sales rule, registration numbers, UAE emirates, product classes). Returns {ok, errors[]}; on ok: status ACTIVE, package invoice events applied, and on the first confirmation the package price mode / calendar. Callers check permission and write their audit log.';

REVOKE ALL ON FUNCTION public.fn_tax_config_confirm(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;   -- server-side only (permission checked by caller)
GRANT EXECUTE ON FUNCTION public.fn_tax_config_confirm(UUID, TEXT, TEXT) TO service_role;                  -- HQ and tenant server code

-- ─── 9. fn_tax_kit_apply ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_tax_kit_apply(
  p_tenant   UUID,
  p_pkg_code TEXT,
  p_actor    TEXT,
  p_activate BOOLEAN DEFAULT false,
  p_note     TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_pkg       public.sys_starter_pkg_mst%ROWTYPE;
  v_ver       public.sys_tax_kit_versions_mst%ROWTYPE;
  v_cfg       public.org_tax_config_cf%ROWTYPE;
  v_cfg_found BOOLEAN;
  v_country   TEXT;
  v_info      TEXT := 'fn_tax_kit_apply ' || p_pkg_code;
  v_conflicts JSONB := '[]'::jsonb;
  v_n         JSONB;
  v_summary   JSONB;
  v_confirm   JSONB;
  r           RECORD;
  v_code      public.org_tax_profiles_cf%ROWTYPE;
  v_cls       public.org_tax_item_classes_cf%ROWTYPE;
  v_rule      public.org_tax_rules_cf%ROWTYPE;
  v_rule_found BOOLEAN;
  v_rule_id   UUID;
  v_default   TEXT;
  n_code_new INT := 0; n_code_upd INT := 0; n_code_ver INT := 0; n_code_off INT := 0;
  n_cls_new  INT := 0; n_cls_upd  INT := 0; n_cls_off  INT := 0;
  n_rule_new INT := 0; n_rule_upd INT := 0; n_rule_off INT := 0;
  n_prod     INT := 0;
BEGIN
  -- ─── Input validation ───────────────────────────────────────────────────
  IF p_tenant IS NULL OR NULLIF(btrim(p_pkg_code), '') IS NULL OR NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_APPLY_BAD_INPUT: tenant, package and actor are required' USING ERRCODE = '22023';
  END IF;

  SELECT upper(country) INTO v_country FROM public.org_tenants_mst WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_TENANT_NOT_FOUND: organization % does not exist', p_tenant USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_pkg FROM public.sys_starter_pkg_mst WHERE pkg_code = p_pkg_code AND is_active AND rec_status = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_PACKAGE_NOT_FOUND: package % is missing or inactive', p_pkg_code USING ERRCODE = 'P0002';
  END IF;
  IF v_pkg.country_code IS NOT NULL AND v_pkg.country_code IS DISTINCT FROM v_country THEN
    RAISE EXCEPTION 'TAX_APPLY_COUNTRY_MISMATCH: package % is for %, the organization is in %', p_pkg_code, v_pkg.country_code, COALESCE(v_country, '?')
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst
   WHERE kit_code = v_pkg.tax_kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND effective_from <= current_date AND (effective_to IS NULL OR effective_to >= current_date)
   ORDER BY version_no DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_NO_PUBLISHED_VERSION: kit % has no published version in effect', v_pkg.tax_kit_code USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cfg FROM public.org_tax_config_cf WHERE tenant_org_id = p_tenant FOR UPDATE;
  v_cfg_found := FOUND;
  -- An active organization is never dropped back to pending (orders would stop
  -- being taxed): re-applying it must confirm in the same call.
  IF v_cfg_found AND v_cfg.status = 'ACTIVE' AND NOT p_activate THEN
    RAISE EXCEPTION 'TAX_APPLY_ACTIVE_NEEDS_ACTIVATE: the tax setup is active; re-apply with activation' USING ERRCODE = '55000';
  END IF;

  -- Our own writes do not count as organization changes (fn_tax_mark_modified).
  PERFORM set_config('app.tax_kit_apply', 'on', true);

  -- ─── Item classes ───────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_item_classes_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1 ORDER BY display_order LOOP
    SELECT * INTO v_cls FROM public.org_tax_item_classes_cf WHERE tenant_org_id = p_tenant AND class_code = r.class_code;
    IF NOT FOUND THEN
      INSERT INTO public.org_tax_item_classes_cf
        (tenant_org_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
         source, kit_version_id, created_by, created_info)
      VALUES
        (p_tenant, r.class_code, r.tax_flow_code, r.name, r.name2, r.description, r.description2,
         r.is_default AND NOT EXISTS (SELECT 1 FROM public.org_tax_item_classes_cf d
                                       WHERE d.tenant_org_id = p_tenant AND d.tax_flow_code = r.tax_flow_code
                                         AND d.is_default AND d.is_active AND d.rec_status = 1),
         r.display_order, 'HQ_KIT', v_ver.id, p_actor, v_info);
      n_cls_new := n_cls_new + 1;
    ELSIF v_cls.source = 'TENANT' OR v_cls.is_tenant_modified THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'ITEM_CLASS', 'code', r.class_code,
                                                       'reason', CASE WHEN v_cls.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
    ELSIF (v_cls.tax_flow_code, v_cls.name, v_cls.name2, v_cls.description, v_cls.description2, v_cls.display_order,
           v_cls.kit_version_id, v_cls.is_active, v_cls.rec_status)
          IS DISTINCT FROM
          (r.tax_flow_code, r.name, r.name2, r.description, r.description2, r.display_order, v_ver.id, true, 1::SMALLINT) THEN
      UPDATE public.org_tax_item_classes_cf
         SET tax_flow_code = r.tax_flow_code, name = r.name, name2 = r.name2, description = r.description,
             description2 = r.description2, display_order = r.display_order, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_cls.id;
      n_cls_upd := n_cls_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.org_tax_item_classes_cf c
     SET is_active = false, is_default = false, updated_by = p_actor, updated_info = v_info
   WHERE c.tenant_org_id = p_tenant AND c.source = 'HQ_KIT' AND NOT c.is_tenant_modified AND c.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_item_classes_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.class_code = c.class_code AND k.is_active AND k.rec_status = 1);
  GET DIAGNOSTICS n_cls_off = ROW_COUNT;

  -- ─── Tax codes ──────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_codes_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1 ORDER BY display_order LOOP
    SELECT * INTO v_code FROM public.org_tax_profiles_cf
     WHERE tenant_org_id = p_tenant AND tax_code = r.tax_code ORDER BY version_no DESC LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.org_tax_profiles_cf
        (tenant_org_id, tax_code, version_no, name, name2, tax_type, rate, amount_kind, fixed_amount, calc_level,
         tax_category_code, tax_flow_code, recoverable_pct, is_reverse_charge, priority, is_compound,
         effective_from, is_default, applies_to, rounding_level, rounding_mode, source, kit_version_id, display_order,
         created_by, created_info)
      VALUES
        (p_tenant, r.tax_code, 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
         r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
         v_ver.effective_from, false, NULL, v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id, r.display_order,
         p_actor, v_info);
      n_code_new := n_code_new + 1;
    ELSIF v_code.source = 'TENANT' OR v_code.is_tenant_modified THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_CODE', 'code', r.tax_code,
                                                       'reason', CASE WHEN v_code.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
    ELSIF (v_code.tax_type, v_code.rate, v_code.amount_kind, v_code.fixed_amount, v_code.calc_level, v_code.tax_category_code,
           v_code.tax_flow_code, v_code.recoverable_pct, v_code.is_reverse_charge, v_code.priority, v_code.is_compound,
           v_code.rounding_level, v_code.rounding_mode)
          IS DISTINCT FROM
          (r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level, r.tax_category_code,
           r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           v_ver.rounding_level, v_ver.rounding_mode) THEN
      IF public.fn_tax_profile_is_used(p_tenant, v_code.id) THEN
        -- Used version is frozen: end it yesterday and start a new version today.
        UPDATE public.org_tax_profiles_cf
           SET effective_to = GREATEST(effective_from, current_date - 1), updated_by = p_actor, updated_info = v_info
         WHERE tenant_org_id = p_tenant AND id = v_code.id;
        INSERT INTO public.org_tax_profiles_cf
          (tenant_org_id, tax_code, version_no, name, name2, tax_type, rate, amount_kind, fixed_amount, calc_level,
           tax_category_code, tax_flow_code, recoverable_pct, is_reverse_charge, priority, is_compound,
           effective_from, is_default, applies_to, rounding_level, rounding_mode, source, kit_version_id, display_order,
           created_by, created_info)
        VALUES
          (p_tenant, r.tax_code, v_code.version_no + 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
           r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           GREATEST(current_date, v_ver.effective_from), false, NULL, v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id,
           r.display_order, p_actor, v_info);
        n_code_ver := n_code_ver + 1;
      ELSE
        UPDATE public.org_tax_profiles_cf
           SET name = r.name, name2 = r.name2, tax_type = r.tax_type, rate = r.rate, amount_kind = r.amount_kind,
               fixed_amount = r.fixed_amount, calc_level = r.calc_level, tax_category_code = r.tax_category_code,
               tax_flow_code = r.tax_flow_code, recoverable_pct = r.recoverable_pct, is_reverse_charge = r.is_reverse_charge,
               priority = r.priority, is_compound = r.compound_base, rounding_level = v_ver.rounding_level,
               rounding_mode = v_ver.rounding_mode, kit_version_id = v_ver.id, display_order = r.display_order,
               is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
         WHERE tenant_org_id = p_tenant AND id = v_code.id;
        n_code_upd := n_code_upd + 1;
      END IF;
    ELSIF (v_code.name, v_code.name2, v_code.display_order, v_code.kit_version_id, v_code.is_active, v_code.rec_status, v_code.effective_to)
          IS DISTINCT FROM (r.name, r.name2, r.display_order, v_ver.id, true, 1::SMALLINT, NULL::DATE) THEN
      UPDATE public.org_tax_profiles_cf
         SET name = r.name, name2 = r.name2, display_order = r.display_order, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_code.id;
      n_code_upd := n_code_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.org_tax_profiles_cf p
     SET is_active = false, updated_by = p_actor, updated_info = v_info
   WHERE p.tenant_org_id = p_tenant AND p.source = 'HQ_KIT' AND NOT p.is_tenant_modified AND p.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_codes_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.tax_code = p.tax_code AND k.is_active AND k.rec_status = 1);
  GET DIAGNOSTICS n_code_off = ROW_COUNT;

  -- ─── Rules (kit rules for this package's segment) ───────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_rules_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1
              AND (segment_codes IS NULL OR v_pkg.segment_code = ANY (segment_codes))
            ORDER BY priority, rule_code LOOP
    SELECT * INTO v_rule FROM public.org_tax_rules_cf WHERE tenant_org_id = p_tenant AND rule_code = r.rule_code;
    v_rule_found := FOUND;
    IF v_rule_found AND (v_rule.source = 'TENANT' OR v_rule.is_tenant_modified) THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_RULE', 'code', r.rule_code,
                                                       'reason', CASE WHEN v_rule.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
      CONTINUE;
    END IF;

    -- An organization rule with the same criteria already decides these lines.
    IF EXISTS (SELECT 1 FROM public.org_tax_rules_cf o
                WHERE o.tenant_org_id = p_tenant AND o.is_active AND o.rec_status = 1
                  AND o.rule_code <> r.rule_code
                  AND o.doc_type_code IS NOT DISTINCT FROM r.doc_type_code
                  AND o.tax_flow_code IS NOT DISTINCT FROM r.tax_flow_code
                  AND o.branch_id IS NULL AND o.place_of_supply_country IS NULL AND o.service_category_code IS NULL
                  AND o.tax_item_class_code IS NOT DISTINCT FROM r.tax_item_class_code
                  AND o.party_tax_class_code IS NOT DISTINCT FROM r.party_tax_class_code
                  AND o.party_country_scope IS NOT DISTINCT FROM r.party_country_scope
                  AND o.effective_from = v_ver.effective_from) THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_RULE', 'code', r.rule_code, 'reason', 'SAME_CRITERIA');
      CONTINUE;
    END IF;

    IF NOT v_rule_found THEN
      INSERT INTO public.org_tax_rules_cf
        (tenant_org_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
         effective_from, priority, name, name2, source, kit_version_id, created_by, created_info)
      VALUES
        (p_tenant, r.rule_code, r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope,
         v_ver.effective_from, r.priority, r.name, r.name2, 'HQ_KIT', v_ver.id, p_actor, v_info)
      RETURNING id INTO v_rule_id;
      n_rule_new := n_rule_new + 1;
    ELSE
      v_rule_id := v_rule.id;
      UPDATE public.org_tax_rules_cf
         SET doc_type_code = r.doc_type_code, tax_flow_code = r.tax_flow_code, tax_item_class_code = r.tax_item_class_code,
             party_tax_class_code = r.party_tax_class_code, party_country_scope = r.party_country_scope,
             priority = r.priority, name = r.name, name2 = r.name2, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_rule_id
         AND (doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope, priority,
              name, name2, kit_version_id, is_active, rec_status, effective_to)
             IS DISTINCT FROM
             (r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope, r.priority,
              r.name, r.name2, v_ver.id, true, 1::SMALLINT, NULL::DATE);
      IF FOUND THEN n_rule_upd := n_rule_upd + 1; END IF;
      DELETE FROM public.org_tax_rule_codes_dtl WHERE tenant_org_id = p_tenant AND rule_id = v_rule_id;
    END IF;

    INSERT INTO public.org_tax_rule_codes_dtl (tenant_org_id, rule_id, seq_no, tax_code, created_by, created_info)
    SELECT p_tenant, v_rule_id, k.seq_no, k.tax_code, p_actor, v_info
      FROM public.sys_tax_kit_rule_codes_dtl k
     WHERE k.rule_id = r.id AND k.kit_version_id = v_ver.id AND k.is_active AND k.rec_status = 1;
  END LOOP;

  UPDATE public.org_tax_rules_cf o
     SET is_active = false, updated_by = p_actor, updated_info = v_info
   WHERE o.tenant_org_id = p_tenant AND o.source = 'HQ_KIT' AND NOT o.is_tenant_modified AND o.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_rules_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.rule_code = o.rule_code AND k.is_active AND k.rec_status = 1
                        AND (k.segment_codes IS NULL OR v_pkg.segment_code = ANY (k.segment_codes)));
  GET DIAGNOSTICS n_rule_off = ROW_COUNT;

  -- ─── Products without a class get the default sales class ───────────────
  SELECT class_code INTO v_default FROM public.org_tax_item_classes_cf
   WHERE tenant_org_id = p_tenant AND tax_flow_code = 'OUTPUT' AND is_default AND is_active AND rec_status = 1;
  IF v_default IS NOT NULL THEN
    UPDATE public.org_product_data_mst
       SET tax_item_class_code = v_default, updated_at = now(), updated_by = p_actor, updated_info = v_info
     WHERE tenant_org_id = p_tenant AND tax_item_class_code IS NULL;
    GET DIAGNOSTICS n_prod = ROW_COUNT;
  END IF;

  PERFORM set_config('app.tax_kit_apply', '', true);

  -- ─── Config: pending candidate ──────────────────────────────────────────
  v_n := jsonb_build_object(
    'codes',   jsonb_build_object('added', n_code_new, 'updated', n_code_upd, 'new_versions', n_code_ver, 'deactivated', n_code_off),
    'classes', jsonb_build_object('added', n_cls_new, 'updated', n_cls_upd, 'deactivated', n_cls_off),
    'rules',   jsonb_build_object('added', n_rule_new, 'updated', n_rule_upd, 'deactivated', n_rule_off),
    'products_classified', n_prod);
  v_summary := jsonb_build_object('pkg_code', p_pkg_code, 'kit_code', v_pkg.tax_kit_code, 'kit_version_no', v_ver.version_no,
                                  'segment_code', v_pkg.segment_code, 'counts', v_n, 'conflicts', v_conflicts);

  INSERT INTO public.org_tax_config_cf
    (tenant_org_id, starter_pkg_code, kit_code, kit_version_id, segment_code, setup_mode, status, tax_enabled,
     applied_at, applied_by, last_apply_summary, created_by, created_info)
  VALUES
    (p_tenant, p_pkg_code, v_pkg.tax_kit_code, v_ver.id, v_pkg.segment_code, v_pkg.tax_setup_mode, 'PENDING_CONFIRMATION', false,
     now(), p_actor, v_summary, p_actor, v_info)
  ON CONFLICT (tenant_org_id) DO UPDATE
     SET starter_pkg_code = EXCLUDED.starter_pkg_code, kit_code = EXCLUDED.kit_code, kit_version_id = EXCLUDED.kit_version_id,
         segment_code = EXCLUDED.segment_code, status = 'PENDING_CONFIRMATION', tax_enabled = false,
         applied_at = now(), applied_by = p_actor, last_apply_summary = EXCLUDED.last_apply_summary,
         updated_by = p_actor, updated_info = v_info;

  IF p_activate THEN
    v_confirm := public.fn_tax_config_confirm(p_tenant, p_actor, p_note);
    IF NOT (v_confirm ->> 'ok')::BOOLEAN THEN
      -- Roll back the whole apply: an active setup is never left pending.
      RAISE EXCEPTION 'TAX_ACTIVATE_NOT_READY: %', v_confirm -> 'errors' USING ERRCODE = '55000';
    END IF;
    v_summary := v_summary || jsonb_build_object('confirm', v_confirm);
  END IF;

  RETURN v_summary;
END $$;

COMMENT ON FUNCTION public.fn_tax_kit_apply(UUID, TEXT, TEXT, BOOLEAN, TEXT) IS
  'Copies a starter package''s kit (codes, item classes, segment rules) into an organization as source HQ_KIT and records a PENDING_CONFIRMATION config. Idempotent: re-apply updates only unmodified HQ_KIT rows (a used code version gets a new version), deactivates kit rows no longer in the package, and reports organization-changed rows as conflicts. Products without a class get the default sales class. p_activate = true also confirms (fn_tax_config_confirm) and fails as a whole if not ready; an ACTIVE setup can only be re-applied that way. Callers check permission and write their audit log.';

REVOKE ALL ON FUNCTION public.fn_tax_kit_apply(UUID, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;   -- server-side only (permission checked by caller)
GRANT EXECUTE ON FUNCTION public.fn_tax_kit_apply(UUID, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;                  -- HQ onboarding / support and tenant server code

-- ─── 10. Seed: a pending candidate for every organization ───────────────────

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT o.id, o.starter_pkg_code FROM public.org_tenants_mst o
            WHERE o.starter_pkg_code IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.org_tax_config_cf c WHERE c.tenant_org_id = o.id)
  LOOP
    PERFORM public.fn_tax_kit_apply(t.id, t.starter_pkg_code, 'migration_0718');
  END LOOP;
END $$;

-- ─── 11. Self-check ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v_missing INT;
BEGIN
  SELECT count(*) INTO v_missing FROM public.org_tenants_mst o
   WHERE NOT EXISTS (SELECT 1 FROM public.org_tax_config_cf c WHERE c.tenant_org_id = o.id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION '0718 self-check: % organization(s) without a tax config', v_missing;
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_tax_config_cf c
              WHERE NOT EXISTS (SELECT 1 FROM public.org_tax_rules_cf r
                                 WHERE r.tenant_org_id = c.tenant_org_id AND r.is_active AND r.tax_flow_code = 'OUTPUT')) THEN
    RAISE EXCEPTION '0718 self-check: an organization has no active sales rule after kit apply';
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_tax_rule_codes_dtl rc
              WHERE NOT EXISTS (SELECT 1 FROM public.org_tax_profiles_cf p
                                 WHERE p.tenant_org_id = rc.tenant_org_id AND p.tax_code = rc.tax_code)) THEN
    RAISE EXCEPTION '0718 self-check: a rule points to a missing tax code';
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_tax_profiles_cf WHERE source = 'HQ_KIT' AND (is_default OR applies_to IS NOT NULL)) THEN
    RAISE EXCEPTION '0718 self-check: a kit code would be picked by the current order tax engine';
  END IF;
END $$;

COMMIT;
