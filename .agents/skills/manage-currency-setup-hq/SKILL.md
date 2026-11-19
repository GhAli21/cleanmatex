---
name: manage-currency-setup-hq
description: Create a new currency and/or complete all required seed data across every HQ sys_* currency table (sys_currency_cd, sys_currency_rounding_rules_cf, sys_currency_denominations_cd) via a new cleanmatex migration. Fills gaps from data the caller supplies, or by researching central-bank/government/numismatic sources when data is missing — never guesses and never silently ships a partial currency setup. Use when adding a new currency, completing an existing currency's rounding rules or denominations, or when the user mentions currency setup, HQ currency data, cash-tender/cash-change rounding, currency denominations, or manage-currency-setup-hq.
user-invocable: true
version: 1.0.0
deprecated: false
effort: medium
references:
  - @.claude/skills/manage-currency-setup-hq/reference.md
  - CLAUDE.md
  - docs/dev/rules/integration-contracts.md
  - cleanmatexsaas/docs/features/Currency_Setup/HQ_CURRENCY_HANDOFF.md
agents:
---

# Manage Currency Setup (HQ)

Invoke as **`/manage-currency-setup-hq`**. Load this skill **before** writing any currency-related SQL — a currency is not "done" until all four tables below are populated, not just `sys_currency_cd`.

## Purpose

HQ owns currency data; `cleanmatex` authors every migration that writes it (per `integration-contracts.md` — the same split as `/create-feature-flag`). A currency is only genuinely usable once it has rows in **all** of:

1. `sys_currency_cd` — the currency master (definition, symbols, minor unit)
2. `sys_currency_rounding_rules_cf` — at minimum an `ACCOUNTING` rule; `CASH_TENDER`/`CASH_CHANGE` too when the currency is cash-supported
3. `sys_currency_denominations_cd` — its note/coin catalog, when cash-supported

Missing any of these is not "good enough for now" — the tenant app's rounding/counting resolvers correctly no-op on an absent row (never invent behavior), but that no-op is a real product gap (a 3-decimal-currency drawer that can never balance, a denomination-free count sheet). This skill's job is to leave zero silent gaps: every required row exists, with real data, not a placeholder.

## Operating Rules

- Do not use subagents unless explicitly requested.
- Do not scan the whole repo. Touch only `supabase/migrations/` (new file) and `prisma/schema.prisma` (only if a referenced column/table doesn't exist yet).
- Treat the **remote** Supabase DB as authoritative for what already exists (`supabase_remote_db` MCP, read-only) — check `sys_currency_cd`, `sys_currency_rounding_rules_cf`, `sys_currency_denominations_cd` for the target `currency_code` before writing anything. Never assume a table is empty for a currency.
- **NEVER apply the migration** (CRITICAL RULE #3) — create the `.sql` file, then STOP and ask the user to review and apply.
- **Never fabricate a fact and mark it verified.** `ACCOUNTING` rounding is mechanical (round to the currency's own `minor_unit`, `HALF_UP`) — always safe to seed without research. `CASH_TENDER`/`CASH_CHANGE` increments and denomination sets are **not** — research them (WebSearch: central bank, government economic-development circulars, then cross-check numismatic/reference sources) whenever the caller hasn't supplied real data. Tag every seeded row's `metadata.review_status`:
  - `verified` — real citation(s) in `metadata.sources`, from this research
  - `derived` — mechanically computed from `minor_unit`, no independent research needed (this is what `ACCOUNTING` always is)
  - `unverified` — best available guess, no citable source found; still seed it (never leave a currency's cash rounding silently absent) but flag it clearly in the response and in `rec_notes`/`notes` for owner review
- `is_in_circulation` on a denomination means **daily practical use**, not bare legal-tender status. A coin still officially minted but "rarely used"/"not given as change" (found repeatedly in this domain — see `reference.md`'s worked examples) is `is_in_circulation = FALSE`, `is_legal_tender = TRUE`, `default_give_as_change = FALSE` — countable if found in a drawer, never suggested as change.
- `CASH_CHANGE` is **asymmetric** from `CASH_TENDER` — normally `CEILING` (the business absorbs the un-tenderable fraction in the customer's favor), while `CASH_TENDER` is normally `HALF_UP`.
- Every `is_in_circulation = TRUE` denomination's `denomination_minor` must be an exact multiple of that currency's `CASH_TENDER` `rounding_increment_minor` — verify this before writing (or rely on the seed-time `DO $$ ... RAISE EXCEPTION` block, which must always be included and must always run against `is_in_circulation = TRUE` rows only).
- Every row needs bilingual `name`/`name2`, and `description`/`description2` wherever that column exists.
- Use the repo-standard `rec_status`/`rec_order`/`rec_notes` triad — never a one-off column name (a prior pass on this exact domain shipped a table with a bare `notes` column and had to rename it back to `rec_notes` in a follow-up; don't repeat that).
- Seed idempotently — `ON CONFLICT ... DO UPDATE` (for a single unique row, e.g. `sys_currency_cd`) or `ON CONFLICT (...) WHERE ... DO NOTHING` (for the effective-dated `sys_currency_rounding_rules_cf`, matching its partial unique index) — never a bare `INSERT` that fails on rerun.
- If `sys_currency_rounding_rules_cf`/`sys_currency_denominations_cd`/`sys_rounding_context_cd`/`sys_rounding_mode_cd` don't exist yet on the target environment, this skill's migration is **not** the place to (re)create them — point to the migrations that created them (originally `0520`-`0522`) as a prerequisite instead of duplicating `CREATE TABLE` DDL.
- `TEXT` not `VARCHAR`; minor-unit columns `INTEGER` not `BIGINT`/`DECIMAL` (repo D13 rule — integer counts of minor units never drift); object names ≤ 30 chars; `DROP ... RESTRICT` only, never `CASCADE`.

## Canonical tables

| Table | Role | Created by | Per-currency? |
|---|---|---|---|
| `sys_currency_cd` | Currency master — 71 columns (symbols, minor unit, cash support) | `0264`/`0265`/`0266` | Yes |
| `sys_rounding_context_cd` | Rounding-context catalog (`ACCOUNTING`, `CASH_TENDER`, `CASH_CHANGE`, ...) | `0520` | No — prerequisite lookup, don't reseed |
| `sys_rounding_mode_cd` | Rounding-mode catalog (`HALF_UP`, `CEILING`, ...) | `0520` | No — prerequisite lookup, don't reseed |
| `sys_currency_rounding_rules_cf` | One row per `(currency_code, rounding_context)` | `0521` | Yes |
| `sys_currency_denominations_cd` | One row per note/coin | `0522` | Yes |

Post-migration corrections belong in the HQ admin UI (`cleanmatexsaas` `/system-codes/currency-setup` and `/system-codes/currency-rounding`), not a new migration — that's the whole point of shipping complete data now. This skill is for the *initial* seed only.

## Workflow

```text
1. Identify the currency_code(s) in scope and whether this is a new currency or completing gaps in an existing one.
2. Read-only check the remote DB: does a sys_currency_cd row exist? Which rounding_contexts already
   have a sys_currency_rounding_rules_cf row? Are there any sys_currency_denominations_cd rows?
   Never assume — a currency can have a master row and zero rounding/denomination rows (the common gap).
3. For each missing piece, gather data:
   a. New sys_currency_cd row: ISO alpha/numeric code, name/name2, minor_unit, symbol, is_cash_supported.
   b. ACCOUNTING rounding rule: mechanical — increment_minor = 1, mode = HALF_UP. Always seed, no research.
   c. CASH_TENDER/CASH_CHANGE rules (only if is_cash_supported): WebSearch the smallest practically-
      tenderable coin and the customary change-rounding practice — see reference.md's research checklist.
   d. Denominations (only if is_cash_supported): WebSearch the current note/coin set, circulation
      status per denomination, legal-tender status, give-as-change defaults.
4. Draft every row with description/description2, rec_status/rec_order/rec_notes, and a metadata
   review_status + sources array reflecting exactly how each value was determined.
5. Detect the next free migration number in supabase/migrations/.
6. Write the migration — idempotent upserts only, FKs to the existing catalogs, the denomination/
   CASH_TENDER divisibility DO-block check included whenever denominations are seeded.
7. Update prisma/schema.prisma only if a needed column/table isn't modeled yet; npx prisma validate.
8. STOP — do not apply. Report per the Final Response Contract below.
```

Read [reference.md](reference.md) before drafting any row — it has the full column lists, the research-source checklist, worked examples (including the exact asymmetric-CASH_CHANGE and circulation-vs-legal-tender judgment calls made for the GCC six + USD), and the seed-time validation template.

## Final Response Contract

```text
- Summary (currency code(s), which of the 4 tables were touched, new vs completed)
- Files changed (migration path; prisma schema if touched)
- Data provenance (per new/changed row: verified + source, derived, or unverified — flagged for review)
- Validation (denomination/CASH_TENDER divisibility, manual SQL syntax review since the migration
  cannot be applied to test — no tsc/build applies to a pure-SQL change)
- Risks / follow-ups (owner must apply; any unverified rows needing central-bank confirmation)
```
