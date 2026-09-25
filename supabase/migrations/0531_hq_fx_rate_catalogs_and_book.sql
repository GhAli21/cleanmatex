-- =============================================================================
-- 0531_hq_fx_rate_catalogs_and_book.sql
-- HQ FX, stage 4A — cleanmatexsaas/docs/features/Currency_Setup/
-- implementation_plan_04_hq_fx.md §5.1 (tenant sibling:
-- docs/features/Tenant_Currency_FX/implementation_plan_01.md §8 contract).
--
-- Creates the HQ reference exchange-rate book and the catalogs shared by the
-- HQ book and the (later) tenant book org_fx_rate_mst:
--
--   1. sys_fx_rate_type_cd            rate types + per-type staleness window
--   2. sys_fx_rate_origin_cd          HOW a rate row got in (manual, HQ copy,
--                                     URL fetch, CSV, Excel, API)
--   3. sys_fx_provider_cd             HQ-curated URL providers (host allowlist,
--                                     parser, env-var NAME for keys — never a key)
--   4. sys_exchange_rate_source_cd    + one row 'cleanmatex_hq' (existing
--                                     "publisher" catalog from 0266, reused —
--                                     plan 02 decision 7; codes stay lowercase)
--   5. sys_fx_rate_import_batch_mst   HQ import runs (empty until HQ import ships)
--   6. sys_currency_exchange_rate_mst the HQ rate book
--
-- Design decisions carried from the plan (IDs in brackets):
--   - Rate direction is fixed platform-wide: to_amount = from_amount × rate_value
--     (ADR-039, /database skill). [F2]
--   - NUMERIC(22,10), never float. [P1]
--   - Lifecycle DRAFT → APPROVED | REJECTED, APPROVED → VOIDED; approved rows are
--     immutable in the service layer, corrected by void + new draft. [P4, P6]
--   - "origin" (how it got in) and "source" (who published it) are separate. [T4]
--   - inverse_rate_value is a generated column, display only; conversions
--     invert the direct rate at full precision at resolve time. [P11]
--   - One live rate per (from, to, date, type, source) via a partial unique
--     index — btree_gist is not installed, same approach as 0521. [F10]
--   - RLS: authenticated may read APPROVED live rows only (tenant "Fill from
--     HQ" + HQ fallback read through it); HQ writes via the service role. [P13]
--   - Audit of rate mutations goes to hq_audit_logs via AuditService, not a
--     dedicated table (the FX spec's name exceeds 30 chars). [P8]
--   - No rates are seeded: rates are market data; a seeded rate is a stale rate.
--
-- Not in this migration: the tenant book (org_currency_cf, org_fx_rate_mst —
-- tenant plan 0532/0533), HQ billing FX (0537–0540).
--
-- Reversal (forward-only): a future migration would DROP TABLE, in order,
-- sys_currency_exchange_rate_mst, sys_fx_rate_import_batch_mst,
-- sys_fx_provider_cd, sys_fx_rate_origin_cd, sys_fx_rate_type_cd — all
-- RESTRICT — and DELETE the 'cleanmatex_hq' source row if unreferenced.
-- Lossless only while no rates or tenant rows reference these objects.
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

-- ── 1. Rate-type catalog ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_fx_rate_type_cd (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  max_age_days  INTEGER,
  display_order INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT,
  CONSTRAINT chk_sfrt_code_upper  CHECK (code = UPPER(code)),
  CONSTRAINT chk_sfrt_max_age     CHECK (max_age_days IS NULL OR max_age_days > 0),
  CONSTRAINT chk_sfrt_rec_status  CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_fx_rate_type_cd IS
  'HQ-owned catalog of exchange-rate types (spot, closing, monthly average, corporate). Shared by the HQ rate book and the tenant rate book.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.code IS 'Stable uppercase code, e.g. SPOT. Mirrored exactly by TypeScript constants.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.name IS 'Display label, English.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.name2 IS 'Display label, Arabic.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.description IS 'When this rate type is used, English.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.description2 IS 'When this rate type is used, Arabic.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.max_age_days IS
  'Staleness window for rate resolution: a resolved rate older than this (request date − rate_date) is reported as FX_RATE_STALE. NULL = no limit. Tenants may override per currency (org_currency_cf.rate_max_age_days).';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.display_order IS 'Sort order for admin-UI dropdowns; NULL sorts last.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.is_active IS 'FALSE hides the type from new-rate pickers without deleting history.';
COMMENT ON COLUMN public.sys_fx_rate_type_cd.rec_status IS '1=active, 0=soft-deleted, 2=archived — never hard-delete.';

INSERT INTO public.sys_fx_rate_type_cd
  (code, name, name2, description, description2, max_age_days, display_order, created_by, created_info)
VALUES
  ('SPOT', 'Spot rate', 'سعر فوري',
   'Market rate for a given day; the default for pricing and day-to-day conversion.',
   'سعر السوق ليوم محدد؛ الافتراضي للتسعير والتحويل اليومي.',
   7, 10, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('CLOSING', 'Period closing rate', 'سعر الإقفال',
   'Rate at period end; used for point-in-time balances and period-end reporting.',
   'السعر في نهاية الفترة؛ يُستخدم للأرصدة في تاريخ محدد وتقارير نهاية الفترة.',
   45, 20, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('MONTHLY_AVG', 'Monthly average rate', 'متوسط السعر الشهري',
   'Average rate over a month; used for period metrics such as revenue for the month.',
   'متوسط السعر خلال شهر؛ يُستخدم لمؤشرات الفترة مثل إيرادات الشهر.',
   45, 30, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('CORPORATE', 'Corporate (budget) rate', 'سعر الشركة المعتمد',
   'Internally fixed rate for budgeting and planning, typically set once a year.',
   'سعر ثابت داخلياً للموازنة والتخطيط، يُحدَّد عادةً مرة في السنة.',
   400, 40, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Rate-origin catalog ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_fx_rate_origin_cd (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT,
  CONSTRAINT chk_sfro_code_upper CHECK (code = UPPER(code)),
  CONSTRAINT chk_sfro_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_fx_rate_origin_cd IS
  'HQ-owned catalog of how a rate row entered a rate book (manual entry, copy from HQ, URL fetch, CSV, Excel, API). Distinct from the publisher (sys_exchange_rate_source_cd). New origins are new rows, not code changes.';
COMMENT ON COLUMN public.sys_fx_rate_origin_cd.code IS 'Stable uppercase code, e.g. CSV_IMPORT. Mirrored exactly by TypeScript constants.';
COMMENT ON COLUMN public.sys_fx_rate_origin_cd.name IS 'Display label, English.';
COMMENT ON COLUMN public.sys_fx_rate_origin_cd.name2 IS 'Display label, Arabic.';
COMMENT ON COLUMN public.sys_fx_rate_origin_cd.is_active IS 'FALSE = origin not offered yet (e.g. API is reserved).';
COMMENT ON COLUMN public.sys_fx_rate_origin_cd.rec_status IS '1=active, 0=soft-deleted, 2=archived — never hard-delete.';

INSERT INTO public.sys_fx_rate_origin_cd
  (code, name, name2, description, description2, display_order, is_active, created_by, created_info)
VALUES
  ('MANUAL', 'Manual entry', 'إدخال يدوي',
   'Rate typed in by a user.', 'سعر أدخله مستخدم يدوياً.',
   10, TRUE, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('HQ_COPY', 'Copied from CleanMateX HQ', 'منسوخ من المقر الرئيسي CleanMateX',
   'Tenant rate copied from an approved HQ reference rate (keeps the HQ rate id).',
   'سعر المستأجر المنسوخ من سعر مرجعي معتمد في المقر الرئيسي (مع الاحتفاظ بمعرّف سعر المقر).',
   20, TRUE, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('URL_FETCH', 'Fetched from provider', 'مستورد من مزوّد',
   'Rate fetched from an HQ-curated provider URL.', 'سعر مستورد من رابط مزوّد معتمد من المقر الرئيسي.',
   30, TRUE, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('CSV_IMPORT', 'CSV import', 'استيراد CSV',
   'Rate imported from a CSV file.', 'سعر مستورد من ملف CSV.',
   40, TRUE, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('EXCEL_IMPORT', 'Excel import', 'استيراد Excel',
   'Rate imported from an Excel file.', 'سعر مستورد من ملف Excel.',
   50, TRUE, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('API', 'API integration', 'تكامل عبر واجهة برمجية',
   'Reserved: rate pushed by an external system through an API.', 'محجوز: سعر يُرسَل من نظام خارجي عبر واجهة برمجية.',
   60, FALSE, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book')
ON CONFLICT (code) DO NOTHING;

-- ── 3. Publisher catalog: add CleanMateX HQ (reuse 0266's table) ─────────────

INSERT INTO public.sys_exchange_rate_source_cd
  (code, name, name2, description, description2, display_order)
VALUES
  ('cleanmatex_hq', 'CleanMateX HQ', 'المقر الرئيسي CleanMateX',
   'Reference rate maintained by CleanMateX HQ.', 'سعر مرجعي يديره المقر الرئيسي لـ CleanMateX.',
   8)
ON CONFLICT (code) DO NOTHING;

-- ── 4. HQ-curated URL providers ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_fx_provider_cd (
  code                 TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  name2                TEXT,
  description          TEXT,
  description2         TEXT,
  source_code          TEXT NOT NULL,
  base_url             TEXT NOT NULL,
  allowed_hosts        TEXT[] NOT NULL,
  response_format      TEXT NOT NULL,
  parser_code          TEXT NOT NULL,
  auth_mode            TEXT NOT NULL DEFAULT 'NONE',
  env_key_name         TEXT,
  base_currency_code   TEXT,
  supports_historical  BOOLEAN NOT NULL DEFAULT FALSE,
  display_order        INTEGER,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status           SMALLINT NOT NULL DEFAULT 1,
  rec_order            INTEGER,
  rec_notes            TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT,
  created_info         TEXT,
  updated_at           TIMESTAMPTZ,
  updated_by           TEXT,
  updated_info         TEXT,
  CONSTRAINT fk_sfp_source   FOREIGN KEY (source_code) REFERENCES public.sys_exchange_rate_source_cd(code),
  CONSTRAINT fk_sfp_base_ccy FOREIGN KEY (base_currency_code) REFERENCES public.sys_currency_cd(code),
  CONSTRAINT chk_sfp_code_upper CHECK (code = UPPER(code)),
  CONSTRAINT chk_sfp_https      CHECK (base_url LIKE 'https://%'),
  CONSTRAINT chk_sfp_hosts      CHECK (cardinality(allowed_hosts) > 0),
  CONSTRAINT chk_sfp_format     CHECK (response_format IN ('JSON', 'XML', 'CSV')),
  CONSTRAINT chk_sfp_auth       CHECK (auth_mode IN ('NONE', 'PLATFORM_KEY')),
  CONSTRAINT chk_sfp_env_key    CHECK ((auth_mode = 'NONE' AND env_key_name IS NULL)
                                    OR (auth_mode = 'PLATFORM_KEY' AND env_key_name IS NOT NULL)),
  CONSTRAINT chk_sfp_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_fx_provider_cd IS
  'HQ-curated exchange-rate providers that may be fetched by URL. Tenants choose from these rows; they never supply a raw URL (SSRF protection). Secrets are never stored here — only the NAME of the server environment variable holding the key.';
COMMENT ON COLUMN public.sys_fx_provider_cd.code IS 'Stable uppercase code, e.g. ECB_DAILY.';
COMMENT ON COLUMN public.sys_fx_provider_cd.source_code IS 'Publisher recorded on rates fetched from this provider (FK sys_exchange_rate_source_cd).';
COMMENT ON COLUMN public.sys_fx_provider_cd.base_url IS 'HTTPS endpoint fetched server-side. Must be HTTPS and its host must be in allowed_hosts.';
COMMENT ON COLUMN public.sys_fx_provider_cd.allowed_hosts IS 'Exact host allowlist; the fetcher rejects any other host, including after redirects.';
COMMENT ON COLUMN public.sys_fx_provider_cd.response_format IS 'JSON | XML | CSV.';
COMMENT ON COLUMN public.sys_fx_provider_cd.parser_code IS 'Server-side parser implementation key, e.g. ECB_DAILY_XML. A provider whose parser is not implemented stays is_active = FALSE.';
COMMENT ON COLUMN public.sys_fx_provider_cd.auth_mode IS 'NONE = keyless; PLATFORM_KEY = platform-wide key read from the env var named in env_key_name.';
COMMENT ON COLUMN public.sys_fx_provider_cd.env_key_name IS 'NAME of the server environment variable that holds the API key. Never the key itself.';
COMMENT ON COLUMN public.sys_fx_provider_cd.base_currency_code IS 'Currency the provider quotes against (e.g. EUR for ECB), when fixed.';
COMMENT ON COLUMN public.sys_fx_provider_cd.supports_historical IS 'TRUE if the provider can return rates for past dates.';

INSERT INTO public.sys_fx_provider_cd
  (code, name, name2, description, description2, source_code, base_url, allowed_hosts,
   response_format, parser_code, auth_mode, env_key_name, base_currency_code,
   supports_historical, display_order, is_active, rec_notes, created_by, created_info)
VALUES
  ('ECB_DAILY', 'European Central Bank — daily reference rates', 'البنك المركزي الأوروبي — الأسعار المرجعية اليومية',
   'Keyless daily euro reference rates published by the ECB.',
   'أسعار مرجعية يومية لليورو ينشرها البنك المركزي الأوروبي دون الحاجة إلى مفتاح.',
   'ecb', 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', ARRAY['www.ecb.europa.eu'],
   'XML', 'ECB_DAILY_XML', 'NONE', NULL, 'EUR',
   FALSE, 10, TRUE, NULL, 'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('OPEN_EXCHANGE', 'Open Exchange Rates', 'Open Exchange Rates',
   'Commercial provider; requires a platform API key.', 'مزوّد تجاري؛ يتطلب مفتاح واجهة برمجية على مستوى المنصة.',
   'open_exchange', 'https://openexchangerates.org/api/latest.json', ARRAY['openexchangerates.org'],
   'JSON', 'OPEN_EXCHANGE_JSON', 'PLATFORM_KEY', 'FX_OPEN_EXCHANGE_APP_ID', 'USD',
   TRUE, 20, FALSE, 'Inactive until the parser ships and HQ sets FX_OPEN_EXCHANGE_APP_ID on the server.',
   'MIGRATION', '0531_hq_fx_rate_catalogs_and_book'),
  ('FIXER', 'Fixer', 'Fixer',
   'Commercial provider; requires a platform API key.', 'مزوّد تجاري؛ يتطلب مفتاح واجهة برمجية على مستوى المنصة.',
   'fixer', 'https://data.fixer.io/api/latest', ARRAY['data.fixer.io'],
   'JSON', 'FIXER_JSON', 'PLATFORM_KEY', 'FX_FIXER_API_KEY', NULL,
   TRUE, 30, FALSE, 'Inactive until the parser ships and HQ sets FX_FIXER_API_KEY on the server.',
   'MIGRATION', '0531_hq_fx_rate_catalogs_and_book')
ON CONFLICT (code) DO NOTHING;

-- ── 5. HQ import batches ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_fx_rate_import_batch_mst (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_code    TEXT NOT NULL,
  source_code    TEXT NOT NULL,
  provider_code  TEXT,
  file_name      TEXT,
  file_hash      TEXT,
  status         TEXT NOT NULL DEFAULT 'PREVIEWED',
  total_rows     INTEGER NOT NULL DEFAULT 0,
  valid_rows     INTEGER NOT NULL DEFAULT 0,
  invalid_rows   INTEGER NOT NULL DEFAULT 0,
  error_summary  JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata       JSONB NOT NULL DEFAULT '{}'::JSONB,
  rec_status     SMALLINT NOT NULL DEFAULT 1,
  rec_notes      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,
  updated_info   TEXT,
  CONSTRAINT fk_sfrib_origin   FOREIGN KEY (origin_code)   REFERENCES public.sys_fx_rate_origin_cd(code),
  CONSTRAINT fk_sfrib_source   FOREIGN KEY (source_code)   REFERENCES public.sys_exchange_rate_source_cd(code),
  CONSTRAINT fk_sfrib_provider FOREIGN KEY (provider_code) REFERENCES public.sys_fx_provider_cd(code),
  CONSTRAINT chk_sfrib_status  CHECK (status IN ('PREVIEWED', 'COMMITTED', 'FAILED', 'CANCELLED')),
  CONSTRAINT chk_sfrib_counts  CHECK (total_rows >= 0 AND valid_rows >= 0 AND invalid_rows >= 0
                                      AND valid_rows + invalid_rows <= total_rows),
  CONSTRAINT chk_sfrib_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_fx_rate_import_batch_mst IS
  'One row per HQ rate import run (CSV, Excel, URL fetch): preview → commit. Empty until HQ import ships; created now so rates can FK import_batch_id from day one.';
COMMENT ON COLUMN public.sys_fx_rate_import_batch_mst.origin_code IS 'How the batch was obtained (FK sys_fx_rate_origin_cd).';
COMMENT ON COLUMN public.sys_fx_rate_import_batch_mst.source_code IS 'Publisher recorded on the batch''s rates (FK sys_exchange_rate_source_cd).';
COMMENT ON COLUMN public.sys_fx_rate_import_batch_mst.provider_code IS 'Provider fetched, for URL_FETCH batches.';
COMMENT ON COLUMN public.sys_fx_rate_import_batch_mst.file_hash IS 'SHA-256 of the uploaded file, to detect re-imports of the same file.';
COMMENT ON COLUMN public.sys_fx_rate_import_batch_mst.status IS 'PREVIEWED → COMMITTED | CANCELLED; FAILED when parsing/validation fails.';
COMMENT ON COLUMN public.sys_fx_rate_import_batch_mst.error_summary IS 'Row-level validation errors (capped) from the preview step.';

CREATE INDEX IF NOT EXISTS idx_sfrib_created
  ON public.sys_fx_rate_import_batch_mst (created_at DESC);

ALTER TABLE public.sys_fx_rate_import_batch_mst ENABLE ROW LEVEL SECURITY;
-- No policies: HQ-internal table, accessed only through the service role.

-- ── 6. HQ rate book ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sys_currency_exchange_rate_mst (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency_code  TEXT NOT NULL,
  to_currency_code    TEXT NOT NULL,
  rate_type_code      TEXT NOT NULL,
  source_code         TEXT NOT NULL,
  origin_code         TEXT NOT NULL,
  rate_date           DATE NOT NULL,
  rate_value          NUMERIC(22,10) NOT NULL,
  inverse_rate_value  NUMERIC(22,10) GENERATED ALWAYS AS (ROUND(1 / rate_value, 10)) STORED,
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  source_reference    TEXT,
  import_batch_id     UUID,
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
  CONSTRAINT fk_scer_from_ccy  FOREIGN KEY (from_currency_code) REFERENCES public.sys_currency_cd(code),
  CONSTRAINT fk_scer_to_ccy    FOREIGN KEY (to_currency_code)   REFERENCES public.sys_currency_cd(code),
  CONSTRAINT fk_scer_rate_type FOREIGN KEY (rate_type_code)     REFERENCES public.sys_fx_rate_type_cd(code),
  CONSTRAINT fk_scer_source    FOREIGN KEY (source_code)        REFERENCES public.sys_exchange_rate_source_cd(code),
  CONSTRAINT fk_scer_origin    FOREIGN KEY (origin_code)        REFERENCES public.sys_fx_rate_origin_cd(code),
  CONSTRAINT fk_scer_batch     FOREIGN KEY (import_batch_id)    REFERENCES public.sys_fx_rate_import_batch_mst(id),
  CONSTRAINT chk_scer_pair     CHECK (from_currency_code <> to_currency_code),
  CONSTRAINT chk_scer_rate     CHECK (rate_value > 0),
  CONSTRAINT chk_scer_status   CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED', 'VOIDED')),
  CONSTRAINT chk_scer_approved CHECK (status NOT IN ('APPROVED', 'VOIDED')
                                      OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
  CONSTRAINT chk_scer_rejected CHECK (status <> 'REJECTED'
                                      OR (rejected_at IS NOT NULL AND rejected_by IS NOT NULL
                                          AND NULLIF(TRIM(rejection_reason), '') IS NOT NULL)),
  CONSTRAINT chk_scer_voided   CHECK (status <> 'VOIDED'
                                      OR (voided_at IS NOT NULL AND voided_by IS NOT NULL
                                          AND NULLIF(TRIM(void_reason), '') IS NOT NULL)),
  CONSTRAINT chk_scer_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_currency_exchange_rate_mst IS
  'HQ reference exchange-rate book. Direction: to_amount = from_amount × rate_value. Lifecycle DRAFT → APPROVED | REJECTED, APPROVED → VOIDED; approved rows are never edited — corrected by void + new draft. Only APPROVED rows are used for conversion. Tenants read approved rows (RLS) for "Fill from HQ" and as a fallback.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.from_currency_code IS 'Currency being converted from (FK sys_currency_cd).';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.to_currency_code IS 'Currency being converted to (FK sys_currency_cd). Must differ from from_currency_code.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.rate_type_code IS 'SPOT | CLOSING | MONTHLY_AVG | CORPORATE … (FK sys_fx_rate_type_cd).';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.source_code IS 'Publisher of the rate, e.g. central_bank, ecb, cleanmatex_hq (FK sys_exchange_rate_source_cd).';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.origin_code IS 'How the row entered the book, e.g. MANUAL, CSV_IMPORT (FK sys_fx_rate_origin_cd).';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.rate_date IS 'Business date the rate applies to. Resolution picks the latest approved rate_date <= the requested date.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.rate_value IS 'Units of to_currency per 1 unit of from_currency. NUMERIC(22,10), > 0, never float.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.inverse_rate_value IS 'Generated 1 / rate_value rounded to 10 dp. DISPLAY ONLY — conversions invert the direct rate at full precision at resolve time.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.status IS 'DRAFT | APPROVED | REJECTED | VOIDED.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.source_reference IS 'Free-text reference to the publication, e.g. a central-bank bulletin number.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.import_batch_id IS 'Import run that created the row (NULL for manual entry).';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.approved_by IS 'HQ user who approved. May equal created_by (self-approval is allowed and audited).';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.rejection_reason IS 'Required when status = REJECTED.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.void_reason IS 'Required when status = VOIDED.';
COMMENT ON COLUMN public.sys_currency_exchange_rate_mst.rec_status IS '1=active, 0=soft-deleted (drafts only), 2=archived — never hard-delete.';

-- One live rate per pair/date/type/source. Rejected, voided and soft-deleted
-- rows free the slot, which is what makes "void, then re-enter" possible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_scer_live
  ON public.sys_currency_exchange_rate_mst
     (from_currency_code, to_currency_code, rate_date, rate_type_code, source_code)
  WHERE status IN ('DRAFT', 'APPROVED') AND rec_status = 1;

-- Resolver hot path: latest approved rate on or before a date.
CREATE INDEX IF NOT EXISTS idx_scer_resolve
  ON public.sys_currency_exchange_rate_mst
     (from_currency_code, to_currency_code, rate_type_code, rate_date DESC)
  WHERE status = 'APPROVED' AND rec_status = 1;

-- Admin list screen: newest first, filtered by status.
CREATE INDEX IF NOT EXISTS idx_scer_date
  ON public.sys_currency_exchange_rate_mst (rate_date DESC, status)
  WHERE rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_scer_batch
  ON public.sys_currency_exchange_rate_mst (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

ALTER TABLE public.sys_currency_exchange_rate_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_scer_read_approved ON public.sys_currency_exchange_rate_mst;
CREATE POLICY pol_scer_read_approved
  ON public.sys_currency_exchange_rate_mst
  FOR SELECT
  TO authenticated
  USING (status = 'APPROVED' AND rec_status = 1);

COMMENT ON POLICY pol_scer_read_approved ON public.sys_currency_exchange_rate_mst IS
  'Signed-in users (tenant app) may read approved, live HQ reference rates only. Drafts, rejected and voided rows stay HQ-internal. No write policies: HQ writes through the service role.';

COMMIT;
