# Developer Guide — Document Numbering Engine (Human-Friendly Codes, P1)

**Status:** P1, P2, P2.1 and P3 applied (P3 `0682` + `0683` applied by the user 2026-10-31, local + remote; types and `prisma.schema` regenerated). P3b (scan screens, app only, no migration) written 2026-10-31, WAITING FOR USER (deploy/test). Scan and piece codes: `SCAN_AND_PIECE_CODES.md`. P4 labels (`0685`, label config tables, Settings → Labels & Tags) applied by the user 2026-10-31 (local + remote; types and `prisma.schema` regenerated): §19. P5 store credit notes (`0687`, SCN) applied by the user 2026-11-01, local + remote, WAITING FOR USER (deploy web-admin): §20.
P6 (`0688` HQ permissions, `0689` deprecated comments) applied by the user 2026-11-01, local + remote, see §21. P7 (HQ API + screens, no migration) written 2026-10-31, WAITING FOR USER (deploy), see §23. **All HFC migrations are applied (2026-11-01). Remaining steps (checks, deploy, QA): §22 APPLY_RUNBOOK.**
**Plan:** `IMPLEMENTATION_PLAN_Human_Friendly_Codes.md` (same folder). **Inventory:** `INVENTORY.md`.
**Migration numbers:** see the table in section 2 (assigned at creation time; other people add migrations at the same time, so always check the folder).

---

## 1. What P1 adds

P1 adds the shared engine and its configuration. It does **not** change how any existing code is generated.
All 51 doc types are registered as `DOMAIN` (or `MANUAL`/`NONE`), so every existing generator keeps working as today.
Doc types move to `GENERAL` one by one in later phases (ORDER in P2, STORE_CREDIT_NOTE in P5), each in the same migration that seeds the counter from the existing data and adds the triggers.

| Area | Objects |
|---|---|
| Structure lookups | `sys_saas_scope_cd` (TENANT_ORG, SYS, HQ), `sys_modules_cd`, `sys_module_sub_systems_cd`. Every row has a unique 2-5 letter `short_code` (plan A-27; `type_prefix` stays 3-5). Modules include the shared ORG/HQ ones (AUTH, RBAC, NOTIFICATION, SETTINGS, AUDIT, REPORTS, INTEGRATIONS ...) and the HQ-only ones (OPS, BILLING, TENANTS, SUPPORT, MARKETING ...). Journals belong to ERP. |
| Doc type config | `sys_doc_seq_category_cd`, `sys_doc_seq_manage_level_cd`, `sys_doc_seq_type_cd` (51 rows) |
| Platform defaults | `hq_general_config` (single row) + `fn_tenant_general_value(tenant, key)`; new `org_tenants_mst` columns `current_fiscal_year`, `fiscal_year_start_month`, `locale_code` |
| Counters | `org_doc_seq_mst` (per tenant), `sys_doc_seq_mst`, `hq_doc_seq_mst` |
| Engine | `fn_doc_seq_next`, `fn_sys_doc_seq_next`, `fn_hq_doc_seq_next`, `fn_doc_seq_period_key`, `fn_doc_seq_format` (+ `fn_doc_seq_format_row`), triggers `fn_doc_seq_assign_code`, `fn_doc_seq_guard_immutable`; internal: `fn_doc_seq_type_get`, `fn_doc_seq_type_check`, `fn_doc_seq_next_by_row`, `fn_doc_seq_caller_role` |
| Self-checks | `vw_doc_seq_consistency`, `fn_doc_seq_consistency_data()` |
| HQ Core Data | 6 rows in `sys_code_tables_registry` (read-only for now) |
| Hardening (S5) | `fn_next_fin_doc_no`, `generate_cash_drawer_sess_no`: pinned `search_path`, EXECUTE for service_role only |

## 2. Migrations and apply order

Apply in this order (each file is one transaction; `lock_timeout` 10s):

| # | Name | Number |
|---|---|---|
| 1 | `scope_modules` | `0666_sys_platform_scope_modules.sql` |
| 2 | `doc_seq_type_config` | `0667_doc_seq_type_config.sql` |
| 3 | `hq_general_config` | `0668_hq_general_config.sql` |
| 4 | `doc_seq_counters` | `0669_doc_seq_counters.sql` |
| 5 | `doc_seq_engine_fns` | `0670_doc_seq_engine_fns.sql` |
| 6 | `doc_seq_consistency` | `0671_doc_seq_consistency.sql` |
| 7 | `doc_seq_code_tables_registry` | `0672_doc_seq_code_tables_registry.sql` |

After applying: run `supabase/tests/doc_seq_engine_p1.test.sql` on **local** (all lines `PASS`), then `SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR';` must return 0 rows. Then regenerate types in both repos and run `npm run prisma:pull` in `web-admin`.

## 3. Read-only checks to run BEFORE applying

Run with your own session (Supabase Studio or psql). All are SELECT-only.

```sql
-- Q3 finance doc-seq rows with no prefix (fn_next_fin_doc_no is recreated with the same logic)
SELECT doc_type_code, count(*) FILTER (WHERE prefix IS NULL) AS null_prefix, count(*) FROM org_fin_doc_seq_mst GROUP BY 1;

-- Q8 tenant locale values: every value must pass the new CHECKs
--   date_format IN ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY'), time_format IN ('12h','24h'),
--   first_day_of_week 0-6, timezone a real IANA name. The migration also stops with a clear error if not.
SELECT date_format, time_format, first_day_of_week, language, timezone, count(*)
FROM org_tenants_mst GROUP BY 1,2,3,4,5;
SELECT timezone, count(*) FROM org_tenants_mst
WHERE timezone IS NOT NULL AND timezone NOT IN (SELECT name FROM pg_timezone_names) GROUP BY 1;

-- Q11 who can execute the definer generators today (S5 revokes anon/authenticated)
SELECT p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
CROSS JOIN pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND p.proname IN ('fn_next_fin_doc_no','generate_cash_drawer_sess_no','generate_order_number','generate_customer_number');

-- Q-N1 the Prisma DB user can still call the hardened functions after the revoke.
-- Run while connected AS THE SAME USER as web-admin DATABASE_URL. Expect ok = true for both rows.
SELECT current_user, p.proname, pg_get_userbyid(p.proowner) AS owner,
       (r.rolsuper OR pg_get_userbyid(p.proowner) = current_user OR pg_has_role(current_user, 'service_role', 'MEMBER')) AS ok
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
JOIN pg_roles r ON r.rolname = current_user
WHERE p.proname IN ('fn_next_fin_doc_no','generate_cash_drawer_sess_no');

-- Q-N2 none of the new names exist yet (expect 0 rows)
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relname IN ('sys_saas_scope_cd','sys_modules_cd','sys_module_sub_systems_cd','sys_doc_seq_category_cd',
  'sys_doc_seq_manage_level_cd','sys_doc_seq_type_cd','hq_general_config','org_doc_seq_mst','sys_doc_seq_mst',
  'hq_doc_seq_mst','vw_doc_seq_consistency')
UNION ALL
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
WHERE p.proname IN ('fn_doc_seq_next','fn_sys_doc_seq_next','fn_hq_doc_seq_next','fn_doc_seq_period_key',
  'fn_doc_seq_format','fn_doc_seq_format_row','fn_doc_seq_type_get','fn_doc_seq_type_check','fn_doc_seq_next_by_row','fn_doc_seq_caller_role','fn_doc_seq_assign_code','fn_doc_seq_guard_immutable',
  'fn_doc_seq_full_size','fn_doc_seq_type_guard','fn_doc_seq_consistency_data','fn_tenant_general_value',
  'fn_tenant_tz_validate','fn_hq_gen_cfg_validate','fn_hq_gen_cfg_no_delete')
UNION ALL
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'org_tenants_mst'
  AND column_name IN ('current_fiscal_year','fiscal_year_start_month','locale_code');

-- Q-N3 registry rows already present (kept as they are: ON CONFLICT DO NOTHING)
SELECT table_name, is_editable FROM sys_code_tables_registry
WHERE table_name IN ('sys_saas_scope_cd','sys_modules_cd','sys_module_sub_systems_cd','sys_doc_seq_category_cd',
  'sys_doc_seq_manage_level_cd','sys_doc_seq_type_cd');

-- Q-N4 the lookups the seeds reference exist (expect 1 row each)
SELECT 'OMR' AS v, EXISTS (SELECT 1 FROM sys_currency_cd WHERE code = 'OMR')
UNION ALL SELECT 'OM', EXISTS (SELECT 1 FROM sys_country_cd WHERE code = 'OM')
UNION ALL SELECT 'en', EXISTS (SELECT 1 FROM sys_language_cd WHERE code = 'en');
```

## 4. How a number is made (GENERAL types)

1. The table has `trg_<x>_no_assign BEFORE INSERT ... EXECUTE FUNCTION fn_doc_seq_assign_code('<DOC_TYPE>', '<column>')` (low-volume tables) or a small typed trigger (busy tables, section 12).
2. If the code column is empty, the trigger reads the config row and calls the engine for its scope (`TENANT_ORG` uses `NEW.tenant_org_id`).
3. `fn_doc_seq_next(tenant, type, at)`:
   - checks the caller (anon is refused; an authenticated caller may only ask for its own tenant: `DOC_SEQ_TENANT_MISMATCH`);
   - reads the config row once (`fn_doc_seq_type_get`) and passes it on (`fn_doc_seq_next_by_row`, `fn_doc_seq_format_row`);
   - reads the tenant time zone (fallback `hq_general_config.timezone`) and fiscal start month;
   - builds the period key: `''` (NEVER), `YYYY`, `YYYYMM`, `YYYYMMDD`, or `FYyyyy`;
   - increments the counter with one `INSERT ... ON CONFLICT DO UPDATE` (row lock until commit; no `MAX()`, no retry);
   - formats: `prefix` + `separator` + parts. SEQ is padded to `seq_pad_length` and **grows** (9999 then 10000; never truncated).
4. `trg_<x>_no_guard BEFORE UPDATE OF <column> ... WHEN (OLD.<column> IS DISTINCT FROM NEW.<column>)` raises `DOC_SEQ_CODE_IMMUTABLE` on any change of a set code.

**Gaps:** the increment is part of the caller's transaction. If the transaction rolls back, the number is given back (the next caller gets the same number). Gaps appear only when a number is taken in a separate transaction from the document, or when the document is deleted later. Always take the number in the same transaction as the insert (the trigger does this by design).

**Concurrency:** two inserts for the same tenant, type and period wait on the counter row; the second gets the next number after the first commits. Different tenants or periods never wait on each other. The row stays locked until COMMIT, so keep these transactions short (section 13).

**Tokens not enabled in P1:** `BR`, `PARENT`, `RAND` raise `DOC_SEQ_TOKEN_NOT_ENABLED`; they are allowed in the config only for DOMAIN rows that describe existing formats.

## 5. Using it from web-admin

- Constants: `web-admin/lib/constants/doc-seq.ts` (`DOC_SEQ_TYPES`, `DOC_SEQ_TYPE_PREFIXES`, `DOC_SEQ_ERRORS`, `parseDocSeqError`).
- Service: `web-admin/lib/services/doc-seq-config.service.ts` (`listDocSeqTypes`, `getDocSeqType`, `nextTenantDocCodeTx`, `listDocSeqConsistency`). It uses `$queryRaw` until the new tables are in the Prisma schema.
- Do not compute codes in TypeScript. Do not write to the counter tables.
- Catch engine errors with `parseDocSeqError(err.message)` and map to user messages (i18n keys come with P2).

## 6. type_prefix

Every doc type has a reserved `type_prefix`: 3-5 capital letters, unique across all types (for example ORDER `ORD`, ORDER_ITEM `ITM`, ORDER_PIECE `PEC`, FIN_JOURNAL `JRL`).
- It is the stable key of the type: scan payloads use `CMX1:<type_prefix>:<code>`, so two types that print the same prefix (for example tax and store credit notes both print `CN-`) are still told apart.
- For GENERAL types the printed prefix equals `type_prefix` (CHECK `ck_doc_seq_gen_tprefix`).
- DOMAIN types keep their own printed format (and child codes such as `<order>-<item>-<piece>` keep theirs); `type_prefix` is only their key.
- `implement_description` on every row explains how the code is made today and what `type_prefix` is used for.

## 7. Adding a new numbered table (checklist)

1. Code column `NOT NULL` + `UNIQUE (tenant_org_id, <code>)`.
2. One `sys_doc_seq_type_cd` row: unique `type_prefix`, `manage_by_level = 'GENERAL'`, `prefix = type_prefix`, format, reset policy, `implement_description`.
3. Assign + guard triggers (section 4). Busy table: typed assign trigger; always the `WHEN (OLD.<col> IS DISTINCT FROM NEW.<col>)` guard (section 12).
4. Backfill existing rows and seed the counter (`INSERT INTO org_doc_seq_mst ... SELECT tenant, type, period, max(seq)`) in the same migration.
5. `SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR'` returns 0 rows; `fn_doc_seq_consistency_data()` shows `counter_behind = false`.

## 8. Self-checks

- `vw_doc_seq_consistency` (catalog reads only, cheap). ERROR checks: `TRG_NO_CONFIG`, `GEN_NO_TRIGGER`, `TRG_GUARD_MISSING`, `CFG_TARGET_MISSING`, `DOMAIN_OBJ_MISSING`, `FORMAT_RESET_MISMATCH`, `TOKEN_NOT_ENABLED`; ERROR for GENERAL / WARN for others: `SCOPE_MISMATCH`, `NO_UNIQUE_INDEX`, `NOT_NULL_MISSING`; WARN: `PREFIX_SHARED`; INFO: `APP_OBJ_UNVERIFIED`.
- Expected after P1 (no GENERAL types yet): 0 ERROR; WARN `PREFIX_SHARED` x2 (CN-, INV-), `SCOPE_MISMATCH` (USER code is platform-wide on `org_users_mst`), `NOT_NULL_MISSING` (cash drawer `session_no`); INFO for app-owned generators.
- `fn_doc_seq_consistency_data()` scans the target tables (run off-peak): rows, NULL/empty codes, duplicates, and for GENERAL types whether a counter is behind the data. The duplicate scan is skipped when a valid unique index on `(unique_with..., column)` already proves there are none. It takes about 20 s per 5M-row GENERAL table (section 14), so callers should run it with `SET LOCAL statement_timeout = '120s'` (or more for big tenants) inside their own transaction.

## 9. Tenant cleanup

Counters are never reset or deleted by tenant cleanup (approved 2026-10-30): a reused number would collide with printed labels and receipts. `0465` deletes no tenants. The only hard deletes of a tenant are the create rollbacks (web-admin signup `registerTenant`; since P2.2 also HQ `TenantsService.create`), allowed only while the tenant is `creating` (0678), which removes the counters itself. (The FK is `ON DELETE RESTRICT`; no app code deletes counters.)

## 10. Security summary

| Object | anon | authenticated | service_role |
|---|---|---|---|
| lookup tables (`sys_*_cd`) | - | SELECT live active rows | ALL |
| `hq_general_config` | - | - (use `fn_tenant_general_value`) | SELECT, INSERT, UPDATE (no DELETE/TRUNCATE) |
| counter tables | - | - | SELECT |
| `fn_doc_seq_next` / `fn_sys_*` / `fn_hq_*` | - | - | EXECUTE |
| `fn_doc_seq_period_key`, `fn_doc_seq_format`, `fn_doc_seq_format_row` | - | EXECUTE | EXECUTE |
| `fn_doc_seq_type_get`, `fn_doc_seq_type_check` | - | - | EXECUTE |
| `fn_doc_seq_next_by_row`, `fn_doc_seq_caller_role`, `fn_doc_seq_assign_code`, `fn_doc_seq_guard_immutable` | - | - | - (owner only; called by the engine and triggers) |
| `vw_doc_seq_consistency`, `fn_doc_seq_consistency_data` | - | - | SELECT / EXECUTE |
| `fn_next_fin_doc_no`, `generate_cash_drawer_sess_no` | - | - (revoked) | EXECUTE |

All SECURITY DEFINER functions pin `search_path = pg_catalog, public, pg_temp`.

## 11. Rollback

Forward-only. Each migration header has a ROLLBACK PLAN (drop in reverse order: 7 → 1). Restoring the dropped defaults on `org_tenants_mst` is in the `hq_general_config` header.

## 12. Busy tables: typed trigger + WHEN guard

The generic `fn_doc_seq_assign_code(doc_type, column)` reads `TG_ARGV`, the config row, and does one `to_jsonb(NEW)` and one `jsonb_populate_record` per row. That is fine for low-volume tables. For busy tables (orders, invoices, payments; P2 ORDER first) write a typed trigger that sets the column directly (template also in the `0670` header):

```sql
CREATE FUNCTION public.fn_<x>_no_assign() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF NEW.<col> IS NULL OR btrim(NEW.<col>) = '' THEN
    NEW.<col> := public.fn_doc_seq_next(NEW.tenant_org_id, '<DOC_TYPE>', now());
  END IF;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.fn_<x>_no_assign() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_<x>_no_assign BEFORE INSERT ON <table>
  FOR EACH ROW EXECUTE FUNCTION public.fn_<x>_no_assign();
CREATE TRIGGER trg_<x>_no_guard BEFORE UPDATE OF <col> ON <table>
  FOR EACH ROW WHEN (OLD.<col> IS DISTINCT FROM NEW.<col>)
  EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('<col>');
```

- `vw_doc_seq_consistency` (`GEN_NO_TRIGGER`) accepts a typed trigger when it is `BEFORE INSERT FOR EACH ROW` and its function text contains the type literal (`'<DOC_TYPE>'`), `NEW.<col>` and a `*doc_seq_next(` call. The guard must stay the generic `fn_doc_seq_guard_immutable('<col>')` (`TRG_GUARD_MISSING`). Keep the names `trg_<x>_no_assign` / `trg_<x>_no_guard`.
- The `WHEN` clause is checked before any PL/pgSQL runs, so updates that do not change the code cost nothing. Use it with the generic guard too.
- The typed trigger saves about 30 µs per insert (section 14).

## 13. Short numbering transactions

The counter row is locked from the increment until the caller's COMMIT. Every other insert for the same tenant, type and period waits for that time.

- Never call HTTP, a queue, e-mail, PDF or any slow work inside the transaction that takes a number. Do it after COMMIT.
- Take the number as late as possible: validate, price and load everything first, then INSERT the document (the trigger takes the number) and commit.
- Do not hold the transaction open across user input or `await` on external services (Prisma `$transaction` with long callbacks counts).
- Use `SET LOCAL lock_timeout` (for example `'5s'`) in long batch jobs so a stuck transaction fails fast instead of queuing every insert.
- A rollback gives the number back (no gap); see section 4.

## 14. Performance (indicative)

Measured 2026-10-30 on a throwaway PostgreSQL 17.5 on the agent box (8-core Xeon, 15 GB RAM, local socket, pgbench 17.11, `synchronous_commit` default). These are **indicative only**: production hardware, network latency and WAL settings differ, and run-to-run noise was about 5-10%. "Before" is the first written `0670`; "after" is the revised one (same signatures, errors and grants; 47 of 48 equivalence cases identical, the other differs only by a random uuid in a message).

Server time per call, including commit (µs):

| Path | Before | After |
|---|---|---|
| `fn_doc_seq_next`, same counter row | 78.9 | 75.3 |
| `fn_doc_seq_next`, 64 tenants | 81.4 | 77.1 |
| `fn_doc_seq_format` (now a wrapper over `fn_doc_seq_format_row`) | 23.5 | 26.5 |
| INSERT, generic trigger | 147.1 | 132.9 |
| INSERT, typed trigger | 108.5 | 103.6 |
| INSERT, code supplied (trigger skips) | 25.3 | 25.4 |

pgbench (tps; avg / p95 latency ms):

| Test | Clients | Before | After |
|---|---|---|---|
| next, different tenants | 1 | 6,624 (0.151 / 0.28) | 6,920 (0.145 / 0.272) |
| next, different tenants | 32 | 37,999 (p95 1.276) | 40,108 (p95 1.204) |
| next, different tenants | 64 | 41,348 (p95 2.272) | 42,748 (p95 2.231) |
| next, same tenant (one hot row) | 8 | 7,673 | 7,726 |
| next, same tenant (one hot row) | 32 | 6,631 (p95 14.9) | 7,160 (p95 13.4) |
| next, same tenant (one hot row) | 64 | 5,100 (p95 38.6, p99 71) | 5,660 (p95 34.8, p99 58) |
| INSERT, generic trigger | 8 / 32 | 19,448 / 23,991 | 20,693 / 26,050 |
| INSERT, typed trigger | 8 / 32 | 23,722 / 30,036 | 25,519 / 29,773 |

- One counter row (one tenant, type and period) serialises: about 5-7k numbers per second on this box, and p95 grows with the number of waiting clients. Different tenants scale with cores.
- Hot counter row after the run: about 4 MB, 0 dead tuples after autovacuum, 97% HOT updates (fillfactor 70; the engine updates only unindexed columns).
- Correctness under load: 32 clients on 4 tenants with 10% random rollbacks for 15 s (about 145k rows): 0 duplicate codes, 0 gaps, counter = max(seq) = row count in every group. A rolled-back number is reused by the next caller.
- `vw_doc_seq_consistency`: about 4.6 ms (was 52 ms before the `0671` revision) with about 6.7k catalog relations.
- `fn_doc_seq_consistency_data()`: about 20 s for a 5M-row GENERAL table (one count scan + one regex scan; most of the time is one regex per row). Run off-peak with a `statement_timeout`.

### 14.1 P2: ORDER on the real insert path (2026-10-30, same box)

Box schema: `0012` `org_orders_mst` + P1 `0666-0672` + `0674`; 15 s pgbench runs. Indicative only (see above).

| Test | Clients | tps | p95 ms |
|---|---|---|---|
| INSERT into `org_orders_mst`, `trg_ord_no_assign` takes the number, many tenants | 8 / 32 | 26,200 / 31,300 | 0.59 / 1.55 |
| `generate_order_number()` then INSERT (app path, one transaction), many tenants | 8 / 32 | 25,500 / 32,900 | — |
| P1 typed-trigger baseline, same session | 8 / 32 | 23,900 / 28,400 | — |
| Same tenant (one hot counter row) | 8 | 7,200 (0 failures) | 3.1 |
| 10% random rollbacks, 4 tenants (trigger path) | see note | 16,700, 0 gaps | — |
| Old `0012` generator (MAX+1 + retry), same tenant | 8 | 659, with duplicate-key aborts | — |

- The rollback run used the P1 setup (4 tenants, 10% `ROLLBACK`); the client count was not recorded with the result.
- After about 1.85M inserted rows: 0 duplicate `order_no`, 0 gaps, counter = max(seq) = row count for every tenant-day.
- `fn_ord_next_sub_order_no`: about 0.5 ms per call with 50 children under one root.
- Seed with `GREATEST`: a pre-existing counter higher than the data max is kept; a lower one is raised to the data max (box test).

## 15. P2 pre-apply checks (run before `0674_ord_order_no_engine.sql`)

All read-only. Run on local first, then remote.

```sql
-- 1. P1 is applied and ORDER is still DOMAIN (expect 1 row, DOMAIN).
SELECT doc_type_code, manage_by_level FROM public.sys_doc_seq_type_cd WHERE doc_type_code = 'ORDER';

-- 2. No ORDER counters yet (expect 0; non-zero is fine, the seed keeps the higher value).
SELECT count(*) FROM public.org_doc_seq_mst WHERE doc_type_code = 'ORDER';

-- 3. Duplicate order numbers inside a tenant (expect 0 rows; fix before applying).
SELECT tenant_org_id, order_no, count(*) FROM public.org_orders_mst
 GROUP BY 1, 2 HAVING count(*) > 1;

-- 4. Non-canonical order numbers (informational: they are kept, not seeded).
SELECT order_no, count(*) FROM public.org_orders_mst
 WHERE order_no !~ '^ORD-[0-9]{8}-[0-9]{4,}(-S[0-9]+)?$' GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

-- 5. Empty order numbers (expect 0; the guard lets the trigger fill them only on INSERT).
SELECT count(*) FROM public.org_orders_mst WHERE order_no IS NULL OR btrim(order_no) = '';

-- 6. Nothing else owns order_no triggers (expect no trg_ord_no_* rows yet).
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.org_orders_mst'::regclass AND NOT tgisinternal ORDER BY 1;

-- 7. Split depth today (expect max depth <= 10).
WITH RECURSIVE t AS (
  SELECT id, 1 AS d FROM public.org_orders_mst WHERE parent_order_id IS NULL
  UNION ALL SELECT o.id, t.d + 1 FROM public.org_orders_mst o JOIN t ON o.parent_order_id = t.id WHERE t.d < 20)
SELECT max(d) FROM t;
```

Apply: the migration takes `SHARE ROW EXCLUSIVE` on `org_orders_mst` with `lock_timeout = 10s` (order creates wait a few
seconds; reads continue). Apply in a quiet minute. After apply:

```sql
SELECT manage_by_level FROM public.sys_doc_seq_type_cd WHERE doc_type_code = 'ORDER';            -- GENERAL
SELECT * FROM public.vw_doc_seq_consistency WHERE doc_type_code = 'ORDER' AND severity = 'ERROR'; -- 0 rows
```

Then run `supabase/tests/ord_order_no_engine_p2.test.sql` (one transaction, ends in ROLLBACK, prints PASS lines).

## 16. P2.1 pre-apply checks, apply and safety test (`0677_ord_root_order_id.sql`, `0678_tenant_hard_delete_guard.sql`)

Plan §5.8.1, decisions A-28..A-31. All checks are read-only. Run on local first, then remote.

```sql
-- 1. PostgreSQL 15 or newer (0677 uses ON DELETE SET NULL (root_order_id)). Expect >= 150000.
SHOW server_version_num;

-- 2. P2 is applied (expect 1 row: fn_ord_next_sub_order_no).
SELECT proname FROM pg_proc WHERE proname = 'fn_ord_next_sub_order_no';

-- 3. Bad split chains (expect 0 rows). The same test the 0677 backfill runs; any row stops the migration
--    with ORD_ROOT_BACKFILL_BAD_CHAIN. Repair parent_order_id of the listed orders first.
WITH RECURSIVE w AS (
  SELECT o.id, o.tenant_org_id, o.parent_order_id AS cur, 1 AS lvl, ARRAY[o.id] AS path
    FROM public.org_orders_mst o WHERE o.parent_order_id IS NOT NULL
  UNION ALL
  SELECT w.id, w.tenant_org_id, p.parent_order_id, w.lvl + 1, w.path || p.id
    FROM w JOIN public.org_orders_mst p ON p.id = w.cur AND p.tenant_org_id = w.tenant_org_id
   WHERE p.parent_order_id IS NOT NULL AND w.lvl <= 10 AND NOT p.id = ANY (w.path)
), last AS (
  SELECT DISTINCT ON (id) id, tenant_org_id, cur AS last_parent, lvl FROM w ORDER BY id, lvl DESC)
SELECT l.id, l.tenant_org_id, l.last_parent, l.lvl
  FROM last l LEFT JOIN public.org_orders_mst r ON r.id = l.last_parent AND r.tenant_org_id = l.tenant_org_id
 WHERE r.id IS NULL OR r.parent_order_id IS NOT NULL;

-- 4. How many sub-orders the backfill will fill (informational).
SELECT count(*) FROM public.org_orders_mst WHERE parent_order_id IS NOT NULL;

-- 5. No tenant uses status 'creating' yet (expect 0) and no NULL status (expect 0; a NULL-status tenant can never
--    be hard-deleted after 0678, which is the intended fail-closed behaviour).
SELECT count(*) FILTER (WHERE status = 'creating') AS creating, count(*) FILTER (WHERE status IS NULL) AS null_status
  FROM public.org_tenants_mst;

-- 6. Nothing else owns these trigger names yet (expect 0 rows).
SELECT tgname FROM pg_trigger
 WHERE tgname IN ('trg_ord_root_guard', 'trg_tenant_hard_delete_guard', 'trg_tenant_truncate_guard',
                  'trg_tenant_status_creating_guard');
```

**Apply and deploy order**

1. Apply `0677_ord_root_order_id.sql` (short `ACCESS EXCLUSIVE` for `ADD COLUMN` + FK validation, `lock_timeout 10s`; apply in a quiet minute). The NOTICE `ORD_ROOT_BACKFILL: n sub-order row(s)` reports the backfill.
2. Apply `0678_tenant_hard_delete_guard.sql` (independent of 0677; triggers + comments only).
3. `db pull` / regenerate Prisma (`root_order_id` on `org_orders_mst`) and the Supabase types in both repos.
4. Deploy web-admin (split service reads `root_order_id`; `registerTenant` uses `creating`) and HQ (`platform-api` 409 guard, `platform-web` status label). The old web-admin split code also works on top of 0677; the old `registerTenant` rollback is refused after 0678 (a failed signup would then leave its row), so deploy it with or soon after 0678.

**After apply**

```sql
SELECT count(*) FROM public.org_orders_mst WHERE parent_order_id IS NOT NULL AND root_order_id IS NULL;  -- 0
SELECT count(*) FROM public.org_orders_mst WHERE parent_order_id IS NULL AND root_order_id IS NOT NULL;  -- 0
SELECT * FROM public.vw_doc_seq_consistency WHERE doc_type_code = 'ORDER' AND severity = 'ERROR';         -- 0 rows
```

**Safety test (risk 1).** `supabase/tests/hfc_p21_split_safety.test.sql` runs a real create → line → split → split-of-split flow and the tenant guard checks in ONE transaction that ends in ROLLBACK (nothing is kept, no number is skipped). Run as postgres with psql, local first:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p21_split_safety.test.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id=<tenant uuid> -f supabase/tests/hfc_p21_split_safety.test.sql
```

Part A prints every trigger on the touched tables (check for unexpected ones), Part B/C print `PASS …` lines or stop at the first `FAIL …`. On a busy remote database run it at a quiet moment (it holds the chosen tenant-day counter row for a few ms). `supabase/tests/ord_order_no_engine_p2.test.sql` T2.6c now detects `root_order_id` and expects `ORD_ROOT_MISMATCH` for re-parenting a root.

**HQ tenant create (P2.2, no migration).** Since 2026-10-31 HQ `platform-api` `TenantsService.create` also inserts `creating`. Order: insert (`creating`) → base currency → UPDATE `creating → <requested status, default trial>` (`.eq('status','creating')`) → best-effort initialization (A-32). A failed currency step or final UPDATE hard-deletes the `creating` row (allowed by 0678, counters removed by the trigger); the final-UPDATE case returns 500 `TENANT_CREATE_FINISH_FAILED`. Deploy: any time after 0678 (already applied); the old HQ code (inserts `trial` directly) also keeps working.

**Tenant stuck in `creating` (risk R13, web-admin signup and HQ create).** If the last signup step (`creating → trial`) fails, web-admin logs `still 'creating'` and the tenant works but stays deletable. On HQ a failed final switch is rolled back; only if that rollback also fails does the row stay `creating` (logged as `Rollback of creating tenant … failed`). Find and fix from HQ (status change to `trial`/`active` is allowed; the detail page shows "Activate") or SQL:

```sql
SELECT id, name, created_at FROM public.org_tenants_mst WHERE status = 'creating' AND created_at < now() - interval '10 minutes';
```

**Edge case: deleted root (G5).** A root order can be deleted only while not committed (0547 guard). Then `fk_ord_root_order` sets `root_order_id` NULL on its sub-orders and `fk_order_parent_order` sets the first-level subs' `parent_order_id` NULL (they become roots). A deeper sub keeps its parent but has no root; splitting under it raises `ORD_ROOT_INCONSISTENT` (web-admin: `NUMBERING_FAILED`). Repair by hand, then split again:

```sql
-- inspect: subs with a parent but no root
SELECT id, order_no, parent_order_id FROM public.org_orders_mst
 WHERE tenant_org_id = $1 AND parent_order_id IS NOT NULL AND root_order_id IS NULL;
```

Repair needs the guard disabled in a reviewed script (root is immutable by design): `ALTER TABLE public.org_orders_mst DISABLE TRIGGER trg_ord_root_guard; UPDATE … SET root_order_id = <new root> WHERE …; ENABLE TRIGGER trg_ord_root_guard;`.

**Escape hatch (tenant data repair only).** Superuser / table owner, in a reviewed script: `ALTER TABLE public.org_tenants_mst DISABLE TRIGGER trg_tenant_hard_delete_guard; …; ENABLE TRIGGER trg_tenant_hard_delete_guard;`. Counters (A-24) must then be handled by the script.

**Error codes**

| Code | SQLSTATE | Meaning | App mapping |
|---|---|---|---|
| `ORD_ROOT_MISMATCH` | 23514 | wrong `root_order_id`, or a root given a root, or re-parenting to another family | split → `NUMBERING_FAILED` |
| `ORD_ROOT_IMMUTABLE` | 23514 | `root_order_id` changed | split → `NUMBERING_FAILED` |
| `ORD_ROOT_NOT_ROOT` | 23514 | the named root is itself a sub-order | split → `NUMBERING_FAILED` |
| `ORD_ROOT_INCONSISTENT` | 22023 | numbering under a sub-order without a root | split → `NUMBERING_FAILED` |
| `ORD_PARENT_NOT_FOUND` | 23503 / P0002 | parent missing or in another tenant | split → `NUMBERING_FAILED` |
| `ORD_ROOT_BACKFILL_BAD_CHAIN` | 23514 | 0677 apply only | fix data, re-apply |
| `TENANT_HARD_DELETE_BLOCKED` | 55000 | delete of a non-`creating` tenant, or TRUNCATE | HQ 409 |
| `TENANT_STATUS_CREATING_INSERT_ONLY` | 55000 | UPDATE to `creating` (HQ also refuses `creating` in a create/update DTO before the DB) | HQ 409 |
| `TENANT_CREATE_FINISH_FAILED` | — (app) | HQ create could not leave `creating`; the row was rolled back | HQ 500 |

## 17. P3 pre-apply checks, apply and safety test (`0682_ord_item_srno_barcode.sql`, `0683_ord_piece_code_human.sql`)

**Applied by the user 2026-10-31 (local + remote).** Kept for reference and for new environments. Choices accepted 2026-10-31: plan A-39.

Written 2026-10-31, updated 2026-10-31 for the tag rules A-35..A-38. Both migrations change only code columns (`order_item_srno`, line `barcode`, `piece_code`, piece `barcode`), the new column `tag_released_at`, and `metadata`. No money column is touched. The recalc triggers are switched off during the backfill, so order totals are not rewritten (A-34).

### 17.1 Apply order

1. Deploy web-admin with the P3 code **first**. It also works on the old schema:
   - new lines get `<order_no>-<n>`. n continues from the highest serial of the order, under the same advisory lock the DB uses;
   - line `barcode` stores the plain serial, not an SVG data URL;
   - batch-update checks **every** piece tag before it saves anything (A-38). Tags are trimmed and upper-cased, use only A-Z 0-9 - _ . /, and are 1..64 characters long. A tag shaped like one of our codes is refused, and so is a tag still held by a live piece of an open order. Errors are 400 `PIECE_TAG_INVALID` / `PIECE_TAG_LOOKS_LIKE_CODE` and 409 `PIECE_TAG_IN_USE` / `PIECE_TAG_DUPLICATE_IN_BATCH`, with `issues[]` and `piecesUpdated: 0`;
   - the piece scan route looks the tag up upper-cased.
2. Run the read-only checks Q-P1..Q-P7 below. Repair (R1..R4) only if a check returns rows. 0683 runs the same tag checks itself. If any fail, it stops before it changes anything, with `ORD_PIECE_PRECHECK: tags need repair, nothing was changed: …`, and lists the count for each check.
3. Apply `0682_ord_item_srno_barcode.sql`, then `0683_ord_piece_code_human.sql`. 0683 refuses to run without 0682. Each takes a table lock with `lock_timeout 10s`, so use a quiet window and retry on timeout. 0683 also adds one trigger on `org_orders_mst`.
4. Regenerate Supabase types (both repos) and Prisma:
   - `piece_code` becomes `String @default("")` instead of `dbgenerated(...)`;
   - new column `tag_released_at DateTime? @db.Timestamptz(6)`;
   - new names: `uq_ord_item_srno`, `ck_ord_item_srno_set`, `ck_ord_item_barcode_val`, `uq_ord_piece_code`, `ck_ord_piece_code_set`, `uq_ord_piece_barcode`, `ck_ord_piece_barcode_fmt`, `ck_ord_piece_barcode_not_code`, and `idx_ord_piece_tenant_barcode` (replaces `idx_order_pieces_barcode`).
5. Run `supabase/tests/hfc_p3_codes_safety.test.sql`. It is rolled back and changes nothing: `psql "$DATABASE_URL" -v tenant_id=<uuid> -f supabase/tests/hfc_p3_codes_safety.test.sql`. Expect A1, A2, B1..B3 and C1..C7 to PASS. C6 covers the tag rules and the release. Also re-run `hfc_p21_split_safety.test.sql` (updated in P3: it now copies the canonical serial).

### 17.2 Read-only checks

Final order = `status` or `current_status`, lower-cased, is `delivered`, `closed` or `cancelled` (the same rule as `fn_ord_tag_releasing_status`). The tag checks look only at live pieces (`deleted_order_change_id IS NULL`). They compare each tag as it will be stored: `upper(btrim(barcode))`.

```sql
-- Q-P1 (0682 R1): lines whose order is missing or in another tenant (must be 0 rows)
SELECT i.tenant_org_id, i.id, i.order_id FROM org_order_items_dtl i
WHERE NOT EXISTS (SELECT 1 FROM org_orders_mst o WHERE o.id = i.order_id AND o.tenant_org_id = i.tenant_org_id);

-- Q-P2 (0682 R2): orders without an order number (must be 0 rows)
SELECT tenant_org_id, id FROM org_orders_mst WHERE order_no IS NULL OR btrim(order_no) = '';

-- Q-P3 (0683): pieces without a line in the same tenant/order, or without piece_seq (must be 0 rows)
SELECT p.tenant_org_id, p.id, p.order_id, p.order_item_id FROM org_order_item_pieces_dtl p
LEFT JOIN org_order_items_dtl i ON i.id = p.order_item_id AND i.tenant_org_id = p.tenant_org_id AND i.order_id = p.order_id
WHERE i.id IS NULL OR p.piece_seq IS NULL;

-- Q-P4 (0683): two pieces of one line with the same piece_seq (would give the same piece code; must be 0 rows)
SELECT tenant_org_id, order_item_id, piece_seq, count(*) FROM org_order_item_pieces_dtl
GROUP BY 1, 2, 3 HAVING count(*) > 1;

-- Q-P5 (0683 R4): live tags with characters outside A-Z 0-9 - _ . / or over 64 characters (must be 0 rows)
SELECT tenant_org_id, id, order_id, barcode, length(btrim(barcode)) AS len
FROM org_order_item_pieces_dtl
WHERE barcode IS NOT NULL AND btrim(barcode) <> '' AND deleted_order_change_id IS NULL
  AND upper(btrim(barcode)) !~ '^[A-Z0-9._/-]{1,64}$';

-- Q-P6 (0683 R4): live tags shaped like one of our codes (must be 0 rows).
-- Same regex as fn_ord_piece_tag_code_re() (created by 0683): any sys_doc_seq_type_cd prefix or type_prefix,
-- plus ORD / ITM / PEC, an optional - _ . /, then a digit. Order, line and piece codes start with ORD-<digit>;
-- staff QR payloads CMX1:... match CMX (and fail Q-P5 because of ':').
WITH re AS (
  SELECT '^(' || string_agg(p, '|' ORDER BY length(p) DESC, p) || ')[-_./]?[0-9]' AS rx
  FROM (SELECT DISTINCT upper(btrim(v)) AS p
          FROM (SELECT unnest(ARRAY[t.prefix, t.type_prefix]) AS v FROM sys_doc_seq_type_cd t
                UNION ALL SELECT unnest(ARRAY['ORD', 'ITM', 'PEC'])) a
         WHERE v IS NOT NULL AND upper(btrim(v)) ~ '^[A-Z0-9]+$') x)
SELECT p.tenant_org_id, p.id, p.order_id, p.barcode
FROM org_order_item_pieces_dtl p, re
WHERE p.barcode IS NOT NULL AND btrim(p.barcode) <> '' AND p.deleted_order_change_id IS NULL
  AND upper(btrim(p.barcode)) ~ re.rx;

-- Q-P7 (0683 R3): the same tag (after trim + upper-case) on two live pieces of open orders in one tenant (must be 0 rows).
-- Pieces of delivered / closed / cancelled orders do not count: 0683 releases their tags (A-35).
SELECT p.tenant_org_id, upper(btrim(p.barcode)) AS tag, count(*),
       array_agg(p.id ORDER BY p.created_at DESC) AS piece_ids_newest_first
FROM org_order_item_pieces_dtl p
JOIN org_orders_mst o ON o.id = p.order_id AND o.tenant_org_id = p.tenant_org_id
WHERE p.barcode IS NOT NULL AND btrim(p.barcode) <> '' AND p.deleted_order_change_id IS NULL
  AND NOT (COALESCE(lower(btrim(o.status)) IN ('delivered','closed','cancelled'), false)
        OR COALESCE(lower(btrim(o.current_status)) IN ('delivered','closed','cancelled'), false))
GROUP BY 1, 2 HAVING count(*) > 1;

-- Info only: what 0682 will renumber (non-canonical or duplicate serials), data: URL barcodes,
-- and how many tags 0683 will normalise or release
SELECT count(*) FILTER (WHERE barcode LIKE 'data:%') AS data_url_barcodes FROM org_order_items_dtl;
SELECT tenant_org_id, order_item_srno, count(*) FROM org_order_items_dtl
WHERE order_item_srno IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY 3 DESC LIMIT 50;
SELECT count(*) FILTER (WHERE barcode <> upper(btrim(barcode))) AS tags_to_normalise
FROM org_order_item_pieces_dtl WHERE barcode IS NOT NULL AND deleted_order_change_id IS NULL;
```

### 17.3 Repairs (only when a check returns rows; always with `tenant_org_id`)

- **R1 (Q-P1):** a line without its order is orphan data. Ask the tenant whether it can be removed. Never move it to another tenant.
- **R2 (Q-P2):** give the order a number through the order-number engine (`fn_doc_seq_next`, see ORDER_NUMBERING.md) inside a transaction, or remove a broken draft.
- **R3 (Q-P7):** for each duplicate tag, keep it on the newest live piece (the first id in `piece_ids_newest_first`). Clear it on the others and keep the old value:
  ```sql
  UPDATE org_order_item_pieces_dtl
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('hfc_p3_cleared_tag', barcode), barcode = NULL
   WHERE tenant_org_id = $1 AND id = ANY($2::uuid[]);   -- the other ids from Q-P7
  ```
- **R4 (Q-P5, Q-P6):** clear a malformed or code-shaped tag the same way: the same `UPDATE` with the ids from Q-P5 / Q-P6. Staff scan a valid tag again later. Do not rewrite the tag by hand into a "close" value, because that could clash with another piece.
- Removed (history) pieces are never checked or changed. Rule 0548 makes them immutable facts.

### 17.4 What changes for callers

- `order_item_srno` is set once and never changes (`trg_ord_item_srno_guard`). A removed (history) line keeps its number, and numbers are never reused. Old non-canonical values that 0682 renumbered are in `metadata.hfc_p3_old_srno`.
- `fn_next_order_item_srno(order, tenant)` now returns `<order_no>-<1 + highest n>` (it returned `001` before). App code takes the same lock: `pg_advisory_xact_lock(hashtextextended('ord_item_srno:' || order_id, 0))` (`lib/services/order-item-code.service.ts`).
- `piece_code` = `<order_item_srno>-<piece_seq>`. It is set by `trg_ord_piece_code_set` on insert (a supplied value is ignored) and is immutable. Never write it from the app.
- Piece `barcode` is the external tag (A-35..A-38):
  - **Format (A-36):** stored trimmed and upper-cased. Blank becomes NULL. Only `A-Z 0-9 - _ . /` are allowed, 1..64 characters (`ck_ord_piece_barcode_fmt`). The DB trigger `trg_ord_piece_tag_rules` normalises the value, so a direct SQL write gets the same rule. 0683 normalised existing live tags and kept the old value in `metadata.hfc_p3_old_barcode`.
  - **Not a code (A-37):** a tag must not start with any `sys_doc_seq_type_cd` prefix / type_prefix (or ORD, ITM, PEC), then an optional `- _ . /` and a digit. This covers order, line and piece codes and `CMX1:` payloads. The trigger raises `PIECE_TAG_LOOKS_LIKE_CODE` (SQLSTATE 23514) on insert or when the tag changes. `ck_ord_piece_barcode_not_code` is a static backstop for ORD / ITM / PEC. Note that the registry has the one-letter prefixes `U` and `Z`, so tags such as `U1` or `Z9` are refused, while `UA1` and `ZONE-1` are allowed.
  - **Unique and freed (A-35):** a tag is unique per tenant among live pieces of open orders (`uq_ord_piece_barcode` … `AND tag_released_at IS NULL`). It is freed when the piece is removed or when its order becomes delivered, closed or cancelled. In that case `trg_ord_piece_tag_release` on `org_orders_mst` sets `tag_released_at`. The old piece keeps the tag for tracing (scan history, `idx_ord_piece_tenant_barcode`). Reopening an order does not take the tag back. Saving the tag again on an open order clears `tag_released_at`, and the unique index then re-checks it (409 if someone else has it now). The app's holder lookup ignores holders on final orders. For a reopened order it is stricter than the DB: it still counts that order's released tags as taken, so the app refuses a tag that the DB would allow.
  - **Batch update (A-38):** every tag is checked first, and nothing is saved if one fails (`issues[]` lists every problem, `piecesUpdated: 0`). Pieces are then saved one at a time. If another user takes a tag at the same moment, the DB index refuses it. The route returns 409 `PIECE_TAG_IN_USE` with `piecesUpdated` (the pieces already saved) and `partial` (true when at least one was saved).
  - Code: `lib/validations/code-format-schemas.ts` (`externalTagSchema`, `looksLikeCode`), `lib/services/piece-code/piece-code.service.ts`, `app/api/v1/orders/[id]/batch-update/route.ts`, `src/features/workflow/lib/piece-tag-error.ts` (EN/AR messages `processing.modal.error.tag*`).
- `vw_doc_seq_consistency` shows `NOT_NULL_MISSING` as WARN for `ORDER_ITEM`. Expected: a CHECK is used instead of NOT NULL so the Prisma create input stays optional.

## 18. P3b scan (app only, no migration)

Written 2026-10-31. Full guide: `SCAN_AND_PIECE_CODES.md`.

- Deploy web-admin; run `npm install` first (new devDependencies `jest-axe@^10`, `@types/jest-axe@^3.5.9`).
- Nothing changes for users until the tenant flag `human_codes_scan_labels` is on (the scan button, `Ctrl+Shift+F` and the page-wide scanner stay hidden). The piece and assembly scanners and the tag checks on piece `PATCH` and `external-tag` work without the flag.
- New limiter `scan-user` (600 per minute per user, A-43) in `lib/middleware/rate-limit.ts`; it fails open without Upstash, like the others.
- **Second slice (2026-10-31, A-41..A-44, still no migration):**
  - Orders search: `GET /api/v1/orders` (and `listOrders` in `lib/db/orders.ts`) take a fast path when the search is a full order / line / piece code: `order_no = <order>` OR `order_no LIKE '<order>-S%'`, always with `tenant_org_id`. Helper `orderNoFromCode` in `code-format-schemas.ts`. Not behind the flag.
  - The orders search box resolves a full code with `POST /api/v1/scan/resolve` and opens the order (`?piece=` for a piece); on a miss it falls back to the list search.
  - `/dashboard/orders/:id?piece=<piece id | piece code>` opens the items tab, expands the line (all lines for an id), opens the piece page, scrolls to the piece and marks it `aria-current`.
  - `AssemblyService.scanItem` falls back to `ScanResolveService` (context `assembly`) after its own barcodes miss (A-42).
  - `CmxDialog`: title / description ids are wired automatically (A-44); tests `__tests__/ui/overlays/cmx-dialog-a11y-name.test.tsx`.
  - Gift-card transaction log rows now carry `order_no` (one extra `org_orders_mst` read, `tenant_org_id` + `id IN`).

## 19. P4 label printing config (`0685_add_settings_label_printing.sql`)

Written 2026-10-31 (plan A-45..A-49). **Applied by the user 2026-10-31** (local + remote; types in both repos and `prisma.schema` regenerated). **Pending follow-ups (not done, recorded 2026-10-31, each needs your OK):** (1) ~~retire `label_printing` flag~~ **`0693` written 2026-11-05 — apply pending**; (2) delete the old `sys_tenant_settings_cd` `LABEL_*` / `RECEIPT_ORDER_CODE128` rows later, only if the `0685` NOTICE reported any; (3) regenerate the platform inventory with `scripts/sync-platform-inventory.mjs`; (4) ~~stray `C:\Users\JHNLP\p4v2code.zip`~~ **deleted 2026-11-05**.

Label printing is available to every tenant; nothing checks the `label_printing` flag any more (A-47).

**What it adds**
- `sys_label_printing_cf`: platform defaults, one row per label type (`ORDER_LABEL`, `PIECE_TAG`, `RECEIPT`). Read-only for tenants (RLS read policy).
- `org_label_printing_cf`: tenant-wide (`branch_id` NULL) and per-branch overrides. Every value column is nullable; NULL = inherit. One row per `(tenant_org_id, label_type, branch_id)` (`UNIQUE NULLS NOT DISTINCT`, so PostgreSQL 15+). RLS on `current_tenant_id()`. Columns that do not apply to a label type must be NULL (CHECK).
- `fn_label_printing_resolve(p_tenant_id, p_branch_id)`: per field branch → tenant → system, with `value_sources` (`BRANCH` / `TENANT` / `SYSTEM` / `FEATURE_FLAG`). The receipt `show_order_barcode` is false while `human_codes_scan_labels` is off for the tenant; the configured value comes back as `show_order_barcode_configured`.
- Nav row `settings_labels` (Settings → Labels & Tags, `/dashboard/settings/labels`, `settings:read`).
- The earlier draft of `0685` (five `sys_tenant_settings_cd` rows `LABEL_*` / `RECEIPT_ORDER_CODE128`) was never applied and is gone. If a copy was ever applied somewhere, the migration prints a NOTICE with the count; those rows are not read by anything and can be removed separately.

**Pre-apply checks (SELECT only)**
```sql
-- 1. The number is still free
SELECT 1 FROM supabase_migrations.schema_migrations WHERE version LIKE '0685%';   -- expect 0 rows
-- 2. PostgreSQL 15+
SHOW server_version;
-- 3. Branch composite key exists (needed by the branch FK)
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.org_branches_mst'::regclass AND contype IN ('p','u');      -- one key on (id, tenant_org_id)
-- 4. 0684 applied (flag the resolver reads)
SELECT flag_key FROM hq_ff_feature_flags_mst WHERE flag_key = 'human_codes_scan_labels';
-- 5. Nothing named like the new objects yet
SELECT to_regclass('public.sys_label_printing_cf'), to_regclass('public.org_label_printing_cf');
-- 6. Old draft settings rows (expect 0)
SELECT setting_code FROM sys_tenant_settings_cd
WHERE setting_code IN ('LABEL_ORDER_SIZE','LABEL_PIECE_TAG_SIZE','LABEL_PIECE_TAG_QR','LABEL_SHOW_CUSTOMER_NAME','RECEIPT_ORDER_CODE128');
```
The migration repeats checks 2, 3 and the needed functions itself (`LABEL_PRINTING_PRECHECK: ...`) and stops without changes if one fails. Adjust check 4 if your flag table name differs.

**Apply (you run these)**
1. Apply `0685` on local, then run the safety test (one transaction, rolled back):
   `psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id=<uuid> -f supabase/tests/hfc_p4_label_settings_safety.test.sql` — every line `PASS`.
2. Apply on remote (same test is safe there).
3. `npm run prisma:pull` (db pull) and Prisma generate in `web-admin`; regenerate the Supabase types in both repos (two new tables, one function).
4. Deploy web-admin with or after `0685` (old P4-draft code would just use built-in defaults, R28). Run `npm install` if `bwip-js` is not installed yet.
5. Check: Settings → Labels & Tags opens for an admin, a tenant-wide change shows on the next printed label, a branch override wins for that branch, "Use default" clears it.

**Code**
- `lib/services/labels/label-printing-config.service.ts` (resolve + admin read/save; an override with all values NULL is deleted), `lib/validations/label-printing-schemas.ts`, `app/api/v1/settings/label-printing/route.ts` (`GET` `settings:read`, `PUT` `settings:update` + CSRF + tenant rate limit).
- `lib/services/labels/label-data.service.ts` reads the resolver (branch of the order) for `GET /api/v1/orders/[id]/label-data`.
- Screen: `app/dashboard/settings/labels/page.tsx`, `src/features/settings/labels/*`, contract in `src/features/settings/access/settings-access.ts`, messages `labelSettings.json` (EN/AR).
- `lib/services/tenant-settings.service.ts` is back to its pre-P4 state (no label settings).
- Rollback: drop `fn_label_printing_resolve`, `org_label_printing_cf`, `sys_label_printing_cf` and the `settings_labels` nav row; web-admin then falls back to built-in defaults.

## 20. P5 store credit notes (`0687_fin_store_credit_note_scn.sql`)

Written 2026-10-31 (plan §5.11, T5.1–T5.3, A-50..A-53 **reviewed + accepted by Jehad Ali 2026-11-05**). **Not applied.** Store credit notes change from `CN-<first 8 chars of tenant id>-<count+1>` (app COUNT, race-prone, leaks part of the tenant id) to the engine: `SCN-<YYYY in the tenant time zone>-<NNNNNN>`, yearly reset, grows past 6 digits. Old `CN-` rows are kept.

**What it adds**
- Config row `STORE_CREDIT_NOTE`: DOMAIN → GENERAL, prefix `SCN`, `YYYY-SEQ`, pad 6, YEARLY.
- `org_credit_notes_mst.credit_note_no`: `DEFAULT ''`, CHECK `ck_fin_cn_no_set` (`btrim(credit_note_no) <> ''`), triggers `trg_fin_cn_no_assign` (fills an empty value) and `trg_fin_cn_no_guard` (number cannot change).
- Counter rows in `org_doc_seq_mst` seeded from any existing `SCN-YYYY-n` rows (normally none).
- No new function, no new table. Supabase types: no change. Prisma: `credit_note_no` gains `@default("")` on the next pull (optional).

**Pre-apply checks (SELECT only)**
```sql
-- 1. The number is still free
SELECT 1 FROM supabase_migrations.schema_migrations WHERE version LIKE '0687%';      -- expect 0 rows
-- 2. Config row still DOMAIN (P1 applied)
SELECT doc_type_code, manage_by_level, prefix FROM sys_doc_seq_type_cd WHERE doc_type_code = 'STORE_CREDIT_NOTE';  -- DOMAIN, CN
-- 3. No empty numbers (the CHECK would fail)
SELECT count(*) FROM org_credit_notes_mst WHERE credit_note_no IS NULL OR btrim(credit_note_no) = '';             -- expect 0
-- 4. No SCN rows yet (if any, the migration seeds the counter from them)
SELECT count(*) FROM org_credit_notes_mst WHERE credit_note_no LIKE 'SCN-%';                                         -- normally 0
-- 5. Unique index present
SELECT indexname FROM pg_indexes WHERE tablename = 'org_credit_notes_mst' AND indexdef ILIKE '%UNIQUE%credit_note_no%';
-- 6. Consistency before (expect 0 ERROR)
SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR';
```
The migration repeats checks 2–5 itself (`FIN_SCN_*` errors) and changes nothing if one fails. It takes a short `SHARE ROW EXCLUSIVE` lock on `org_credit_notes_mst` (reads go on; credit note inserts wait a moment).

**Apply (you run these)** — **`0687` applied by the user 2026-11-01, local + remote.** Still open from this list: the local safety test (1), the consistency check (2), the optional Prisma pull (4) and the web-admin deploy (5).
1. Apply `0687` on local, then run the safety test (one transaction, rolled back):
   `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p5_scn_safety.test.sql` — every line `PASS` (T5.1a–h).
2. `SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR';` → 0 rows.
3. Apply on remote (quiet moment; the lock is short).
4. Optional: `npm run prisma:pull` + Prisma generate in `web-admin` (`@default("")`); types unchanged.
5. Deploy web-admin P5 **after** the apply (A-53). The old code keeps working between the two steps (its `CN-` value is kept).
6. Check (QA S12): issue a goodwill credit note from a customer page → number `SCN-2026-000001`; a refund to store credit → next number.

**Concurrency (box, 2026-10-31):** 20 parallel inserts → 20 distinct numbers 000001–000020, counter 20, no error.

**Code**
- `web-admin/lib/services/stored-value.service.ts`: `creditNoteNoForInsert` (ENGINE → `''`; LEGACY → old generator), `assertCreditNoteNoAssigned` (throws `STORE_CREDIT_NOTE_NO_NOT_ASSIGNED`, so the surrounding transaction rolls back). Used by `issueCreditNoteTx` and `issueCreditNote`; the 7 callers are unchanged.
- `web-admin/lib/constants/doc-seq.ts`: `STORE_CREDIT_NOTE_NUMBERING` (`ENGINE` default), `STORE_CREDIT_NOTE_NUMBERING_MODES`, `STORE_CREDIT_NOTE_NO_NOT_ASSIGNED`.
- Registry of every DOMAIN code: `DOMAIN_CODES_REGISTRY.md`.

**Rollback** (new migration; data untouched): set `STORE_CREDIT_NOTE_NUMBERING = 'LEGACY'` and deploy first, then drop `trg_fin_cn_no_assign`, `trg_fin_cn_no_guard`, `ck_fin_cn_no_set` and the default, and set the config row back to DOMAIN / `CN` / `RAND-SEQ` / 5 / NEVER (exact SQL in the `0687` header). Issued SCN numbers stay valid.

## 21. P6 HQ permissions and deprecated image columns (`0688_hq_doc_seq_permissions.sql`, `0689_ord_label_image_cols_deprecated.sql`)

**What it adds:** 3 rows in `hq_permissions` (`hq_doc_seq:read`, `hq_general_config:read`, `hq_general_config:manage`, EN + AR) and a `DEPRECATED` comment on `org_orders_mst.qr_code` and `org_orders_mst.barcode`. No role grant, no tenant permission, nothing dropped. Details: `PERMISSIONS.md`.

**Read-only pre-checks (expect the shown result):**

```sql
-- 1. The codes are not there yet (0 rows; if any exist, ON CONFLICT keeps them as they are).
SELECT permission_code FROM hq_permissions
 WHERE permission_code IN ('hq_doc_seq:read','hq_general_config:read','hq_general_config:manage');
-- 2. SUPER_ADMIN holds '*' (1 row), so it gets the new codes without a grant.
SELECT role_code, permission_code FROM hq_role_permissions WHERE role_code = 'SUPER_ADMIN' AND permission_code = '*';
-- 3. Both old image columns exist and are empty (2 rows, non_null = 0).
SELECT 'qr_code' AS col, count(qr_code) AS non_null FROM org_orders_mst
UNION ALL SELECT 'barcode', count(barcode) FROM org_orders_mst;
```

**Apply (local first, then remote):** — **`0688` and `0689` applied by the user 2026-11-01, local + remote.** Still open: the local safety test (2).
1. Apply `0688_hq_doc_seq_permissions.sql`, then `0689_ord_label_image_cols_deprecated.sql` (both are safe to run twice).
2. Local only: `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p6_safety.test.sql` → two `P6 PASS` notices (rolled back).
3. Types: no table or column changes, so regenerating types and `prisma.schema` is optional (the comments may show up in the Prisma schema as `///` notes).
4. No deploy is needed for P6. P7 uses the codes.

**Rollback:** `DELETE FROM hq_permissions WHERE created_info = '0688 HFC doc seq permissions' AND permission_code NOT IN (SELECT permission_code FROM hq_role_permissions);` and re-run the two `COMMENT ON` lines from `0012_order_intake_enhancements.sql`.

## 22. APPLY_RUNBOOK — HFC migrations `0687`–`0690`, in order (updated 2026-11-05)

**All HFC migrations are applied through `0697`.** `0687`–`0689` applied 2026-11-01; `0690` applied 2026-11-05 morning; **`0693`, `0695`, `0696`, `0697` applied by the user 2026-11-05 evening** (local + remote). Types and `prisma.schema` regenerated both repos after 0697. Morning deploy covered through `0690`; **evening web-admin deploy still pending**. Non-HFC: `0686`, `0691`, `0692`, `0694`. **Next free: `0698`.** See also [`FINAL_QA_RUNBOOK.md`](./FINAL_QA_RUNBOOK.md). Steps 1–6a DONE for 0687–0690; evening apply/typegen DONE; **next: deploy latest web-admin, smoke (step 7 + FINAL_QA §5), QA / mobile.**

| # | File | Phase | Changes | Deploy needed after? |
|---|------|-------|---------|----------------------|
| 1 | `0687_fin_store_credit_note_scn.sql` (**applied 2026-11-01**) | P5 | SCN trigger + guard + CHECK on `org_credit_notes_mst.credit_note_no`; STORE_CREDIT_NOTE config row → GENERAL / `SCN` | **Yes, web-admin** (apply 0687 **first**, then deploy: the new code sends `''` and needs the trigger) |
| 2 | `0688_hq_doc_seq_permissions.sql` (**applied 2026-11-01**) | P6 | 3 rows in `hq_permissions` | No (P7 uses them) |
| 3 | `0689_ord_label_image_cols_deprecated.sql` (**applied 2026-11-01**) | P6 | COMMENT ON 2 columns | No |
| — | (no migration) | P7 | HQ API modules `doc-seq-config`, `general-config`; HQ screens; wizard prefill | **Deployed 2026-11-05** (§23) |
| — | (no migration) | P8 | Notification sends `order_no`; mobile LTR display + Dart codec; rule text | **web-admin deployed 2026-11-05**; next mobile release still pending (§24) |
| — | (no migration) | P9 | Docs pack, QA guide, report, ADR-004 | No (docs only; §25) |
| 4 | `0690_hq_doc_seq_role_grants.sql` (**applied 2026-11-05**) | P11 | A-54 grants: `hq_doc_seq:read` → `TECH_ADMIN`, `SUPPORT`; `hq_general_config:read` + `:manage` → `TECH_ADMIN`; JSON copy in `hq_roles.permissions` synced (A-71) | Done; affected HQ users may need to sign in again |
| 5–8 | `0693`, `0695`, `0696`, `0697` (**applied 2026-11-05 evening**) | follow-ups | #1 flag retire; #2 settings cleanup; #5 drop order image cols; #11 template `{{credit_note_no}}` | **Types/Prisma DONE**; **deploy latest web-admin PENDING**. Next free: `0698`. Details: [`FINAL_QA_RUNBOOK.md`](./FINAL_QA_RUNBOOK.md) |

**Steps (local DB first, check, then remote):**
1. **DONE (before the 2026-11-01 apply).** **Pre-checks** (read-only SELECTs): §20 (0687, six checks) and §21 (0688/0689, three checks). Stop if a result differs from the expected one.
2. **DONE 2026-11-01 (applied by you, local + remote).** **Apply** in order: `0687` → `0688` → `0689`. `0688`/`0689` are safe to run twice; `0687` refuses a second run on purpose (`FIN_SCN_ALREADY_GENERAL`, nothing changes).
3. **Safety tests (local only, each rolls back)** — still useful after any re-apply; not required to have been reported:
   - `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p5_scn_safety.test.sql` → all `PASS T5.1…` notices.
   - `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p6_safety.test.sql` → two `P6 PASS` notices.
4. **DONE 2026-11-05 (by you).** **Types / Prisma (both repos):** regenerated and `prisma.schema` pulled. Note: `0687` adds a CHECK constraint and triggers, no new column; `0688`/`0689`/`0690` change no table shape. (Was optional.) Path reminder: tenant `npm run supabase:types`, web-admin `prisma:pull` + `prisma:generate`; HQ `platform-api` and `platform-web` `types:generate`.
5. **Apply DONE** — `0687`–`0689` remote on 2026-11-01; `0690` remote on 2026-11-05 (step 6a). (Safety tests stay local-only.)
6. **DONE 2026-11-05 (deployed by you).** **Deploy order** (for the record):
   1. web-admin (P5 code) **after** `0687` is on that database. If the deploy must wait, the old code still works with `0687` (it sends a `CN-…` value, which the trigger keeps).
   2. HQ `platform-api` (P7 modules) **after** `0688` is on that database (the guards need the 3 permission codes), then HQ `platform-web` (P7 screens; it calls the new API routes). Before the HQ deploy run, in each HQ app: `npx tsc --noEmit`, `npx jest`, `npm run build` (and `npm run check:i18n` in `platform-web`).
6a. **DONE 2026-11-05 (applied by you, local + remote; A-71).** `0690_hq_doc_seq_role_grants.sql` (replaces the old manual SQL). It gives `hq_doc_seq:read` → `TECH_ADMIN`, `SUPPORT` and `hq_general_config:read` + `hq_general_config:manage` → `TECH_ADMIN`, in `hq_role_permissions` and in the `hq_roles.permissions` JSON. `SUPER_ADMIN` is not touched (`*`). Safe to run twice (second run prints "already has …" NOTICEs); a missing role is skipped with a NOTICE. If you already ran the old manual 6a SQL, `0690` only prints NOTICEs.
   - Pre-check (read-only): `SELECT code FROM hq_permissions WHERE code IN ('hq_doc_seq:read','hq_general_config:read','hq_general_config:manage');` → 3 rows (from `0688`).
   - Safety test (local only, rolls back): `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p11_role_grants_safety.test.sql` → `PASS: hfc_p11_role_grants_safety`.
   - Users of those roles may need to sign in again so their HQ token picks up the codes.
   - Rollback: `DELETE FROM hq_role_permissions WHERE created_info = '0690 HFC doc seq role grants';` then remove the codes from those roles in HQ → Roles (or from `hq_roles.permissions`).
6b. **Mobile (P8):** build and release the customer app as usual (`mobile_core` changed; no config). 
7. **Smoke test:** issue one store credit note in web-admin → number looks like `SCN-2026-000001`; `SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR'` → 0 rows. HQ (P7, as SUPER_ADMIN): open Data → Code Types (list loads, a GENERAL type shows a preview), Data → Code Consistency (0 errors), Settings → General Config (values show; edit one support field and save; save again from an old tab → 409 "Load latest"); start "Create tenant" → country/currency/time zone match General Config. P8: move a test order to the next status with notifications on → the message shows `ORD-…`, not a UUID; in the customer app (Arabic) the order number reads left-to-right.

**Rollback:** per file, in reverse order: step 6a (`0690`), §21 (0689, 0688), then §20 (0687: set `STORE_CREDIT_NOTE_NUMBERING = 'LEGACY'` and deploy first).

## 23. P7 HQ API and screens (no migration, 2026-10-31)

**A-75 (2026-11-06):** Frontend module routes moved to `/doc-seq-config` (hub / types / consistency). Sidebar section **SaaS Backoffice Admin- HQ**. API paths unchanged.

**Status:** written 2026-10-31; **DEPLOYED 2026-11-05** (`platform-api` + `platform-web`). Decisions A-57..A-63 (plan §20, **reviewed + accepted by Jehad Ali 2026-11-05**).

### 23.1 API (`platform-api`, global prefix `/api/hq/v1`)

| Method + route | Permission | What it does |
|----------------|------------|--------------|
| `GET doc-seq/types?page&pageSize&q&level&active&scope&module&subSystem&category` | `hq_doc_seq:read` | Paged list of `sys_doc_seq_type_cd` (page from 1, pageSize ≤ 100, default 25) |
| `GET doc-seq/types/:code` | `hq_doc_seq:read` | One type with its format, reset policy, `implement_description` and its own consistency rows |
| `GET doc-seq/types/:code/preview?at&tz&fyStart` | `hq_doc_seq:read` | Sample code for a GENERAL type (formatter only, no counter touched); 422 `NOT_GENERAL` for other types, 400 `BAD_TIMEZONE` |
| `GET doc-seq/consistency?includeData&severity&refresh` | `hq_doc_seq:read` | Schema checks (`vw_doc_seq_consistency`) + data checks; cached 60 s per process, `refresh=true` at most once per 10 s (429) |
| `GET general-config` | `hq_general_config:read` | The single `hq_general_config` row with lookup names and `version` |
| `GET general-config/options` | `hq_general_config:read` | Currency, country and language lists for the edit form |
| `PATCH general-config` | `hq_general_config:manage` | Body = changed fields + `version`; 409 `STALE_CONFIG` if the row changed; 422 `BAD_TIMEZONE` / `BAD_LOOKUP`; 400 on a CHECK failure; audit row with old → new of changed fields |

Files: `src/modules/doc-seq-config/*` (controller, service, consistency service, repository, DTOs, types, 3 specs) and `src/modules/general-config/*` (controller, service, repository, DTOs, types, specs); both registered in `src/app.module.ts`.

### 23.2 Screens (`platform-web`)

| Route | Sidebar | Feature folder |
|-------|---------|----------------|
| `/doc-seq-config` (hub) + `/doc-seq-config/types` | SaaS Backoffice Admin- HQ → Doc Seq Config / Code Types | `src/features/doc-seq` (`doc-seq-types-screen.tsx`, `doc-seq-type-dialog.tsx`) |
| `/doc-seq-config/consistency` | SaaS Backoffice Admin- HQ → Code Consistency | `src/features/doc-seq` (`doc-seq-consistency-screen.tsx`) |
| `/settings/general-config` | SaaS Backoffice Admin- HQ → General Config | `src/features/general-config` (`general-config-screen.tsx`, `general-config-edit-dialog.tsx`) |

- Shared: `CmxCodeChip` (`src/ui/data-display/cmx-code-chip.tsx`, exported from `@ui/data-display`): `<bdi dir="ltr">` monospace, copy button with toast, kinds `order|item|piece|tag|doc`.
- Data: `src/features/*/api` (apiClient), `hooks` (TanStack Query), `model` (types + pure helpers `toGeneralConfigForm`, `diffGeneralConfig`).
- i18n: `messages/{en,ar}/docSeq.json`, `generalConfig.json`, `layout.json` (`sections.saasBackofficeAdminHq`, `routes.docSeqConfig|docSeqTypes|docSeqConsistency|generalConfig|systemCatalogsCodes`); catalog regenerated (`npm run i18n:generate`).
- Wizard prefill (A-13 / A-62): `src/features/tenants/hooks/use-tenant-creation-wizard.ts` → `applyPlatformDefaults` (exported, unit-tested).

### 23.3 Tests run (2026-10-31, Windows)

- platform-api: `npx jest src/modules/doc-seq-config src/modules/general-config` → 5 suites, 42 tests pass; `tsc` no error in the new files; eslint 0 errors.
- platform-web: `npx jest __tests__/ui/cmx-code-chip.test.tsx __tests__/features/doc-seq-general-config.test.ts` → 2 suites, 7 tests pass; `npx tsc --noEmit` 0 errors; eslint 0 errors (JSDoc warnings only); `npm run check:i18n` passes.
- Not run: `next build` (do it before deploy), `jest-axe` checks (A-63: install first).

### 23.4 Rollback

Code only: redeploy the previous `platform-api` / `platform-web` build. Nothing in the database changes.

### 23.5 Doc-seq console redesign (A-76..A-83, 2026-11-06, no migration)

**New API routes** (all `hq_doc_seq:read` unless noted; global prefix `/api/hq/v1`):

| Method + route | What it does |
|----------------|--------------|
| `GET doc-seq/stats` | Hub numbers: types by scope / level / reset / module, active vs inactive, counter rows (tenant / HQ / SYS), tenants with counters, last counter activity, filter facets. Cached 60 s per process. |
| `GET doc-seq/counters?scope&tenantId&docType&periodKey&sort&dir&page&pageSize` | Read-only counters. `scope` = `TENANT_ORG` (default, `org_doc_seq_mst`), `HQ` (`hq_doc_seq_mst`), `SYS` (`sys_doc_seq_mst`) — fixed table map, never from input. `pageSize` ≤ 50. Each row: tenant name, type name, `periodKey`, `isCurrentPeriod` (from `fn_doc_seq_period_key` with the tenant time zone / fiscal start, HQ fallback — the same rule as `fn_doc_seq_next_by_row`), `nextValue` and `nextPreview` (`fn_doc_seq_format`, read only) for the current period of GENERAL types. |
| `GET doc-seq/counters/tenants?docType&q` | Tenants that have counters (optionally for one type) with row count, type count, last activity. Cached 60 s; scans at most 20,000 counter rows (`approximate: true` when capped). |
| `GET doc-seq/types` (changed) | New `reset` filter (`NEVER` = no restart) and server sort `sort=displayOrder|code|name|module|level|reset|scope` + `dir=asc|desc` (whitelisted; `code` tie-breaker). |
| `GET general-config/history?limit` (`hq_general_config:read`) | Last ≤ 50 saved changes from `hq_audit_logs` (`resource_type='hq_general_config'`, `action='general_config.update'`), each with field-level old → new and the editor name (`hq_users` name / email only). |
| `GET general-config` (changed) | Adds `updatedByName`. |

Files: `doc-seq-config/doc-seq-counters.service.ts` (new), repository / service / controller / DTOs / types updated; specs `doc-seq-counters.service.spec.ts` (new) and controller spec. `general-config` repository / service / controller / DTO / types + spec.

**Screens** (`platform-web`, all under `app/doc-seq-config/layout.tsx` = `CmxDashboardShell`):

| Route | Screen | Notes |
|-------|--------|-------|
| `/doc-seq-config` | `doc-seq-hub-screen.tsx` | Health banner (links to Consistency), 8 KPI cards, distribution by generator / scope / restart (each links to a filtered Types list), quick links that show disabled with the missing permission. |
| `/doc-seq-config/types` | `doc-seq-types-screen.tsx` | URL filters `q, level, scope, module, reset, status, sort, dir, page, size`; server sort; CSV; row → detail. |
| `/doc-seq-config/types/[code]` | `doc-seq-type-detail-screen.tsx` | Tabs in `?tab=` overview / preview / counters / checks. |
| `/doc-seq-config/counters` | `doc-seq-counters-screen.tsx` | URL filters `scope, tenantId, docType, period, sort, dir, page, size`; CSV. Read only. |
| `/doc-seq-config/consistency` | `doc-seq-consistency-screen.tsx` | One issue list; URL filters `q, severity, source, ok`; CSV + JSON. |
| `/settings/general-config` | `general-config-screen.tsx`, `general-config-edit-dialog.tsx`, `general-config-value.tsx` | Validation, review step, discard guard, history. |

Building blocks: `src/features/doc-seq/ui/doc-seq-shared.tsx`, `hooks/use-url-filters.ts` (URL is user-editable: every screen validates what it reads with `lib/doc-seq-search.ts`), `hooks/use-debounced-value.ts`, `lib/doc-seq-csv.ts` (formula-injection safe, BOM for Arabic in Excel), `lib/doc-seq-issues.ts`, `lib/doc-seq-format.ts`; shared `CmxBreadcrumbs`. i18n: `messages/{en,ar}/docSeqConsole.json`, `docSeqChecks.json` (one entry per check code: title / meaning / fix — **add an entry here when you add a check to `vw_doc_seq_consistency`**), new keys in `generalConfig.json`, `layout.json` `routes.docSeqCounters`.

**Counters are never edited from HQ.** Correcting a counter that is behind (`DATA_COUNTER_BEHIND`) stays a reviewed migration; an audited "move forward only" endpoint is proposal P-1 (plan §20), not built.

**Tests (2026-11-06):** box + Windows — platform-api `jest src/modules/doc-seq-config src/modules/general-config` (6 suites, 57 tests on Windows); platform-web `__tests__/features/doc-seq-*` + `__tests__/lib/i18n` + `__tests__/ui` (151 tests incl. jest-axe on every screen in data / empty / error / no-access states); `tsc --noEmit` 0 errors; eslint 0 errors; `npm run check:i18n` pass.

**Rollback:** redeploy the previous `platform-api` / `platform-web`. No database change.

## 24. P8 clients, notifications and rules (no migration, 2026-10-31)

**Status:** written 2026-10-31; **web-admin DEPLOYED 2026-11-05**; next mobile release still pending. Decisions A-64..A-67 (plan §20, **reviewed + accepted by Jehad Ali 2026-11-05**).

### 24.1 Mobile (`cmx_mobile_apps`)

- `packages/mobile_core/lib/src/human_codes.dart` (exported from `mobile_core.dart`): 1:1 copy of web-admin `lib/validations/code-format-schemas.ts` + `lib/services/scan-resolve/cmx-code-payload.ts`. API: `orderNoRe`, `itemSrnoRe`, `pieceCodeRe`, `cmxPayloadPrefixRe`, `scanRawMaxLength` (128), `CodeKind`, `toAsciiDigits`, `normalizeScanInput`, `classifyCode`, `isOrderNo`, `isPieceCode`, `orderNoFromCode`, `encodeCmxPayload`, `decodeCmxPayload` (`CmxPayloadDecodeResult` with `CmxPayloadDecodeError`), `ltrCode`.
- **Keep the copies in sync:** a change to a code format or the `CMX1:` payload must be made in web-admin **and** in `human_codes.dart` in the same change; `packages/mobile_core/test/human_codes_test.dart` mirrors the web-admin cases.
- Display: `Text(ltrCode(order.orderNumber))` (customer order card, order detail title). `ltrCode` adds invisible LRI/PDI marks: use it for display only, never for storage, comparison or API calls.
- P11 (A-73, 2026-11-01): `customer_order_booking_screen.dart` success message now uses `ltrCode(booking.submittedOrderNumber ?? '')`.
- Tests: `flutter test --no-pub packages/mobile_core/test/human_codes_test.dart` (7), `flutter test --no-pub apps/customer_app/test/orders` (2), `flutter analyze --no-pub` on the changed files (no issues).

### 24.2 cmx-api

N/A today (auth + health only). When an orders or scan module is added: copy the two web-admin helpers above, look orders up by `order_no`, never return the UUID as the user-facing number.

### 24.3 Notifications

- `web-admin/app/api/v1/orders/[id]/transition/route.ts`: `findOrderNo(tenantId, orderId)` reads `order_no` (tenant-filtered) and fills `{{order_number}}`; on a read error it falls back to the id, so the transition response is never affected.
- Test: `web-admin/__tests__/api/v1/orders-transition.route.test.ts` (5 tests incl. the 2 new ones).
- Checked clean: templates seeded in `0346` / `0382`, `lib/.../order-event-variables.ts`. No credit-note message is emitted yet. P11 (A-74): `lib/notifications/credit-note-variables.ts` builds `credit_note_no` (+ `invoice_number` alias for the seeded `0382` text, `amount`, `currency`) for the future `credit_note.issued` emit.

### 24.4 Rules

HFC-RULE blocks (between `HFC-RULE:BEGIN` / `HFC-RULE:END`) refreshed in: tenant `.cursor/rules/databaseconventions.mdc`, `.claude/skills/database/{SKILL,conventions}.md`, `.codex/docs/database_conventions.md`, `.codex/skills/database/{SKILL,conventions}.md`; HQ `.cursor/rules/rulesfromclaudejh.mdc`, `.claude/skills/{database,create-db-table}/SKILL.md`, `.codex/docs/database_conventions.md`, `.codex/skills/{database,create-db-table}/SKILL.md`. `CLAUDE.md` / `AGENTS.md` pointers unchanged.

### 24.5 Deploy and rollback

Deploy web-admin (any time; no migration needed for this fix). Mobile: ships with the next app release. Rollback: redeploy the previous build; nothing in the database changes.

## 25. P9 close-out (no migration, 2026-10-31)

- **Migrations:** P9 adds none. P11 adds `0690` (**applied 2026-11-05**). HFC files applied through `0697` (`0693`/`0695`/`0696`/`0697` on 2026-11-05 evening); the **next free number is `0698`** (`0680`, `0681`, `0686`, and `0691_speed_pricing_nav_audit.sql` are not HFC files).
- **Docs:** the full pack, `QA_TEST_GUIDE.md` (S1–S20) and `IMPLEMENTATION_REPORT.md` are in this folder; HQ has ADR-004 (`docs/Dev/ADRs/`, **Accepted** 2026-11-05).
- **Shims (A-68):** `order-number-generator.ts`, `barcode-generator.ts` and the `STORE_CREDIT_NOTE_NUMBERING` `LEGACY` fallback are kept.
- **Your steps:** §22 apply + deploy **done through `0690` and the web/HQ deploys (2026-11-05)**; next: smoke test (step 7), mobile release (6b), then `QA_TEST_GUIDE.md` and the perf checks.

### 25.1 Follow-ups that need your approval
(Updated 2026-11-05: A-50..A-74 **reviewed + accepted by Jehad Ali** on assistant expert recommendation. P11 items marked DONE were done in code earlier.) **Approval sheet (risk + recommend):** [`FOLLOWUPS_APPROVAL.md`](./FOLLOWUPS_APPROVAL.md) — reply with item numbers to approve; nothing on that sheet is done until you do.
1. ~~Retire the `label_printing` flag (A-47).~~ **APPLIED 2026-11-05** — `0693` local + remote; types/Prisma regenerated. Safety `hfc_f1_...` report still useful.
2. ~~Delete old LABEL_* / RECEIPT_ORDER_CODE128 settings.~~ **APPLIED 2026-11-05** — `0695` local + remote. Safety `hfc_f2_...` report pending.
3. ~~Sync platform inventory.~~ **DONE 2026-11-05** — `web-admin/scripts/sync-platform-inventory.mjs` (local copy).
4. ~~Delete the stray `C:\Users\JHNLP\p4v2code.zip`.~~ **DONE 2026-11-05** (Jehad Ali OK Now; 87,089 bytes deleted).
5. ~~Drop order qr_code/barcode.~~ **APPLIED 2026-11-05** — `0696` local + remote; types/Prisma regenerated. Safety `hfc_f5_...` report pending.
6. ~~Remove LEGACY fallback.~~ **DONE 2026-11-05** (code).
7. ~~barcode-generator.~~ **DELETED 2026-11-05**. `order-number-generator` **kept** (still used by `order-service.ts`).
8. ~~Apply the A-54 HQ role grants (§22 step 6a).~~ **DONE — `0690` applied by you 2026-11-05 (A-71).**
9. ~~Install `jest-axe` in `platform-web` (A-63).~~ **DONE 2026-11-05** (`jest-axe@^10.0.0` + `@types/jest-axe@^3.5.9`; no jest-axe-consuming HQ tests existed yet).
10. ~~Use `ltrCode` on the mobile booking screen (A-64).~~ **DONE (P11, A-73).**
11. ~~Emit credit_note.issued + template.~~ **MIG APPLIED 2026-11-05** (`0697`). Emit code wired; **deploy + test-tenant verify still open** before prod messages.
12. Run QA S1–S20 and the perf checks (T9.1, T9.2).
13. ~~Review A-50..A-74.~~ **DONE 2026-11-05** — reviewed + accepted by Jehad Ali (expert recommendation); record in [`FOLLOWUPS_APPROVAL.md`](./FOLLOWUPS_APPROVAL.md) #13. ~~ADR-004 Proposed → Accepted~~ **DONE 2026-11-05** (#13a).
14. ~~P10 start.~~ **RUNBOOK 2026-11-05** — `P10_BACKFILL_RUNBOOK.md` (suppliers already have code+unique; rewrite blocked on live samples).
15. ~~(P11) Fix failing customer-app booking step-two test.~~ **DONE 2026-11-05** — stale expects (`Packing preferences` → l10n `Packing`; selection summary → `FilterChip.selected`). `flutter test …customer_order_booking_screen_test.dart` 2/2 pass.
