# Handoff — HQ Currency Setup ⇄ Tenant Cash Drawer Program

**For:** whoever is implementing **Currency Setup in `cleanmatexsaas` (HQ)**
**From:** the tenant-side POS Session & Cash Drawer hardening program (`cleanmatex`)
**Date:** 2026-09-23 · owner decisions recorded · DDL spec added
**Status:** decided — ready to implement

> **All SQL in this document is a specification, not a migration.** `cleanmatexsaas` never creates migrations. HQ decides the shape and values; the `.sql` file is authored in `cleanmatex` and applied by the owner. See §7.

---

## Why you are getting this

The tenant-side cash drawer program depends on currency data that **your feature owns**. This note draws the line so neither side duplicates the other, records the owner's decisions, and gives you a migration-ready spec.

Short version: **HQ owns currency definition. The tenant app owns currency usage. All migrations are written in `cleanmatex` regardless of which side owns the data.**

---

## 1. Ownership split

| Concern | Owner | Notes |
|---|---|---|
| `sys_currency_cd` and its lookup catalogs | **HQ** | Definition, values, admin UI |
| `sys_currency_rounding_rules_cd` — all rounding contexts | **HQ** | Expanded per §3 |
| `sys_currency_denominations_cd` — notes & coins | **HQ** | §4 |
| Decimal-place authority | **HQ** (`sys_currency_cd`) | §5 |
| FX / exchange rates | **HQ** | Out of scope for the drawer program — §8 |
| Per-tenant currency / denomination overrides | **Tenant app** | `org_*` with RLS, never `sys_*` |
| Cash counting, drawer sessions, variance, Z-reports | **Tenant app** | Do not model these in HQ |
| **Every migration / DDL** | **Tenant app (`cleanmatex`)** | §7 |

---

## 2. The most urgent gap: cash rounding has no values

Columns exist and are applied — `sys_currency_cd.cash_rounding_increment_minor` and `cash_rounding_mode` (migration `0264`, FK'd in `0266`). **But migration `0265` seeds them `NULL` for every GCC currency**, verified for OMR, KWD, BHD and AED.

### Why this is not cosmetic

`cash_rounding_increment_minor` is what separates **accounting precision** from **physically tenderable cash**.

OMR, KWD and BHD carry 3 decimals, but one-baisa and one-fils coins are not in practical circulation — the smallest tenderable unit is **5 minor units (0.005)**. With the value absent, the tenant app records a cash payment of `2.003 OMR`, an amount that **cannot physically exist in a drawer**. Every such order leaves a permanent sub-unit residue and the cashier's count can never match expected cash.

That is a structural reason a 3-decimal-currency drawer cannot balance, and it is fixed entirely on your side by supplying values.

**Per §3 (owner decision) those values now land in `sys_currency_rounding_rules_cd`, and the two `sys_currency_cd.cash_rounding_*` columns are retired.**

---

## 3. DECIDED — `sys_currency_rounding_rules_cd` becomes the rounding authority

**Owner decision.** Accounting rounding **stays** in `sys_currency_rounding_rules_cd`. The table is expanded to carry *all* rounding contexts — cash tender, change, tax and so on — and is seeded for **all 181 currencies** already in `sys_currency_cd`.

### 3.1 Current state

```sql
-- migration 0290 (B17), as it stands today
CREATE TABLE sys_currency_rounding_rules_cd (
  currency_code   TEXT        PRIMARY KEY,
  rounding_method TEXT        NOT NULL DEFAULT 'HALF_UP'
                                CHECK (rounding_method IN ('HALF_UP','HALF_DOWN','FLOOR','CEIL')),
  rounding_unit   DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Three problems: one row per currency (no context dimension), a `DECIMAL` increment rather than minor units, and no audit block.

### 3.2 Target shape — full spec

```sql
-- ── Step 1: rounding-type catalog (new) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sys_rounding_type_cd (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status    SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT
);

INSERT INTO public.sys_rounding_type_cd (code, name, name2, description, display_order) VALUES
  ('ACCOUNTING',     'Accounting',      'محاسبي',            'Default monetary rounding for line and invoice totals.', 1),
  ('CASH_TENDER',    'Cash Tender',     'الدفع النقدي',      'Physical cash taken from the customer.',                 2),
  ('CASH_CHANGE',    'Cash Change',     'الباقي النقدي',     'Change handed back to the customer.',                    3),
  ('TAX',            'Tax',             'ضريبة',             'VAT / tax computation rounding.',                        4),
  ('DISCOUNT',       'Discount',        'خصم',               'Discount and promotion computation.',                    5),
  ('FX_CONVERSION',  'FX Conversion',   'تحويل العملة',      'Currency conversion rounding.',                          6),
  ('UNIT_PRICE',     'Unit Price',      'سعر الوحدة',        'Derived unit prices.',                                   7),
  ('REFUND',         'Refund',          'استرداد',           'Refund amount rounding.',                                8),
  ('LOYALTY_REDEEM', 'Loyalty Redeem',  'استبدال الولاء',    'Points to money conversion.',                            9),
  ('PAYOUT',         'Payout',          'صرف',               'Supplier and commission payouts.',                      10)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- ── Step 2: unify the rounding-mode catalog ──────────────────────────────────
-- sys_currency_cash_rounding_mode_cd is 34 chars (over the 30 limit) and is no
-- longer cash-specific. Rename, then extend to the union of both vocabularies.
ALTER TABLE public.sys_currency_cash_rounding_mode_cd
  RENAME TO sys_rounding_mode_cd;

INSERT INTO public.sys_rounding_mode_cd (code, name, name2, description, description2, display_order) VALUES
  ('HALF_DOWN', 'Half Down', 'تقريب النصف للأسفل', 'Round half values downward.', 'تقريب القيم النصفية للأسفل.', 5)
ON CONFLICT (code) DO NOTHING;
-- Existing codes: HALF_UP, HALF_EVEN, UP, DOWN. Map legacy CEIL→UP, FLOOR→DOWN.

-- ── Step 3: expand the rules table ───────────────────────────────────────────
ALTER TABLE public.sys_currency_rounding_rules_cd
  ADD COLUMN IF NOT EXISTS id                       UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rounding_type            TEXT,
  ADD COLUMN IF NOT EXISTS rounding_increment_minor BIGINT,
  ADD COLUMN IF NOT EXISTS rounding_mode            TEXT,
  ADD COLUMN IF NOT EXISTS name                     TEXT,
  ADD COLUMN IF NOT EXISTS name2                    TEXT,
  ADD COLUMN IF NOT EXISTS description              TEXT,
  ADD COLUMN IF NOT EXISTS description2             TEXT,
  ADD COLUMN IF NOT EXISTS is_mandatory             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS effective_from           DATE,
  ADD COLUMN IF NOT EXISTS effective_to             DATE,
  ADD COLUMN IF NOT EXISTS display_order            INTEGER,
  ADD COLUMN IF NOT EXISTS metadata                 JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS rec_order                INTEGER,
  ADD COLUMN IF NOT EXISTS rec_notes                TEXT,
  ADD COLUMN IF NOT EXISTS created_by               TEXT,
  ADD COLUMN IF NOT EXISTS created_info             TEXT,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by               TEXT,
  ADD COLUMN IF NOT EXISTS updated_info             TEXT;
```

**Column reference:**

| Column | Type | Purpose |
|---|---|---|
| `id` | `UUID` | new PK — `currency_code` can no longer be unique |
| `currency_code` | `TEXT` | FK → `sys_currency_cd(code)` |
| `rounding_type` | `TEXT` | FK → `sys_rounding_type_cd(code)` |
| `rounding_increment_minor` | `BIGINT` | **minor units** — `5` = 0.005 at 3dp |
| `rounding_mode` | `TEXT` | FK → `sys_rounding_mode_cd(code)` |
| `name` / `name2` / `description` / `description2` | `TEXT` | bilingual, for the HQ admin UI |
| `is_mandatory` | `BOOLEAN` | regulator-imposed vs advisory |
| `effective_from` / `effective_to` | `DATE` | rule versioning — see note below |
| `display_order`, `notes`, `metadata` | | `metadata` carries `seed_source` / `review_status`, mirroring `0265` |
| audit block, `is_active`, `rec_status`, `rec_order`, `rec_notes` | | repo standard |

**Keep increments in minor units (`BIGINT`).** It is the one representation that cannot drift, and it matches what `0264` already established.

**`effective_from` / `effective_to` matter more than they look.** Cash rounding changes by regulation (Canada's penny, New Zealand's 5c). A Z-report reprinted for an old business date must resolve the rule that was in force *then*, not today's.

### 3.3 Constraints and indexes

```sql
ALTER TABLE public.sys_currency_rounding_rules_cd
  ADD CONSTRAINT fk_scrr_currency  FOREIGN KEY (currency_code)  REFERENCES public.sys_currency_cd(code),
  ADD CONSTRAINT fk_scrr_type      FOREIGN KEY (rounding_type)  REFERENCES public.sys_rounding_type_cd(code),
  ADD CONSTRAINT fk_scrr_mode      FOREIGN KEY (rounding_mode)  REFERENCES public.sys_rounding_mode_cd(code),
  ADD CONSTRAINT chk_scrr_incr     CHECK (rounding_increment_minor > 0),
  ADD CONSTRAINT chk_scrr_period   CHECK (effective_to IS NULL OR effective_from IS NULL
                                          OR effective_to >= effective_from);

CREATE UNIQUE INDEX uq_scrr_cur_type_from
  ON public.sys_currency_rounding_rules_cd
     (currency_code, rounding_type, COALESCE(effective_from, DATE '0001-01-01'));

CREATE INDEX idx_scrr_lookup
  ON public.sys_currency_rounding_rules_cd (currency_code, rounding_type, is_active);
```

All object names are within the 30-character limit using the `scrr` abbreviation.

### 3.4 Resolution contract — for every consumer

> Look up `(currency, specific_type)`. If absent, fall back to `(currency, 'ACCOUNTING')`. If still absent, **no-op**.

Never invent a rounding behaviour. This preserves the existing B15/B17 "resolve or zero, never assume" policy the tenant app already follows. Date-filter on `effective_from` / `effective_to` against the **business date**, not `now()`.

### 3.5 Two blockers to fix in the same migration

**(a) Two incompatible rounding-mode vocabularies exist today.**

| Source | Codes |
|---|---|
| `sys_currency_rounding_rules_cd.rounding_method` CHECK (`0290`) | `HALF_UP`, `HALF_DOWN`, `FLOOR`, `CEIL` |
| `sys_currency_cash_rounding_mode_cd` (`0266`) | `HALF_UP`, `HALF_EVEN`, `UP`, `DOWN` |

They overlap on `HALF_UP` only. `FLOOR`≈`DOWN` and `CEIL`≈`UP` are the same intent renamed, but `HALF_DOWN` and `HALF_EVEN` are genuinely different behaviours. The tenant app's TS constants mirror the **first** vocabulary, so the tenant side owns a constant migration (`FLOOR`/`CEIL` → `DOWN`/`UP`).

**(b) `sys_currency_cash_rounding_mode_cd` is 34 characters — already over the repo's 30-char limit.**

The rename in §3.2 Step 2 solves both at once.

### 3.6 Seeding 181 currencies — be honest about what is real data

`sys_currency_cd` holds **181 currencies**. A precise, market-accurate cash-rounding increment for all of them is not something to fabricate.

**Recommended approach, mirroring what `0265` already does with `review_status` metadata:**

```sql
-- 1. Derive an ACCOUNTING row for all 181 from the currency master. Mechanical.
INSERT INTO public.sys_currency_rounding_rules_cd
  (id, currency_code, rounding_type, rounding_increment_minor, rounding_mode,
   name, name2, is_active, rec_status, metadata)
SELECT gen_random_uuid(), c.code, 'ACCOUNTING', 1, 'HALF_UP',
       'Accounting rounding', 'التقريب المحاسبي', TRUE, 1,
       '{"seed_source":"DERIVED_FROM_MINOR_UNIT","review_status":"derived"}'::JSONB
FROM public.sys_currency_cd c
WHERE c.is_active = TRUE
ON CONFLICT DO NOTHING;

-- 2. CASH_TENDER defaults to the accounting increment for everything…
-- 3. …then the curated exception list below overrides the currencies that differ,
--    with metadata review_status = 'curated'.
```

This keeps unreviewed rows visibly distinguishable from verified ones.

**Exception list worth curating first — verify each against the central bank before shipping. Treat this as a starting list, not authority:**

| Currency | Minor unit | Suggested `CASH_TENDER` | Reason |
|---|---|---|---|
| OMR | 3 | `5` (0.005) | 1-baisa coins not in practical circulation |
| KWD | 3 | `5` (0.005) | 1-fils coins not in practical circulation |
| BHD | 3 | `5` (0.005) | 1-fils coins not in practical circulation |
| AED / SAR / QAR | 2 | `1` or `5` — **confirm** | many retailers round cash to 0.05 |
| CHF | 2 | `5` (0.05) | smallest coin 5 rappen |
| CAD | 2 | `5` (0.05) | penny withdrawn 2013 |
| AUD | 2 | `5` (0.05) | 1c and 2c withdrawn |
| NZD | 2 | `10` (0.10) | 5c also withdrawn 2006 |
| SEK / NOK / DKK | 2 | `100` (1.00) | cash rounds to the whole unit |
| HUF | 0 | `5` | smallest coin 5 forint |
| JPY / KRW / ISK | 0 | `1` | no subunit in circulation |
| INR | 2 | **confirm** | sub-rupee coins largely withdrawn |

**The GCC six are what this product ships on — verify those first.** The rest can ship as `derived` without blocking anything.

### 3.7 Migration sequencing

The table has live consumers, so order matters. **Four separate migrations with an app change between #3 and #4:**

| # | Contents |
|---|---|
| 1 | `sys_rounding_type_cd` + seed; rename and extend the mode catalog |
| 2 | Add all new columns to the rules table (nullable); backfill existing rows as `rounding_type = 'ACCOUNTING'`, converting `rounding_unit` → `rounding_increment_minor` via `sys_currency_cd.minor_unit`; map `CEIL`→`UP`, `FLOOR`→`DOWN` |
| 3 | Drop the old PK, add the new one, add FKs/CHECKs/indexes, set `NOT NULL`; run the §3.6 seed |
| 4 | **After** the tenant app migrates `currency-rounding.ts`: drop legacy `rounding_unit` / `rounding_method`, and `sys_currency_cd.cash_rounding_increment_minor` / `cash_rounding_mode` — `DROP … RESTRICT`, never `CASCADE` |

Backfill formula for step 2 — `rounding_unit` is a major-unit decimal, the new column is minor units:

```sql
UPDATE public.sys_currency_rounding_rules_cd r
   SET rounding_type = 'ACCOUNTING',
       rounding_increment_minor =
         GREATEST(1, ROUND(r.rounding_unit * POWER(10, c.minor_unit))::BIGINT),
       rounding_mode = CASE r.rounding_method
                         WHEN 'CEIL'  THEN 'UP'
                         WHEN 'FLOOR' THEN 'DOWN'
                         ELSE r.rounding_method
                       END
  FROM public.sys_currency_cd c
 WHERE c.code = r.currency_code
   AND r.rounding_type IS NULL;
```

Pre-launch, no compatibility shim is needed beyond that ordering.

---

## 4. DECIDED — HQ owns the denomination catalog

**Owner decision.** `sys_currency_denominations_cd` is **HQ-owned**: HQ defines, seeds and provides the admin UI. The tenant app consumes it read-only for cash-counting sheets.

```sql
CREATE TABLE IF NOT EXISTS public.sys_currency_denominations_cd (
  currency_code      TEXT    NOT NULL REFERENCES public.sys_currency_cd(code),
  denomination_minor BIGINT  NOT NULL,          -- minor units, consistent with §3
  denom_kind         TEXT    NOT NULL,          -- NOTE | COIN
  name               TEXT    NOT NULL,          -- "50 Baisa"
  name2              TEXT,                      -- "٥٠ بيسة"
  display_order      INTEGER,                   -- counting-sheet order, largest first
  is_circulating     BOOLEAN NOT NULL DEFAULT TRUE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  metadata           JSONB   NOT NULL DEFAULT '{}'::JSONB,
  rec_status         SMALLINT NOT NULL DEFAULT 1,
  rec_order          INTEGER,
  rec_notes          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by         TEXT,
  created_info       TEXT,
  updated_at         TIMESTAMPTZ,
  updated_by         TEXT,
  updated_info       TEXT,

  CONSTRAINT pk_scdn              PRIMARY KEY (currency_code, denomination_minor),
  CONSTRAINT chk_scdn_kind        CHECK (denom_kind IN ('NOTE','COIN')),
  CONSTRAINT chk_scdn_value       CHECK (denomination_minor > 0)
);

CREATE INDEX idx_scdn_lookup
  ON public.sys_currency_denominations_cd (currency_code, is_active, display_order);
```

**`is_circulating` vs `is_active`:** a withdrawn note stays `is_active = TRUE, is_circulating = FALSE` so historical counts still resolve it, but it is not offered in a new counting sheet.

**Seed-time validation worth enforcing:** every `denomination_minor` must be a whole multiple of that currency's `CASH_TENDER` increment from §3. A denomination the rounding rule cannot produce is a seeding bug — catching it in the migration is free:

```sql
-- fails the migration if any seeded denomination is unreachable by the rounding rule
DO $$
DECLARE bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM public.sys_currency_denominations_cd d
  JOIN public.sys_currency_rounding_rules_cd r
    ON r.currency_code = d.currency_code AND r.rounding_type = 'CASH_TENDER'
  WHERE d.denomination_minor % r.rounding_increment_minor <> 0;
  IF bad > 0 THEN
    RAISE EXCEPTION 'Denomination/rounding mismatch on % row(s)', bad;
  END IF;
END $$;
```

### 4.1 Worked example — OMR (verify before shipping)

Omani Rial, `minor_unit = 3`, subunit baisa, 1 rial = 1000 baisa.

| `denomination_minor` | Kind | `name` | `name2` |
|---|---|---|---|
| 50000 | NOTE | 50 Rials | ٥٠ ريال |
| 20000 | NOTE | 20 Rials | ٢٠ ريال |
| 10000 | NOTE | 10 Rials | ١٠ ريال |
| 5000 | NOTE | 5 Rials | ٥ ريال |
| 1000 | NOTE | 1 Rial | ١ ريال |
| 500 | NOTE | 500 Baisa | ٥٠٠ بيسة |
| 100 | NOTE | 100 Baisa | ١٠٠ بيسة |
| 50 | COIN | 50 Baisa | ٥٠ بيسة |
| 25 | COIN | 25 Baisa | ٢٥ بيسة |
| 10 | COIN | 10 Baisa | ١٠ بيسة |
| 5 | COIN | 5 Baisa | ٥ بيسة |

Every value is a multiple of the suggested `CASH_TENDER` increment of `5`, so the check above passes. **Confirm the note/coin set against the Central Bank of Oman before seeding** — I am giving you the shape, not an authority.

AED, SAR, QAR, KWD and BHD follow the same pattern. Curate those six properly; derive or leave inactive elsewhere, marked `review_status` per §3.6.

**The tenant app separately owns `org_currency_denom_cf`** — per-tenant / per-branch enable-disable, for a branch that refuses large notes. That one is not yours.

---

## 5. DECIDED — `sys_currency_cd` is the decimal-place authority

**Owner decision.** Decimal places are a property of the **currency**, not the tenant.

- **Authoritative:** `sys_currency_cd.decimal_places` / `minor_unit`.
- **Not authoritative:** the `TENANT_DECIMAL_PLACES` tenant setting. The tenant app deprecates it to display-only and resolves everything financial from the currency master.
- B17's `rounding_unit` stops implying precision once §3 converts it to an explicit minor-unit increment.

Please state this explicitly in the Currency Setup spec so it does not drift back.

---

## 6. DECIDED — `VARCHAR` → `TEXT`, folded into the next currency migration

`sys_currency_cd` uses `VARCHAR(3)` / `VARCHAR(250)`, and `cash_rounding_mode` is `VARCHAR(20)`. The repo rule is `TEXT` everywhere. Fold the conversion into whichever currency migration comes next rather than raising a separate one.

Also already present and worth keeping accurate: **`is_cash_supported`**. The tenant app will honour it by refusing to open a cash drawer in a currency where it is false.

---

## 7. Process reminder: HQ writes no migrations

The HQ Currency Setup blueprint contains `create table` / `alter table` DDL, and so does this document. Per `docs/dev/rules/integration-contracts.md`, **`cleanmatex` owns all migrations and `cleanmatexsaas` never creates them.**

1. HQ decides the shape and the values.
2. HQ requests the migration from `cleanmatex`, with exact DDL and seed data.
3. `cleanmatex` writes the `.sql` file and **stops** — the owner applies it.
4. Both sides regenerate types.

Please don't apply DDL directly from HQ, even for a seed-only change.

---

## 8. FX / multi-currency — out of scope for the drawer program

`HQ_EXCHANGE_RATES_FX_MULTI_CURRENCY_IMPLEMENTATION_PLAN.md` exists on your side. The tenant cash drawer program deliberately assumes **one drawer = one currency**, and is adding a DB constraint that a cash payment's currency must match its drawer session's currency.

FX for **pricing and reporting** is fine and needs nothing from the drawer side.

If FX leads to tenants **accepting foreign cash at the counter**, tell the drawer program — that changes the custody model substantially (per-currency drawer compartments, rate-at-tender snapshots, separate variance per currency). It is not a small adaptation. The `FX_CONVERSION` rounding type in §3.2 is reserved for you.

---

## 9. What the tenant side commits to

- Never writes to `sys_currency_*` — read-only consumption.
- Resolves rounding through the §3.4 contract, no-opping safely when values are absent, so nothing breaks before you populate.
- Migrates its `CURRENCY_ROUNDING_MODES` constant off `FLOOR`/`CEIL` onto the unified catalog.
- Owns all tenant-scoped overrides in `org_*` tables with RLS.
- Writes and sequences every migration, including the ones your feature needs.

---

## 10. HQ implementation checklist

- [ ] Confirm the `sys_rounding_type_cd` code list (§3.2) covers every rounding context the platform has.
- [ ] Confirm the mode-catalog rename to `sys_rounding_mode_cd` and the `CEIL`→`UP` / `FLOOR`→`DOWN` mapping.
- [ ] **Verify the GCC six** cash increments against each central bank (§3.6). This is the one item that cannot be derived.
- [ ] Decide AED / SAR / QAR: `1` (0.01) or `5` (0.05).
- [ ] Curate GCC denomination sets (§4.1); derive or deactivate the rest.
- [ ] Request migrations 1–3 from `cleanmatex` (§3.7); hold migration 4 until the tenant app has migrated.
- [ ] Build the HQ admin UI for rounding rules and denominations (bilingual, RTL).
- [ ] State decimal-place authority in the Currency Setup spec (§5).
- [ ] Fold `VARCHAR`→`TEXT` into the request (§6).

---

## 11. The ask, in priority order

1. **Expand `sys_currency_rounding_rules_cd`** per §3 — new shape, type catalog, unified mode catalog, PK change.
2. **Seed it** — derived `ACCOUNTING` for all 181, curated `CASH_TENDER` for the GCC six first.
3. **Define and seed `sys_currency_denominations_cd`** (§4).
4. **State decimal-place authority** (§5).
5. **`VARCHAR` → `TEXT`**, folded into the above (§6).

Items 1–3 are what the tenant drawer program is waiting on. Until §3 lands, cash rounding safely no-ops and drawers in 3-decimal currencies keep accumulating sub-unit residue.
