-- =============================================================================
-- 0642_tax_profile_rounding.sql
-- Line-Level Money Snapshot — Phase 2, M4 (PLAN.md §6.6, §12, §12.1, ADR-060
-- §6, Phase 0 outcome C5).
--
-- Why: the last Phase 2 migration. Gives the Phase 4 calculator everything
-- it needs to decide tax rounding and tax category per line, closing PF-04
-- (exempt orders taxed) and PF-06/PF-05 groundwork without changing any
-- figure today (no product has a supply code or a non-STANDARD category).
--
-- 1. sys_tax_exempt_reason_cd (new, C5): bilingual reason codes a non-standard
--    tax-category line carries on fiscal documents (ADR-060 §6), scoped per
--    country because reason wording and availability differ by tax
--    jurisdiction. Seeded empty -- no exempt product exists yet to need one;
--    rows are added per country as real exemptions are configured (P7).
--
-- 2. org_tax_profiles_cf: rounding_level (LINE/DOCUMENT), rounding_mode (FK
--    sys_rounding_mode_cd), output_decimal_places, rounding_increment_minor.
--    NULL in the two latter falls back to the currency ACCOUNTING rule
--    (PLAN.md §6.6, §9 L14). Seeded DOCUMENT / HALF_UP / NULL / NULL on all
--    10 existing profiles: one rounding per tax line on the order base, at
--    currency decimals -- today's behaviour, no figure change.
--
-- 3. org_product_data_mst:
--    - tax_category_code (FK sys_tax_category_cd, NOT NULL, seeded STANDARD):
--      replaces the integer is_tax_exempt as the line-tax-category source.
--      is_tax_exempt itself is NOT dropped here -- M11 drops it after the
--      Phase 10 recompute, once nothing reads it.
--    - tax_supply_code (nullable, no default, C5): the UNCL/customs supply
--      code (e.g. EXEMPT_SERVICE, EXPORT) a tax profile's applies_to list can
--      match on (ADR-060 §6). Free text, no FK -- no fixed catalog exists and
--      none is seeded (today no product has one, so profile selection by
--      supply code changes nothing, matching ADR-060 §6 / PF-06).
--    - tax_exempt_reason (nullable, C5): which sys_tax_exempt_reason_cd
--      row explains a non-STANDARD tax_category_code. Not an FK: the table
--      is keyed by (country, code) and org_product_data_mst carries no
--      country column (a product's country is its tenant's, via
--      org_tenants_mst.country); validity against the tenant's country is
--      checked at the service layer (Phase 4/7), not by the DB.
--    - price_type case drift fixed: 'per_piece' -> 'PER_PC' (3 rows on the
--      remote DB). A CHECK is added for the two known codes, FIXED and
--      PER_PC, nullable otherwise. Verified on the remote DB before writing
--      this migration: 6 rows stay NULL (2 retail/sale items with no
--      per-piece or fixed pricing concept, 4 laundry products that were
--      simply never classified) -- the plan's seed step only converts
--      per_piece -> PER_PC, so those 6 are left as-is; they are a catalog
--      data-quality gap for the owner, not something this migration guesses
--      at.
--
-- Rollback (forward-only): ALTER TABLE org_product_data_mst DROP COLUMN
-- tax_category_code, tax_supply_code, tax_exempt_reason RESTRICT; ALTER
-- TABLE org_tax_profiles_cf DROP COLUMN rounding_level, rounding_mode,
-- output_decimal_places, rounding_increment_minor RESTRICT; DROP TABLE
-- sys_tax_exempt_reason_cd RESTRICT. The price_type fix is not reversed (it
-- corrects existing data, not a schema addition).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. sys_tax_exempt_reason_cd
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_tax_exempt_reason_cd (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  country       TEXT NOT NULL,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    UUID,
  updated_at    TIMESTAMPTZ,
  updated_by    UUID,

  CONSTRAINT pk_sys_tax_exempt_reason PRIMARY KEY (id),
  CONSTRAINT uq_sys_tax_exempt_reason_country_code UNIQUE (country, code),
  CONSTRAINT fk_sys_tax_exempt_reason_country FOREIGN KEY (country) REFERENCES public.sys_country_cd(code)
);

CREATE INDEX IF NOT EXISTS idx_sys_tax_exempt_reason_country
  ON public.sys_tax_exempt_reason_cd (country, is_active);

COMMENT ON TABLE public.sys_tax_exempt_reason_cd IS
  'Line-Level Money Snapshot (ADR-060 §6, Phase 0 C5): bilingual reason codes a non-STANDARD tax-category line carries on fiscal documents. Scoped per country -- the same real-world reason can have different wording, or not exist, in different tax jurisdictions. Seeded empty by this migration; rows are added per country as real exemptions are configured (Phase 7).';
COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.country IS 'FK sys_country_cd.code. The jurisdiction this reason applies in.';
COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.code IS 'Reason code, unique within its country (e.g. GOVERNMENT_ENTITY, DIPLOMATIC, EXPORT).';
COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_tax_exempt_reason_cd.name2 IS 'Arabic display name.';

-- ------------------------------------------------------------------
-- 2. org_tax_profiles_cf — rounding configuration
-- ------------------------------------------------------------------
ALTER TABLE public.org_tax_profiles_cf
  ADD COLUMN IF NOT EXISTS rounding_level            TEXT NOT NULL DEFAULT 'DOCUMENT',
  ADD COLUMN IF NOT EXISTS rounding_mode             TEXT NOT NULL DEFAULT 'HALF_UP',
  ADD COLUMN IF NOT EXISTS output_decimal_places     SMALLINT,
  ADD COLUMN IF NOT EXISTS rounding_increment_minor  INTEGER;

ALTER TABLE public.org_tax_profiles_cf
  ADD CONSTRAINT chk_org_tax_prof_rounding_level
    CHECK (rounding_level IN ('LINE', 'DOCUMENT')),
  ADD CONSTRAINT fk_org_tax_prof_rounding_mode
    FOREIGN KEY (rounding_mode) REFERENCES public.sys_rounding_mode_cd(code),
  ADD CONSTRAINT chk_org_tax_prof_decimal_places
    CHECK (output_decimal_places IS NULL OR output_decimal_places >= 0),
  ADD CONSTRAINT chk_org_tax_prof_increment_minor
    CHECK (rounding_increment_minor IS NULL OR rounding_increment_minor > 0);

COMMENT ON COLUMN public.org_tax_profiles_cf.rounding_level IS
  'LINE (round each line''s tax) or DOCUMENT (round the summed tax once per category). Seeded DOCUMENT -- today''s behaviour, no figure change.';
COMMENT ON COLUMN public.org_tax_profiles_cf.rounding_mode IS
  'FK sys_rounding_mode_cd. Seeded HALF_UP -- today''s behaviour.';
COMMENT ON COLUMN public.org_tax_profiles_cf.output_decimal_places IS
  'Decimal places to round tax figures to. NULL falls back to the order currency''s ACCOUNTING rounding rule (PLAN.md §9, L14).';
COMMENT ON COLUMN public.org_tax_profiles_cf.rounding_increment_minor IS
  'Coin-step increment in minor units (e.g. 5 = round to the nearest 0.05), if this profile rounds to a step rather than to decimal places. NULL falls back to the currency ACCOUNTING rule.';

-- ------------------------------------------------------------------
-- 3. org_product_data_mst — tax category, supply code, exempt reason,
--    price_type fix
-- ------------------------------------------------------------------
UPDATE public.org_product_data_mst
SET price_type = 'PER_PC'
WHERE price_type = 'per_piece';

ALTER TABLE public.org_product_data_mst
  ADD COLUMN IF NOT EXISTS tax_category_code  TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS tax_supply_code     TEXT,
  ADD COLUMN IF NOT EXISTS tax_exempt_reason   TEXT;

ALTER TABLE public.org_product_data_mst
  ADD CONSTRAINT fk_org_product_tax_category
    FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd(code),
  ADD CONSTRAINT chk_org_product_price_type
    CHECK (price_type IS NULL OR price_type IN ('FIXED', 'PER_PC'));

COMMENT ON COLUMN public.org_product_data_mst.tax_category_code IS
  'Line-Level Money Snapshot (ADR-060 §6): this product''s tax-base category, FK sys_tax_category_cd. Seeded STANDARD on every existing row (no exempt products today). Replaces is_tax_exempt as the source of a line''s tax category; is_tax_exempt itself is untouched here and dropped in M11 once nothing reads it.';
COMMENT ON COLUMN public.org_product_data_mst.tax_supply_code IS
  'Optional UNCL/customs supply code (e.g. EXEMPT_SERVICE, EXPORT) a tax profile''s applies_to list can match on (ADR-060 §6). Free text, no fixed catalog. NULL on every existing row (no figure change: a profile with an empty applies_to still applies to every line as a default).';
COMMENT ON COLUMN public.org_product_data_mst.tax_exempt_reason IS
  'Which sys_tax_exempt_reason_cd row explains a non-STANDARD tax_category_code. Not an FK: that table is keyed by (country, code) and this table carries no country column (a product''s country is its tenant''s); validity is checked at the service layer against the tenant''s country.';

COMMIT;
