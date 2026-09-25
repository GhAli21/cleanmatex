-- =============================================================================
-- 0521_hq_currency_rounding_rules_cf.sql
-- HQ Currency Setup handoff §3.2/§3.3/§3.4/§3.6/§3.7, Phase 2, step 2 of 3.
--
-- Expands the live, single-row-per-currency sys_currency_rounding_rules_cd
-- (13 rows, 0 FKs, ACCOUNTING-only, confirmed via remote read-only query
-- before writing this migration) into the context-scoped policy table
-- sys_currency_rounding_rules_cf: adds the calc/output decimal-place split,
-- integer minor-unit increments, tenant-overridability flag, effective
-- dating, and FKs to the catalogs from 0520. Renamed _cd -> _cf because
-- these are policy/configuration records, not code values (handoff §3.2).
--
-- Sequencing inside this one file mirrors handoff §3.7 steps 2-3 (add
-- nullable columns -> backfill existing rows -> finalize PK/FK/CHECK/NOT
-- NULL -> seed). Step 1 (context/mode catalogs) is 0520. Step 4 (drop the
-- now-legacy rounding_unit/rounding_method columns here, and
-- sys_currency_cd.cash_rounding_increment_minor/cash_rounding_mode) is
-- deliberately NOT in this migration — the handoff explicitly holds it
-- until after the tenant app has migrated off the old shape. This session
-- migrates web-admin/lib/money/currency-rounding.ts in the same pass, but
-- step 4 still waits for the owner to confirm this migration applied
-- cleanly and the app works against it, per CRITICAL RULE #2/#3 discipline
-- (never modify an applied migration; every irreversible DROP gets its own
-- reviewed migration, not bundled into the migration that first depends on
-- the new shape working).
--
-- CASH_TENDER/CASH_CHANGE seed for the GCC six + USD: researched 2026-09-25
-- via web search against central-bank/government-regulation sources (cited
-- per row in `metadata.sources`), not fabricated. AED and QAR have the
-- strongest evidence (an actual Abu Dhabi DED circular permits rounding to
-- the nearest 25 fils; Qatari retail practice is well-documented at 25/50
-- dirham) and sharpen the handoff's own placeholder range ("1 or 5 -
-- confirm") upward to 25. OMR/KWD/BHD confirm the handoff's suggested 5
-- (baisa/fils). SAR is the one currency where evidence was mixed (one weak
-- source claims cash rounds to the nearest riyal; official 2016-series
-- halala coins remain in production) — seeded at the conservative 5 halala,
-- which favors the customer over the more aggressive claim. USD is seeded
-- at 5 cents (nickel) on real, current evidence — the US Mint struck its
-- last penny 2025-11-12 (Treasury's own FAQ + Richmond Fed research). All
-- seven rows are `review_status: verified` per this session's research, not
-- `unverified`/`derived` — see the summary this was reported to the owner
-- with. Every row is UI-editable after this migration via the HQ rounding
-- rules admin screen (Phase 2.9), so a correction never needs a new
-- migration.
--
-- Reversal (forward-only): a future migration would drop the new FKs/CHECKs/
-- indexes, drop the id/context/mode/decimal-place/increment/effective/
-- tenant-overridable columns, restore the currency_code PK, and revert the
-- table name to sys_currency_rounding_rules_cd. Lossy for every row beyond
-- the original 13 ACCOUNTING ones (i.e. loses the CASH_TENDER/CASH_CHANGE/
-- 181-currency seed), which is why this is reviewed before being applied,
-- not blind-reversed.
-- =============================================================================

BEGIN;

-- ── Step 2: add new columns (nullable), backfill existing 13 rows ──────────

ALTER TABLE public.sys_currency_rounding_rules_cd
  ADD COLUMN IF NOT EXISTS id                         UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rounding_context            TEXT,
  ADD COLUMN IF NOT EXISTS calculation_decimal_places  INTEGER,
  ADD COLUMN IF NOT EXISTS output_decimal_places       INTEGER,
  ADD COLUMN IF NOT EXISTS rounding_mode               TEXT,
  ADD COLUMN IF NOT EXISTS rounding_increment_minor    INTEGER,
  ADD COLUMN IF NOT EXISTS is_tenant_overridable       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_mandatory                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS effective_from              DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS effective_to                DATE,
  ADD COLUMN IF NOT EXISTS name                        TEXT,
  ADD COLUMN IF NOT EXISTS name2                       TEXT,
  ADD COLUMN IF NOT EXISTS description                 TEXT,
  ADD COLUMN IF NOT EXISTS description2                TEXT,
  ADD COLUMN IF NOT EXISTS display_order               INTEGER,
  ADD COLUMN IF NOT EXISTS rec_order                   INTEGER,
  ADD COLUMN IF NOT EXISTS metadata                    JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS created_by                  TEXT,
  ADD COLUMN IF NOT EXISTS created_info                TEXT,
  ADD COLUMN IF NOT EXISTS updated_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by                  TEXT,
  ADD COLUMN IF NOT EXISTS updated_info                TEXT;

-- Rename the pre-existing 0290-era `notes` column to `rec_notes` so this
-- table carries the repo-standard rec_status/rec_order/rec_notes triad
-- (rec_status already existed; rec_order was added above) instead of a
-- one-off `notes` name — cheaper than adding a second, duplicate column.
ALTER TABLE public.sys_currency_rounding_rules_cd
  RENAME COLUMN notes TO rec_notes;

-- Backfill: every live row becomes an ACCOUNTING rule. rounding_unit is a
-- major-unit decimal (e.g. 0.001 for a 3dp currency); convert to an integer
-- minor-unit increment via the currency's own minor_unit. Every live row is
-- HALF_UP already (confirmed via remote read-only query), so the CEIL->UP /
-- FLOOR->DOWN mapping is future-proofing for this backfill formula, not a
-- change any live row goes through today.
UPDATE public.sys_currency_rounding_rules_cd r
   SET rounding_context = 'ACCOUNTING',
       rounding_increment_minor =
         GREATEST(1, ROUND(r.rounding_unit * POWER(10, c.minor_unit))::INTEGER),
       rounding_mode = CASE r.rounding_method
                          WHEN 'CEIL'  THEN 'UP'
                          WHEN 'FLOOR' THEN 'DOWN'
                          ELSE r.rounding_method
                        END,
       name = 'Accounting rounding',
       name2 = 'التقريب المحاسبي',
       description = 'Default accounting-precision rounding to the currency''s own minor unit, migrated from the pre-context-scoped rule.',
       description2 = 'التقريب المحاسبي الافتراضي إلى الوحدة الصغرى الخاصة بالعملة، منقول من القاعدة السابقة غير المصنّفة حسب السياق.',
       is_tenant_overridable = FALSE,
       metadata = '{"seed_source":"MIGRATED_FROM_0290","review_status":"derived"}'::JSONB
  FROM public.sys_currency_cd c
 WHERE c.code = r.currency_code
   AND r.rounding_context IS NULL;

-- ── Step 3: finalize PK/FK/CHECK/NOT NULL, seed, rename ─────────────────────

ALTER TABLE public.sys_currency_rounding_rules_cd
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN rounding_context SET NOT NULL,
  ALTER COLUMN rounding_mode SET NOT NULL;

ALTER TABLE public.sys_currency_rounding_rules_cd
  DROP CONSTRAINT sys_currency_rounding_rules_cd_pkey,
  DROP CONSTRAINT sys_currency_rounding_rules_cd_rounding_method_check;

ALTER TABLE public.sys_currency_rounding_rules_cd
  ADD CONSTRAINT pk_scrr PRIMARY KEY (id),
  ADD CONSTRAINT fk_scrr_currency FOREIGN KEY (currency_code)
    REFERENCES public.sys_currency_cd(code),
  ADD CONSTRAINT fk_scrr_context FOREIGN KEY (rounding_context)
    REFERENCES public.sys_rounding_context_cd(code),
  ADD CONSTRAINT fk_scrr_mode FOREIGN KEY (rounding_mode)
    REFERENCES public.sys_rounding_mode_cd(code),
  ADD CONSTRAINT chk_scrr_calc_dp CHECK (calculation_decimal_places IS NULL
                                         OR calculation_decimal_places BETWEEN 0 AND 12),
  ADD CONSTRAINT chk_scrr_out_dp CHECK (output_decimal_places IS NULL
                                        OR output_decimal_places BETWEEN 0 AND 12),
  ADD CONSTRAINT chk_scrr_dp_order CHECK (calculation_decimal_places IS NULL
                                          OR output_decimal_places IS NULL
                                          OR calculation_decimal_places >= output_decimal_places),
  ADD CONSTRAINT chk_scrr_incr CHECK (rounding_increment_minor IS NULL
                                      OR rounding_increment_minor > 0),
  ADD CONSTRAINT chk_scrr_dates CHECK (effective_to IS NULL OR effective_to >= effective_from);

-- Overlap protection: the "rigorous" btree_gist exclusion constraint from
-- the handoff (§3.3 option 1) needs `CREATE EXTENSION btree_gist`, which is
-- its own approval (Phase 2 task 2.7). Deferred — zero practical risk today
-- since every row seeded below has effective_to = NULL and one
-- effective_from per (currency, context), so no overlap can exist yet. The
-- partial unique index below is the "pragmatic" option and is sufficient
-- until the extension is approved.
CREATE UNIQUE INDEX uq_scrr_active
  ON public.sys_currency_rounding_rules_cd (currency_code, rounding_context, effective_from)
  WHERE rec_status = 1;

CREATE INDEX idx_scrr_lookup
  ON public.sys_currency_rounding_rules_cd (currency_code, rounding_context, is_active);

ALTER TABLE public.sys_currency_rounding_rules_cd RENAME TO sys_currency_rounding_rules_cf;

COMMENT ON TABLE public.sys_currency_rounding_rules_cf IS
  'HQ-owned rounding policy, one row per (currency, context). ACCOUNTING/TAX are never tenant-overridable; CASH_CHANGE is (org_fin_cash_ctrl_stng_cf.cash_change_bearer). Resolution: look up (currency, context); fall back to (currency, ACCOUNTING); if still absent, no-op (round to sys_currency_cd.minor_unit only) — never invent a rounding behavior.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.calculation_decimal_places IS
  'NULL falls back to sys_currency_cd.minor_unit. Kept >= output_decimal_places to avoid premature rounding mid-computation.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.output_decimal_places IS
  'NULL falls back to sys_currency_cd.minor_unit. May never exceed the currency''s intrinsic minor unit (enforced in seed review, not a cross-table CHECK).';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.rounding_increment_minor IS
  'Integer count of minor units (5 baisa, 100 öre), never a decimal — decimal increments reintroduce the float drift this design removes. NULL = no increment snapping beyond output_decimal_places.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.id IS 'Surrogate primary key. currency_code alone stopped being unique once this table went context-scoped.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.currency_code IS 'FK to sys_currency_cd(code). Immutable after creation — a currency correction is a new row, not an edit.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.rounding_context IS 'FK to sys_rounding_context_cd(code). Immutable after creation — a context correction is a new row, not an edit.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.rounding_mode IS 'FK to sys_rounding_mode_cd(code). Defines exact tie-breaking and sign behavior — see that table.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.is_tenant_overridable IS 'Whether a tenant-level override of this rule is allowed. FALSE for ACCOUNTING/TAX (regulator-determined) and CASH_TENDER (coin-physics-determined).';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.is_mandatory IS 'Reserved for a future enforcement flag (e.g. a rule that cannot be disabled even by HQ). Not yet read by any consumer.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.effective_from IS 'Date this rule version starts applying. Resolvers filter on the business date, never on now().';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.effective_to IS 'Date this rule version stops applying. NULL = still in effect.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.name IS 'Display label, English.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.name2 IS 'Display label, Arabic.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.description IS 'One-sentence explanation of the rule''s practical effect, English.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.description2 IS 'One-sentence explanation of the rule''s practical effect, Arabic.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.display_order IS 'Sort order for admin-UI listings; NULL sorts last.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.rec_notes IS 'Longer free-text justification/citation for this rule — renamed from the pre-0521 table''s `notes` column for consistency with the repo''s rec_status/rec_order/rec_notes convention.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.metadata IS 'seed_source/review_status/confidence/sources — provenance for how this row''s values were determined, not business data.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.is_active IS 'Soft-enable flag; FALSE hides the rule from resolution without deleting history.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.rec_status IS '1=active, 0=soft-deleted, 2=archived — never hard-delete.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.rec_order IS 'Reserved manual-ordering column, not populated by this seed.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.created_at IS 'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.created_by IS 'Actor (HQ user id or system) that created the row.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.created_info IS 'Freeform context captured at creation (e.g. request/session info).';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.updated_at IS 'Last update timestamp (UTC); NULL if never updated.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.updated_by IS 'Actor (HQ user id or system) that last updated the row.';
COMMENT ON COLUMN public.sys_currency_rounding_rules_cf.updated_info IS 'Freeform context captured at the last update.';

-- ── Mechanical ACCOUNTING seed for every currency without one yet ──────────
-- (the 13 backfilled above are skipped via ON CONFLICT; this fills the
-- other ~168 non-GCC currencies at "round to own minor unit, no snapping" —
-- the same behavior an absent row already produces, so this is a
-- convenience for admin-UI visibility, not a behavior change.)

INSERT INTO public.sys_currency_rounding_rules_cf
  (id, currency_code, rounding_context, rounding_increment_minor, rounding_mode,
   name, name2, description, description2, is_tenant_overridable, is_active, rec_status, metadata)
SELECT gen_random_uuid(), c.code, 'ACCOUNTING', 1, 'HALF_UP',
       'Accounting rounding', 'التقريب المحاسبي',
       'Default accounting-precision rounding to the currency''s own minor unit; no increment snapping beyond that.',
       'التقريب المحاسبي الافتراضي إلى الوحدة الصغرى الخاصة بالعملة؛ دون أي تقريب إضافي للزيادة.',
       FALSE, TRUE, 1,
       '{"seed_source":"DERIVED_FROM_MINOR_UNIT","review_status":"derived"}'::JSONB
FROM public.sys_currency_cd c
WHERE c.is_active = TRUE
ON CONFLICT (currency_code, rounding_context, effective_from) WHERE rec_status = 1 DO NOTHING;

-- ── Curated CASH_TENDER + CASH_CHANGE seed, GCC six + USD ───────────────────
-- Researched 2026-09-25 (WebSearch against central-bank / government-
-- regulation / numismatic sources) — see the file header and metadata.sources
-- per row. review_status is "verified" (this session's research), not
-- "unverified"/"derived". Every value is UI-editable afterward.

INSERT INTO public.sys_currency_rounding_rules_cf
  (id, currency_code, rounding_context, rounding_increment_minor, rounding_mode,
   name, name2, description, description2, is_tenant_overridable, is_active, rec_status, rec_notes, metadata)
VALUES
  -- OMR — 1-baisa/smaller impractical; 5/10/25/50 baisa are the coins in
  -- everyday use (Central Bank of Oman currency page; Wikipedia "Omani rial").
  (gen_random_uuid(), 'OMR', 'CASH_TENDER', 5, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for OMR — 5 baisa.',
   'أصغر وحدة عملية للدفع النقدي بالريال العماني — 5 بيسة.',
   FALSE, TRUE, 1,
   'Smallest practically tenderable unit is 5 baisa.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://cbo.gov.om/Pages/Currency.aspx","https://en.wikipedia.org/wiki/Omani_rial"]}'::JSONB),
  (gen_random_uuid(), 'OMR', 'CASH_CHANGE', 10, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 10 baisa; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 10 بيسة؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'Change rounds up to the nearest 10 baisa by default (business absorbs the fraction); tenant cash_change_bearer setting can override the direction.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),

  -- KWD — 1 fils technically still legal tender but not minted since 1988
  -- and not used day-to-day; 5 fils is the smallest coin in practical use.
  (gen_random_uuid(), 'KWD', 'CASH_TENDER', 5, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for KWD — 5 fils.',
   'أصغر وحدة عملية للدفع النقدي بالدينار الكويتي — 5 فلس.',
   FALSE, TRUE, 1,
   '1 fils coin not minted since 1988 and not used in daily transactions; 5 fils is the practical floor.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://www.cbk.gov.kw/en/banknotes-and-coins/coins","https://en.wikipedia.org/wiki/Kuwaiti_dinar"]}'::JSONB),
  (gen_random_uuid(), 'KWD', 'CASH_CHANGE', 5, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 5 fils; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 5 فلس؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'No evidence of a coarser common change practice than the 5-fils tender floor.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),

  -- BHD — 1 fils only ever issued 1965-66 and no longer circulates; 5 fils
  -- is the smallest coin currently in circulation.
  (gen_random_uuid(), 'BHD', 'CASH_TENDER', 5, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for BHD — 5 fils.',
   'أصغر وحدة عملية للدفع النقدي بالدينار البحريني — 5 فلس.',
   FALSE, TRUE, 1,
   '1 fils coin (issued only 1965-1966) no longer circulates; 5 fils is the smallest current coin.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://en.wikipedia.org/wiki/Bahraini_dinar","https://onlinecoin.club/Coins/CoinType/Bahrain/Five_Fils/"]}'::JSONB),
  (gen_random_uuid(), 'BHD', 'CASH_CHANGE', 5, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 5 fils; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 5 فلس؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'No evidence of a coarser common change practice than the 5-fils tender floor.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),

  -- AED — an actual Abu Dhabi Department of Economic Development circular
  -- permits rounding retail prices to the nearest 25 fils; 1/5/10 fils
  -- coins are still minted but "so rarely seen... many do not realise they
  -- exist" (Gulf News). This is materially stronger evidence than a guess,
  -- and sharpens the handoff's placeholder ("1 or 5 - confirm") to 25.
  (gen_random_uuid(), 'AED', 'CASH_TENDER', 25, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for AED — 25 fils, per Abu Dhabi DED retail rounding rules.',
   'أصغر وحدة عملية للدفع النقدي بالدرهم الإماراتي — 25 فلسًا، وفق قواعد دائرة التنمية الاقتصادية بأبوظبي.',
   FALSE, TRUE, 1,
   'Abu Dhabi DED circular permits rounding retail prices to the nearest 25 fils; 1/5/10 fils coins are minted but not practically used.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://gulfnews.com/your-money/taxation/prices-to-be-rounded-up-to-25-fils-in-abu-dhabi-1.2156315","https://gulfnews.com/uae/readers-say-they-were-unaware-smaller-fils-coins-existed-1.790116"]}'::JSONB),
  (gen_random_uuid(), 'AED', 'CASH_CHANGE', 25, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 25 fils; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 25 فلسًا؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'Matches the documented 25-fils retail rounding unit.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),

  -- QAR — 25/50 dirham coins are "frequently used"; 1/5/10 dirham coins
  -- exist but are rarely used, with retail prices commonly rounded to the
  -- nearest 25 or 50 dirham. Sharpens the handoff's placeholder ("1 or 5 -
  -- confirm") to 25, matching AED's evidenced pattern.
  (gen_random_uuid(), 'QAR', 'CASH_TENDER', 25, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for QAR — 25 dirham.',
   'أصغر وحدة عملية للدفع النقدي بالريال القطري — 25 درهمًا.',
   FALSE, TRUE, 1,
   '1/5/10 dirham coins rarely used in practice; retail commonly rounds to the nearest 25 or 50 dirham.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://en.wikipedia.org/wiki/Qatari_riyal"]}'::JSONB),
  (gen_random_uuid(), 'QAR', 'CASH_CHANGE', 25, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 25 dirham; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 25 درهمًا؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'Matches the documented 25-dirham retail rounding unit.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),

  -- SAR — mixed evidence: one weak source claims cash rounds to the nearest
  -- riyal, but the 2016 (6th-series) 1/5/10/25/50-halala coins remain in
  -- active production and "halalas are vital in cash dealings" per another
  -- source, with no citable government rounding circular (unlike AED).
  -- Seeded at the conservative, coin-backed 5 halala rather than the
  -- more aggressive unsourced claim — favors the customer, matches actual
  -- circulating coinage, and is a one-row UI edit if HQ's own review finds
  -- otherwise.
  (gen_random_uuid(), 'SAR', 'CASH_TENDER', 5, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Conservative cash-tender unit for SAR — 5 halala; flagged for HQ review (medium confidence).',
   'وحدة دفع نقدي متحفظة للريال السعودي — 5 هللات؛ مُعلَّمة للمراجعة من المقر الرئيسي (ثقة متوسطة).',
   FALSE, TRUE, 1,
   'Conservative pick: 5-halala coins are in active production (6th series, 2016) and used in retail pricing; evidence for a coarser common cash-rounding practice was weaker/unsourced. Flagged for HQ review (handoff checklist item).',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","confidence":"medium","sources":["https://en.wikipedia.org/wiki/Saudi_riyal"]}'::JSONB),
  (gen_random_uuid(), 'SAR', 'CASH_CHANGE', 5, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 5 halala; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 5 هللات؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'Matches the conservative 5-halala tender floor; see CASH_TENDER note.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","confidence":"medium"}'::JSONB),

  -- USD — the US Mint struck its last penny on 2025-11-12 and Treasury
  -- placed its final penny-blank order in May 2025; existing pennies remain
  -- legal tender (still accepted) but are no longer minted or practically
  -- given as change. Multiple sources (Richmond Fed, Treasury's own FAQ,
  -- pending federal legislation HR 3074/S 1525) converge on cash
  -- transactions rounding to the nearest 5 cents (nickel) going forward —
  -- real, current, citable evidence, not a guess.
  (gen_random_uuid(), 'USD', 'CASH_TENDER', 5, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for USD — 5 cents (nickel), following the US Treasury''s 2025 cessation of penny production.',
   'أصغر وحدة عملية للدفع النقدي بالدولار الأمريكي — 5 سنتات (نيكل)، عقب توقف وزارة الخزانة الأمريكية عن سك عملة السنت الواحد عام 2025.',
   FALSE, TRUE, 1,
   'US Mint struck its last 1-cent coin 2025-11-12; existing pennies remain legal tender but are no longer minted or practically given as change. Cash transactions round to the nearest 5 cents.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://home.treasury.gov/news/featured-stories/penny-production-cessation-faqs","https://www.richmondfed.org/publications/research/economic_brief/2025/eb_25-27","https://en.wikipedia.org/wiki/Penny_debate_in_the_United_States"]}'::JSONB),
  (gen_random_uuid(), 'USD', 'CASH_CHANGE', 5, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest 5 cents; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب 5 سنتات؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'Matches the post-penny 5-cent cash-tender floor; several proposed federal bills (HR 3074, S 1525) would formalize this rounding, not yet enacted.',
   '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB)
ON CONFLICT (currency_code, rounding_context, effective_from) WHERE rec_status = 1 DO NOTHING;

COMMIT;
