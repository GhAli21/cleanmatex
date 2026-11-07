-- =============================================================================
-- Migration: 0712_tax_kits_catalog.sql
-- Program:   Tax Engine T2 / M2 — HQ tax catalog, country kits, starter packages
-- Plan:      docs/features/Tax_Config/TAX_ENGINE_PLAN.md §4 (L1, L1b), §4.7, §6.1
-- Facts:     docs/features/Tax_Config/KIT_FACTS.md (every seeded rate/threshold
--            cites a row there; unverified facts carry is_verified = false)
-- Purpose:
--   HQ (the SaaS Backoffice) owns ready-made tax setups per country so an
--   inexperienced laundry gets a correct setup without tax knowledge.
--     sys_tax_types_cd            + charge_kind, new levy / WHT types
--     sys_tax_party_class_cd      who the customer / supplier is (new)
--     sys_tax_segment_cd          business situation of the laundry (new)
--     sys_tax_kits_mst            one kit per country / kind (new)
--     sys_tax_kit_versions_mst    dated, publishable versions of a kit (new)
--     sys_tax_kit_codes_dtl       tax codes of a version (rates live here once)
--     sys_tax_kit_item_classes_dtl  item tax classes of a version
--     sys_tax_kit_rules_dtl       which codes apply (match criteria)
--     sys_tax_kit_rule_codes_dtl  ordered codes a rule yields
--     sys_tax_kit_vectors_dtl     worked examples (input → expected tax)
--     sys_starter_pkg_mst         country × segment starter package (typed, no
--                                 general settings — owner decision 2026-11-07)
--     sys_starter_pkg_trig_dtl    when the tax document is issued per package
--     org_tenants_mst.starter_pkg_code  package chosen for the organization
-- Design note: country packs and kits are merged (a kit version holds the
--   country's legal parameters: thresholds, rounding, tax point). Country =
--   jurisdiction for GCC; the UAE emirate is a reporting dimension (M3), not a
--   separate jurisdiction. Nothing is copied into tenants here: that is
--   fn_tax_kit_apply (M3).
-- Rollback: drop org_tenants_mst.starter_pkg_code, then the new tables in
--   reverse order (RESTRICT), then sys_tax_types_cd.charge_kind and the 5 new
--   type rows.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Tax types: charge kind + new types ──────────────────────────────────

ALTER TABLE public.sys_tax_types_cd
  ADD COLUMN IF NOT EXISTS charge_kind TEXT NOT NULL DEFAULT 'TAX';

COMMENT ON COLUMN public.sys_tax_types_cd.charge_kind IS
  'TAX = a tax computed on a taxable amount (VAT, GST, WHT); LEVY = a government charge that may be fixed or percent and is shown separately (municipality, tourism, service levies).';

ALTER TABLE public.sys_tax_types_cd
  ADD CONSTRAINT ck_stt_charge_kind CHECK (charge_kind IN ('TAX', 'LEVY'));

COMMENT ON CONSTRAINT ck_stt_charge_kind ON public.sys_tax_types_cd IS 'Allowed charge kinds.';

INSERT INTO public.sys_tax_types_cd (tax_type, name, name2, description, sort_order, charge_kind, is_active, rec_status, created_by, created_info)
VALUES
  ('WHT',              'Withholding tax',  'ضريبة الاستقطاع',  'Tax withheld from a payment to a supplier and paid to the authority.', 40, 'TAX',  true, 1, 'migration_0712', 'Tax engine M2'),
  ('MUNICIPALITY_TAX', 'Municipality tax', 'رسوم البلدية',     'Municipality charge on certain services.',                             50, 'LEVY', true, 1, 'migration_0712', 'Tax engine M2'),
  ('TOURISM_TAX',      'Tourism tax',      'ضريبة السياحة',    'Tourism tax on certain services.',                                     60, 'LEVY', true, 1, 'migration_0712', 'Tax engine M2'),
  ('TOURISM_LEVY',     'Tourism levy',     'رسوم السياحة',     'Fixed or percent tourism levy.',                                       70, 'LEVY', true, 1, 'migration_0712', 'Tax engine M2'),
  ('SERVICE_LEVY',     'Service levy',     'رسوم الخدمة',      'Government service levy.',                                             80, 'LEVY', true, 1, 'migration_0712', 'Tax engine M2')
ON CONFLICT (tax_type) DO UPDATE
   SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description,
       charge_kind = EXCLUDED.charge_kind, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 2. Party tax classes ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_tax_party_class_cd (
  party_class_code TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  name2            TEXT        NULL,
  description      TEXT        NULL,
  description2     TEXT        NULL,
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  display_order    INTEGER     NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  rec_status       SMALLINT    NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       TEXT        NULL,
  created_info     TEXT        NULL,
  updated_at       TIMESTAMPTZ NULL,
  updated_by       TEXT        NULL,
  updated_info     TEXT        NULL,
  CONSTRAINT pk_sys_tax_party_cls PRIMARY KEY (party_class_code),
  CONSTRAINT ck_stpc_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stpc_one_default ON public.sys_tax_party_class_cd ((true)) WHERE is_default;

COMMENT ON TABLE  public.sys_tax_party_class_cd IS 'Tax class of a customer or supplier; tax rules match on it (e.g. a VAT-registered business gets a full tax invoice).';
COMMENT ON COLUMN public.sys_tax_party_class_cd.party_class_code IS 'Stable code used by rules and stored on customers / suppliers.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.description IS 'English explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.description2 IS 'Arabic explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.is_default IS 'Class used when a customer has none (one row only).';
COMMENT ON COLUMN public.sys_tax_party_class_cd.display_order IS 'Order in pickers.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.is_active IS 'False = hidden from pickers; existing references stay valid.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_party_class_cd.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT ck_stpc_rec_status ON public.sys_tax_party_class_cd IS 'Allowed record statuses.';
COMMENT ON INDEX public.uq_stpc_one_default IS 'At most one default party class.';

INSERT INTO public.sys_tax_party_class_cd (party_class_code, name, name2, description, description2, is_default, display_order, created_by, created_info) VALUES
  ('CONSUMER',            'Individual customer',        'عميل فرد',               'A person buying for personal use. Gets a simplified tax invoice.',                         'شخص يشتري لاستخدامه الشخصي. يحصل على فاتورة ضريبية مبسطة.',             true,  10, 'migration_0712', 'Tax engine M2'),
  ('BUSINESS_REGISTERED', 'VAT-registered business',    'منشأة مسجلة في الضريبة', 'A business with a VAT number. Gets a full tax invoice showing its VAT number.',            'منشأة لديها رقم ضريبي. تحصل على فاتورة ضريبية كاملة تظهر رقمها الضريبي.', false, 20, 'migration_0712', 'Tax engine M2'),
  ('BUSINESS_UNREGISTERED','Business, not VAT-registered','منشأة غير مسجلة في الضريبة','A business without a VAT number. Treated like an individual for invoices.',              'منشأة ليس لديها رقم ضريبي. تعامل كالفرد في الفواتير.',                  false, 30, 'migration_0712', 'Tax engine M2'),
  ('GOVERNMENT',          'Government body',            'جهة حكومية',             'A ministry or government body. Usually taxed like a business; check local rules.',         'وزارة أو جهة حكومية. تعامل غالباً كمنشأة؛ راجع الأنظمة المحلية.',        false, 40, 'migration_0712', 'Tax engine M2'),
  ('FOREIGN',             'Foreign / non-resident',     'جهة أجنبية / غير مقيمة', 'A customer or supplier outside the country. Purchases from them may need reverse charge.', 'عميل أو مورد خارج الدولة. قد تخضع المشتريات منه للاحتساب العكسي.',        false, 50, 'migration_0712', 'Tax engine M2'),
  ('EXEMPT_ENTITY',       'Tax-exempt body',            'جهة معفاة من الضريبة',   'A body with an official exemption (e.g. diplomatic). Needs an exemption certificate.',     'جهة لديها إعفاء رسمي (مثل الجهات الدبلوماسية). تحتاج شهادة إعفاء.',      false, 60, 'migration_0712', 'Tax engine M2')
ON CONFLICT (party_class_code) DO UPDATE
   SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       display_order = EXCLUDED.display_order, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

ALTER TABLE public.sys_tax_party_class_cd ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_stpc_read ON public.sys_tax_party_class_cd;
CREATE POLICY pol_stpc_read ON public.sys_tax_party_class_cd FOR SELECT TO authenticated USING (true);
COMMENT ON POLICY pol_stpc_read ON public.sys_tax_party_class_cd IS 'Any signed-in user may read (platform reference data).';
REVOKE ALL ON public.sys_tax_party_class_cd FROM PUBLIC, anon;                                     -- not public data
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sys_tax_party_class_cd FROM authenticated;     -- HQ writes via service role
GRANT SELECT ON public.sys_tax_party_class_cd TO authenticated;
GRANT ALL ON public.sys_tax_party_class_cd TO service_role;

-- ─── 3. Segments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_tax_segment_cd (
  segment_code  TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  name2         TEXT        NULL,
  description   TEXT        NULL,
  description2  TEXT        NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  CONSTRAINT pk_sys_tax_segment PRIMARY KEY (segment_code),
  CONSTRAINT ck_stsg_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_tax_segment_cd IS 'Business situation of a laundry (size / registration); selects the starter package and segment-only kit rules.';
COMMENT ON COLUMN public.sys_tax_segment_cd.segment_code IS 'Stable code used by packages and kit rules (segment_codes).';
COMMENT ON COLUMN public.sys_tax_segment_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_tax_segment_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_tax_segment_cd.description IS 'English explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_segment_cd.description2 IS 'Arabic explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_segment_cd.display_order IS 'Order in pickers.';
COMMENT ON COLUMN public.sys_tax_segment_cd.is_active IS 'False = hidden from pickers.';
COMMENT ON COLUMN public.sys_tax_segment_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_segment_cd.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_segment_cd.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_segment_cd.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_segment_cd.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_segment_cd.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_segment_cd.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT ck_stsg_rec_status ON public.sys_tax_segment_cd IS 'Allowed record statuses.';

INSERT INTO public.sys_tax_segment_cd (segment_code, name, name2, description, description2, display_order, created_by, created_info) VALUES
  ('SME',                'Small / medium laundry',   'مغسلة صغيرة / متوسطة',   'One or a few branches, mostly walk-in customers. Simple setup, prices include VAT.',           'فرع أو عدة فروع، معظم العملاء أفراد. إعداد بسيط والأسعار شاملة الضريبة.',          10, 'migration_0712', 'Tax engine M2'),
  ('ENTERPRISE',         'Large laundry / B2B',      'مغسلة كبيرة / شركات',     'Many branches or business customers (hotels, hospitals). Full invoices, prices before VAT.', 'فروع كثيرة أو عملاء شركات (فنادق، مستشفيات). فواتير كاملة والأسعار قبل الضريبة.',   20, 'migration_0712', 'Tax engine M2'),
  ('FRANCHISE_BASE',     'Franchise branch',         'فرع امتياز',              'Runs under a franchise brand. Same tax setup as a small laundry.',                           'يعمل تحت علامة امتياز. نفس الإعداد الضريبي للمغسلة الصغيرة.',                      30, 'migration_0712', 'Tax engine M2'),
  ('NOT_VAT_REGISTERED', 'Not VAT-registered',       'غير مسجل في الضريبة',     'Sales below the registration threshold. Charges no VAT and issues receipts only.',            'مبيعات أقل من حد التسجيل. لا تفرض ضريبة وتصدر إيصالات فقط.',                       40, 'migration_0712', 'Tax engine M2')
ON CONFLICT (segment_code) DO UPDATE
   SET name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       display_order = EXCLUDED.display_order, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

ALTER TABLE public.sys_tax_segment_cd ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_stsg_read ON public.sys_tax_segment_cd;
CREATE POLICY pol_stsg_read ON public.sys_tax_segment_cd FOR SELECT TO authenticated USING (true);
COMMENT ON POLICY pol_stsg_read ON public.sys_tax_segment_cd IS 'Any signed-in user may read (platform reference data).';
REVOKE ALL ON public.sys_tax_segment_cd FROM PUBLIC, anon;                                     -- not public data
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sys_tax_segment_cd FROM authenticated;     -- HQ writes via service role
GRANT SELECT ON public.sys_tax_segment_cd TO authenticated;
GRANT ALL ON public.sys_tax_segment_cd TO service_role;

-- ─── 4. Kits and kit versions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_tax_kits_mst (
  kit_code      TEXT        NOT NULL,
  country_code  TEXT        NULL,
  kit_kind      TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  name2         TEXT        NULL,
  description   TEXT        NULL,
  description2  TEXT        NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  CONSTRAINT pk_sys_tax_kits PRIMARY KEY (kit_code),
  CONSTRAINT fk_stk_country FOREIGN KEY (country_code) REFERENCES public.sys_country_cd (code) ON DELETE RESTRICT,
  CONSTRAINT ck_stk_kind CHECK (kit_kind IN ('VAT', 'NO_VAT', 'GENERIC')),
  CONSTRAINT ck_stk_country_kind CHECK (kit_kind <> 'VAT' OR country_code IS NOT NULL),
  CONSTRAINT ck_stk_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_tax_kits_mst IS 'HQ-prepared tax setup. VAT kits are per country (rates live once, shared by every package of that country); NO_VAT and GENERIC kits serve any country.';
COMMENT ON COLUMN public.sys_tax_kits_mst.kit_code IS 'Stable code, e.g. OM_VAT, NO_VAT, GENERIC_VAT.';
COMMENT ON COLUMN public.sys_tax_kits_mst.country_code IS 'Country the kit is for; NULL = usable in any country (NO_VAT, GENERIC).';
COMMENT ON COLUMN public.sys_tax_kits_mst.kit_kind IS 'VAT = verified country VAT; NO_VAT = no tax charged; GENERIC = organization enters its own rate (never claims verification).';
COMMENT ON COLUMN public.sys_tax_kits_mst.name IS 'English name.';
COMMENT ON COLUMN public.sys_tax_kits_mst.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_tax_kits_mst.description IS 'English explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_kits_mst.description2 IS 'Arabic explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_kits_mst.display_order IS 'Order in HQ lists.';
COMMENT ON COLUMN public.sys_tax_kits_mst.is_active IS 'False = cannot be applied to new organizations.';
COMMENT ON COLUMN public.sys_tax_kits_mst.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_kits_mst.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kits_mst.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kits_mst.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kits_mst.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kits_mst.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kits_mst.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT fk_stk_country ON public.sys_tax_kits_mst IS 'Country must exist.';
COMMENT ON CONSTRAINT ck_stk_kind ON public.sys_tax_kits_mst IS 'Allowed kit kinds.';
COMMENT ON CONSTRAINT ck_stk_country_kind ON public.sys_tax_kits_mst IS 'A VAT kit always belongs to one country.';
COMMENT ON CONSTRAINT ck_stk_rec_status ON public.sys_tax_kits_mst IS 'Allowed record statuses.';

CREATE TABLE IF NOT EXISTS public.sys_tax_kit_versions_mst (
  id                     UUID          NOT NULL DEFAULT gen_random_uuid(),
  kit_code               TEXT          NOT NULL,
  version_no             INTEGER       NOT NULL,
  status                 TEXT          NOT NULL DEFAULT 'DRAFT',
  effective_from         DATE          NOT NULL,
  effective_to           DATE          NULL,
  currency_code          TEXT          NULL,
  mandatory_reg_threshold DECIMAL(19,4) NULL,
  voluntary_reg_threshold DECIMAL(19,4) NULL,
  simplified_max_amount  DECIMAL(19,4) NULL,
  rounding_level         TEXT          NOT NULL DEFAULT 'LINE',
  rounding_mode          TEXT          NOT NULL DEFAULT 'HALF_UP',
  tax_on_advance         BOOLEAN       NOT NULL DEFAULT false,
  is_verified            BOOLEAN       NOT NULL DEFAULT false,
  source_url             TEXT          NULL,
  checked_on             DATE          NULL,
  review_notes           TEXT          NULL,
  published_at           TIMESTAMPTZ   NULL,
  published_by           TEXT          NULL,
  rec_status             SMALLINT      NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             TEXT          NULL,
  created_info           TEXT          NULL,
  updated_at             TIMESTAMPTZ   NULL,
  updated_by             TEXT          NULL,
  updated_info           TEXT          NULL,
  CONSTRAINT pk_sys_tax_kit_ver PRIMARY KEY (id),
  CONSTRAINT uq_stkv_kit_version UNIQUE (kit_code, version_no),
  CONSTRAINT fk_stkv_kit FOREIGN KEY (kit_code) REFERENCES public.sys_tax_kits_mst (kit_code) ON DELETE RESTRICT,
  CONSTRAINT fk_stkv_currency FOREIGN KEY (currency_code) REFERENCES public.sys_currency_cd (code) ON DELETE RESTRICT,
  CONSTRAINT ck_stkv_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT ck_stkv_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_stkv_amounts_ccy CHECK (currency_code IS NOT NULL OR (mandatory_reg_threshold IS NULL AND voluntary_reg_threshold IS NULL AND simplified_max_amount IS NULL)),
  CONSTRAINT ck_stkv_amounts_pos CHECK (COALESCE(mandatory_reg_threshold, 0) >= 0 AND COALESCE(voluntary_reg_threshold, 0) >= 0 AND COALESCE(simplified_max_amount, 0) >= 0),
  CONSTRAINT ck_stkv_round_lvl CHECK (rounding_level IN ('LINE', 'DOCUMENT')),
  CONSTRAINT ck_stkv_round_mode CHECK (rounding_mode IN ('HALF_UP', 'HALF_EVEN', 'UP', 'DOWN')),
  CONSTRAINT ck_stkv_published CHECK (status = 'DRAFT' OR published_at IS NOT NULL),
  CONSTRAINT ck_stkv_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE INDEX IF NOT EXISTS idx_stkv_kit_eff ON public.sys_tax_kit_versions_mst (kit_code, effective_from DESC) WHERE status = 'PUBLISHED';

COMMENT ON TABLE  public.sys_tax_kit_versions_mst IS 'A dated version of a kit holding the country legal parameters; a rate change is a new version from its effective date (never an edit of a published one).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.id IS 'Surrogate key referenced by the version''s codes, classes, rules and vectors.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.kit_code IS 'Kit this version belongs to.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.version_no IS 'Version number within the kit, 1, 2, …';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.status IS 'DRAFT (HQ editing), PUBLISHED (can be applied), RETIRED (kept for history).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.effective_from IS 'First tax date this version applies to.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.effective_to IS 'Last tax date this version applies to; NULL = open-ended.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.currency_code IS 'Currency of the amounts below; no default (locale field).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.mandatory_reg_threshold IS 'Yearly taxable sales above which registration is mandatory (KIT_FACTS §1). Used for guidance only.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.voluntary_reg_threshold IS 'Yearly taxable sales or expenses above which voluntary registration is allowed (KIT_FACTS §1).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.simplified_max_amount IS 'Highest invoice amount for which a simplified tax invoice may be issued to a VAT-registered customer; NULL = no amount limit (KIT_FACTS §2).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.rounding_level IS 'Where tax is rounded: LINE or DOCUMENT; residual is labelled, never hidden.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.rounding_mode IS 'Rounding rule to the currency minor unit.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.tax_on_advance IS 'True = an advance / deposit is a tax point for the amount received (KIT_FACTS §4).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.is_verified IS 'True only when every fact of this version was checked against an official source; false shows TAX_KIT_FACT_UNVERIFIED in HQ.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.source_url IS 'Main official source of the rates / thresholds.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.checked_on IS 'Date the facts were last checked.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.review_notes IS 'What is still unverified and where to check it.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.published_at IS 'When the version was published (required once not DRAFT).';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.published_by IS 'Who published the version.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kit_versions_mst.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT uq_stkv_kit_version ON public.sys_tax_kit_versions_mst IS 'One row per kit and version number.';
COMMENT ON CONSTRAINT fk_stkv_kit ON public.sys_tax_kit_versions_mst IS 'Version belongs to an existing kit.';
COMMENT ON CONSTRAINT fk_stkv_currency ON public.sys_tax_kit_versions_mst IS 'Currency must exist.';
COMMENT ON CONSTRAINT ck_stkv_status ON public.sys_tax_kit_versions_mst IS 'Allowed statuses.';
COMMENT ON CONSTRAINT ck_stkv_dates ON public.sys_tax_kit_versions_mst IS 'End date not before start date.';
COMMENT ON CONSTRAINT ck_stkv_amounts_ccy ON public.sys_tax_kit_versions_mst IS 'Amounts need a currency.';
COMMENT ON CONSTRAINT ck_stkv_amounts_pos ON public.sys_tax_kit_versions_mst IS 'Amounts are not negative.';
COMMENT ON CONSTRAINT ck_stkv_round_lvl ON public.sys_tax_kit_versions_mst IS 'Allowed rounding levels.';
COMMENT ON CONSTRAINT ck_stkv_round_mode ON public.sys_tax_kit_versions_mst IS 'Allowed rounding modes.';
COMMENT ON CONSTRAINT ck_stkv_published ON public.sys_tax_kit_versions_mst IS 'Published and retired versions record when they were published.';
COMMENT ON CONSTRAINT ck_stkv_rec_status ON public.sys_tax_kit_versions_mst IS 'Allowed record statuses.';
COMMENT ON INDEX public.idx_stkv_kit_eff IS 'Find the published version in force for a kit and date.';

-- ─── 5. Kit content: codes, item classes, rules, rule codes, vectors ────────

CREATE TABLE IF NOT EXISTS public.sys_tax_kit_codes_dtl (
  kit_version_id    UUID          NOT NULL,
  tax_code          TEXT          NOT NULL,
  name              TEXT          NOT NULL,
  name2             TEXT          NULL,
  tax_type          TEXT          NOT NULL,
  tax_category_code TEXT          NOT NULL,
  tax_flow_code     TEXT          NOT NULL,
  amount_kind       TEXT          NOT NULL DEFAULT 'PERCENT',
  rate              DECIMAL(9,4)  NULL,
  fixed_amount      DECIMAL(19,4) NULL,
  calc_level        TEXT          NOT NULL DEFAULT 'LINE',
  recoverable_pct   DECIMAL(7,4)  NOT NULL DEFAULT 100,
  is_reverse_charge BOOLEAN       NOT NULL DEFAULT false,
  priority          SMALLINT      NOT NULL DEFAULT 1,
  compound_base     BOOLEAN       NOT NULL DEFAULT false,
  display_order     INTEGER       NOT NULL DEFAULT 0,
  rec_status        SMALLINT      NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT          NULL,
  created_info      TEXT          NULL,
  updated_at        TIMESTAMPTZ   NULL,
  updated_by        TEXT          NULL,
  updated_info      TEXT          NULL,
  CONSTRAINT pk_sys_tax_kit_codes PRIMARY KEY (kit_version_id, tax_code),
  CONSTRAINT fk_stkc_version FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stkc_type FOREIGN KEY (tax_type) REFERENCES public.sys_tax_types_cd (tax_type) ON DELETE RESTRICT,
  CONSTRAINT fk_stkc_category FOREIGN KEY (tax_category_code) REFERENCES public.sys_tax_category_cd (code) ON DELETE RESTRICT,
  CONSTRAINT ck_stkc_flow CHECK (tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING')),
  CONSTRAINT ck_stkc_amount_kind CHECK (amount_kind IN ('PERCENT', 'FIXED')),
  CONSTRAINT ck_stkc_amount CHECK (
    (amount_kind = 'PERCENT' AND fixed_amount IS NULL AND (rate IS NULL OR rate BETWEEN 0 AND 100))
    OR (amount_kind = 'FIXED' AND rate IS NULL AND fixed_amount IS NOT NULL AND fixed_amount >= 0)),
  CONSTRAINT ck_stkc_calc_level CHECK (calc_level IN ('LINE', 'DOCUMENT')),
  CONSTRAINT ck_stkc_vat_line CHECK (tax_type <> 'VAT' OR calc_level = 'LINE'),
  CONSTRAINT ck_stkc_recoverable CHECK (recoverable_pct BETWEEN 0 AND 100),
  CONSTRAINT ck_stkc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_tax_kit_codes_dtl IS 'Tax codes of a kit version (rates live here once). Copied to org_tax_profiles_cf by fn_tax_kit_apply (M3).';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.kit_version_id IS 'Kit version the code belongs to.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.tax_code IS 'Stable code within the version, e.g. VAT_STD, VAT_IN_STD.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.name IS 'English name shown on invoices and screens.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.name2 IS 'Arabic name shown on invoices and screens.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.tax_type IS 'Tax type (VAT, WHT, levies).';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.tax_category_code IS 'STANDARD / ZERO_RATED / EXEMPT / OUT_OF_SCOPE; drives invoice and return grouping.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.tax_flow_code IS 'OUTPUT (sales), INPUT (purchases) or WITHHOLDING.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.amount_kind IS 'PERCENT of the taxable amount, or FIXED amount.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.rate IS 'Percent rate; NULL only in GENERIC kits where the organization must enter it before confirming.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.fixed_amount IS 'Fixed amount per line / document when amount_kind = FIXED.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.calc_level IS 'LINE or DOCUMENT; VAT is always per line.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.recoverable_pct IS 'Share of input tax that can be reclaimed (input codes); the rest is a cost.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.is_reverse_charge IS 'True = the buyer accounts for the tax (output and input pair, net zero).';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.priority IS 'Order when several codes stack on one line.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.compound_base IS 'True = taxable amount includes earlier-priority taxes.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.display_order IS 'Order in lists.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kit_codes_dtl.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT fk_stkc_version ON public.sys_tax_kit_codes_dtl IS 'Code belongs to an existing kit version.';
COMMENT ON CONSTRAINT fk_stkc_type ON public.sys_tax_kit_codes_dtl IS 'Tax type must exist.';
COMMENT ON CONSTRAINT fk_stkc_category ON public.sys_tax_kit_codes_dtl IS 'Tax category must exist.';
COMMENT ON CONSTRAINT ck_stkc_flow ON public.sys_tax_kit_codes_dtl IS 'Allowed tax flows.';
COMMENT ON CONSTRAINT ck_stkc_amount_kind ON public.sys_tax_kit_codes_dtl IS 'Allowed amount kinds.';
COMMENT ON CONSTRAINT ck_stkc_amount ON public.sys_tax_kit_codes_dtl IS 'PERCENT uses rate 0–100 only; FIXED uses a non-negative fixed amount only.';
COMMENT ON CONSTRAINT ck_stkc_calc_level ON public.sys_tax_kit_codes_dtl IS 'Allowed calculation levels.';
COMMENT ON CONSTRAINT ck_stkc_vat_line ON public.sys_tax_kit_codes_dtl IS 'VAT is always calculated per line.';
COMMENT ON CONSTRAINT ck_stkc_recoverable ON public.sys_tax_kit_codes_dtl IS 'Recoverable share 0–100%.';
COMMENT ON CONSTRAINT ck_stkc_rec_status ON public.sys_tax_kit_codes_dtl IS 'Allowed record statuses.';

CREATE TABLE IF NOT EXISTS public.sys_tax_kit_item_classes_dtl (
  kit_version_id UUID        NOT NULL,
  class_code     TEXT        NOT NULL,
  tax_flow_code  TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  name2          TEXT        NULL,
  description    TEXT        NULL,
  description2   TEXT        NULL,
  is_default     BOOLEAN     NOT NULL DEFAULT false,
  display_order  INTEGER     NOT NULL DEFAULT 0,
  rec_status     SMALLINT    NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT        NULL,
  created_info   TEXT        NULL,
  updated_at     TIMESTAMPTZ NULL,
  updated_by     TEXT        NULL,
  updated_info   TEXT        NULL,
  CONSTRAINT pk_sys_tax_kit_cls PRIMARY KEY (kit_version_id, class_code),
  CONSTRAINT fk_stki_version FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT ck_stki_flow CHECK (tax_flow_code IN ('OUTPUT', 'INPUT')),
  CONSTRAINT ck_stki_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stki_default ON public.sys_tax_kit_item_classes_dtl (kit_version_id, tax_flow_code) WHERE is_default;

COMMENT ON TABLE  public.sys_tax_kit_item_classes_dtl IS 'Item tax classes of a kit version (what is being sold or bought); products, categories and expense categories point to one.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.kit_version_id IS 'Kit version the class belongs to.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.class_code IS 'Stable class code, e.g. LAUNDRY_SERVICE, PURCHASE_STANDARD.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.tax_flow_code IS 'OUTPUT classes are for sales items, INPUT classes for purchases / expenses.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.name IS 'English name.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.description IS 'English explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.description2 IS 'Arabic explanation in plain words.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.is_default IS 'Class given to items without one at kit apply (one per flow).';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.display_order IS 'Order in pickers.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kit_item_classes_dtl.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT fk_stki_version ON public.sys_tax_kit_item_classes_dtl IS 'Class belongs to an existing kit version.';
COMMENT ON CONSTRAINT ck_stki_flow ON public.sys_tax_kit_item_classes_dtl IS 'Allowed flows for classes.';
COMMENT ON CONSTRAINT ck_stki_rec_status ON public.sys_tax_kit_item_classes_dtl IS 'Allowed record statuses.';
COMMENT ON INDEX public.uq_stki_default IS 'One default class per kit version and flow.';

CREATE TABLE IF NOT EXISTS public.sys_tax_kit_rules_dtl (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  kit_version_id        UUID        NOT NULL,
  rule_code             TEXT        NOT NULL,
  doc_type_code         TEXT        NULL,
  tax_flow_code         TEXT        NULL,
  tax_item_class_code   TEXT        NULL,
  party_tax_class_code  TEXT        NULL,
  party_country_scope   TEXT        NULL,
  segment_codes         TEXT[]      NULL,
  priority              SMALLINT    NOT NULL DEFAULT 100,
  name                  TEXT        NOT NULL,
  name2                 TEXT        NULL,
  rec_status            SMALLINT    NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            TEXT        NULL,
  created_info          TEXT        NULL,
  updated_at            TIMESTAMPTZ NULL,
  updated_by            TEXT        NULL,
  updated_info          TEXT        NULL,
  CONSTRAINT pk_sys_tax_kit_rules PRIMARY KEY (id),
  CONSTRAINT uq_stkr_code UNIQUE (kit_version_id, rule_code),
  CONSTRAINT uq_stkr_id_version UNIQUE (id, kit_version_id),
  CONSTRAINT uq_stkr_criteria UNIQUE NULLS NOT DISTINCT
    (kit_version_id, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope, segment_codes),
  CONSTRAINT fk_stkr_version FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stkr_doc_type FOREIGN KEY (doc_type_code) REFERENCES public.sys_doc_seq_type_cd (doc_type_code) ON DELETE RESTRICT,
  CONSTRAINT fk_stkr_class FOREIGN KEY (kit_version_id, tax_item_class_code)
    REFERENCES public.sys_tax_kit_item_classes_dtl (kit_version_id, class_code) ON DELETE RESTRICT,
  CONSTRAINT fk_stkr_party FOREIGN KEY (party_tax_class_code) REFERENCES public.sys_tax_party_class_cd (party_class_code) ON DELETE RESTRICT,
  CONSTRAINT ck_stkr_flow CHECK (tax_flow_code IS NULL OR tax_flow_code IN ('OUTPUT', 'INPUT', 'WITHHOLDING')),
  CONSTRAINT ck_stkr_scope CHECK (party_country_scope IS NULL OR party_country_scope IN ('DOMESTIC', 'GCC', 'FOREIGN')),
  CONSTRAINT ck_stkr_segments CHECK (segment_codes IS NULL OR cardinality(segment_codes) > 0),
  CONSTRAINT ck_stkr_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_tax_kit_rules_dtl IS 'Which tax codes apply. NULL criteria = any; the most specific match wins, then priority; two rules with identical criteria are refused (uq_stkr_criteria). Copied to org_tax_rules_cf by fn_tax_kit_apply (M3).';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.id IS 'Surrogate key.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.kit_version_id IS 'Kit version the rule belongs to.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.rule_code IS 'Stable rule code within the version.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.doc_type_code IS 'Match: document type; NULL = any.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.tax_flow_code IS 'Match: tax flow of the document type; NULL = any.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.tax_item_class_code IS 'Match: item tax class; NULL = any.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.party_tax_class_code IS 'Match: customer / supplier tax class; NULL = any.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.party_country_scope IS 'Match: party location DOMESTIC / GCC / FOREIGN; NULL = any.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.segment_codes IS 'Rule copied only for these segments (sorted, checked against sys_tax_segment_cd by trigger); NULL = every segment.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.priority IS 'Tie-break between equally specific rules; lower wins.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.name IS 'English explanation shown in the explain preview.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.name2 IS 'Arabic explanation shown in the explain preview.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kit_rules_dtl.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT uq_stkr_code ON public.sys_tax_kit_rules_dtl IS 'Rule code unique within a version.';
COMMENT ON CONSTRAINT uq_stkr_id_version ON public.sys_tax_kit_rules_dtl IS 'Target of the rule-codes FK so a rule''s codes stay in the same version.';
COMMENT ON CONSTRAINT uq_stkr_criteria ON public.sys_tax_kit_rules_dtl IS 'Ambiguity refused: no two rules with the same criteria in a version.';
COMMENT ON CONSTRAINT fk_stkr_version ON public.sys_tax_kit_rules_dtl IS 'Rule belongs to an existing kit version.';
COMMENT ON CONSTRAINT fk_stkr_doc_type ON public.sys_tax_kit_rules_dtl IS 'Document type must exist in the registry.';
COMMENT ON CONSTRAINT fk_stkr_class ON public.sys_tax_kit_rules_dtl IS 'Item class must belong to the same kit version (NULL = any).';
COMMENT ON CONSTRAINT fk_stkr_party ON public.sys_tax_kit_rules_dtl IS 'Party class must exist.';
COMMENT ON CONSTRAINT ck_stkr_flow ON public.sys_tax_kit_rules_dtl IS 'Allowed tax flows.';
COMMENT ON CONSTRAINT ck_stkr_scope ON public.sys_tax_kit_rules_dtl IS 'Allowed party country scopes.';
COMMENT ON CONSTRAINT ck_stkr_segments ON public.sys_tax_kit_rules_dtl IS 'Segment list is NULL or not empty.';
COMMENT ON CONSTRAINT ck_stkr_rec_status ON public.sys_tax_kit_rules_dtl IS 'Allowed record statuses.';

CREATE OR REPLACE FUNCTION public.fn_stkr_check_segments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_bad TEXT;
BEGIN
  IF NEW.segment_codes IS NOT NULL THEN
    NEW.segment_codes := ARRAY(SELECT DISTINCT s FROM unnest(NEW.segment_codes) s ORDER BY s);  -- canonical order for uq_stkr_criteria
    SELECT string_agg(s, ', ') INTO v_bad
      FROM unnest(NEW.segment_codes) s
     WHERE NOT EXISTS (SELECT 1 FROM public.sys_tax_segment_cd g WHERE g.segment_code = s);
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'TAX_RULE_UNKNOWN_SEGMENT: %', v_bad USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_stkr_check_segments() IS 'Sorts and de-duplicates segment_codes and refuses codes missing from sys_tax_segment_cd (arrays cannot carry an FK).';

DROP TRIGGER IF EXISTS trg_stkr_segments ON public.sys_tax_kit_rules_dtl;
CREATE TRIGGER trg_stkr_segments
  BEFORE INSERT OR UPDATE OF segment_codes ON public.sys_tax_kit_rules_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_stkr_check_segments();

COMMENT ON TRIGGER trg_stkr_segments ON public.sys_tax_kit_rules_dtl IS 'Validates and normalises segment_codes.';

CREATE TABLE IF NOT EXISTS public.sys_tax_kit_rule_codes_dtl (
  rule_id        UUID        NOT NULL,
  kit_version_id UUID        NOT NULL,
  seq_no         SMALLINT    NOT NULL,
  tax_code       TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT        NULL,
  created_info   TEXT        NULL,
  updated_at     TIMESTAMPTZ NULL,
  updated_by     TEXT        NULL,
  updated_info   TEXT        NULL,
  CONSTRAINT pk_sys_tax_kit_rcodes PRIMARY KEY (rule_id, seq_no),
  CONSTRAINT uq_stkrc_rule_code UNIQUE (rule_id, tax_code),
  CONSTRAINT fk_stkrc_rule FOREIGN KEY (rule_id, kit_version_id)
    REFERENCES public.sys_tax_kit_rules_dtl (id, kit_version_id) ON DELETE CASCADE,
  CONSTRAINT fk_stkrc_code FOREIGN KEY (kit_version_id, tax_code)
    REFERENCES public.sys_tax_kit_codes_dtl (kit_version_id, tax_code) ON DELETE RESTRICT,
  CONSTRAINT ck_stkrc_seq CHECK (seq_no > 0)
);

COMMENT ON TABLE  public.sys_tax_kit_rule_codes_dtl IS 'Ordered tax codes a rule yields (several = stacked taxes). Every rule has at least one (zero-rate / out-of-scope codes express "no tax").';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.rule_id IS 'Rule that yields the code.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.kit_version_id IS 'Kit version of both the rule and the code (kept equal by the two FKs).';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.seq_no IS 'Application order, 1 first.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.tax_code IS 'Code applied.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kit_rule_codes_dtl.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT uq_stkrc_rule_code ON public.sys_tax_kit_rule_codes_dtl IS 'A code appears once per rule.';
COMMENT ON CONSTRAINT fk_stkrc_rule ON public.sys_tax_kit_rule_codes_dtl IS 'Rule must exist in the same version; codes are owned by the rule (CASCADE is limited to these child rows of a draft rule).';
COMMENT ON CONSTRAINT fk_stkrc_code ON public.sys_tax_kit_rule_codes_dtl IS 'Code must exist in the same kit version.';
COMMENT ON CONSTRAINT ck_stkrc_seq ON public.sys_tax_kit_rule_codes_dtl IS 'Sequence starts at 1.';

CREATE TABLE IF NOT EXISTS public.sys_tax_kit_vectors_dtl (
  kit_version_id UUID        NOT NULL,
  vector_code    TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  description2   TEXT        NULL,
  input          JSONB       NOT NULL,
  expected       JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT        NULL,
  created_info   TEXT        NULL,
  updated_at     TIMESTAMPTZ NULL,
  updated_by     TEXT        NULL,
  updated_info   TEXT        NULL,
  CONSTRAINT pk_sys_tax_kit_vectors PRIMARY KEY (kit_version_id, vector_code),
  CONSTRAINT fk_stkx_version FOREIGN KEY (kit_version_id) REFERENCES public.sys_tax_kit_versions_mst (id) ON DELETE RESTRICT,
  CONSTRAINT ck_stkx_json CHECK (jsonb_typeof(input) = 'object' AND jsonb_typeof(expected) = 'object')
);

COMMENT ON TABLE  public.sys_tax_kit_vectors_dtl IS 'Worked examples a kit version must pass before publishing; also shown to owners as "for example". Amounts are strings to keep exact decimals.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.kit_version_id IS 'Kit version tested.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.vector_code IS 'Stable example code.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.description IS 'English explanation of the example.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.description2 IS 'Arabic explanation of the example.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.input IS 'Engine input: doc_type, item_class, party_class, pricing_mode, amount.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.expected IS 'Expected result: tax_code, taxable, tax.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_tax_kit_vectors_dtl.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT fk_stkx_version ON public.sys_tax_kit_vectors_dtl IS 'Example belongs to an existing kit version.';
COMMENT ON CONSTRAINT ck_stkx_json ON public.sys_tax_kit_vectors_dtl IS 'Input and expected are JSON objects.';

-- ─── 6. Starter packages ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_starter_pkg_mst (
  pkg_code               TEXT        NOT NULL,
  country_code           TEXT        NULL,
  segment_code           TEXT        NOT NULL,
  tax_kit_code           TEXT        NOT NULL,
  calendar_template_code TEXT        NOT NULL,
  tax_setup_mode         TEXT        NOT NULL DEFAULT 'BASIC',
  tax_pricing_mode       TEXT        NOT NULL DEFAULT 'INCLUSIVE',
  is_country_default     BOOLEAN     NOT NULL DEFAULT false,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  display_order          INTEGER     NOT NULL DEFAULT 0,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  CONSTRAINT pk_sys_starter_pkg PRIMARY KEY (pkg_code),
  CONSTRAINT uq_ssp_country_segment UNIQUE NULLS NOT DISTINCT (country_code, segment_code),
  CONSTRAINT fk_ssp_country FOREIGN KEY (country_code) REFERENCES public.sys_country_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_ssp_segment FOREIGN KEY (segment_code) REFERENCES public.sys_tax_segment_cd (segment_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ssp_kit FOREIGN KEY (tax_kit_code) REFERENCES public.sys_tax_kits_mst (kit_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ssp_calendar FOREIGN KEY (calendar_template_code) REFERENCES public.sys_calendar_templates_mst (calendar_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ssp_mode CHECK (tax_setup_mode IN ('BASIC', 'ADVANCED')),
  CONSTRAINT ck_ssp_pricing CHECK (tax_pricing_mode IN ('INCLUSIVE', 'EXCLUSIVE')),
  CONSTRAINT ck_ssp_rec_status CHECK (rec_status IN (0, 1, 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ssp_country_default ON public.sys_starter_pkg_mst ((COALESCE(country_code, '*'))) WHERE is_country_default;

COMMENT ON TABLE  public.sys_starter_pkg_mst IS 'Ready setup for a country and business segment: which tax kit, calendar, mode and price mode a new organization gets (typed columns, not general settings — owner decision 2026-11-07). Resolution: country + segment → package, else country default, else generic default.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.pkg_code IS 'Stable code, e.g. OM_SME.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.country_code IS 'Country; NULL = generic package for countries without their own.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.segment_code IS 'Business segment.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.tax_kit_code IS 'Tax kit applied (latest published version in force); must be the country''s kit or a country-neutral kit.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.calendar_template_code IS 'Business calendar copied at onboarding.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.tax_setup_mode IS 'BASIC (plain questions) or ADVANCED (codes, rules, classes).';
COMMENT ON COLUMN public.sys_starter_pkg_mst.tax_pricing_mode IS 'INCLUSIVE = shelf prices include tax (GCC retail norm); EXCLUSIVE = tax added on top (B2B).';
COMMENT ON COLUMN public.sys_starter_pkg_mst.is_country_default IS 'Package used when the segment is not chosen (one per country, one generic).';
COMMENT ON COLUMN public.sys_starter_pkg_mst.name IS 'English name.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.description IS 'English summary in plain words.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.description2 IS 'Arabic summary in plain words.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.display_order IS 'Order in HQ pickers.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.is_active IS 'False = not offered to new organizations.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_starter_pkg_mst.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT uq_ssp_country_segment ON public.sys_starter_pkg_mst IS 'One package per country and segment (generic = NULL country).';
COMMENT ON CONSTRAINT fk_ssp_country ON public.sys_starter_pkg_mst IS 'Country must exist.';
COMMENT ON CONSTRAINT fk_ssp_segment ON public.sys_starter_pkg_mst IS 'Segment must exist.';
COMMENT ON CONSTRAINT fk_ssp_kit ON public.sys_starter_pkg_mst IS 'Kit must exist.';
COMMENT ON CONSTRAINT fk_ssp_calendar ON public.sys_starter_pkg_mst IS 'Calendar template must exist.';
COMMENT ON CONSTRAINT ck_ssp_mode ON public.sys_starter_pkg_mst IS 'Allowed setup modes.';
COMMENT ON CONSTRAINT ck_ssp_pricing ON public.sys_starter_pkg_mst IS 'Allowed pricing modes.';
COMMENT ON CONSTRAINT ck_ssp_rec_status ON public.sys_starter_pkg_mst IS 'Allowed record statuses.';
COMMENT ON INDEX public.uq_ssp_country_default IS 'One default package per country and one generic default.';

CREATE OR REPLACE FUNCTION public.fn_ssp_check_kit_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_tax_kits_mst k
              WHERE k.kit_code = NEW.tax_kit_code
                AND k.country_code IS NOT NULL
                AND k.country_code IS DISTINCT FROM NEW.country_code) THEN
    RAISE EXCEPTION 'STARTER_PKG_KIT_COUNTRY: kit % is for another country than package %', NEW.tax_kit_code, NEW.pkg_code
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_ssp_check_kit_country() IS 'A package may use its own country''s kit or a country-neutral kit, never another country''s.';

DROP TRIGGER IF EXISTS trg_ssp_kit_country ON public.sys_starter_pkg_mst;
CREATE TRIGGER trg_ssp_kit_country
  BEFORE INSERT OR UPDATE OF tax_kit_code, country_code ON public.sys_starter_pkg_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ssp_check_kit_country();

COMMENT ON TRIGGER trg_ssp_kit_country ON public.sys_starter_pkg_mst IS 'Enforces package / kit country match.';

CREATE TABLE IF NOT EXISTS public.sys_starter_pkg_trig_dtl (
  pkg_code      TEXT        NOT NULL,
  trigger_event TEXT        NOT NULL,
  document_type TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  CONSTRAINT pk_sys_starter_pkg_trig PRIMARY KEY (pkg_code, trigger_event),
  CONSTRAINT fk_sspt_pkg FOREIGN KEY (pkg_code) REFERENCES public.sys_starter_pkg_mst (pkg_code) ON DELETE CASCADE,
  CONSTRAINT ck_sspt_event CHECK (trigger_event IN ('ON_ORDER_SUBMIT', 'ON_PAYMENT_CONFIRMATION', 'ON_SERVICE_COMPLETION', 'ON_DELIVERY', 'ON_AR_INVOICE_ISSUE')),
  CONSTRAINT ck_sspt_doc_type CHECK (document_type IN ('INVOICE', 'SIMPLIFIED_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'))
);

COMMENT ON TABLE  public.sys_starter_pkg_trig_dtl IS 'When a tax document is issued for organizations on this package; copied into org_tax_doc_triggers_cfg at kit apply (D13). Same values as that table''s CHECKs. A SIMPLIFIED_INVOICE trigger is upgraded to a full INVOICE for VAT-registered customers above the kit''s simplified_max_amount.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.pkg_code IS 'Package.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.trigger_event IS 'Business event that issues the document.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.document_type IS 'Tax document issued by default at that event.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.created_at IS 'Created at.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.created_by IS 'Created by.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.updated_at IS 'Last updated at.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.updated_by IS 'Last updated by.';
COMMENT ON COLUMN public.sys_starter_pkg_trig_dtl.updated_info IS 'Last update context.';
COMMENT ON CONSTRAINT fk_sspt_pkg ON public.sys_starter_pkg_trig_dtl IS 'Package must exist; triggers are owned by the package.';
COMMENT ON CONSTRAINT ck_sspt_event ON public.sys_starter_pkg_trig_dtl IS 'Same events as org_tax_doc_triggers_cfg.';
COMMENT ON CONSTRAINT ck_sspt_doc_type ON public.sys_starter_pkg_trig_dtl IS 'Same document types as org_tax_doc_triggers_cfg.';

-- RLS + grants for the kit and package tables (platform reference data).
DO $$
DECLARE
  t TEXT;
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tax_kits_mst', 'sys_tax_kit_versions_mst', 'sys_tax_kit_codes_dtl', 'sys_tax_kit_item_classes_dtl',
                           'sys_tax_kit_rules_dtl', 'sys_tax_kit_rule_codes_dtl', 'sys_tax_kit_vectors_dtl',
                           'sys_starter_pkg_mst', 'sys_starter_pkg_trig_dtl']
  LOOP
    p := 'pol_' || left(t, 21) || '_rd';
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', p, t);
    EXECUTE format('COMMENT ON POLICY %I ON public.%I IS %L', p, t, 'Any signed-in user may read (platform reference data); HQ writes through the service role.');
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);                                   -- not public data
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);     -- read-only for app users
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ─── 6b. Standard audit columns on every new table (CLAUDE.md / database skill) ───

-- Reusable: keeps updated_at current and counts updates on any table that has
-- updated_at + updated_count. Caller-set updated_by / updated_info are kept.
CREATE OR REPLACE FUNCTION public.fn_audit_touch_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at    := now();
  NEW.updated_count := COALESCE(OLD.updated_count, 0) + 1;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_audit_touch_row() IS
  'BEFORE UPDATE trigger: sets updated_at = now() and increments updated_count. Reusable on any table with both columns.';

DO $$
DECLARE
  t TEXT;
  c RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tax_party_class_cd', 'sys_tax_segment_cd', 'sys_tax_kits_mst', 'sys_tax_kit_versions_mst',
                           'sys_tax_kit_codes_dtl', 'sys_tax_kit_item_classes_dtl', 'sys_tax_kit_rules_dtl',
                           'sys_tax_kit_rule_codes_dtl', 'sys_tax_kit_vectors_dtl', 'sys_starter_pkg_mst', 'sys_starter_pkg_trig_dtl']
  LOOP
    FOR c IN
      SELECT * FROM (VALUES
        ('created_at',    'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP', 'When the row was created.'),
        ('created_by',    'TEXT NULL',                                      'Who created the row.'),
        ('created_info',  'TEXT NULL',                                      'Creation context (screen, migration, job).'),
        ('updated_at',    'TIMESTAMPTZ NULL',                               'When the row was last updated (set by trigger).'),
        ('updated_by',    'TEXT NULL',                                      'Who last updated the row.'),
        ('updated_info',  'TEXT NULL',                                      'Last update context.'),
        ('updated_count', 'INTEGER NOT NULL DEFAULT 0',                     'Number of updates (incremented by trigger).'),
        ('deleted_at',    'TIMESTAMPTZ NULL',                               'When the row was soft-deleted.'),
        ('deleted_by',    'TEXT NULL',                                      'Who soft-deleted the row.'),
        ('deleted_info',  'TEXT NULL',                                      'Soft-delete context.'),
        ('rec_status',    'SMALLINT NOT NULL DEFAULT 1',                    'Record status: 1 active, 0 deleted, 2 archived.'),
        ('rec_order',     'INTEGER NULL',                                   'Optional manual sort order.'),
        ('rec_notes',     'TEXT NULL',                                      'Free notes about the record.'),
        ('is_active',     'BOOLEAN NOT NULL DEFAULT true',                  'False = hidden / not offered; references stay valid.')
      ) AS v(col, ddl, cmt)
    LOOP
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', t, c.col, c.ddl);
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', t, c.col, c.cmt);
    END LOOP;

    -- rec_status CHECK on tables whose CREATE TABLE did not declare one.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = format('public.%I', t)::regclass AND contype = 'c'
                      AND pg_get_constraintdef(oid) LIKE '%rec_status%') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (rec_status IN (0, 1, 2))', t, 'ck_' || left(t, 23) || '_rs');
      EXECUTE format('COMMENT ON CONSTRAINT %I ON public.%I IS %L', 'ck_' || left(t, 23) || '_rs', t, 'Allowed record statuses.');
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t, 'Keeps updated_at and updated_count current.');
  END LOOP;
END $$;

-- ─── 7. Seeds: kits and versions (facts: KIT_FACTS.md §1–§2) ────────────────

INSERT INTO public.sys_tax_kits_mst (kit_code, country_code, kit_kind, name, name2, description, description2, display_order, created_by, created_info) VALUES
  ('OM_VAT',      'OM', 'VAT',     'Oman VAT',          'ضريبة القيمة المضافة - عُمان',     'VAT 5% on laundry services and goods sold in Oman.',        'ضريبة 5% على خدمات الغسيل والسلع المباعة في عُمان.',         10, 'migration_0712', 'Tax engine M2'),
  ('SA_VAT',      'SA', 'VAT',     'Saudi Arabia VAT',  'ضريبة القيمة المضافة - السعودية',  'VAT 15% on laundry services and goods sold in Saudi Arabia.', 'ضريبة 15% على خدمات الغسيل والسلع المباعة في السعودية.',     20, 'migration_0712', 'Tax engine M2'),
  ('AE_VAT',      'AE', 'VAT',     'UAE VAT',           'ضريبة القيمة المضافة - الإمارات',  'VAT 5% on laundry services and goods sold in the UAE.',      'ضريبة 5% على خدمات الغسيل والسلع المباعة في الإمارات.',      30, 'migration_0712', 'Tax engine M2'),
  ('BH_VAT',      'BH', 'VAT',     'Bahrain VAT',       'ضريبة القيمة المضافة - البحرين',   'VAT 10% on laundry services and goods sold in Bahrain.',     'ضريبة 10% على خدمات الغسيل والسلع المباعة في البحرين.',      40, 'migration_0712', 'Tax engine M2'),
  ('NO_VAT',      NULL, 'NO_VAT',  'No VAT',            'بدون ضريبة',                       'No tax is charged (country without VAT, or business not VAT-registered). Receipts only.', 'لا تُفرض ضريبة (دولة بلا ضريبة قيمة مضافة أو منشأة غير مسجلة). إيصالات فقط.', 50, 'migration_0712', 'Tax engine M2'),
  ('GENERIC_VAT', NULL, 'GENERIC', 'Generic VAT',       'ضريبة عامة',                       'One sales tax whose rate the organization enters. Not verified for any country.', 'ضريبة مبيعات واحدة تُدخل المنشأة نسبتها. غير موثقة لأي دولة.', 60, 'migration_0712', 'Tax engine M2')
ON CONFLICT (kit_code) DO UPDATE
   SET country_code = EXCLUDED.country_code, kit_kind = EXCLUDED.kit_kind, name = EXCLUDED.name, name2 = EXCLUDED.name2,
       description = EXCLUDED.description, description2 = EXCLUDED.description2, display_order = EXCLUDED.display_order,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- Version 1 of each kit. effective_from = the rate's legal start date (KIT_FACTS §1).
-- is_verified stays false while KIT_FACTS §5 / followups F1–F6 are open.
INSERT INTO public.sys_tax_kit_versions_mst
  (kit_code, version_no, status, effective_from, currency_code, mandatory_reg_threshold, voluntary_reg_threshold, simplified_max_amount,
   rounding_level, rounding_mode, tax_on_advance, is_verified, source_url, checked_on, review_notes, published_at, published_by, created_by, created_info)
VALUES
  -- OM: Tax Authority thresholds decision + tax-rate page; simplified rule not sourced (F4).
  ('OM_VAT', 1, 'PUBLISHED', DATE '2021-04-16', 'OMR', 38500, 19250, NULL, 'LINE', 'HALF_UP', true, false,
   'https://tms.taxoman.gov.om/portal/tax-rate', DATE '2026-11-07',
   'Unverified: return box numbers (F3), simplified-invoice conditions (F4), voucher timing (F6). See docs/features/Tax_Config/KIT_FACTS.md.',
   now(), 'migration_0712', 'migration_0712', 'Tax engine M2'),
  -- SA: ZATCA FAQ 024; simplified < SAR 1,000 for B2B (KIT_FACTS §2).
  ('SA_VAT', 1, 'PUBLISHED', DATE '2020-07-01', 'SAR', 375000, 187500, 1000, 'LINE', 'HALF_UP', true, false,
   'https://zatca.gov.sa/en/HelpCenter/FAQs/Pages/FAQ_024.aspx', DATE '2026-11-07',
   'Unverified: return box numbers (F1), B2C simplified for any amount (F5), voucher timing (F6). See KIT_FACTS.md.',
   now(), 'migration_0712', 'migration_0712', 'Tax engine M2'),
  -- AE: FTA registration page; simplified <= AED 10,000 for registered customers (KIT_FACTS §2).
  ('AE_VAT', 1, 'PUBLISHED', DATE '2018-01-01', 'AED', 375000, 187500, 10000, 'LINE', 'HALF_UP', true, false,
   'https://tax.gov.ae/en/taxes/vat/vat.topics/registration.for.vat.aspx', DATE '2026-11-07',
   'Unverified: voucher timing (F6). Return boxes need branch emirate_code (M3). See KIT_FACTS.md.',
   now(), 'migration_0712', 'migration_0712', 'Tax engine M2'),
  -- BH: NBR registration + treatments pages; simplified < BHD 500 (KIT_FACTS §2).
  ('BH_VAT', 1, 'PUBLISHED', DATE '2022-01-01', 'BHD', 37500, 18750, 500, 'LINE', 'HALF_UP', true, false,
   'https://www.nbr.gov.bh/vat_registration', DATE '2026-11-07',
   'Unverified: return box numbers (F2), voucher timing (F6). See KIT_FACTS.md.',
   now(), 'migration_0712', 'migration_0712', 'Tax engine M2'),
  -- NO_VAT: nothing to verify (no tax is charged).
  ('NO_VAT', 1, 'PUBLISHED', DATE '2000-01-01', NULL, NULL, NULL, NULL, 'LINE', 'HALF_UP', false, true,
   NULL, DATE '2026-11-07', NULL, now(), 'migration_0712', 'migration_0712', 'Tax engine M2'),
  -- GENERIC: rate entered by the organization; never verified.
  ('GENERIC_VAT', 1, 'PUBLISHED', DATE '2000-01-01', NULL, NULL, NULL, NULL, 'LINE', 'HALF_UP', false, false,
   NULL, DATE '2026-11-07', 'Generic kit: the organization enters its rate; HQ never marks it verified.', now(), 'migration_0712', 'migration_0712', 'Tax engine M2')
ON CONFLICT (kit_code, version_no) DO UPDATE
   SET status = EXCLUDED.status, effective_from = EXCLUDED.effective_from, currency_code = EXCLUDED.currency_code,
       mandatory_reg_threshold = EXCLUDED.mandatory_reg_threshold, voluntary_reg_threshold = EXCLUDED.voluntary_reg_threshold,
       simplified_max_amount = EXCLUDED.simplified_max_amount, rounding_level = EXCLUDED.rounding_level,
       rounding_mode = EXCLUDED.rounding_mode, tax_on_advance = EXCLUDED.tax_on_advance, is_verified = EXCLUDED.is_verified,
       source_url = EXCLUDED.source_url, checked_on = EXCLUDED.checked_on, review_notes = EXCLUDED.review_notes,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 8. Seeds: item classes (same set in every kit; KIT_FACTS §4) ───────────

INSERT INTO public.sys_tax_kit_item_classes_dtl
  (kit_version_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order, created_by, created_info)
SELECT v.id, c.class_code, c.flow, c.name, c.name2, c.descr, c.descr2, c.is_default, c.ord, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_versions_mst v
 CROSS JOIN (VALUES
   ('LAUNDRY_SERVICE',  'OUTPUT', 'Laundry service',          'خدمة غسيل',          'Washing, dry-cleaning, pressing, alterations.',                 'غسيل، تنظيف جاف، كي، تعديلات.',                       true,  10),
   ('GOODS_SALE',       'OUTPUT', 'Goods sold',               'سلع مباعة',          'Products sold to customers (detergent, bags, hangers).',        'منتجات تباع للعملاء (منظفات، أكياس، علاقات).',        false, 20),
   ('DELIVERY_FEE',     'OUTPUT', 'Delivery / pickup fee',    'رسوم التوصيل / الاستلام','Fee for pickup or delivery; taxed like the laundry service.',  'رسوم الاستلام أو التوصيل؛ تُعامل ضريبياً كخدمة الغسيل.', false, 30),
   ('GIFT_CARD',        'OUTPUT', 'Gift card / prepaid credit','بطاقة هدية / رصيد مسبق','Sale of a gift card or prepaid credit; taxed when used.',      'بيع بطاقة هدية أو رصيد مسبق؛ تُفرض الضريبة عند الاستخدام.', false, 40),
   ('ADVANCE_DEPOSIT',  'OUTPUT', 'Advance / deposit',        'دفعة مقدمة / عربون', 'Money received before the service; taxed when received.',      'مبلغ يُستلم قبل الخدمة؛ تُفرض الضريبة عند الاستلام.',  false, 50),
   ('TIP',              'OUTPUT', 'Tip',                      'إكرامية',            'Voluntary tip for staff; outside VAT.',                        'إكرامية طوعية للموظفين؛ خارج نطاق الضريبة.',           false, 60),
   ('CASH_ROUNDING',    'OUTPUT', 'Cash rounding',            'تقريب نقدي',         'Rounding difference on cash payments; outside VAT.',            'فرق التقريب في الدفع النقدي؛ خارج نطاق الضريبة.',      false, 70),
   ('PURCHASE_STANDARD','INPUT',  'Purchase with VAT',        'مشتريات خاضعة للضريبة','Purchase with VAT that can be reclaimed.',                    'مشتريات عليها ضريبة يمكن استردادها.',                 true,  80),
   ('PURCHASE_NO_VAT',  'INPUT',  'Purchase without VAT',     'مشتريات بدون ضريبة', 'Purchase from a non-registered supplier, or exempt / zero-rated.','مشتريات من مورد غير مسجل أو معفاة / بنسبة صفر.',      false, 90),
   ('PURCHASE_NON_REC', 'INPUT',  'Purchase, VAT not reclaimable','مشتريات ضريبتها غير قابلة للاسترداد','VAT paid but not reclaimable (e.g. staff entertainment); VAT becomes a cost.','ضريبة مدفوعة لا تُسترد (مثل ضيافة الموظفين)؛ تصبح الضريبة تكلفة.', false, 100)
 ) AS c(class_code, flow, name, name2, descr, descr2, is_default, ord)
 WHERE v.version_no = 1
ON CONFLICT (kit_version_id, class_code) DO UPDATE
   SET tax_flow_code = EXCLUDED.tax_flow_code, name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description,
       description2 = EXCLUDED.description2, is_default = EXCLUDED.is_default, display_order = EXCLUDED.display_order,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 9. Seeds: tax codes ────────────────────────────────────────────────────

-- VAT kits: same code set, rate per country (KIT_FACTS §1). GENERIC: rate NULL (entered by the organization).
INSERT INTO public.sys_tax_kit_codes_dtl
  (kit_version_id, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, recoverable_pct, is_reverse_charge, priority, display_order, created_by, created_info)
SELECT v.id, c.tax_code, c.name, c.name2, CASE WHEN c.flow = 'WITHHOLDING' THEN 'WHT' ELSE 'VAT' END, c.category, c.flow, 'PERCENT',
       CASE WHEN c.uses_rate THEN r.rate ELSE 0 END, c.recoverable, c.rc, 1, c.ord, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_versions_mst v
  JOIN (VALUES ('OM_VAT', 5.0000::DECIMAL(9,4)), ('SA_VAT', 15.0000), ('AE_VAT', 5.0000), ('BH_VAT', 10.0000), ('GENERIC_VAT', NULL)) AS r(kit_code, rate)
    ON r.kit_code = v.kit_code AND v.version_no = 1
 CROSS JOIN (VALUES
   ('VAT_STD',       'VAT standard rate',            'ضريبة بالنسبة الأساسية',        'STANDARD',     'OUTPUT', true,  100::DECIMAL(7,4), false, 10),
   ('VAT_ZERO',      'VAT zero rate',                'ضريبة بنسبة صفر',               'ZERO_RATED',   'OUTPUT', false, 100,               false, 20),
   ('VAT_EXEMPT',    'VAT exempt',                   'معفى من الضريبة',               'EXEMPT',       'OUTPUT', false, 100,               false, 30),
   ('VAT_OOS',       'Outside VAT',                  'خارج نطاق الضريبة',             'OUT_OF_SCOPE', 'OUTPUT', false, 100,               false, 40),
   ('VAT_IN_STD',    'Input VAT (reclaimable)',      'ضريبة مدخلات قابلة للاسترداد',  'STANDARD',     'INPUT',  true,  100,               false, 50),
   ('VAT_IN_NONREC', 'Input VAT (not reclaimable)',  'ضريبة مدخلات غير قابلة للاسترداد','STANDARD',   'INPUT',  true,  0,                 false, 60),
   ('VAT_IN_NONE',   'Purchase without VAT',         'مشتريات بدون ضريبة',            'OUT_OF_SCOPE', 'INPUT',  false, 100,               false, 70),
   ('VAT_IN_RC',     'Reverse charge VAT (imports of services)', 'ضريبة الاحتساب العكسي (استيراد خدمات)', 'STANDARD', 'INPUT', true, 100, true, 80),
   ('WHT_NONE',      'No withholding tax',           'بدون ضريبة استقطاع',            'OUT_OF_SCOPE', 'WITHHOLDING', false, 100,          false, 90)
 ) AS c(tax_code, name, name2, category, flow, uses_rate, recoverable, rc, ord)
 WHERE r.kit_code <> 'GENERIC_VAT' OR c.tax_code NOT IN ('VAT_IN_RC')   -- generic kit: no reverse charge
ON CONFLICT (kit_version_id, tax_code) DO UPDATE
   SET name = EXCLUDED.name, name2 = EXCLUDED.name2, tax_type = EXCLUDED.tax_type, tax_category_code = EXCLUDED.tax_category_code,
       tax_flow_code = EXCLUDED.tax_flow_code, rate = EXCLUDED.rate, recoverable_pct = EXCLUDED.recoverable_pct,
       is_reverse_charge = EXCLUDED.is_reverse_charge, display_order = EXCLUDED.display_order,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- NO_VAT kit: one "no tax" code per flow.
INSERT INTO public.sys_tax_kit_codes_dtl
  (kit_version_id, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, display_order, created_by, created_info)
SELECT v.id, c.tax_code, c.name, c.name2, c.tax_type, 'OUT_OF_SCOPE', c.flow, 'PERCENT', 0, c.ord, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_versions_mst v
 CROSS JOIN (VALUES
   ('NO_TAX_OUT', 'No tax',           'بدون ضريبة',         'VAT', 'OUTPUT',      10),
   ('NO_TAX_IN',  'No tax',           'بدون ضريبة',         'VAT', 'INPUT',       20),
   ('WHT_NONE',   'No withholding tax','بدون ضريبة استقطاع', 'WHT', 'WITHHOLDING', 30)
 ) AS c(tax_code, name, name2, tax_type, flow, ord)
 WHERE v.kit_code = 'NO_VAT' AND v.version_no = 1
ON CONFLICT (kit_version_id, tax_code) DO UPDATE
   SET name = EXCLUDED.name, name2 = EXCLUDED.name2, tax_type = EXCLUDED.tax_type, tax_flow_code = EXCLUDED.tax_flow_code,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 10. Seeds: rules + rule codes ──────────────────────────────────────────

-- VAT kits (incl. GENERIC): one rule per flow/class, plus per-flow fallbacks so
-- no supported document returns NO_TAX_RULE. Reverse charge only for ENTERPRISE
-- (imports of services from a foreign supplier).
INSERT INTO public.sys_tax_kit_rules_dtl
  (kit_version_id, rule_code, tax_flow_code, tax_item_class_code, party_country_scope, segment_codes, priority, name, name2, created_by, created_info)
SELECT v.id, r.rule_code, r.flow, r.class_code, r.scope, r.segments, r.prio, r.name, r.name2, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_versions_mst v
 CROSS JOIN (VALUES
   ('OUT_LAUNDRY',   'OUTPUT',      'LAUNDRY_SERVICE',   NULL,      NULL::TEXT[],            100, 'Laundry services are taxed at the standard rate.',            'خدمات الغسيل خاضعة للنسبة الأساسية.'),
   ('OUT_GOODS',     'OUTPUT',      'GOODS_SALE',        NULL,      NULL,                    100, 'Goods sold are taxed at the standard rate.',                  'السلع المباعة خاضعة للنسبة الأساسية.'),
   ('OUT_DELIVERY',  'OUTPUT',      'DELIVERY_FEE',      NULL,      NULL,                    100, 'Delivery fees follow the laundry service (standard rate).',   'رسوم التوصيل تتبع خدمة الغسيل (النسبة الأساسية).'),
   ('OUT_GIFT_CARD', 'OUTPUT',      'GIFT_CARD',         NULL,      NULL,                    100, 'Gift card sale is not taxed; tax is charged when it is used.', 'بيع بطاقة الهدية غير خاضع؛ تُفرض الضريبة عند الاستخدام.'),
   ('OUT_ADVANCE',   'OUTPUT',      'ADVANCE_DEPOSIT',   NULL,      NULL,                    100, 'Advance payments are taxed when received.',                   'الدفعات المقدمة خاضعة للضريبة عند استلامها.'),
   ('OUT_TIP',       'OUTPUT',      'TIP',               NULL,      NULL,                    100, 'Tips are outside VAT.',                                       'الإكراميات خارج نطاق الضريبة.'),
   ('OUT_ROUNDING',  'OUTPUT',      'CASH_ROUNDING',     NULL,      NULL,                    100, 'Cash rounding is outside VAT.',                               'التقريب النقدي خارج نطاق الضريبة.'),
   ('OUT_ANY',       'OUTPUT',      NULL,                NULL,      NULL,                    900, 'Any other sale is taxed at the standard rate.',               'أي بيع آخر خاضع للنسبة الأساسية.'),
   ('IN_STANDARD',   'INPUT',       'PURCHASE_STANDARD', NULL,      NULL,                    100, 'Purchases with VAT: VAT can be reclaimed.',                   'مشتريات عليها ضريبة: يمكن استردادها.'),
   ('IN_NO_VAT',     'INPUT',       'PURCHASE_NO_VAT',   NULL,      NULL,                    100, 'Purchases without VAT.',                                      'مشتريات بدون ضريبة.'),
   ('IN_NON_REC',    'INPUT',       'PURCHASE_NON_REC',  NULL,      NULL,                    100, 'VAT on these purchases cannot be reclaimed.',                 'ضريبة هذه المشتريات لا تُسترد.'),
   ('IN_FOREIGN_RC', 'INPUT',       NULL,                'FOREIGN', ARRAY['ENTERPRISE'],     100, 'Services bought from abroad: reverse charge.',                'خدمات مشتراة من الخارج: احتساب عكسي.'),
   ('IN_ANY',        'INPUT',       NULL,                NULL,      NULL,                    900, 'Any other purchase: VAT can be reclaimed.',                   'أي مشتريات أخرى: يمكن استرداد الضريبة.'),
   ('WHT_ANY',       'WITHHOLDING', NULL,                NULL,      NULL,                    900, 'No withholding tax on payments.',                             'لا ضريبة استقطاع على المدفوعات.')
 ) AS r(rule_code, flow, class_code, scope, segments, prio, name, name2)
 WHERE v.version_no = 1
   AND v.kit_code IN ('OM_VAT', 'SA_VAT', 'AE_VAT', 'BH_VAT', 'GENERIC_VAT')
   AND NOT (v.kit_code = 'GENERIC_VAT' AND r.rule_code = 'IN_FOREIGN_RC')
ON CONFLICT (kit_version_id, rule_code) DO UPDATE
   SET tax_flow_code = EXCLUDED.tax_flow_code, tax_item_class_code = EXCLUDED.tax_item_class_code,
       party_country_scope = EXCLUDED.party_country_scope, segment_codes = EXCLUDED.segment_codes, priority = EXCLUDED.priority,
       name = EXCLUDED.name, name2 = EXCLUDED.name2, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- NO_VAT kit: one fallback rule per flow.
INSERT INTO public.sys_tax_kit_rules_dtl
  (kit_version_id, rule_code, tax_flow_code, priority, name, name2, created_by, created_info)
SELECT v.id, r.rule_code, r.flow, 900, r.name, r.name2, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_versions_mst v
 CROSS JOIN (VALUES
   ('OUT_ANY', 'OUTPUT',      'No tax is charged on sales.',     'لا تُفرض ضريبة على المبيعات.'),
   ('IN_ANY',  'INPUT',       'No tax on purchases is reclaimed.','لا تُسترد ضريبة على المشتريات.'),
   ('WHT_ANY', 'WITHHOLDING', 'No withholding tax on payments.', 'لا ضريبة استقطاع على المدفوعات.')
 ) AS r(rule_code, flow, name, name2)
 WHERE v.kit_code = 'NO_VAT' AND v.version_no = 1
ON CONFLICT (kit_version_id, rule_code) DO UPDATE
   SET tax_flow_code = EXCLUDED.tax_flow_code, name = EXCLUDED.name, name2 = EXCLUDED.name2,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- Rule → code (one code per rule).
INSERT INTO public.sys_tax_kit_rule_codes_dtl (rule_id, kit_version_id, seq_no, tax_code, created_by, created_info)
SELECT r.id, r.kit_version_id, 1, m.tax_code, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_rules_dtl r
  JOIN public.sys_tax_kit_versions_mst v ON v.id = r.kit_version_id AND v.version_no = 1
  JOIN (VALUES
    ('VAT', 'OUT_LAUNDRY',   'VAT_STD'),
    ('VAT', 'OUT_GOODS',     'VAT_STD'),
    ('VAT', 'OUT_DELIVERY',  'VAT_STD'),
    ('VAT', 'OUT_GIFT_CARD', 'VAT_OOS'),
    ('VAT', 'OUT_ADVANCE',   'VAT_STD'),
    ('VAT', 'OUT_TIP',       'VAT_OOS'),
    ('VAT', 'OUT_ROUNDING',  'VAT_OOS'),
    ('VAT', 'OUT_ANY',       'VAT_STD'),
    ('VAT', 'IN_STANDARD',   'VAT_IN_STD'),
    ('VAT', 'IN_NO_VAT',     'VAT_IN_NONE'),
    ('VAT', 'IN_NON_REC',    'VAT_IN_NONREC'),
    ('VAT', 'IN_FOREIGN_RC', 'VAT_IN_RC'),
    ('VAT', 'IN_ANY',        'VAT_IN_STD'),
    ('VAT', 'WHT_ANY',       'WHT_NONE'),
    ('NO_VAT', 'OUT_ANY',    'NO_TAX_OUT'),
    ('NO_VAT', 'IN_ANY',     'NO_TAX_IN'),
    ('NO_VAT', 'WHT_ANY',    'WHT_NONE')
  ) AS m(kit_group, rule_code, tax_code)
    ON m.rule_code = r.rule_code
   AND m.kit_group = CASE WHEN v.kit_code = 'NO_VAT' THEN 'NO_VAT' ELSE 'VAT' END
ON CONFLICT (rule_id, seq_no) DO UPDATE
   SET tax_code = EXCLUDED.tax_code, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 11. Seeds: worked examples (vectors) ───────────────────────────────────

INSERT INTO public.sys_tax_kit_vectors_dtl (kit_version_id, vector_code, description, description2, input, expected, created_by, created_info)
SELECT v.id, x.vector_code, x.descr, x.descr2, x.input::jsonb, x.expected::jsonb, 'migration_0712', 'Tax engine M2'
  FROM public.sys_tax_kit_versions_mst v
  JOIN (VALUES
    ('OM_VAT', 'EXCL_10', 'Laundry service OMR 10.000 before VAT → VAT 0.500.',        'خدمة غسيل 10.000 ر.ع قبل الضريبة ← ضريبة 0.500.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"EXCLUSIVE","amount":"10.000"}',
     '{"tax_code":"VAT_STD","taxable":"10.000","tax":"0.500"}'),
    ('OM_VAT', 'INCL_10', 'Laundry service OMR 10.500 including VAT → VAT 0.500.',     'خدمة غسيل 10.500 ر.ع شاملة الضريبة ← ضريبة 0.500.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"INCLUSIVE","amount":"10.500"}',
     '{"tax_code":"VAT_STD","taxable":"10.000","tax":"0.500"}'),
    ('SA_VAT', 'EXCL_100', 'Laundry service SAR 100.00 before VAT → VAT 15.00.',       'خدمة غسيل 100.00 ر.س قبل الضريبة ← ضريبة 15.00.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"EXCLUSIVE","amount":"100.00"}',
     '{"tax_code":"VAT_STD","taxable":"100.00","tax":"15.00"}'),
    ('SA_VAT', 'INCL_115', 'Laundry service SAR 115.00 including VAT → VAT 15.00.',    'خدمة غسيل 115.00 ر.س شاملة الضريبة ← ضريبة 15.00.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"INCLUSIVE","amount":"115.00"}',
     '{"tax_code":"VAT_STD","taxable":"100.00","tax":"15.00"}'),
    ('AE_VAT', 'EXCL_100', 'Laundry service AED 100.00 before VAT → VAT 5.00.',        'خدمة غسيل 100.00 د.إ قبل الضريبة ← ضريبة 5.00.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"EXCLUSIVE","amount":"100.00"}',
     '{"tax_code":"VAT_STD","taxable":"100.00","tax":"5.00"}'),
    ('AE_VAT', 'INCL_105', 'Laundry service AED 105.00 including VAT → VAT 5.00.',     'خدمة غسيل 105.00 د.إ شاملة الضريبة ← ضريبة 5.00.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"INCLUSIVE","amount":"105.00"}',
     '{"tax_code":"VAT_STD","taxable":"100.00","tax":"5.00"}'),
    ('BH_VAT', 'EXCL_10', 'Laundry service BHD 10.000 before VAT → VAT 1.000.',        'خدمة غسيل 10.000 د.ب قبل الضريبة ← ضريبة 1.000.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"EXCLUSIVE","amount":"10.000"}',
     '{"tax_code":"VAT_STD","taxable":"10.000","tax":"1.000"}'),
    ('BH_VAT', 'INCL_11', 'Laundry service BHD 11.000 including VAT → VAT 1.000.',     'خدمة غسيل 11.000 د.ب شاملة الضريبة ← ضريبة 1.000.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"INCLUSIVE","amount":"11.000"}',
     '{"tax_code":"VAT_STD","taxable":"10.000","tax":"1.000"}'),
    ('NO_VAT', 'NO_TAX', 'Any sale → no tax.',                                          'أي بيع ← بدون ضريبة.',
     '{"doc_type":"ORDER","item_class":"LAUNDRY_SERVICE","party_class":"CONSUMER","pricing_mode":"INCLUSIVE","amount":"10.000"}',
     '{"tax_code":"NO_TAX_OUT","taxable":"10.000","tax":"0.000"}')
  ) AS x(kit_code, vector_code, descr, descr2, input, expected)
    ON x.kit_code = v.kit_code AND v.version_no = 1
ON CONFLICT (kit_version_id, vector_code) DO UPDATE
   SET description = EXCLUDED.description, description2 = EXCLUDED.description2, input = EXCLUDED.input, expected = EXCLUDED.expected,
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 12. Seeds: starter packages + invoice triggers ─────────────────────────

-- VAT countries × 4 segments; QA, KW (no VAT) and generic get SME + NOT_VAT_REGISTERED.
INSERT INTO public.sys_starter_pkg_mst
  (pkg_code, country_code, segment_code, tax_kit_code, calendar_template_code, tax_setup_mode, tax_pricing_mode, is_country_default,
   name, name2, description, description2, display_order, created_by, created_info)
SELECT c.cc || '_' || s.seg, c.country, s.seg,
       CASE WHEN s.seg = 'NOT_VAT_REGISTERED' OR c.kit = 'NO_VAT' THEN 'NO_VAT' ELSE c.kit END,
       c.cal, s.mode, s.pricing, (s.seg = 'SME'),
       c.cname || ' — ' || s.sname, c.cname2 || ' — ' || s.sname2,
       s.descr, s.descr2, c.ord + s.ord, 'migration_0712', 'Tax engine M2'
  FROM (VALUES
    ('OM',      'OM',  'OM_VAT',      'OM',      'Oman',          'عُمان',     100),
    ('SA',      'SA',  'SA_VAT',      'SA',      'Saudi Arabia',  'السعودية',  200),
    ('AE',      'AE',  'AE_VAT',      'AE',      'UAE',           'الإمارات',  300),
    ('BH',      'BH',  'BH_VAT',      'BH',      'Bahrain',       'البحرين',   400),
    ('QA',      'QA',  'NO_VAT',      'QA',      'Qatar',         'قطر',       500),
    ('KW',      'KW',  'NO_VAT',      'KW',      'Kuwait',        'الكويت',    600),
    ('GENERIC', NULL,  'GENERIC_VAT', 'GENERIC', 'Other country', 'دولة أخرى', 900)
  ) AS c(cc, country, kit, cal, cname, cname2, ord)
 CROSS JOIN (VALUES
   ('SME',                'BASIC',    'INCLUSIVE', 'Small / medium',     'صغيرة / متوسطة', 'Simple setup; prices include VAT; simplified tax invoice for walk-in customers.', 'إعداد بسيط؛ الأسعار شاملة الضريبة؛ فاتورة ضريبية مبسطة للعملاء الأفراد.', 1),
   ('ENTERPRISE',         'ADVANCED', 'EXCLUSIVE', 'Large / B2B',        'كبيرة / شركات',  'Full controls; prices before VAT; full tax invoice for business customers.',        'تحكم كامل؛ الأسعار قبل الضريبة؛ فاتورة ضريبية كاملة لعملاء الشركات.',     2),
   ('FRANCHISE_BASE',     'BASIC',    'INCLUSIVE', 'Franchise branch',   'فرع امتياز',     'Same as small / medium, for franchise branches.',                                  'مثل الصغيرة / المتوسطة لفروع الامتياز.',                                 3),
   ('NOT_VAT_REGISTERED', 'BASIC',    'INCLUSIVE', 'Not VAT-registered', 'غير مسجل',       'No VAT charged; receipts only. Register once sales pass the threshold.',            'لا ضريبة؛ إيصالات فقط. سجّل عند تجاوز حد التسجيل.',                       4)
 ) AS s(seg, mode, pricing, sname, sname2, descr, descr2, ord)
 WHERE c.kit <> 'NO_VAT' OR s.seg IN ('SME', 'NOT_VAT_REGISTERED')
ON CONFLICT (pkg_code) DO UPDATE
   SET country_code = EXCLUDED.country_code, segment_code = EXCLUDED.segment_code, tax_kit_code = EXCLUDED.tax_kit_code,
       calendar_template_code = EXCLUDED.calendar_template_code, tax_setup_mode = EXCLUDED.tax_setup_mode,
       tax_pricing_mode = EXCLUDED.tax_pricing_mode, is_country_default = EXCLUDED.is_country_default,
       name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description, description2 = EXCLUDED.description2,
       display_order = EXCLUDED.display_order, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- Every package that charges VAT issues a tax document at order submit (simplified by
-- default, upgraded to full for registered business customers); ENTERPRISE also
-- issues a full invoice when an AR invoice is raised. NO_VAT packages issue none.
INSERT INTO public.sys_starter_pkg_trig_dtl (pkg_code, trigger_event, document_type, created_by, created_info)
SELECT p.pkg_code, t.ev, t.doc, 'migration_0712', 'Tax engine M2'
  FROM public.sys_starter_pkg_mst p
 CROSS JOIN (VALUES ('ON_ORDER_SUBMIT', 'SIMPLIFIED_INVOICE', false), ('ON_AR_INVOICE_ISSUE', 'INVOICE', true)) AS t(ev, doc, enterprise_only)
 WHERE p.tax_kit_code <> 'NO_VAT'
   AND (NOT t.enterprise_only OR p.segment_code = 'ENTERPRISE')
ON CONFLICT (pkg_code, trigger_event) DO UPDATE
   SET document_type = EXCLUDED.document_type, updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2';

-- ─── 13. Organization: chosen starter package ───────────────────────────────

ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS starter_pkg_code TEXT NULL;

COMMENT ON COLUMN public.org_tenants_mst.starter_pkg_code IS
  'Starter package applied to this organization (sys_starter_pkg_mst). Set at onboarding (country default unless HQ picks a segment); a change re-runs kit apply as a pending candidate.';

ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT fk_otm_starter_pkg FOREIGN KEY (starter_pkg_code)
    REFERENCES public.sys_starter_pkg_mst (pkg_code) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_otm_starter_pkg ON public.org_tenants_mst IS 'Starter package must exist.';

-- Backfill: country default package, else the generic default. org_tenants_mst
-- is the tenant row itself (no tenant_org_id column), so every organization is updated.
UPDATE public.org_tenants_mst t
   SET starter_pkg_code = COALESCE(
         (SELECT p.pkg_code FROM public.sys_starter_pkg_mst p WHERE p.country_code = upper(t.country) AND p.is_country_default),
         (SELECT p.pkg_code FROM public.sys_starter_pkg_mst p WHERE p.country_code IS NULL AND p.is_country_default)),
       updated_at = now(), updated_by = 'migration_0712', updated_info = 'Tax engine M2: starter package backfill'
 WHERE t.starter_pkg_code IS NULL;

-- ─── 14. Self-check ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- Every rule yields at least one code.
  SELECT string_agg(k.kit_code || ':' || r.rule_code, ', ') INTO v_bad
    FROM public.sys_tax_kit_rules_dtl r
    JOIN public.sys_tax_kit_versions_mst k ON k.id = r.kit_version_id
   WHERE NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_rule_codes_dtl c WHERE c.rule_id = r.id);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'M2: rules without codes: %', v_bad; END IF;

  -- Every kit version has a fallback rule for each flow (no NO_TAX_RULE after apply).
  SELECT string_agg(v.kit_code || ':' || f.flow, ', ') INTO v_bad
    FROM public.sys_tax_kit_versions_mst v
   CROSS JOIN (VALUES ('OUTPUT'), ('INPUT'), ('WITHHOLDING')) AS f(flow)
   WHERE NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_rules_dtl r
                      WHERE r.kit_version_id = v.id AND r.tax_flow_code = f.flow
                        AND r.tax_item_class_code IS NULL AND r.party_tax_class_code IS NULL
                        AND r.party_country_scope IS NULL AND r.segment_codes IS NULL AND r.doc_type_code IS NULL);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'M2: missing fallback rule: %', v_bad; END IF;

  -- A rule''s code has the rule''s flow.
  SELECT string_agg(r.rule_code || '->' || c.tax_code, ', ') INTO v_bad
    FROM public.sys_tax_kit_rule_codes_dtl rc
    JOIN public.sys_tax_kit_rules_dtl r ON r.id = rc.rule_id
    JOIN public.sys_tax_kit_codes_dtl c ON c.kit_version_id = rc.kit_version_id AND c.tax_code = rc.tax_code
   WHERE r.tax_flow_code IS DISTINCT FROM c.tax_flow_code;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'M2: rule/code flow mismatch: %', v_bad; END IF;

  -- One default package per seeded country and a generic default.
  IF (SELECT count(*) FROM public.sys_starter_pkg_mst WHERE is_country_default) <> 7 THEN
    RAISE EXCEPTION 'M2: expected 7 default packages';
  END IF;

  -- Every organization has a package.
  IF EXISTS (SELECT 1 FROM public.org_tenants_mst WHERE starter_pkg_code IS NULL) THEN
    RAISE EXCEPTION 'M2: organization without starter package';
  END IF;
END $$;

COMMIT;
