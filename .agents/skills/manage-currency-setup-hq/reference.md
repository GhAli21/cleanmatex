# manage-currency-setup-hq — Full Reference (v1.0.0)

This is the detailed reference for the `/manage-currency-setup-hq` skill. `SKILL.md` is the thin entry
point — read this file for the actual column lists, research checklist, and worked templates.

Everything here was extracted from the session that first built this domain (HQ Currency Setup
handoff, migrations `0520`-`0522`, GCC six + USD curated seed) — treat the worked examples as the
source of truth for tone and rigor, not just structure.

---

## 0. Ownership note

Per `docs/dev/rules/integration-contracts.md`: `cleanmatex` always owns migrations, even though
`cleanmatexsaas` owns the HQ currency-setup/currency-rounding admin UI and API for managing this data
day-to-day after the initial seed. That's why this skill lives here and never touches
`cleanmatexsaas/platform-api` or `platform-web` — if the admin UI itself needs a new field or screen,
that's a separate, HQ-side task, not this skill's job.

---

## 1. Discovery — read before writing anything

```sql
-- Does the currency exist at all?
SELECT code, name, minor_unit, is_cash_supported, iso_alpha_code
FROM sys_currency_cd WHERE code = 'XXX';

-- Which rounding contexts already have a rule?
SELECT rounding_context, rounding_mode, rounding_increment_minor, metadata->>'review_status'
FROM sys_currency_rounding_rules_cf WHERE currency_code = 'XXX' ORDER BY rounding_context;

-- Which denominations already exist?
SELECT denomination_code, denomination_minor, denom_kind, is_in_circulation
FROM sys_currency_denominations_cd WHERE currency_code = 'XXX' ORDER BY display_order;
```

Run these via the **remote** Supabase MCP (`supabase_remote_db` execute_sql, read-only) before deciding
what's missing. A currency frequently has a `sys_currency_cd` row (seeded in bulk, e.g. the 181-currency
ISO seed) but **zero** rows in the other two tables — that's the default gap this skill exists to close,
not an edge case.

Also confirm the exact live FK/constraint names you'll depend on if you're touching anything beyond a
plain `INSERT` (e.g. `pg_get_constraintdef` on `pg_constraint`) — don't assume a name from memory or
from this doc; verify it every time, the same way `0520` verified `fk_sys_currency_cash_rounding_mode`
before relying on it.

---

## 2. `sys_currency_cd` — new currency

Only 4 columns are truly required (no default, `NOT NULL`): `code`, `name`, `symbol`, `iso_alpha_code`.
Everything else has a sane default or is nullable. In practice always also supply `name2`,
`iso_numeric_code`, and `minor_unit` (defaults to `2`, wrong for 0- or 3-decimal currencies).

```sql
INSERT INTO public.sys_currency_cd
  (code, name, name2, symbol, minor_unit, iso_alpha_code, iso_numeric_code, is_cash_supported)
VALUES
  ('XXX', 'Currency Name', 'اسم العملة', '¤', 2, 'XXX', 999, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2, symbol = EXCLUDED.symbol;
```

Leave every symbol-rendering column (`fallback_symbol`, `official_symbol`, `symbol_svg`,
`unicode_codepoint`, ...) at its default unless you have a specific, sourced reason to set it — that's
Phase-3-of-HQ-Currency-Setup territory (format preview, rendering fallbacks), not this skill's job.
`is_cash_supported` gates whether steps 3-4 below apply at all — a currency with no physical cash use
(rare; some clearing/settlement-only codes) only ever needs an `ACCOUNTING` rounding rule.

**Do not touch `sys_currency_cd`'s other ~65 columns' types or the 7 lookup catalogs from migration
`0266`** — that's D26's flagged "full Prisma model reconciliation," an explicitly separate, larger pass.

---

## 3. `sys_currency_rounding_rules_cf` — full column list

```text
id                          UUID        surrogate PK
currency_code               TEXT        FK sys_currency_cd(code), immutable after create
rounding_context            TEXT        FK sys_rounding_context_cd(code), immutable after create
calculation_decimal_places  INTEGER     NULL = falls back to sys_currency_cd.minor_unit
output_decimal_places       INTEGER     NULL = falls back to sys_currency_cd.minor_unit
rounding_mode               TEXT        FK sys_rounding_mode_cd(code)
rounding_increment_minor    INTEGER     integer minor units; NULL = no increment snapping
is_tenant_overridable       BOOLEAN     FALSE for ACCOUNTING/TAX/CASH_TENDER; TRUE for CASH_CHANGE
is_mandatory                BOOLEAN     reserved, not yet consumed — leave FALSE
effective_from              DATE        defaults CURRENT_DATE
effective_to                DATE        NULL = still in effect
name / name2                TEXT        bilingual display label
description / description2  TEXT        bilingual one-sentence explanation — always populate
display_order                INTEGER
rec_notes                   TEXT        longer free-text citation/justification
metadata                    JSONB       {"seed_source", "review_status", "confidence"?, "sources"?}
is_active                   BOOLEAN
rec_status / rec_order      SMALLINT / INTEGER  standard triad
created_at/_by/_info, updated_at/_by/_info       standard audit block
```

Unique index: `(currency_code, rounding_context, effective_from)` where `rec_status = 1` — match this
exactly in `ON CONFLICT`.

### ACCOUNTING (always seed, mechanical — no research)

```sql
INSERT INTO public.sys_currency_rounding_rules_cf
  (id, currency_code, rounding_context, rounding_increment_minor, rounding_mode,
   name, name2, description, description2, is_tenant_overridable, is_active, rec_status, metadata)
VALUES
  (gen_random_uuid(), 'XXX', 'ACCOUNTING', 1, 'HALF_UP',
   'Accounting rounding', 'التقريب المحاسبي',
   'Default accounting-precision rounding to the currency''s own minor unit; no increment snapping beyond that.',
   'التقريب المحاسبي الافتراضي إلى الوحدة الصغرى الخاصة بالعملة؛ دون أي تقريب إضافي للزيادة.',
   FALSE, TRUE, 1,
   '{"seed_source":"DERIVED_FROM_MINOR_UNIT","review_status":"derived"}'::JSONB)
ON CONFLICT (currency_code, rounding_context, effective_from) WHERE rec_status = 1 DO NOTHING;
```

### CASH_TENDER / CASH_CHANGE (only if `is_cash_supported`, requires research)

Research checklist — WebSearch each, in this order, before writing a value:

1. `"<currency> smallest coin in circulation"` / `"<currency country> coins rarely used everyday"`
2. `"<currency country> cash rounding policy retail"` — look specifically for a **government or
   central-bank circular**, not just a numismatic description. This is the single highest-value search:
   the GCC-six + USD pass found that a real Abu Dhabi DED circular and the US Treasury's 2025 penny
   cessation FAQ both existed and materially changed the seeded value from a guess.
3. Cross-check against the central bank's own coin/denomination page for what's officially minted.
4. If sources disagree or nothing citable exists, seed the **conservative, coin-backed** value (the
   smallest denomination still in active production) rather than an aggressive unsourced claim, and mark
   `review_status: unverified` (or `verified` with `confidence: medium` if there's weak-but-real
   supporting evidence) — see the SAR worked example below.

```sql
INSERT INTO public.sys_currency_rounding_rules_cf
  (id, currency_code, rounding_context, rounding_increment_minor, rounding_mode,
   name, name2, description, description2, is_tenant_overridable, is_active, rec_status, rec_notes, metadata)
VALUES
  (gen_random_uuid(), 'XXX', 'CASH_TENDER', 5, 'HALF_UP',
   'Cash tender rounding', 'تقريب الدفع النقدي',
   'Smallest practical cash-tender unit for XXX — <n> <minor-unit-name>.',
   'أصغر وحدة عملية للدفع النقدي بـ<العملة> — <n> <اسم الوحدة الصغرى>.',
   FALSE, TRUE, 1,
   '<why this increment — cite the coin/circular found>',
   '{"seed_source":"WEB_RESEARCH_<YYYY-MM-DD>","review_status":"verified","sources":["<url>"]}'::JSONB),
  (gen_random_uuid(), 'XXX', 'CASH_CHANGE', 5, 'CEILING',
   'Cash change rounding', 'تقريب الباقي النقدي',
   'Change rounds up to the nearest <n> <minor-unit-name>; business absorbs the fraction by default.',
   'الباقي يُقرَّب لأعلى إلى أقرب <n> <اسم الوحدة الصغرى>؛ يتحمل المتجر الفرق افتراضيًا.',
   TRUE, TRUE, 1,
   'Matches the documented <n>-<unit> retail rounding unit (or: no evidence of a coarser change practice).',
   '{"seed_source":"WEB_RESEARCH_<YYYY-MM-DD>","review_status":"verified"}'::JSONB)
ON CONFLICT (currency_code, rounding_context, effective_from) WHERE rec_status = 1 DO NOTHING;
```

`CASH_CHANGE`'s `rounding_increment_minor` is normally the **same** as `CASH_TENDER`'s, unless research
specifically shows change customarily rounds coarser (e.g. OMR: 5-baisa tender floor, but 10-baisa
change step was the better-evidenced default). `is_tenant_overridable = TRUE` on `CASH_CHANGE` always —
`org_fin_cash_ctrl_stng_cf.cash_change_bearer` lets a tenant pick a different direction
(`BUSINESS`/`CUSTOMER`/`NEAREST` → `CEILING`/`FLOOR`/`HALF_UP`); this row is only the HQ default.

---

## 4. `sys_currency_denominations_cd` — full column list

```text
id                     UUID     surrogate PK — count lines & tenant overrides FK to this, never to value
currency_code          TEXT     FK sys_currency_cd(code)
denomination_code      TEXT     stable business key, unique per currency, e.g. 'XXX-C-5' / 'XXX-N-1000'
denomination_minor     INTEGER  face value in minor units, immutable after create
denom_kind             TEXT     'NOTE' or 'COIN'
name / name2           TEXT     bilingual display label, e.g. "5 Baisa" / "٥ بيسة"
short_name / short_name2  TEXT  compact count-grid label — optional, leave NULL unless sourced
series_code/name/name2, issue_date, withdrawal_date, legal_tender_from/_to  — leave NULL unless
                                sourced; enrich later via the admin UI, never fabricate a date
is_legal_tender        BOOLEAN  still legally redeemable — independent of daily use
is_in_circulation      BOOLEAN  DAILY PRACTICAL use — see the judgment rule below
is_active               BOOLEAN
default_accept_cash    BOOLEAN  branch accepts this denomination from a customer by default
default_give_as_change BOOLEAN  handed back as change by default
display_order          INTEGER  cash-count-sheet sort order, largest first
front_asset_key/back_asset_key  TEXT — leave NULL unless an actual image asset exists
metadata               JSONB    {"seed_source","review_status","confidence"?,"sources"?,"note"?}
rec_status/rec_order/rec_notes  standard triad
created_at/_by/_info, updated_at/_by/_info  standard audit block
```

Unique constraint: `(currency_code, denomination_code)`.

### The `is_in_circulation` judgment call

This is the single most consequential decision per denomination, and it recurred across **every**
currency researched so far (KWD/BHD 1-fils, AED/QAR smallest coins, SAR 1-halala, USD penny):

> An officially-minted, still-legal-tender denomination that sources describe as "rarely used,"
> "not given as change," or "impractical" is `is_in_circulation = FALSE`, `is_legal_tender = TRUE`,
> `default_give_as_change = FALSE`, `default_accept_cash = TRUE`. It is countable if a cashier finds
> one in a drawer, but never suggested or given as change, and — critically — it is **excluded** from
> the CASH_TENDER divisibility check below, which is exactly why CASH_TENDER can legitimately differ
> from a currency's raw `minor_unit`.

A denomination that was **formally withdrawn/de-monetized** (not just impractical) is
`is_legal_tender = FALSE` too.

### Worked template

```sql
INSERT INTO public.sys_currency_denominations_cd
  (currency_code, denomination_code, denomination_minor, denom_kind, name, name2,
   is_legal_tender, is_in_circulation, default_accept_cash, default_give_as_change,
   display_order, metadata)
VALUES
  ('XXX', 'XXX-N-<minor>', <minor>, 'NOTE', '<n> <Unit>', '<الاسم>', TRUE, TRUE, TRUE, FALSE, 1,
   '{"seed_source":"WEB_RESEARCH_<YYYY-MM-DD>","review_status":"verified","sources":["<url>"]}'::JSONB),
  -- ... largest to smallest, largest 1-2 notes usually default_give_as_change = FALSE
  ('XXX', 'XXX-C-1', 1, 'COIN', '1 <subunit>', '<الاسم>', TRUE, FALSE, TRUE, FALSE, 99,
   '{"seed_source":"WEB_RESEARCH_<YYYY-MM-DD>","review_status":"verified","note":"<why excluded from circulation>"}'::JSONB)
ON CONFLICT (currency_code, denomination_code) DO NOTHING;
```

### Mandatory seed-time validation

Always include this block (or extend the existing one in `0522` if that migration is still the
attachment point) whenever you seed denominations — it is what catches a wrong `CASH_TENDER` value or
a wrong `is_in_circulation` flag before the migration is ever applied:

```sql
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
```

---

## 5. Worked examples from the originating session (2026-09-25)

Full detail and exact citations: `supabase/migrations/0521_hq_currency_rounding_rules_cf.sql` and
`0522_hq_currency_denominations.sql`. Summary of the judgment calls made, useful as calibration:

| Currency | CASH_TENDER | Evidence strength | Why |
|---|---|---|---|
| OMR | 5 baisa | Verified | Central Bank of Oman circulation facts; 5/10/25/50 baisa in daily use |
| KWD | 5 fils | Verified | 1 fils not minted since 1988, not used daily |
| BHD | 5 fils | Verified | 1 fils withdrawn 1965-66, no longer circulates |
| AED | 25 fils | **Verified, strong** | An actual Abu Dhabi DED circular permits rounding to nearest 25 fils — sharpened the naive guess ("1 or 5") upward |
| QAR | 25 dirham | Verified | 25/50 dirham "frequently used," 1/5/10 "rarely used," retail commonly rounds to 25/50 |
| SAR | 5 halala | Verified, `confidence: medium` | Mixed evidence — one weak source claimed rounding to the nearest riyal, but 2016-series 1-50 halala coins remain in active production with no citable government circular like AED's. Seeded the conservative, coin-backed value, flagged for HQ review rather than taking the more aggressive unsourced claim |
| USD | 5 cents | **Verified, strong** | The US Mint struck its literal last penny 2025-11-12 (Treasury's own FAQ + Richmond Fed research) — real, current, citable, not a guess |

This table exists to calibrate *how much research is enough* — AED and USD both had an actual
regulatory/institutional source, not just a numismatic description, and that's what justified
`review_status: verified` without a confidence caveat. SAR did not, hence the explicit
`confidence: medium` flag even though it's still `verified` (real research was done, just weaker).

---

## 6. Migration file skeleton

```sql
-- =============================================================================
-- {NNNN}_currency_setup_{currency_code_lowercase}.sql
-- manage-currency-setup-hq skill — completes/creates XXX across sys_currency_cd,
-- sys_currency_rounding_rules_cf, sys_currency_denominations_cd.
--
-- Researched <date> via WebSearch against central-bank/government/numismatic
-- sources — see metadata.sources per row. review_status reflects exactly how
-- confident each value is; nothing here is presented as more certain than it is.
--
-- Reversal (forward-only): a future migration would DELETE the rows this one
-- inserts (by currency_code), or DROP the sys_currency_cd row if newly created
-- and nothing else references it yet.
-- =============================================================================

BEGIN;

-- 1. sys_currency_cd (skip if the currency already has a row)
-- 2. sys_currency_rounding_rules_cf — ACCOUNTING (always) + CASH_TENDER/CASH_CHANGE (if cash-supported)
-- 3. sys_currency_denominations_cd (if cash-supported)
-- 4. seed-time consistency DO block (if denominations were seeded)

COMMIT;
```

**Created as a `.sql` file only — never applied by this skill.** Stop and hand off for review, same as
every other migration-producing skill in this repo.
