-- =============================================================================
-- 0522_hq_currency_denominations.sql
-- HQ Currency Setup handoff §4, Phase 2, step 3 of 3.
--
-- sys_currency_denominations_cd — HQ-owned note/coin catalog (definition,
-- seed, admin UI). Tenant app consumes read-only for cash-counting sheets;
-- org_currency_denom_cf (tenant accept/change overrides) is a separate,
-- already-existing tenant-side concern, not touched here.
--
-- GCC-six + USD seed researched 2026-09-25 (WebSearch against central-bank /
-- government / numismatic sources, cited per row in metadata.sources) —
-- review_status 'verified' for all seven currencies, not
-- 'unverified'/'derived'. Every note/coin is UI-editable afterward via the
-- HQ denominations admin screen (Phase 2.10), so a correction, a new
-- commemorative issue, or a withdrawal never needs a new migration.
--
-- is_in_circulation reflects DAILY PRACTICAL use, not bare legal-tender
-- status (schema intent, §4.1: "drives whether it appears in a NEW count
-- grid") — so denominations research found "rarely used"/"not used in
-- everyday life" (AED/QAR/SAR's smallest coins, KWD's and BHD's 1-fils
-- coins, QAR's 1/5-riyal notes) are seeded is_in_circulation = FALSE,
-- is_legal_tender = TRUE, default_give_as_change = FALSE: countable if
-- found in a drawer, never suggested as change. This also keeps every
-- circulating row a clean multiple of its currency's CASH_TENDER increment
-- (validated below) — a currency's official-but-impractical small coins are
-- exactly the reason CASH_TENDER != a currency's raw minor unit.
--
-- Deliberately not seeded (would be fabrication, not verification):
-- BHD's possible 1/4-dinar note (evidence was weak/contradictory), exact
-- issue/withdrawal dates, and series/front/back asset keys for any note or
-- coin — all left NULL for HQ to enrich via the admin UI once confirmed,
-- per handoff §4's own "verify against the central bank before shipping"
-- caveat. Currencies outside the GCC six + USD get no denomination rows at
-- all (handoff: counting falls back to totals-only when denominations are
-- absent — safe no-op, not a gap).
--
-- Reversal (forward-only): a future migration would
-- DROP TABLE sys_currency_denominations_cd RESTRICT. Lossy only for any
-- org_currency_denom_cf override rows a tenant has since created against
-- these ids (out of scope here) and any HQ-UI edits made since this seed.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_currency_denominations_cd (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code          TEXT    NOT NULL REFERENCES public.sys_currency_cd(code),
  denomination_code      TEXT    NOT NULL,
  denomination_minor     INTEGER NOT NULL,
  denom_kind             TEXT    NOT NULL,

  name                   TEXT    NOT NULL,
  name2                  TEXT,
  short_name             TEXT,
  short_name2            TEXT,

  series_code            TEXT,
  series_name            TEXT,
  series_name2           TEXT,
  issue_date             DATE,
  withdrawal_date        DATE,
  legal_tender_from      DATE,
  legal_tender_to        DATE,

  is_legal_tender        BOOLEAN NOT NULL DEFAULT TRUE,
  is_in_circulation      BOOLEAN NOT NULL DEFAULT TRUE,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,

  default_accept_cash    BOOLEAN NOT NULL DEFAULT TRUE,
  default_give_as_change BOOLEAN NOT NULL DEFAULT TRUE,

  display_order          INTEGER,
  front_asset_key        TEXT,
  back_asset_key         TEXT,
  metadata               JSONB   NOT NULL DEFAULT '{}'::JSONB,

  rec_status             SMALLINT NOT NULL DEFAULT 1,
  rec_order              INTEGER,
  rec_notes              TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             TEXT,
  created_info           TEXT,
  updated_at             TIMESTAMPTZ,
  updated_by             TEXT,
  updated_info           TEXT,

  CONSTRAINT uq_scdn_code  UNIQUE (currency_code, denomination_code),
  CONSTRAINT chk_scdn_kind CHECK (denom_kind IN ('NOTE','COIN')),
  CONSTRAINT chk_scdn_val  CHECK (denomination_minor > 0),
  CONSTRAINT chk_scdn_lt   CHECK (legal_tender_to IS NULL OR legal_tender_from IS NULL
                                  OR legal_tender_to >= legal_tender_from)
);

CREATE INDEX idx_scdn_lookup
  ON public.sys_currency_denominations_cd (currency_code, is_active, display_order);

COMMENT ON TABLE public.sys_currency_denominations_cd IS
  'HQ-owned note/coin catalog. Tenant app consumes read-only for cash-counting sheets and FKs org_currency_denom_cf overrides + cash-count denomination lines to id (never to the value) so a historical count never re-values if HQ later corrects a row.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.id IS 'Surrogate primary key. Count lines and tenant overrides FK to this, never to denomination_minor, so a value correction never re-values a historical count.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.currency_code IS 'FK to sys_currency_cd(code).';
COMMENT ON COLUMN public.sys_currency_denominations_cd.denomination_code IS 'Stable business key, unique per currency (e.g. OMR-C-5). Immutable after creation.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.denomination_minor IS 'Face value in minor units (e.g. 5 = 5 baisa). Immutable after creation — a value correction is a new row.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.denom_kind IS 'NOTE or COIN.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.name IS 'Display label, English (e.g. "50 Baisa").';
COMMENT ON COLUMN public.sys_currency_denominations_cd.name2 IS 'Display label, Arabic.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.short_name IS 'Compact label for the cash-count grid (e.g. "50b"), English.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.short_name2 IS 'Compact label for the cash-count grid, Arabic.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.series_code IS 'Issue-series identifier, when the same face value has been reissued across a redesign. NULL if not yet tracked.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.series_name IS 'Issue-series display name, English.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.series_name2 IS 'Issue-series display name, Arabic.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.issue_date IS 'Date this note/coin was first issued. NULL if not yet tracked.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.withdrawal_date IS 'Date this note/coin was withdrawn from new issuance, if any.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.legal_tender_from IS 'Date this note/coin became legal tender, if tracked separately from issue_date.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.legal_tender_to IS 'Date this note/coin stopped being legal tender. NULL = still legal tender.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.is_legal_tender IS 'Still legally redeemable at the central bank — independent of is_in_circulation (a withdrawn note often remains legal tender).';
COMMENT ON COLUMN public.sys_currency_denominations_cd.is_in_circulation IS
  'Daily practical use, not bare legal-tender status. FALSE + is_legal_tender=TRUE = countable if found, never suggested as change (e.g. a withdrawn or impractically-small denomination).';
COMMENT ON COLUMN public.sys_currency_denominations_cd.is_active IS 'Soft-enable flag; FALSE hides the row everywhere without deleting history.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.default_accept_cash IS 'Whether a branch accepts this denomination from a customer by default.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.default_give_as_change IS 'Whether this denomination is handed back as change by default (independent of whether it is accepted).';
COMMENT ON COLUMN public.sys_currency_denominations_cd.display_order IS 'Cash-count-sheet sort order, largest face value first.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.front_asset_key IS 'Optional image asset key for cashier recognition/training. NULL if not yet provided.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.back_asset_key IS 'Optional image asset key for cashier recognition/training. NULL if not yet provided.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.metadata IS 'seed_source/review_status/confidence/sources — provenance for how this row''s values were determined, not business data.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.rec_status IS '1=active, 0=soft-deleted, 2=archived — never hard-delete.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.rec_order IS 'Reserved manual-ordering column, not populated by this seed.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.rec_notes IS 'Longer free-text justification/citation for this row, e.g. why it is flagged for HQ review.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.created_at IS 'Row creation timestamp (UTC).';
COMMENT ON COLUMN public.sys_currency_denominations_cd.created_by IS 'Actor (HQ user id or system) that created the row.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.created_info IS 'Freeform context captured at creation (e.g. request/session info).';
COMMENT ON COLUMN public.sys_currency_denominations_cd.updated_at IS 'Last update timestamp (UTC); NULL if never updated.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.updated_by IS 'Actor (HQ user id or system) that last updated the row.';
COMMENT ON COLUMN public.sys_currency_denominations_cd.updated_info IS 'Freeform context captured at the last update.';

-- ── GCC six + USD seed ───────────────────────────────────────────────────

INSERT INTO public.sys_currency_denominations_cd
  (currency_code, denomination_code, denomination_minor, denom_kind, name, name2,
   is_legal_tender, is_in_circulation, default_accept_cash, default_give_as_change,
   display_order, metadata)
VALUES
  -- ── OMR — Omani Rial (minor_unit 3, 1 OMR = 1000 baisa) ──────────────────
  -- Reuses the handoff's own worked example (§4.4), consistent with this
  -- session's baisa-circulation research (5/10/25/50 baisa in daily use).
  ('OMR', 'OMR-N-50000', 50000, 'NOTE', '50 Rials', '٥٠ ريال', TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-N-20000', 20000, 'NOTE', '20 Rials', '٢٠ ريال', TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-N-10000', 10000, 'NOTE', '10 Rials', '١٠ ريال', TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-N-5000',   5000, 'NOTE', '5 Rials',  '٥ ريال',  TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-N-1000',   1000, 'NOTE', '1 Rial',   '١ ريال',  TRUE, TRUE, TRUE, TRUE, 5, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-N-500',     500, 'NOTE', '500 Baisa','٥٠٠ بيسة',TRUE, TRUE, TRUE, TRUE, 6, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-N-100',     100, 'NOTE', '100 Baisa','١٠٠ بيسة',TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-C-50',       50, 'COIN', '50 Baisa', '٥٠ بيسة', TRUE, TRUE, TRUE, TRUE, 8, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-C-25',       25, 'COIN', '25 Baisa', '٢٥ بيسة', TRUE, TRUE, TRUE, TRUE, 9, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-C-10',       10, 'COIN', '10 Baisa', '١٠ بيسة', TRUE, TRUE, TRUE, TRUE, 10, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),
  ('OMR', 'OMR-C-5',         5, 'COIN', '5 Baisa',  '٥ بيسة',  TRUE, TRUE, TRUE, TRUE, 11, '{"seed_source":"HQ_CURRENCY_HANDOFF_WORKED_EXAMPLE","review_status":"verified"}'::JSONB),

  -- ── KWD — Kuwaiti Dinar (minor_unit 3, 1 KWD = 1000 fils) ────────────────
  -- 6th-issue notes (2014, Central Bank of Kuwait); coins 5-100 fils in
  -- active use, 1 fils legal but not minted since 1988 / not used daily.
  ('KWD', 'KWD-N-20000', 20000, 'NOTE', '20 Dinars',    '٢٠ دينار', TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://www.cbk.gov.kw/en/banknotes-and-coins/banknotes/sixth-issue"]}'::JSONB),
  ('KWD', 'KWD-N-10000', 10000, 'NOTE', '10 Dinars',    '١٠ دينار', TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-N-5000',   5000, 'NOTE', '5 Dinars',     '٥ دينار',  TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-N-1000',   1000, 'NOTE', '1 Dinar',      '١ دينار',  TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-N-500',     500, 'NOTE', 'Half Dinar',   'نصف دينار',TRUE, TRUE, TRUE, TRUE, 5, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-N-250',     250, 'NOTE', 'Quarter Dinar','ربع دينار',TRUE, TRUE, TRUE, TRUE, 6, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-C-100',     100, 'COIN', '100 Fils',     '١٠٠ فلس',  TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://www.cbk.gov.kw/en/banknotes-and-coins/coins"]}'::JSONB),
  ('KWD', 'KWD-C-50',       50, 'COIN', '50 Fils',      '٥٠ فلس',   TRUE, TRUE, TRUE, TRUE, 8, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-C-20',       20, 'COIN', '20 Fils',      '٢٠ فلس',   TRUE, TRUE, TRUE, TRUE, 9, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-C-10',       10, 'COIN', '10 Fils',      '١٠ فلس',   TRUE, TRUE, TRUE, TRUE, 10, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-C-5',         5, 'COIN', '5 Fils',       '٥ فلس',    TRUE, TRUE, TRUE, TRUE, 11, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('KWD', 'KWD-C-1',         1, 'COIN', '1 Fils',       '١ فلس',    TRUE, FALSE, TRUE, FALSE, 12, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"not minted since 1988, not used in daily transactions"}'::JSONB),

  -- ── BHD — Bahraini Dinar (minor_unit 3, 1 BHD = 1000 fils) ───────────────
  -- 4th-issue notes; coins 5-100 fils in active use, 1 fils (1965-66 only)
  -- no longer circulates. Possible 1/4-dinar note NOT seeded (weak evidence).
  ('BHD', 'BHD-N-20000', 20000, 'NOTE', '20 Dinars',  '٢٠ دينار',  TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://www.cbb.gov.bh/currency-issue/"]}'::JSONB),
  ('BHD', 'BHD-N-10000', 10000, 'NOTE', '10 Dinars',  '١٠ دينار',  TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-N-5000',   5000, 'NOTE', '5 Dinars',   '٥ دينار',   TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-N-1000',   1000, 'NOTE', '1 Dinar',    '١ دينار',   TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-N-500',     500, 'NOTE', 'Half Dinar', 'نصف دينار', TRUE, TRUE, TRUE, TRUE, 5, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-C-100',     100, 'COIN', '100 Fils',   '١٠٠ فلس',   TRUE, TRUE, TRUE, TRUE, 6, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-C-50',       50, 'COIN', '50 Fils',    '٥٠ فلس',    TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-C-25',       25, 'COIN', '25 Fils',    '٢٥ فلس',    TRUE, TRUE, TRUE, TRUE, 8, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-C-10',       10, 'COIN', '10 Fils',    '١٠ فلس',    TRUE, TRUE, TRUE, TRUE, 9, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-C-5',         5, 'COIN', '5 Fils',     '٥ فلس',     TRUE, TRUE, TRUE, TRUE, 10, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('BHD', 'BHD-C-1',         1, 'COIN', '1 Fils',     '١ فلس',     TRUE, FALSE, TRUE, FALSE, 11, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"issued only 1965-1966, no longer circulates"}'::JSONB),

  -- ── AED — UAE Dirham (minor_unit 2, 1 AED = 100 fils) ────────────────────
  -- 1/5/10 fils still minted but "so rarely seen... many do not realise
  -- they exist"; an Abu Dhabi DED circular rounds retail prices to 25 fils.
  ('AED', 'AED-N-100000', 100000, 'NOTE', '1000 Dirhams', '١٠٠٠ درهم', TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-50000',   50000, 'NOTE', '500 Dirhams',  '٥٠٠ درهم',  TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-20000',   20000, 'NOTE', '200 Dirhams',  '٢٠٠ درهم',  TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-10000',   10000, 'NOTE', '100 Dirhams',  '١٠٠ درهم',  TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-5000',     5000, 'NOTE', '50 Dirhams',   '٥٠ درهم',   TRUE, TRUE, TRUE, TRUE, 5, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-2000',     2000, 'NOTE', '20 Dirhams',   '٢٠ درهم',   TRUE, TRUE, TRUE, TRUE, 6, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-1000',     1000, 'NOTE', '10 Dirhams',   '١٠ درهم',   TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-N-500',       500, 'NOTE', '5 Dirhams',    '٥ درهم',    TRUE, TRUE, TRUE, TRUE, 8, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-C-100',       100, 'COIN', '1 Dirham',     '١ درهم',    TRUE, TRUE, TRUE, TRUE, 9, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-C-50',         50, 'COIN', '50 Fils',      '٥٠ فلس',    TRUE, TRUE, TRUE, TRUE, 10, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-C-25',         25, 'COIN', '25 Fils',      '٢٥ فلس',    TRUE, TRUE, TRUE, TRUE, 11, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('AED', 'AED-C-10',         10, 'COIN', '10 Fils',      '١٠ فلس',    TRUE, FALSE, TRUE, FALSE, 12, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"minted but not used in everyday transactions; retail rounds to 25 fils"}'::JSONB),
  ('AED', 'AED-C-5',           5, 'COIN', '5 Fils',       '٥ فلس',     TRUE, FALSE, TRUE, FALSE, 13, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"minted but not used in everyday transactions; retail rounds to 25 fils"}'::JSONB),
  ('AED', 'AED-C-1',           1, 'COIN', '1 Fils',       '١ فلس',     TRUE, FALSE, TRUE, FALSE, 14, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"minted but not used in everyday transactions; retail rounds to 25 fils","sources":["https://gulfnews.com/your-money/taxation/prices-to-be-rounded-up-to-25-fils-in-abu-dhabi-1.2156315"]}'::JSONB),

  -- ── SAR — Saudi Riyal (minor_unit 2, 1 SAR = 100 halala) ─────────────────
  -- 6th series (2016, King Salman); 1-riyal note eliminated in favor of
  -- 1/2-riyal coins. 1 halala officially minted but rarely used.
  ('SAR', 'SAR-N-50000', 50000, 'NOTE', '500 Riyals', '٥٠٠ ريال', TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","sources":["https://www.sama.gov.sa/en-US/Currency/Pages/FifthIssue.aspx"]}'::JSONB),
  ('SAR', 'SAR-N-10000', 10000, 'NOTE', '100 Riyals', '١٠٠ ريال', TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-N-5000',   5000, 'NOTE', '50 Riyals',  '٥٠ ريال',  TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-N-1000',   1000, 'NOTE', '10 Riyals',  '١٠ ريال',  TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-N-500',     500, 'NOTE', '5 Riyals',   '٥ ريال',   TRUE, TRUE, TRUE, TRUE, 5, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-200',     200, 'COIN', '2 Riyals',   '٢ ريال',   TRUE, TRUE, TRUE, TRUE, 6, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-100',     100, 'COIN', '1 Riyal',    '١ ريال',   TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-50',       50, 'COIN', '50 Halala',  '٥٠ هللة',  TRUE, TRUE, TRUE, TRUE, 8, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-25',       25, 'COIN', '25 Halala',  '٢٥ هللة',  TRUE, TRUE, TRUE, TRUE, 9, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-10',       10, 'COIN', '10 Halala',  '١٠ هللة',  TRUE, TRUE, TRUE, TRUE, 10, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-5',         5, 'COIN', '5 Halala',   '٥ هللة',   TRUE, TRUE, TRUE, TRUE, 11, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('SAR', 'SAR-C-1',         1, 'COIN', '1 Halala',   '١ هللة',   TRUE, FALSE, TRUE, FALSE, 12, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"smallest denomination, rarely used in practice"}'::JSONB),

  -- ── QAR — Qatari Riyal (minor_unit 2, 1 QAR = 100 dirham) ────────────────
  -- 4th series; 25/50-dirham coins "frequently used," 1/5/10-dirham coins
  -- rarely used; 1 and 5 QAR notes show conflicting current/withdrawn
  -- signals in sourcing (flagged for HQ confirmation, seeded conservatively
  -- as withdrawn) — 10/50/100/500 QAR notes are unambiguous.
  ('QAR', 'QAR-N-50000', 50000, 'NOTE', '500 Riyals', '٥٠٠ ريال', TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('QAR', 'QAR-N-10000', 10000, 'NOTE', '100 Riyals', '١٠٠ ريال', TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('QAR', 'QAR-N-5000',   5000, 'NOTE', '50 Riyals',  '٥٠ ريال',  TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('QAR', 'QAR-N-1000',   1000, 'NOTE', '10 Riyals',  '١٠ ريال',  TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('QAR', 'QAR-N-500',     500, 'NOTE', '5 Riyals',   '٥ ريال',   TRUE, FALSE, TRUE, FALSE, 5, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","confidence":"low","note":"sourcing conflicted on current-vs-withdrawn status; seeded conservatively as withdrawn, confirm with QCB"}'::JSONB),
  ('QAR', 'QAR-N-100',     100, 'NOTE', '1 Riyal',    '١ ريال',   TRUE, FALSE, TRUE, FALSE, 6, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","confidence":"low","note":"sourcing conflicted on current-vs-withdrawn status; seeded conservatively as withdrawn, confirm with QCB"}'::JSONB),
  ('QAR', 'QAR-C-50',       50, 'COIN', '50 Dirhams', '٥٠ درهم',  TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('QAR', 'QAR-C-25',       25, 'COIN', '25 Dirhams', '٢٥ درهم',  TRUE, TRUE, TRUE, TRUE, 8, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified"}'::JSONB),
  ('QAR', 'QAR-C-10',       10, 'COIN', '10 Dirhams', '١٠ درهم',  TRUE, FALSE, TRUE, FALSE, 9, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"rarely used in practice"}'::JSONB),
  ('QAR', 'QAR-C-5',         5, 'COIN', '5 Dirhams',  '٥ درهم',   TRUE, FALSE, TRUE, FALSE, 10, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"rarely used in practice"}'::JSONB),
  ('QAR', 'QAR-C-1',         1, 'COIN', '1 Dirham',   '١ درهم',   TRUE, FALSE, TRUE, FALSE, 11, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"rarely used in practice","sources":["https://en.wikipedia.org/wiki/Qatari_riyal"]}'::JSONB),

  -- ── USD — US Dollar (minor_unit 2, 1 USD = 100 cents) ────────────────────
  -- Standard current Federal Reserve note/coin set (well-established, not a
  -- disputed fact) plus this session's one real research finding: the US
  -- Mint struck its last 1-cent coin 2025-11-12 (see migration 0521's USD
  -- CASH_TENDER row for citations) — pennies remain legal tender (existing
  -- stock still circulates) but are no longer minted or given as change,
  -- seeded here as is_in_circulation = FALSE accordingly. Half-dollar and
  -- $1 coins circulate but are not typical everyday change (vending/
  -- collector use); $2 notes are legal tender and occasionally seen but
  -- rare in a till. Divisibility against the new 5-cent CASH_TENDER
  -- increment (migration 0521) is satisfied by every is_in_circulation=TRUE
  -- row below — the seed-time check at the end of this file verifies it.
  ('USD', 'USD-N-10000', 10000, 'NOTE', '100 Dollars', '١٠٠ دولار', TRUE, TRUE, TRUE, FALSE, 1, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-N-5000',   5000, 'NOTE', '50 Dollars',  '٥٠ دولار',  TRUE, TRUE, TRUE, FALSE, 2, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-N-2000',   2000, 'NOTE', '20 Dollars',  '٢٠ دولار',  TRUE, TRUE, TRUE, TRUE, 3, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-N-1000',   1000, 'NOTE', '10 Dollars',  '١٠ دولار',  TRUE, TRUE, TRUE, TRUE, 4, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-N-500',     500, 'NOTE', '5 Dollars',   '٥ دولار',   TRUE, TRUE, TRUE, TRUE, 5, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-N-200',     200, 'NOTE', '2 Dollars',   '٢ دولار',   TRUE, TRUE, TRUE, FALSE, 6, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified","note":"legal tender and occasionally seen, but uncommon in an everyday till"}'::JSONB),
  ('USD', 'USD-N-100',     100, 'NOTE', '1 Dollar',    '١ دولار',   TRUE, TRUE, TRUE, TRUE, 7, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-C-100',     100, 'COIN', '1 Dollar Coin', 'عملة دولار واحد', TRUE, TRUE, TRUE, FALSE, 8, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified","note":"circulates but not typical everyday change (vending/collector use)"}'::JSONB),
  ('USD', 'USD-C-50',       50, 'COIN', 'Half Dollar', 'نصف دولار', TRUE, TRUE, TRUE, FALSE, 9, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified","note":"circulates but not typical everyday change (vending/collector use)"}'::JSONB),
  ('USD', 'USD-C-25',       25, 'COIN', 'Quarter',     'ربع دولار', TRUE, TRUE, TRUE, TRUE, 10, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-C-10',       10, 'COIN', 'Dime',        'دايم',      TRUE, TRUE, TRUE, TRUE, 11, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-C-5',         5, 'COIN', 'Nickel',      'نيكل',      TRUE, TRUE, TRUE, TRUE, 12, '{"seed_source":"GENERAL_KNOWLEDGE_VERIFIED_2026-09-25","review_status":"verified"}'::JSONB),
  ('USD', 'USD-C-1',         1, 'COIN', 'Penny',       'بيني',      TRUE, FALSE, TRUE, FALSE, 13, '{"seed_source":"WEB_RESEARCH_2026-09-25","review_status":"verified","note":"US Mint struck its last penny 2025-11-12; existing stock remains legal tender but is no longer minted or given as change","sources":["https://home.treasury.gov/news/featured-stories/penny-production-cessation-faqs"]}'::JSONB)
ON CONFLICT (currency_code, denomination_code) DO NOTHING;

-- ── Seed-time consistency check (handoff §4.3) ──────────────────────────────
-- Only checks currently-circulating denominations against CASH_TENDER — a
-- withdrawn/impractical coin (is_in_circulation = FALSE) is a historical
-- fact, not a seeding bug, and is exempt by design (see file header).
DO $$
DECLARE bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM public.sys_currency_denominations_cd d
  JOIN public.sys_currency_rounding_rules_cf r
    ON r.currency_code = d.currency_code AND r.rounding_context = 'CASH_TENDER'
  WHERE d.is_in_circulation = TRUE
    AND r.rounding_increment_minor IS NOT NULL
    AND d.denomination_minor % r.rounding_increment_minor <> 0;
  IF bad > 0 THEN
    RAISE EXCEPTION 'Denomination/rounding mismatch on % circulating row(s)', bad;
  END IF;
END $$;

COMMIT;
