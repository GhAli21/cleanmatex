# Proposal: Human-Friendly Codes (rule + config table)

> **Implementation plan:** see [`IMPLEMENTATION_PLAN_Human_Friendly_Codes.md`](./IMPLEMENTATION_PLAN_Human_Friendly_Codes.md) (PLAN v1, 2026-10-30, waiting for approval).

Status: DRAFT v6, agreed (plan approvals recorded 2026-10-30, see §12). Delivery: P0–P4 DONE (P3 and P4 applied 2026-10-31; P4 label config reworked the same day, A-46..A-49, migration 0685 applied by the user 2026-10-31), P3b code done; live status in the plan §1. P5 (store credit notes `SCN`, migration `0687`) applied by you 2026-11-01, waiting for your deploy. P6 (HQ permissions `0688`, deprecated image-column comments `0689`) applied by you 2026-11-01. P7–P9 done (no migration); plan CLOSED, waiting for your deploy and QA.
Author: Coding_Bot_JhA, 2026-10-30
Repos affected (after approval): `cleanmatex` (owns migrations, web-admin) and `cleanmatexsaas` (platform-api, platform-web)

> Edit anything below. All design decisions are agreed; seed lists wait for the inventory.

---

## 1. Goal

Never expose UUIDs as business identifiers. Every record a person talks about, prints, or searches for gets a human-friendly code that is unique within its tenant, e.g. `CUS-000001`, `ORD-2026-000123`.

Everything that can live in data goes into one config table. Only what data cannot enforce goes into the repo rules.

---

## 2. Rule text (to add to both repos' rules + DB skill)

**Rule: Human-Friendly Codes**

1. **UUID stays the key.** `id` (UUID) remains the primary key and the target of every foreign key. The human code is for display, search, printing and external reference only. Never join on it.
2. **DB generates codes.** Codes are generated only in the database by the shared function + trigger, never in the UI or API. An explicitly supplied code (e.g. from an import) is accepted only if it is unique.
3. **Unique per tenant.** Every coded table has `UNIQUE (tenant_org_id, <x>_code)`. HQ-level (non-tenant) tables use `UNIQUE (<x>_code)`.
4. **Immutable, never reused.** Once assigned a code never changes and is never reused, even after soft or hard delete. Gaps are allowed unless the type is configured `strict_no_gaps`.
5. **Tenant-local year.** "Year" means the calendar year in the tenant's time zone, fixed at creation time.
6. **UI shows codes.** Wherever a person sees a record (lists, details, pick lists, prints, messages), show its code. Never show a raw UUID. Pick lists show name + code. Labels follow "Label - [db_column]".
7. **New table checklist.** Any new table that needs a human code must, **in the same migration**:
   - add its row to `sys_doc_seq_type_cd` (with the correct `manage_by_level`),
   - add the `<x>_code` column (`NOT NULL`) and its unique index,
   - if `GENERAL`: attach the shared trigger `trg_<table>_assign_code` with its `doc_type_code`; if `DOMAIN`: set `managed_by_object` to the domain generator.
   A migration that adds such a table without these is incomplete.
8. **Safety net.** The consistency check (section 6) must pass before merge.

**Applies to:** tables people refer to: customers, orders, invoices, receipts, payments, refunds, credit notes, suppliers, employees, delivery/pickup tickets, support cases, and similar.
**Does not apply to:** `sys_*_cd` lookup tables (natural code is already the key), child line tables (use parent code + line number), join, audit, log and config tables.

---

> **Where this rule is written:** both repos' rules files and DB skills (tenant `databaseconventions.mdc`, `.claude/skills/database/SKILL.md` + `conventions.md`; HQ `rulesfromclaudejh.mdc`, `.claude/skills/database/SKILL.md`; the matching `.codex` docs and skills in both repos; pointers in both root `CLAUDE.md` and `AGENTS.md`). See the implementation plan §16.1, tasks T1.R and T8.4.

## 3. Format (v2: driven by `parts_format`)

Code = `prefix` + `separator` + parts from `parts_format`, joined by `separator`.

Allowed tokens in `parts_format` (separated by `-`):

| Token | Meaning | Example |
|---|---|---|
| `YYYY` | 4-digit year (tenant local time) | 2026 |
| `YY` | 2-digit year | 26 |
| `YYYYMM` | year + month | 202610 |
| `YYMM` | short year + month | 2610 |
| `YYYYMMDD` | full date | 20261030 |
| `BR` | branch code (reserved for later) | B01 |
| `SEQ` | padded running number; **required, always the last part** | 000123 |

Examples:

| doc type | prefix | parts_format | reset_policy | Result |
|---|---|---|---|---|
| CUSTOMER | CUS | `SEQ` | NEVER | `CUS-000001` |
| ORDER | ORD | `YYYY-SEQ` | YEARLY | `ORD-2026-000123` |
| RECEIPT | RCP | `YYYYMM-SEQ` | MONTHLY | `RCP-202610-000045` |
| DELIVERY | DLV | `YYYYMMDD-SEQ` | DAILY | `DLV-20261030-0012` |

- `SEQ` grows past its padding (no wrap).
- Master data uses `SEQ` only (no date). Transaction documents include a date part.

---

## 4. Config table: `sys_doc_seq_type_cd` (v3)

One row per code type. HQ-owned, global (not per tenant). It records **every** human-code type, including ones already implemented elsewhere (e.g. finance), via `manage_by_level`.

| Column | Type | Notes |
|---|---|---|
| `doc_type_code` | text PK | e.g. `CUSTOMER`, `ORDER`, `INVOICE` |
| `name` / `name2` | text | display names (EN / AR) |
| `description` / `description2` | text | full descriptions (EN / AR) |
| `scope_code` | text FK → `sys_saas_scope_cd` | `HQ`, `SYS`, `TENANT_ORG`; decides which generator is used (see manage_by_level) |
| `category_code` | text FK → `sys_doc_seq_category_cd` | `CATALOG`, `MASTER_DATA`, `TRANSACTION` |
| `module_code` | text FK → `sys_modules_cd` | `AUTH`, `HQ_FIN`, `ORG_DATA`, `ORG_FIN`, `NTF`, `STNG`, … |
| `sub_system_code` | text, composite FK `(module_code, sub_system_code)` → `sys_module_sub_systems_cd` | `CUSTOMER`, `SUPPLIER`, `ORDER`, … (list proposed by the inventory); the sub-system must belong to the row's module |
| `target_table` | text | e.g. `org_customers_mst` |
| `target_column` | text | e.g. `customer_code` |
| `is_unique` | boolean | default true |
| `unique_with` | text[] | e.g. `{tenant_org_id}` or `{tenant_org_id,branch_id}`; NULL + `is_unique` = unique across the whole table (sys/HQ) |
| `prefix` | text | 2–5 uppercase letters, CHECK `^[A-Z]{2,5}$` |
| `separator` | text | default `-` |
| `parts_format` | text not null | **single source of truth**, e.g. `SEQ`, `YYYY-SEQ`, `YYYYMM-SEQ`; CHECK: only allowed tokens, `SEQ` exactly once and last |
| `how_many_parts` | smallint | **generated** from `parts_format` (1–5); kept for display/filtering, never typed |
| `seq_pad_length` | smallint | default 6, CHECK 1–12 (was `last_pad_length`) |
| `full_size` | smallint | **generated max length** = prefix + separators + date parts + pad; used to size the target column. Codes may grow beyond it only when `SEQ` overflows its padding |
| `reset_policy` | text | `NEVER`, `YEARLY`, `MONTHLY`, `DAILY`, `FISCAL_YEAR`; CHECK (see consistency rules below) |
| `manage_by_level` | text FK → `sys_doc_seq_manage_level_cd` | `GENERAL`, `DOMAIN`, `MANUAL`, `NONE` |
| `managed_by_object` | text null | required when not `GENERAL`, e.g. `org_fin_doc_seq_mst` |
| `allow_tenant_override` | boolean | default false (reserved) |
| `strict_no_gaps` | boolean | default false (reserved for invoice rules and other features if needed; not enforced by the general generators, the owning domain implements it) |
| `implement_description` | text | how this code is generated, in detail and step by step (the tables, functions, triggers and SQL involved), so any HQ support user can trace it. Filled by the seed for every row; shown in the HQ Code Types screen |
| `display_order` | int | |
| `is_active` | boolean | |
| audit columns | | `created_at/by`, `updated_at/by`, `rec_status` as per project standard |

Removed vs your draft: `include_year`, `include_second_part` (replaced by `parts_format`).

**`manage_by_level` values**

| Code | Meaning |
|---|---|
| `GENERAL` | Generated by the shared generator for the row's scope (see below) |
| `DOMAIN` | Generated by a module's own existing generator (e.g. finance `org_fin_doc_seq_mst`); **kept as is**, only registered here |
| `MANUAL` | Typed by a person, unique-checked |
| `NONE` | Registered for reference only |

**`GENERAL` generator by scope**

| scope_code | Counter table | Next-value function | Counter key |
|---|---|---|---|
| `TENANT_ORG` | `org_doc_seq_mst` | `fn_doc_seq_next` | `(tenant_org_id, doc_type_code, period_key)` |
| `SYS` | `sys_doc_seq_mst` | `fn_sys_doc_seq_next` | `(doc_type_code, period_key)` |
| `HQ` | `hq_doc_seq_mst` | `fn_hq_doc_seq_next` | `(doc_type_code, period_key)` |

**Lookup tables**

Shared, platform-wide (useful beyond codes), created with **full seed**:
- `sys_saas_scope_cd`: HQ, SYS, TENANT_ORG
- `sys_modules_cd`: every module in both repos (AUTH, HQ_FIN, ORG_DATA, ORG_FIN, NTF, STNG, …), full list from the inventory
- `sys_module_sub_systems_cd`: PK `(module_code, sub_system_code)`, FK module_code → `sys_modules_cd`, full list from the inventory

Code-specific:
- `sys_doc_seq_category_cd`: CATALOG, MASTER_DATA, TRANSACTION
- `sys_doc_seq_manage_level_cd`: GENERAL, DOMAIN, MANUAL, NONE

All use the `sys_*_cd` standard (code, name/name2, description/description2, display_order, is_active, audit columns). If the inventory finds any of these tables (or an equivalent) already exists, reuse it instead of creating a duplicate.

**Constraints**
- `UNIQUE (target_table, target_column)`
- `UNIQUE (prefix)`: global across scopes (an HQ and an ORG type can't share a prefix). The inventory loads existing domain prefixes (e.g. finance) first so there are no clashes.
- `reset_policy` vs `parts_format`:
  - `NEVER` → format has no date part
  - `YEARLY` / `FISCAL_YEAR` → contains `YYYY` or `YY`
  - `MONTHLY` → contains `YYYYMM` or `YYMM`
  - `DAILY` → contains `YYYYMMDD`
- `manage_by_level <> 'GENERAL'` → `managed_by_object` is not null.
- `is_unique = false` → `unique_with` is null.

**Prefix rules (agreed)**
- Existing codes keep their current prefixes and are registered as `DOMAIN` (e.g. finance) or `MANUAL`. Nothing is renamed.
- New prefixes are 3 letters from the English name (`CUS`, `SUP`, `EMP`, `ORD`, `DLV`, `PKP`, `TKT`, …), checked against every existing prefix first.
- The inventory produces the full list as a table for row-by-row approval before any migration.

**Seed rows (preliminary; final list comes from the inventory)**

| doc_type_code | prefix | scope | category | parts_format | reset | manage_by_level | target |
|---|---|---|---|---|---|---|---|
| CUSTOMER | CUS | TENANT_ORG | MASTER_DATA | SEQ | NEVER | GENERAL | org_customers_mst.customer_code |
| SUPPLIER | SUP | TENANT_ORG | MASTER_DATA | SEQ | NEVER | GENERAL | (tbd) |
| EMPLOYEE | EMP | TENANT_ORG | MASTER_DATA | SEQ | NEVER | GENERAL | (tbd) |
| ORDER | ORD | TENANT_ORG | TRANSACTION | YYYY-SEQ (see 11.7 C: recommend YYYYMMDD-SEQ, DAILY) | YEARLY | GENERAL | org_orders_mst.order_no (see section 11) |
| DELIVERY | DLV | TENANT_ORG | TRANSACTION | YYYY-SEQ | YEARLY | GENERAL | (tbd) |
| INVOICE / RECEIPT / PAYMENT / REFUND / CREDIT_NOTE | (existing) | TENANT_ORG | TRANSACTION | (existing) | (existing) | DOMAIN | managed by `org_fin_doc_seq_mst` (tbd) |

---

## 5. Counter tables + generators (only for `manage_by_level = GENERAL`)

Existing domain generators (e.g. finance `org_fin_doc_seq_mst`) are **not changed**. They're only registered in the config table.

**Three counter tables, one per scope**

| Table | Columns | PK |
|---|---|---|
| `org_doc_seq_mst` | `tenant_org_id` uuid FK, `doc_type_code` FK, `period_key` text, `last_value` bigint, `prefix_override` text null (reserved), audit | `(tenant_org_id, doc_type_code, period_key)` |
| `sys_doc_seq_mst` | `doc_type_code` FK, `period_key`, `last_value`, audit | `(doc_type_code, period_key)` |
| `hq_doc_seq_mst` | `doc_type_code` FK, `period_key`, `last_value`, audit | `(doc_type_code, period_key)` |

`period_key`: `''` for NEVER, `2026` for yearly, `202610` for monthly, `20261030` for daily, and the fiscal-year value for FISCAL_YEAR.

**Functions**
- `fn_doc_seq_format(p_doc_type, p_value, p_at, p_tz)`: one shared, internal formatter that builds the code from `prefix`, `separator`, `parts_format` and `seq_pad_length`. Also `fn_doc_seq_period_key(...)`. The format logic is written once and used by all three.
- `fn_doc_seq_next(p_tenant uuid, p_doc_type text, p_at timestamptz)`: TENANT_ORG; tenant's time zone; counter in `org_doc_seq_mst`.
- `fn_sys_doc_seq_next(p_doc_type text, p_at timestamptz)`: SYS; time zone from `hq_general_config.timezone`; counter in `sys_doc_seq_mst`.
- `fn_hq_doc_seq_next(p_doc_type text, p_at timestamptz)`: HQ; time zone from `hq_general_config.timezone`; counter in `hq_doc_seq_mst`.
- Each one checks that the config row is active, `GENERAL`, and of its own scope; otherwise it raises an error.
- Each increments atomically with `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING last_value`.
- All are `SECURITY DEFINER`, `search_path = pg_catalog, public, pg_temp`.

**Fiscal year (interim)**
- New column `org_tenants_mst.fiscal_year_start_month smallint null`, CHECK 1–12. Null means not set (treated as January).
- **(v6, 2026-10-30) General values in both tables:** `current_fiscal_year` (text), `fiscal_year_start_month`, `date_format`, `time_format`, `first_day_of_week`, language, `locale_code` and `timezone` are columns in both `hq_general_config` (platform default) and `org_tenants_mst` (tenant value; NULL means use the HQ default). They replace the deactivated settings `ERP_LITE_FISCAL_YEAR_START`, `SYS_TIMEZONE`, `TENANT_DATE_FORMAT`, `TENANT_TIME_FORMAT`, `TENANT_FIRST_DAY_OF_WEEK`, `TENANT_LANGUAGE`, `TENANT_LOCALE`, which stay deactivated with a pointer comment. The other 17 settings deactivated by 0652 are unused feature settings and are not touched. Details: implementation plan §5.3.
- The generator works out the fiscal year for any date. Example: start month 4 means 2026-04-01 to 2027-03-31 is fiscal year `2026`, so the `period_key` is `FY2026`.
- Used only by types with `reset_policy = FISCAL_YEAR`.
- Why not `current_fiscal_year text`: it must be updated by hand every year, and a missed update gives wrong codes silently. A start month never goes stale.
- Replaced or extended later by the proper fiscal-year feature.

**HQ / platform settings: `hq_general_config`** (new)

A single-row table holding HQ-wide defaults. It's typed columns rather than key/value, so each value has its proper type and foreign key.

| Column | Type | Notes |
|---|---|---|
| `config_id` | boolean PK | default true, CHECK (`config_id`), which guarantees one row only |
| `default_currency_code` | text FK → `sys_currency_cd` | seed `USD` |
| `timezone` | text not null | IANA name, seed `Asia/Muscat`; validated against `pg_timezone_names` by a trigger (a CHECK can't query) |
| `default_language_code` | text FK → `sys_language_cd` | seed `en` |
| `default_country_code` | text FK → `sys_country_cd` | seed `OM`; default for lookups and the tenant wizard |
| `fiscal_year_start_month` | smallint | CHECK 1–12, seed 1; used by HQ/SYS `FISCAL_YEAR` types |
| `date_format` | text | seed `YYYY-MM-DD` (reads the same in EN and AR, sorts as text) |
| `default_vat_rate` | numeric(5,2) | seed `5.00` (Oman); starting value only when a new tenant is created, and each tenant keeps its own rate |
| `support_email` | text null | for HQ-to-tenant notifications and footers |
| `support_phone` | text null | same |
| `default_trial_days` | smallint | seed `14` (or the current wizard value, confirmed by the inventory); replaces the hard-coded wizard default |
| audit columns | | `created_at/by`, `updated_at/by`, `rec_status` |

- Read by `fn_sys_doc_seq_next` and `fn_hq_doc_seq_next` (time zone, fiscal start), and later by any HQ feature that needs a platform default.
- Read-only API endpoint `GET /hq/general-config` (HQ permission) for the HQ console; an edit screen later, with pick lists.
- Scope rule: only platform-wide defaults go here. Feature-specific settings (billing, notifications, …) stay in that feature's own settings, so this table doesn't become a catch-all.
- If the inventory finds an existing HQ settings table that covers this, extend it instead of creating a new one.

**Shared trigger function `fn_doc_seq_assign_code()`**: BEFORE INSERT.
- Arguments: `TG_ARGV[0]` = `doc_type_code`, `TG_ARGV[1]` = column name.
- Reads the scope from the config row and calls the matching `*_next` function (TENANT_ORG passes `NEW.tenant_org_id`).
- Fills the column if it is null or empty. Keeps a supplied value (the unique index enforces it).
- A companion BEFORE UPDATE guard blocks changes to the code (immutability).

---

## 6. Safety net (consistency check)

Read-only SQL view or function `vw_doc_seq_consistency` that lists:
- tables with an `fn_doc_seq_assign_code` trigger but no config row (or a mismatched `doc_type_code`),
- config rows whose `target_table`/`target_column` doesn't exist,
- `GENERAL` rows with no trigger on the target table, or whose scope doesn't match the table (e.g. TENANT_ORG without `tenant_org_id`),
- `DOMAIN` rows whose `managed_by_object` doesn't exist,
- `parts_format` / `reset_policy` mismatches (as a double check on the CHECK constraints),
- coded columns missing the per-tenant unique index or `NOT NULL`.

Expected result: zero rows. It runs as an API/Jest test or CI step, and I can also run it read-only on the remote DB.

---

## 7. App changes (after the DB part)

- API DTOs and responses include the code. Search endpoints accept the code.
- Public/external routes: lookup and search routes also accept the code; write routes keep the UUID (recommended, please confirm).
- UI: show the code in lists, details, pick lists (name · code), prints and notifications. Remove raw UUIDs from screens.
- An HQ screen for `sys_doc_seq_type_cd`, read-only at first (pick lists, EN/AR), showing each type's `implement_description`.
- An HQ General Config screen for `hq_general_config` with full view and edit in this release (A-12).

---

## 8. Rollout plan

1. **Inventory (read-only, remote DB).** For each candidate table: does it have a code column already, what format, who generates it (e.g. finance `org_fin_doc_seq_mst`), existing prefixes, any empty or duplicate codes, row counts. Also: existing module/sub-system lists to reuse. Output: a table in this doc + the full seed list for `sys_doc_seq_type_cd`.
2. **Migration A (split into a few files if large):** `sys_saas_scope_cd`, `sys_modules_cd`, `sys_module_sub_systems_cd` (full seed), `sys_doc_seq_category_cd`, `sys_doc_seq_manage_level_cd`; `sys_doc_seq_type_cd` + seed rows (GENERAL + DOMAIN); the three counter tables; the formatter, the three `*_next` functions, the trigger functions; the `fiscal_year_start_month` column on `org_tenants_mst`; `hq_general_config` + its single seed row; the consistency view.
3. **Migrations B…n: backfill existing tables (agreed), one per table, priority order:** customers → orders → invoices → payments → the rest. For each: add the column nullable, backfill in `created_at` order per tenant (and per year where it applies), set the counter to the max used, set `NOT NULL`, add the unique index, attach the triggers.
   - Tables that already have a working code keep it (no renaming). They are registered as `DOMAIN` or `MANUAL` with their existing format.
4. **Rules + skills:** add section 2 to both repos' rules files and the DB/frontend skills.
5. **App changes** (section 7), screen by screen.
6. **QA rows** in qa_test_guide.md plus a report file kept updated, per the usual practice.

All migrations are written unapplied with no status line in the header. You apply them.

---

## 9. Open questions

**Agreed**
- (2026-10-30, v2) Config table design: lookup FKs; `parts_format` as the single source of truth; `how_many_parts` + `full_size` generated; `reset_policy` extended and CHECKed; `unique_with` as `text[]`; `seq_pad_length`; `UNIQUE (prefix)` global; existing implementations kept and registered as `DOMAIN`. Master data drops the date.
- (v3) Scope lookup is `sys_saas_scope_cd` (HQ, SYS, TENANT_ORG). Modules and sub-systems are the shared `sys_modules_cd` and `sys_module_sub_systems_cd`, created with full seed.
- (v3) Tenant prefix override: reserved, off.
- (v3) Strict no-gaps: no control in the general generators; the owning domain implements it.
- (v3) New tables **and** backfill of existing tables.
- (v3) `GENERAL` uses one generator per scope: `org_doc_seq_mst`/`fn_doc_seq_next`, `sys_doc_seq_mst`/`fn_sys_doc_seq_next`, `hq_doc_seq_mst`/`fn_hq_doc_seq_next`.
- `full_size` = generated max length (assumed). `sub_system` list proposed by the inventory.

- (v4) Fiscal year: `org_tenants_mst.fiscal_year_start_month smallint` (1–12), as recommended.
- (v4) SYS/HQ time zone and other platform defaults come from the new single-row `hq_general_config` (currency USD, timezone Asia/Muscat, …).

- (v5) `hq_general_config` columns: currency, timezone, language, country `OM`, fiscal start month, `date_format`, `default_vat_rate` 5.00, `support_email`, `support_phone`, `default_trial_days`. Feature-specific settings stay out.
- (v5) Prefixes: existing ones are kept as is; new ones are 3 letters, checked for clashes; the full list is approved row by row after the inventory.
- (v5) Existing modules / scope / HQ settings tables: reuse and extend, never duplicate or replace; partial fits are flagged with a specific change suggestion.

**Still open**
- None on design. Waiting for: the inventory results, then row-by-row approval of the seed lists (modules, sub-systems, code types and prefixes).

**Next step (needs your go)**
- Read-only inventory: remote DB (read-only) + both repos (read-only). Output goes into a new section 11 of this proposal. No repo files are changed and no migrations are written until you approve the inventory.

---

## 10. Risks

- **Backfilling large tables** needs batching and runs during the migration. Plan it for low traffic.
- **Hot counter row:** very high insert rates on one tenant/type serialize on that row. That's fine at laundry volumes.
- **Existing integrations** that already show or store old codes must keep working, so existing codes aren't renamed.
- **Strict numbering**, if needed later, needs a different (locking, no-rollback-gap) approach for that type only.

---

## 11. Deep dive: ORDER numbering

> Read-only investigation, 2026-10-30. Remote DB (read-only session, PostgreSQL 17.6) + tenant repo `F:\jhapp\cleanmatex` + HQ repo `F:\jhapp\cleanmatexsaas`. Nothing was changed.

### 11.1 What exists today (schema)

| Table.column | Type | Rules | Real values |
|---|---|---|---|
| `org_orders_mst.order_no` | varchar(100) NOT NULL | `UNIQUE(tenant_org_id, order_no)` + index `idx_org_orders_tenant_no` (0001_core_schema) | `ORD-YYYYMMDD-NNNN` |
| `org_orders_mst.qr_code`, `barcode` | text | none (0012) | all NULL |
| `org_orders_mst.ar_invoice_no`, `tax_document_no` | text | copies of finance numbers | all NULL |
| `org_order_items_dtl.order_item_srno` | text | trigger `before_ins_set_order_item_srno` → `fn_next_order_item_srno` (MAX+1, 3 digits, 0015) | overwritten by app to `<order_no>-<n>` e.g. `ORD-20261003-0001-1` |
| `org_order_items_dtl.barcode` | text | — | all NULL |
| `org_order_item_pieces_dtl.piece_code` | text **GENERATED ALWAYS** `order_id::text‖'-'‖order_item_id::text‖'-'‖piece_seq` (0073) | no unique | `<uuid>-<uuid>-<n>`: exposes UUIDs, breaks the "no UUID in codes" rule; UI shortens it to `…last 8 chars` (`PieceBaseCard.tsx`) |
| `org_order_item_pieces_dtl.barcode` | text | non-unique index, not per tenant | all NULL |
| `org_order_edit_history.order_no` | copy | — | — |
| `org_order_changes_mst.change_no` | int | per order | — |
| `org_orders_mst.public_tracking_token` | hex(16 random bytes) + expiry/revoke (0441) | opaque | used for public tracking |

Triggers on `org_orders_mst` (`oc_order_foundation_guard`, `trg_ord_crt_pos_freeze`, `trg_order_auto_log_created`, `trg_order_initial_status`): **none generates `order_no`**. The app generates it.

### 11.2 How `order_no` is generated today

- DB function `generate_order_number(p_tenant_org_id uuid) RETURNS text` (migration `0012_order_intake_enhancements.sql`; live definition identical). It's `SECURITY DEFINER` with **no `search_path`**, and is granted to `authenticated`.
  - `v_date := TO_CHAR(CURRENT_DATE,'YYYYMMDD')`
  - `seq := MAX(SUBSTRING(order_no FROM 14)::int)+1` for `order_no LIKE 'ORD-'||v_date||'-%'` in the tenant
  - result `'ORD-'||v_date||'-'||LPAD(seq,4,'0')`; `NOT EXISTS` check, up to 10 retries with `pg_sleep(0.001)`
- Helpers in the same migration: `get_order_number_prefix()` (marked `IMMUTABLE` while using `CURRENT_DATE`, which is wrong) and `extract_order_sequence(text)`. All three are listed as grandfathered in `.cursor/rules/databasegrandfatheredobjects.mdc` (future names `org_ord_*`).
- App: `web-admin/lib/utils/order-number-generator.ts` → `generateOrderNumberWithTx(tx, tenantId)` runs `SELECT generate_order_number($1::uuid)` inside the order-create transaction (`order-service.ts:673`). `isValidOrderNumber` regex `/^ORD-\d{8}-\d{4}$/` **throws** on anything else. The header comment wrongly says "database sequence".
- Split sub-orders (`order-service.ts` ~1319) call `supabase.rpc('generate_order_number')` **outside** the Prisma transaction. A sub-order gets a new unrelated ORD number, and the number is used even if the split later fails.
- Other generators copied the same pattern: cash drawer `SES-YYYYMMDD-XXXX` (0270), `generate_customer_number` (`CUST-00001`, MAX+1).

### 11.3 Real data (remote, anonymised)

| Fact | Value |
|---|---|
| Orders | 13, 2 tenants, 3 branches, created 2026-10-02 → 2026-10-24 |
| Pattern | 100% `ORD-99999999-9999` |
| NULL / empty `order_no` | 0 |
| Duplicates in a tenant | 0 (3 numbers repeat across tenants; that's fine, uniqueness is per tenant) |
| Busiest tenant-day | 4 orders (max seq 4); 8 tenant-days, 0 gaps |
| Sub-orders (`parent_order_id`) | 0 |
| Orders with `qr_code` / `barcode` / `ar_invoice_no` / `tax_document_no` | 0 / 0 / 0 / 0 |
| Time zone | DB `TimeZone = Asia/Muscat` → `CURRENT_DATE` is the Muscat date for every tenant. `org_tenants_mst.timezone` exists but is ignored. `created_at` is timestamp without time zone (UTC). |

This is clearly test data. **Cutover risk is very low.**

### 11.4 Where the number is used

| Area | Where | Depends on format? |
|---|---|---|
| UI (lists, details, search, delivery, pickup, home collection, issues, reports, reconciliation) | ~211 non-test files: `src/features` (61), `lib/services` (37), `app/dashboard` (24), `app/api` (15) | Display/search only, except the regex in `order-number-generator.ts` |
| i18n | `messages/en.json`, `messages/ar.json` (17 keys each) | label only |
| Prints | order receipt, order details, tax document, AR invoice, item labels, ready print | show the string |
| QR / barcode | Receipt QR (`receipt-service.ts` → `lib/utils/qr-code-generator.ts`) = the public tracking URL (random token), already safe. Item barcode (`lib/db/orders.ts` → `generateBarcode`) = `<order_no>-<srno>`, already safe. Unused helper `generateQRCode` in `lib/utils/barcode-generator.ts` builds JSON `{"order":"ORD-…","tenant":"<tenant uuid>",…}`; nothing calls it today. `org_orders_mst.qr_code` is NULL on every row. | only the unused helper would put the tenant UUID in a QR |
| Item lines | `order_item_srno = <order_no>-<n>` (`order-service.ts:839, 2705`, `order-change-structural-write.ts:203`) | concatenates `order_no` |
| Notifications | `{{order_number}}` in `0346_ntf_templates_schema.sql` (13) and `0382_ntf_templates_full_seed.sql` (82); `order-event-variables.ts:47` | string only |
| Public tracking | `/track/{token}` (opaque). The old readable `/api/v1/public/orders/[tenantId]/[orderNo]` is retired and returns 404 (BF-16, guessable numbers) | **no**: links don't depend on order_no |
| Customer app API | `app/api/v1/public/customer/orders/[orderNo]` + `?tenantId` + Bearer verification token | string lookup |
| Mobile | `cmx_mobile_apps` customer_app reads `order_no` as a string | no |
| cmx-api | `finance-readiness.contracts.ts` `orderNo?: string` | no |
| HQ repo | only generated `database.types.ts` (no logic) | no |
| Cleanup tools | 0465 cleanup function filters by `order_no` / `order_no LIKE` | pattern-based |

Conclusion: only the generator, the TS regex/parse helpers, and `order_item_srno` depend on the *format*. Everything else treats it as an opaque string.

### 11.5 Related numbering already in the system (no common engine today)

| Document | Generator | Format | Reset | Concurrency safe? |
|---|---|---|---|---|
| Order | `generate_order_number` (SQL) | `ORD-YYYYMMDD-NNNN` | daily | **No** (MAX+1) |
| Order item | trigger `fn_next_order_item_srno` → overwritten by app | `<order_no>-<n>` | per order | per order (OK) |
| Piece | generated column | `<uuid>-<uuid>-<n>` | — | n/a, **not human-friendly** |
| AR invoice / refund | `fn_next_fin_doc_no` + `org_fin_doc_seq_mst` (upsert + `FOR UPDATE`) | `ARI-000023`, `REF-000010` | never | Yes |
| Tax documents | `tax-document-sequence.service.ts` + `org_tax_doc_seq_counters` (tenant, type, fiscal_year, `FOR UPDATE`) | `INV/SIM/CN/DN-2026-000001` | fiscal year | Yes (1 row live: SIMPLIFIED_INVOICE 2026 = 1) |
| Vouchers | `voucher-number.service.ts` / `voucher-service.ts` (advisory lock + MAX) | `RV/PV/ADJ-2026-000119` | yearly (JS server year) | Yes-ish (advisory lock, MAX scan) |
| Credit notes (stored value) | `stored-value.service.ts:414,472` (`count+1`) | `CN-<first 8 of tenant uuid>-00001` | never | **No** + **exposes tenant UUID** |
| POS session | app | `POS-YYYYMMDD-<8 hex>` | — | random |
| Cash drawer | `generate_cash_drawer_sess_no/_trx_no` | `SES-YYYYMMDD-XXXX` | daily | No (same MAX+1 pattern) |
| Customer | `generate_customer_number` | `CUST-00001` | never | No |

So there are four counter mechanisms today: MAX+1, `org_fin_doc_seq_mst`, `org_tax_doc_seq_counters`, and advisory-lock+MAX. Section 5's `org_doc_seq_mst` / `fn_doc_seq_next` is the one to converge on.

### 11.6 Risks found in the current ORDER mechanism

1. **Race → failed order create.** Two cashiers saving at the same moment both read MAX, both get `…-0005`. `NOT EXISTS` can't see the other uncommitted row, so one insert fails on `UNIQUE(tenant_org_id, order_no)`. There is no retry at insert, so the user sees an error.
2. **Overflow at 10,000/day.** `LPAD(x,4)` *truncates* (`10000` → `1000`), so the number collides, then fails after 10 retries. The TS regex also rejects 5 digits. That's not realistic per tenant today, but it's a hard wall.
3. **Wrong day for non-Muscat tenants.** The day comes from the DB time zone, not `org_tenants_mst.timezone`. A KSA/UAE tenant is fine (UTC+3/+4), but any tenant west of that rolls over at the wrong time.
4. **Security hygiene:** `SECURITY DEFINER` with no `search_path`; any `authenticated` user can call it for *any* tenant UUID and learn the tenant's daily volume.
5. **Split orders** get numbers outside the transaction (number burnt even on failure; no visible link to the parent).
6. **Piece codes** expose two UUIDs and aren't printable/scannable in a friendly way.
7. **Unused QR helper** (`generateQRCode` in `barcode-generator.ts`) would embed the tenant UUID if anyone wired it up. The live receipt QR already uses the tracking link.
8. `get_order_number_prefix()` is declared `IMMUTABLE` but depends on the date (it can be cached wrongly).

**Problem → fix map** (each fix is detailed in 11.7 / 11.9):

| # | Problem | Fix | Where |
|---|---|---|---|
| 1 | Race on concurrent saves → duplicate number, failed create | Atomic counter row `INSERT … ON CONFLICT DO UPDATE … RETURNING` in `org_doc_seq_mst` via `fn_doc_seq_next`; no `MAX()+1`, no `NOT EXISTS`, no `pg_sleep` retry loop | 11.7 F, §5 |
| 2 | Overflow/truncation at 10,000/day | Formatter pads to *at least* `seq_pad_length` and never truncates (`10000` stays `10000`); regex relaxed to `\d{4,}`; parser splits on last `-` | 11.7 C, I |
| 3 | Day boundary uses DB/Muscat time for all tenants | Period key from `org_tenants_mst.timezone`, fallback `hq_general_config.timezone` | 11.7 E |
| 4 | `SECURITY DEFINER` without `search_path`; any user can query any tenant's count | `SET search_path = pg_catalog, public, pg_temp`; tenant check (caller's tenant = `p_tenant_org_id`, or service role); revoke `EXECUTE` from `anon`/`public` | 11.7 F |
| 5 | Split sub-orders numbered outside the transaction, no parent link | Number inside the same transaction; recommended `<parent order_no>-S1`, `-S2` | 11.7 I, Q3 |
| 6 | Piece codes expose two UUIDs | New `<order_no>-<item n>-<piece n>` via trigger (replaces the UUID generated column) | 11.7 J, Q4 |
| 7 | Unused QR helper would embed the tenant UUID | Retire the JSON helper (deprecation note pointing to `qr-code-generator.ts`); every order/receipt QR uses the `/track/{token}` link | 11.7 J, Q5 |
| 8 | `get_order_number_prefix()` marked `IMMUTABLE` but depends on the date | Drop it (prefix comes from the config row) or re-mark `STABLE` | 11.7 F |
| + | Store credit notes `CN-<tenant uuid 8>-NNNNN` via `count+1`, prefix clash with tax `CN` | New prefix `SCN` on `fn_doc_seq_next` (atomic, no UUID); old rows kept | 11.7 K, Q6 |
| + | Order number could be edited after insert | BEFORE UPDATE immutability guard | 11.7 H |

### 11.7 Recommendation

**A. Keep the column `order_no`.** Don't add `order_code`. It's NOT NULL, unique per tenant, used in ~211 files, prints, templates and the customer API. Register it in `sys_doc_seq_type_cd` with target `org_orders_mst.order_no`. *(This changes the section 4 seed row from "order_code (tbd)" to "order_no".)*

**B. Keep every existing number as is.** No renaming, no backfill. All 13 rows already fit the format.

**C. Format: two options. I recommend Option 1.**

| | Option 1 (recommended): keep today's format | Option 2: proposal default |
|---|---|---|
| `parts_format` | `YYYYMMDD-SEQ` | `YYYY-SEQ` |
| Example | `ORD-20261030-0007` | `ORD-2026-000123` |
| Reset | DAILY | YEARLY |
| Padding | 4 (grows to 5+ if needed, never truncates) | 6 |
| Visual change | **none**: old and new numbers look the same | new and old look different (mixed formats in lists/search) |
| Counter speech | "today's number 7" is short at the counter | "123" grows all year |
| Drop-off date readable | yes | year only |
| Counter rows | 1 per tenant per day (tiny) | 1 per tenant per year |

Option 1 wins on continuity and on how laundries actually work (the ticket says the drop-off day; staff call small numbers). The only real cost is length (17 chars), which is fine on receipts and tags.

**D. Counter scope: per tenant** (`unique_with = {tenant_org_id}`), as today. Keep `BR` as an optional token for later. *Per branch* would need `ORD-<BR>-…` so numbers stay unique per tenant, and the tenant only has 3 branches today. Make it a tenant setting later if a customer asks.

**E. Day/period key = the tenant's local date.** Use `org_tenants_mst.timezone`, falling back to `hq_general_config` timezone (`Asia/Muscat`). That's not the server or JS clock.

**F. Generation:** replace the body of `generate_order_number(p_tenant_org_id)` with a thin wrapper over `fn_doc_seq_next('ORDER', …)` + `fn_doc_seq_format`. Keep the signature so `order-number-generator.ts`, the split flow and the HQ types don't break. Add `SET search_path = public`, add a tenant check (caller's tenant = `p_tenant_org_id`, or service role only), and drop the `pg_sleep` retry loop. Then the `fn_doc_seq_assign_code` BEFORE INSERT trigger only fills `order_no` when it's NULL, so both paths work during the transition.

**G. Gaps are allowed** (rolled-back orders burn a number). Orders aren't fiscal documents; tax invoices keep their own gap-free counter (`org_tax_doc_seq_counters`).

**H. Immutability:** the BEFORE UPDATE guard blocks changing `order_no` after insert.

**I. App fixes (small):**
- `isValidOrderNumber`: accept `^ORD-\d{8}-\d{4,}$` (or don't throw at all; treat the value as opaque).
- `parseOrderNumber` / `extract_order_sequence`: split on the last `-` and stop using `SUBSTRING FROM 14`.
- Split sub-orders: `<parent order_no>-S1`, `-S2`, numbered **inside the same tx**. *Decided.* Splitting a sub-order numbers under the root order (splitting `…-S2` gives `…-S3`, never `-S2-S1`) (A-19). Sub-orders also store the root in `root_order_id` (A-28, P2.1).
- Fix the comment that says "database sequence".

**J. Children tie in by suffix, not by their own counters:**

| Child | Code | Notes |
|---|---|---|
| Item | `<order_no>-<n>` | already the case; drop the 3-digit trigger value or make the trigger produce this directly |
| Piece | `<order_no>-<item n>-<piece n>` e.g. `ORD-20261030-0007-2-3` | same column `piece_code`, new value. The generated expression is replaced by a trigger, because it needs `order_no` and the item number |
| Garment tag / barcode | = piece code | unique per tenant |
| QR (receipt, order label) | `/track/{token}` URL, as the receipt already does | **no tenant UUID**; retire the unused JSON helper |

**K. Other numbers to register (DOMAIN, generated by their own domain code for now):** `AR_INV` (ARI), `REFUND` (REF), tax docs (INV/SIM/CN/DN), vouchers (RV/PV/ADJ), POS session, cash drawer session/trx. Register them so prefixes stay globally unique and the consistency view sees them. Moving them to GENERAL is a later, separate decision.
- Fix soon, separately: **stored-value credit notes** (`CN-<tenant uuid 8>-NNNNN`, `count+1`). This is unsafe, leaks the UUID, and its `CN` prefix clashes with tax `CN-2026-…`. Suggest prefix `SCN` (store credit note) under `fn_doc_seq_next`.

### 11.8 Proposed `sys_doc_seq_type_cd` rows (order area)

| doc_type_code | prefix | level | kind | parts_format | reset_policy | padding | manage_by_level | managed_by_object | target | unique_with |
|---|---|---|---|---|---|---|---|---|---|---|
| ORDER | ORD | TENANT_ORG | TRANSACTION | `YYYYMMDD-SEQ` | DAILY | 4 | GENERAL | `fn_doc_seq_next` (via `generate_order_number` wrapper) | `org_orders_mst.order_no` | `{tenant_org_id}` |
| ORDER_ITEM | — | TENANT_ORG | TRANSACTION | `<parent>-SEQ` | per order | 0 | NONE (derived) | `order-service.ts` | `org_order_items_dtl.order_item_srno` | `{tenant_org_id}` |
| ORDER_PIECE | — | TENANT_ORG | TRANSACTION | `<parent>-SEQ` | per item | 0 | NONE (derived) | trigger (new) | `org_order_item_pieces_dtl.piece_code` | `{tenant_org_id}` |
| AR_INVOICE | ARI | TENANT_ORG | TRANSACTION | `SEQ` | NEVER | 6 | DOMAIN | `fn_next_fin_doc_no` | `org_invoice_mst.invoice_no` | `{tenant_org_id}` |
| REFUND | REF | TENANT_ORG | TRANSACTION | `SEQ` | NEVER | 6 | DOMAIN | `fn_next_fin_doc_no` | `org_order_refunds_dtl.refund_no` | `{tenant_org_id}` |
| TAX_INVOICE / TAX_SIMPLIFIED / TAX_CREDIT_NOTE / TAX_DEBIT_NOTE | INV / SIM / CN / DN | TENANT_ORG | TRANSACTION | `YYYY-SEQ` | FISCAL_YEAR | 6 | DOMAIN | `tax-document-sequence.service.ts` | tax document no | `{tenant_org_id}` |
| VOUCHER_RECEIPT / _PAYMENT / _ADJUST | RV / PV / ADJ | TENANT_ORG | TRANSACTION | `YYYY-SEQ` | YEARLY | 6 | DOMAIN | `voucher-number.service.ts` | `org_fin_vouchers_mst.voucher_no` | `{tenant_org_id}` |
| STORE_CREDIT_NOTE | SCN (new) | TENANT_ORG | TRANSACTION | `YYYY-SEQ` | YEARLY | 6 | GENERAL | `fn_doc_seq_next` | `org_credit_notes_mst.credit_note_no` | `{tenant_org_id}` |
| POS_SESSION | POS | TENANT_ORG | TRANSACTION | `YYYYMMDD-<rand>` | n/a | — | DOMAIN | app | `org_pos_sessions_mst.session_no` | `{tenant_org_id, branch_id}` |
| CASH_DRAWER_SESSION | SES | TENANT_ORG | TRANSACTION | `YYYYMMDD-SEQ` | DAILY | 4 | DOMAIN (→ GENERAL later) | `generate_cash_drawer_sess_no` | cash drawer session | `{tenant_org_id}` |

Note: the global `UNIQUE(prefix)` rule means `CN` can't be used by both tax credit notes and store credit notes. That's the reason for `SCN`.

### 11.9 Cutover plan for ORDER

1. Add the config row + counter function (sections 4–5).
2. **Seed the counter** for today's period from the existing data (`MAX(seq)` for each tenant's current day) so the first new number never collides.
3. Swap the `generate_order_number` body to the wrapper (same signature). Add the fill-if-NULL trigger and the immutability guard.
4. App: relax the regex/parse helpers, fix the split flow, update the comment.
5. Pieces/QR: separate small change (new piece code; retire the unused JSON QR helper).
6. Run `vw_doc_seq_consistency`: it should show 0 duplicates/NULLs. With 13 test orders this is minutes of work, no downtime.

**POS/offline:** today order creation is online-only (DB function). If an offline POS is ever needed, it should create orders with a temporary `OFF-<device>-<n>` and get the real `ORD-…` on sync (the opaque token and UUID stay the true identity). Don't pre-allocate number ranges now.

### 11.10 Open questions for you (Q8–Q10 are in 11.11)

1. **Format:** Option 1 `ORD-20261030-0007` (daily, unchanged look; recommended) or Option 2 `ORD-2026-000123` (yearly)?
   - **Recommended: Option 1, `ORD-20261030-0007`, daily.** Same look as today's 13 orders, so lists and search never mix formats. Staff and customers say a short daily number at the counter, and the ticket shows the drop-off day. The length (17 chars) is fine on receipts and tags.
   - **DECIDED (2026-10-30): Option 1, `ORD-YYYYMMDD-SEQ`, daily reset, padding 4 that grows and never truncates.**
2. **Counter scope:** per tenant (recommended) or per branch (`ORD-<BR>-…`)?
   - **Recommended: per tenant.** It's today's behaviour, and the number alone is unique across the business, so pickup at any branch works. Per branch would force `ORD-<BR>-…` into every number. Keep `BR` as an optional token for a tenant setting later.
   - **DECIDED (2026-10-30): per tenant.**
3. **Split sub-orders:** `<parent>-S1` suffix, or a normal new ORD number?
   - **Recommended: `<parent>-S1`, `-S2`.** Staff and customers see at a glance that it belongs to the parent, no extra daily number is used up, and it's assigned in the same transaction as the split.
   - **DECIDED (2026-10-30): `<parent order_no>-S1`, `-S2`, assigned in the same transaction.**
4. **Piece code:** OK to replace the UUID-based `piece_code` with `<order_no>-<item>-<piece>`?
   - **Recommended: yes.** Add the stored `piece_code` (`<order_no>-<item n>-<piece n>`), keep the old `piece_code` with a deprecation note for one release, then drop it. Today's value is about 80 chars of UUIDs and can't be printed or scanned.
   - **DECIDED (2026-10-30): do it properly now, keep the column `piece_code` (it's text), and change only its value.** There's no new `piece_code` column and no transition period. In one migration: drop the `GENERATED ALWAYS AS` expression on `piece_code`, add a BEFORE INSERT trigger that sets `<order_no>-<item n>-<piece n>`, backfill existing rows, add `UNIQUE(tenant_org_id, piece_code)` and the immutability guard. App readers keep the same field name, and only code that parsed the old UUID format needs checking.
5. **QR content:** the receipt QR already holds the `/track/{token}` link. OK to make that the standard for every order QR (labels, tags) and retire the unused JSON helper in `barcode-generator.ts` that would put the tenant UUID in?
   - **Recommended: yes, the `/track/{token}` link everywhere a customer sees a QR** (receipt, order label), and retire the unused JSON helper. The token is random and revocable, phones open it directly, and nothing internal leaks.
   - **DECIDED (2026-10-30): the tracking link stays only for the customer link we send.** The order QR is a separate internal staff code. See 11.12.
6. **Store credit notes:** OK to rename the prefix to `SCN` and move them to the general counter (existing `CN-11111111-0000x` rows are kept)?
   - **Recommended: yes, `SCN` on `fn_doc_seq_next`, `YYYY-SEQ` yearly** (`SCN-2026-000001`). Keep the existing `CN-xxxxxxxx-0000n` rows as they are. This removes the `count+1` race, the UUID leak, and the clash with tax `CN`.
   - **DECIDED (2026-10-30): agreed.**
7. **Day boundary:** use each tenant's `timezone` (recommended), or keep Asia/Muscat for all?
   - **Recommended: each tenant's `timezone`**, falling back to `hq_general_config.timezone`. For today's Muscat tenants nothing changes, and it's correct for any tenant added in another zone.
   - **DECIDED (2026-10-30): agreed.**

### 11.11 Order QR and piece barcode (deep check)

**What the code does today**

| Thing | Today | Problem |
|---|---|---|
| Receipt QR | `receipt-service.ts` → `qr-code-generator.ts`, encodes the public tracking URL (random token) | none, already right |
| Order label (`print-label-button.tsx`) | prints `org_orders_mst.qr_code` and `barcode` as stored images | both columns are NULL on every order, so the button is always disabled; the label prints nothing |
| Unused JSON QR helper (`barcode-generator.ts` `generateQRCode`) | `{order, tenant uuid, phone, customer uuid, timestamp}` | leaks UUIDs and the phone; not called |
| Item barcode (`lib/db/orders.ts`) | value `<order_no>-<srno>`, but the column stores the rendered **SVG image (data URL)**, not the value | can't be searched or scanned; the `(tenant_org_id, barcode)` index is on image text |
| Piece `piece_code` (0073) | generated `<order uuid>-<item uuid>-<n>` | UUIDs, about 80 chars, not printable as a barcode |
| Piece `barcode` | always NULL at create; can be set by an edit; scan route matches `barcode` **within one item only** | nothing prints a piece barcode, so scanning can't match; scanning at assembly needs the item first |

**Recommendation: order level**
1. Order label = **internal staff QR `CMX1:O:<order_no>`** (see 11.12; the tracking link stays only on the customer receipt and in messages) **plus a CODE128 barcode of `order_no`** (staff scan at the counter / pickup).
2. Render images **at print time** from the values. Don't store images in the DB. Retire `org_orders_mst.qr_code` / `barcode` as image columns (deprecation note), or keep them NULL.
3. Scanning an order barcode looks up `(tenant_org_id, order_no)`.
4. Retire the unused JSON helper.

**Recommendation: piece level**
1. **Keep the column `piece_code`, change its value** to `<order_no>-<item n>-<piece n>`, e.g. `ORD-20261030-0007-2-3` (21 chars). It's set by a trigger (no longer a generated column), backfilled for existing rows, unique per tenant, and immutable.
2. Piece tag prints a **CODE128 barcode of `piece_code`** plus the text under it. 1D is what cheap scanners and small heat-seal/paper tags handle best. An optional QR with the same value can be offered on larger labels. No tracking URL on garment tags (internal use).
3. Keep `barcode` as an **optional external tag** (pre-printed heat-seal tag, RFID, or a customer's own tag) that staff link to the piece by scanning.
4. Scan resolves **`piece_code` OR `barcode` within the tenant** (not only within one item), so assembly, QA and packing can scan any piece directly and find its order. Add a unique index `(tenant_org_id, barcode) WHERE barcode IS NOT NULL`.
5. Item barcode: store the **value** `<order_no>-<srno>` (or derive it), not the SVG.

**Open questions**
- Q8: Order label = tracking-link QR + `order_no` barcode. OK?
  - **Recommended: yes.** QR = tracking link for the customer; CODE128 of `order_no` for staff. Draw both at print time, so the label button works for every order.
  - **DECIDED (2026-10-30): same as Q5.** The order label carries the internal staff QR (11.12) plus the CODE128 of `order_no`.
- Q9: Piece tag = CODE128 of `piece_code` (QR optional on big labels). OK?
  - **Recommended: yes, CODE128 of `piece_code` with the text under it.** It's the most reliable on small heat-seal tags and with cheap scanners. Offer a QR with the same value only on large labels, as a print setting.
  - **DECIDED (2026-10-30): agreed for now.** Note from the user: laundries often use a fixed barcode per garment, which is covered by `barcode` (Q10).
- Q10: Keep `barcode` for optional pre-printed/external tags, unique per tenant. OK?
  - **Recommended: yes.** Keep `barcode` as an optional external or pre-printed tag, unique per tenant (`WHERE barcode IS NOT NULL`). Scanning resolves `piece_code` or `barcode` across the whole tenant.
  - **DECIDED (2026-10-30): agreed.** `barcode` holds the garment's fixed or pre-printed tag; staff scan it to link it to the piece at intake.


### 11.12 Order QR: internal staff code (separate from the tracking link)

**DECIDED (2026-10-30): agreed.** The order label and bag tag use the staff QR `CMX1:O:<order_no>`. The tracking link is only for the customer.

**Why:** the `/track/{token}` link is the public customer link that we send for following the order. Printing it on every label would make any label photo a public link, and its token lifecycle (revoke or rotate) would break printed labels. The order QR is for staff scanning, so it needs its own payload.

**Recommended payload (short, versioned, no UUIDs, no personal data):**

```
CMX1:O:ORD-20261030-0007
```

- `CMX1` is the scheme plus version, so the app knows it's our code and the format can grow later (`CMX2…`).
- `O` is the record type (`O` order, `P` piece, `I` item, later `B` bag/rack), so one scanner screen can handle any of our codes.
- The value is the human-friendly code, never a UUID. The tenant comes from the staff member's signed-in session, so the tenant UUID is never printed.
- No phone, customer name, amount or timestamp. A QR is easy to photograph, and those details change, while a printed label can't.

**Behaviour**
- The scan handler parses `CMX1:<type>:<code>` and looks up `(session tenant, code)`. It also accepts a bare `ORD-…` or `piece_code` from a 1D barcode scan, so both work.
- A QR that's scanned with a phone camera outside the app just shows text, so it reveals nothing beyond what's printed on the label.
- Rendered at print time, not stored (see 11.11).

**Optional later (not now):** a signed variant `CMX1:O:<code>:<short HMAC>` if tenants want tamper-proof labels. That's not needed while lookups are always scoped to the signed-in tenant.

**Where each code is used**

| Printed on | Customer QR (tracking link) | Staff QR (`CMX1:…`) | CODE128 |
|---|---|---|---|
| Customer receipt | yes | no | `order_no` (optional) |
| Order label / bag tag | no | yes | `order_no` |
| Piece tag | no | optional (large labels) | `piece_code` |
| Fixed garment tag | | | existing `barcode` |

---

## 12. Decisions from the plan approvals (2026-10-30)

| Item | Decision |
|---|---|
| A-03 | Seven general values (`current_fiscal_year`, `fiscal_year_start_month`, `date_format`, `time_format`, `first_day_of_week`, language, `locale_code`) plus `timezone` are real columns in both `hq_general_config` (HQ default) and `org_tenants_mst` (tenant value; NULL uses the HQ default). The tenant settings system stays; the 17 unused settings switched off by 0652 are not added. |
| A-04 to A-11, A-13, A-14, A-17, A-20 | Approved as recommended in the plan (§20). CODE128 uses `bwip-js` (A-07). |
| A-12 | The HQ General Config edit screen ships **in this release**: view + edit with audit, `hq_general_config:manage`, `PATCH /hq/general-config`. It's one row, so it's created by the seed and can't be deleted. |
| A-15 | Each repo copies only the cmx pieces it needs (e.g. `CmxCodeChip`, the code payload codec), with matching tests. No shared package. |
| A-18 | Skipped for now. The HQ Code Consistency screen shows the checks on demand; a scheduled alert can be added later. |
| A-19 | Splitting a sub-order numbers under the root order (`-S3`). |
| A-28 (2026-10-31, user) | Sub-orders store their family root in a new column `org_orders_mst.root_order_id` (migration `0677`); numbering reads it instead of walking parents. |
| A-29 (2026-10-31, user) | A split only moves work: all money stays on the parent order; sub-order lines are priced 0 and point back to the parent lines. |
| A-30 (2026-10-31, expert, delegated) | The order number is taken inside the create transaction, last, just before the insert (gapless; ~7k creates/s per tenant on the box). |
| A-31 (2026-10-31, expert; HQ part changed by user 2026-10-31) | Tenant hard delete is allowed only in the new insert-only status `creating` (a tenant still being created); a DB trigger blocks every other case (migration `0678`). Both self-signup and HQ tenant create start in `creating` and leave it when the required steps succeed (P2.2). Rule 4 (codes never reused) holds: only a tenant that never finished being created can lose its counters. |
| A-32 (2026-10-31, expert) | HQ tenant create leaves `creating` after the tenant row and base currency exist; the later initialization (branches, categories, catalog, preferences) stays best-effort and re-runnable, as today. A failed required step deletes the half-made tenant. |
| A-33 (2026-10-31, expert; user asked for the safest design) | Counters of a deleted tenant are removed only by the database, in the same step as the tenant delete, and only for a tenant still being created. No app deletes counters, so a refused delete can never lose a tenant's numbers. |
| A-34 (2026-10-31, expert) | When P3 fills in the new line and piece codes on existing data, the table's triggers are paused for that step only, so order totals and edit times are not touched. Old values are kept. |
| A-35 (2026-10-31, expert; user rule) | An external tag is freed when its piece is removed or its order is delivered, closed or cancelled. The piece keeps the tag as history (`tag_released_at` is set; the value stays). Reopening an order does not take the tag back. |
| A-36 (2026-10-31, expert; user rule) | Tags are stored trimmed and upper-case, only A-Z 0-9 - _ . /, up to 64 characters (replaces the A-16 charset). Existing tags are normalised by `0683`. |
| A-37 (2026-10-31, expert; user rule) | A tag may not look like one of our codes: any code-type prefix (order, line, piece, every doc type, `CMX1:`) followed by a digit is refused. Note: the one-letter prefixes U and Z refuse tags like U1, Z9. |
| A-38 (2026-10-31, expert; user rule) | Saving tags checks every tag first and saves nothing if one is wrong, listing all problems. Pieces are then saved one by one; a clash at the same instant returns 409 with the number already saved. |
| P3 codes (2026-10-31) | Line code `<order_no>-<n>` (never reused, continues after removed lines), piece code `<line code>-<piece n>`, external tag unique per tenant among live pieces of open orders (A-35..A-38). Migrations `0682`, `0683`; the global scan screens follow in P3b. |
| A-39 (2026-10-31, accepted by you after applying P3) | Closed orders free their tags (like delivered and cancelled); a reopened order keeps its tags released; the one-letter prefixes `U` and `Z` refuse tags such as `U1`; the tag release trigger is `SECURITY DEFINER`; the piece `PATCH` path moved to P3b and uses the same tag checks as batch-update. |
| A-40 / P3b scan (2026-10-31, expert) | One scan box for any code or tag (`POST /api/v1/scan/resolve`), plus `orders/lookup`, `pieces/lookup` and `external-tag` (link / remove a tag, CSRF). A code is never read as a tag; removed pieces are found by code only; another tenant's code looks the same as a missing one (404); unknown `CMX1:` types give 422. Global scan button + `Ctrl+Shift+F` + page-wide scanner behind the flag `human_codes_scan_labels` (default off). 600 scans/min per user. No migration. Codes on every screen (T3.9) are next. Guide: `SCAN_AND_PIECE_CODES.md`. |
| A-41 (2026-10-31, approved by you) | The scan shortcut stays `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac). |
| A-42 (2026-10-31, approved by you) | The assembly scanner also accepts piece codes, line codes, staff QR and tags of the task's order (through the shared scan resolver), after its own barcodes; same response; removed pieces and other orders are refused. |
| A-43 (2026-10-31, approved by you) | Scan limit stays 600 per minute per user; it fails open when Upstash is down. |
| A-44 (2026-10-31, approved by you) | Every `CmxDialog` is now named by its title (and described by its description) for screen readers, with no change for callers; the a11y test checks the dialog name again. |
| T3.9 codes on screens (2026-10-31) | Orders, lines and pieces show their full codes as chips (tag as a second chip), sub-orders link to their parent, shortened UUIDs are gone from order screens, the orders search opens a scanned code at once, and `?piece=` highlights the piece. Remaining station screens and the pieces filter followed the same day (T3.9b): order-number chips on station, pickup, delivery, home-collection and report screens, and a pieces filter by piece code or tag. |
| A-45 / P4 labels (2026-10-31, expert) | Order labels print the CODE128 of `order_no` and the staff QR `CMX1:ORD:<order_no>` (the payload built in P3b); piece tags print the CODE128 of `piece_code`, with the QR `CMX1:PEC:<piece_code>` only when `LABEL_PIECE_TAG_QR` is on. Barcodes keep the hyphens. No phone on any label; the customer is "Ahmed B." and can be hidden. The receipt can show the order CODE128 (`RECEIPT_ORDER_CODE128`, on only with `human_codes_scan_labels`); the customer tracking QR is unchanged. Printing uses a hidden frame (no pop-up, no HTML strings). Guide `USER_GUIDE_LABELS.md`. |
| A-46 / A-47 label config (2026-10-31, approved by you) | Label options live in config tables, not tenant settings: `sys_label_printing_cf` (platform defaults per label type: order label, piece tag, receipt) and `org_label_printing_cf` (tenant-wide or per-branch overrides; empty = use the default). One resolver picks branch → tenant → system. Label printing is available to every tenant; the `label_printing` flag is no longer checked (kept in the catalog, to retire later in HQ). The receipt barcode is still capped by `human_codes_scan_labels`. |
| A-48 (2026-10-31, approved by you) | Sizes are not checked against the `label_printing_58mm` / `label_printing_80mm` flags; the old image columns `org_orders_mst.qr_code` / `barcode` get a DEPRECATED comment in P6/P9 and are dropped only with a separate approval; bulk printing comes in a later phase. |
| A-49 / Labels & Tags screen (2026-10-31, expert) | Settings → Labels & Tags edits the options for all branches or one branch, with "Use default" on every field and the value in use shown next to it; read needs `settings:read`, save `settings:update`; EN/AR. |
| A-50..A-53 / P5 store credit (2026-10-31, **reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away)) | Store credit notes are numbered `SCN-YYYY-NNNNNN` by the engine (migration `0687`); old `CN-` numbers stay; the counter starts at 1 each year. The app sends an empty number and reads the real one back; if none comes back the issue stops and nothing is saved. A code switch (`STORE_CREDIT_NOTE_NUMBERING`, ENGINE / LEGACY) keeps the old generator for one release as the rollback path. Apply `0687` first, then deploy. |
| A-54..A-56 / P6 permissions (2026-10-31, **reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away)) | HQ gets 3 permission codes (`hq_doc_seq:read`, `hq_general_config:read`, `hq_general_config:manage`, migration `0688`) with no role grant: SUPER_ADMIN already has `*`, other roles get them from HQ Roles (least privilege, like `0625`). No tenant permission and no nav migration (HQ nav is code in P7); the flag already exists (`0684`). The old label image columns get a DEPRECATED comment (`0689`); nothing is dropped. |
| A-57..A-63 / P7 HQ (2026-10-31, **reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away)) | HQ gets the Code Types list (details and a safe preview), the Code Consistency report (cached 60 s, re-run at most every 10 s) and the General Config screen (edit with `hq_general_config:manage`; a stale save returns 409 and offers "Load latest"; changing the time zone or fiscal-year start asks first; only changed fields are saved and audited). The tenant wizard pre-fills country, currency, time zone, language and trial days from General Config, without overwriting what the operator typed. Codes show as copyable left-to-right chips. `jest-axe` for HQ is left for you to install. |
| A-64..A-67 / P8 clients (2026-10-31, **reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away)) | Mobile gets the same code rules as web-admin (`mobile_core` `human_codes.dart`, a copy) and shows codes left-to-right with `ltrCode` (display only); the booking screen waits for your edit. cmx-api has no order code yet (N/A). The order status notification now sends the order number, not the internal id (falls back to the id only if the read fails). The HFC rule text in both repos now says: reuse the shared helpers, show codes LTR with `CmxCodeChip`, never put a UUID in a message. No migration. Details: plan §20 A-64..A-67. |
| A-68..A-70 / P9 close-out (2026-10-31, **reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away)) | Old helpers and the store-credit `LEGACY` fallback are kept (nothing deleted; removal is a dated follow-up ~2026-12-01). The shared-engine design is written as ADR-004 in the HQ repo (**Accepted** 2026-11-05). The full documentation pack, QA guide (S1–S20) and implementation report were added to this folder; QA and performance checks run on the deployed environment by you. No migration. Plan status: CLOSED - waiting for user apply/deploy. Details: plan §20 A-68..A-70. |
| New column | `sys_doc_seq_type_cd.implement_description` (your addition, §4): a step-by-step "how it works" note for HQ support, filled for every seeded row. |
| Still open | A-01, A-02, A-16 and A-21 wait for the P0 inventory. |
