# Operations Catalog — Operator and Developer Guide (P2)

**Screen:** HQ platform-web → sidebar **Operations → Operations Catalog** (`/ops/operations`)
**Plan:** [PLAN.md](./PLAN.md) §2.C · **Migration:** `supabase/migrations/0611_ops_operations_catalog.sql` (CREATED, NOT APPLIED until you apply it)
**Last updated:** 2026-10-14

## 1. What it is

A curated list of operator operations. Each entry shows its **exact SQL**, a description and step-by-step guidance. It replaces hand-delivered SQL snippets. It is **not** a SQL console: you can never type or submit SQL.

| Mode | What you can do |
|---|---|
| `RUN_IN_UI` | Fill the parameters and press **Run now**. The stored statement runs with your values bound as parameters. |
| `COPY_ONLY` | Press **Copy**, run the text yourself where it belongs (for example the CLI), follow the guidance. |
| `GUIDE_ONLY` | Follow the guidance (hosting env vars, Resend/Twilio consoles). Nothing to run. |

## 2. How to use it

1. Open the screen (needs `hq_ops:read`). Filter by module, risk or mode, or search.
2. Select an operation: the right panel shows the description, the SQL, parameters, verify SQL and guidance.
3. Fill the parameters (typed form: uuid, whole number, yes/no, text, date-time). Required fields are marked.
4. Press **Run now** (needs `hq_ops:run_operations`):
   - **READ** runs immediately.
   - **WRITE** asks for confirmation first.
   - **DESTRUCTIVE** asks you to type the exact confirmation phrase (needs `hq_ops:run_destructive` in addition).
5. The result table shows up to 200 rows plus the real row count. A failed statement shows the database message (it is not reported as success).
6. **History** lists every attempt (success, failure, rejected) with the parameter values and the operator.

Without `hq_ops:run_operations` the screen is read-only: you can read everything, run nothing.

## 3. Risk tiers

| Risk | Meaning | Gate |
|---|---|---|
| `READ` | Query only. Runs inside a sub-transaction with `transaction_read_only = on` that is always rolled back, so even a faulty statement cannot persist a change. | `hq_ops:run_operations` |
| `WRITE` | Changes data. Must end in `RETURNING` so the result shows the affected rows. | `hq_ops:run_operations` + confirm dialog |
| `DESTRUCTIVE` | Deletes data. Has a `confirm_phrase` that must be typed exactly. | `hq_ops:run_operations` + `hq_ops:run_destructive` + typed phrase |

The destructive permission is enforced by the API **even when the global RBAC enforcement flag (`HQ_RBAC_ENFORCEMENT_ENABLED`) is off**.

## 4. Safety guarantees

- The API has no field that accepts SQL (`forbidNonWhitelisted` rejects `sql`, `command`, `query`). The caller sends only: operation **code**, parameter values, confirmation phrase.
- `fn_ops_operation_run` looks the operation up **by code**, refuses anything that is not `RUN_IN_UI`, validates every parameter against `param_schema` (unknown, missing and malformed values are rejected, uuid/int/bool/timestamp are cast-checked) and executes the **stored** statement with `EXECUTE ... USING` bound values. Caller text is never concatenated into SQL. The function never raises: it returns `{ok, code, message, ...}`.
- **No DDL and no migrations can be run from the UI.** Table CHECK constraints enforce: `manage_via = MIGRATION` requires `COPY_ONLY`/`GUIDE_ONLY`; runnable SQL may not contain `CREATE/ALTER/DROP/TRUNCATE/GRANT/REVOKE`, a `;`, or comments, and must start with `SELECT/WITH/INSERT/UPDATE/DELETE`; READ SQL may not contain write keywords.
- **Tenant isolation:** any runnable SQL that references an `org_*` table must set `requires_tenant`, which forces a required `uuid` parameter named `tenant_org_id` and a visible `tenant_org_id` reference in the SQL (CHECK constraints). All seeded SQL filters `tenant_org_id` explicitly.
- Results are capped at 200 returned rows (`truncated` is reported); a 30 s statement timeout applies.
- Every attempt is logged in `sys_ops_operation_run_dtl` (truncated, sanitised parameters; no parameter type can carry a secret) and every execution is audited through the HQ `AuditService` (`ops_operation.run`, risk, parameters, outcome).
- Tables are platform-global `sys_*`, RLS enabled, no client policies, `REVOKE` from `anon`/`authenticated`; functions are `SECURITY DEFINER` with a pinned `search_path`, `EXECUTE` for `service_role` only.

## 5. Seeded catalog (0611)

| Code | Risk / mode | Purpose |
|---|---|---|
| `ntf.outbox_status_summary` | READ / run | Outbox counts by status and channel for one tenant |
| `ntf.dispatch_log_recent` | READ / run | Recent `hq_ntf_dispatch_log` evidence for one tenant |
| `ntf.retention_preview` | READ / run | What `ntf-retention-sweep` would purge for one tenant (default 180 days) |
| `ops.cron_last_runs` | READ / run | Every pg_cron job with its last run |
| `ntf.pilot_test_message` | WRITE / run | Queue one WhatsApp/SMS pilot test row (status `QUEUED`, fixed past `scheduled_at`) |
| `ntf.set_dispatch_via_hq` | WRITE / run | Set `metadata.dispatch_via_hq` on an existing `org_ntf_settings_cf` row |
| `ntf.delete_pilot_rows` | DESTRUCTIVE / run | Delete unprocessed `A1_PILOT_TEST` outbox rows of one tenant (phrase `DELETE PILOT ROWS`) |
| `ops.apply_migration` | COPY_ONLY | Command and safe order for applying a migration |
| `ops.set_hq_env_vars` | GUIDE_ONLY | Notification env vars for platform-api / web-admin |
| `ntf.resend_webhook_setup` | GUIDE_ONLY | Resend webhook + signing secret |
| `ntf.twilio_account_verify` | GUIDE_ONLY | Twilio prerequisites and HQ account verification |

## 6. Adding an operation (developer procedure)

Operations are added **only by a migration** (never from the UI/API). Create a new migration (next free sequence number; never edit 0611) that inserts into `public.sys_ops_operation_cf`, idempotently (`ON CONFLICT (operation_code) DO NOTHING`). Do not apply it yourself: create the file, stop, and ask for review (CLAUDE.md rule #3).

Authoring rules for `RUN_IN_UI` SQL:

1. **One statement**, no `;`, no `--` or `/* */`, no DDL/privilege keywords.
2. Placeholders are `$1..$n` in `param_schema` order (max 6). Every placeholder is bound as **TEXT**, so cast explicitly: `$1::uuid`, `$2::int`, `$3::boolean`, `$4::timestamp`.
3. Write/destructive statements **must** end in `RETURNING` (the row count and result table come from it).
4. Touching an `org_*` table: set `requires_tenant = true`, declare `{"name":"tenant_org_id","type":"uuid","required":true,...}` and filter `tenant_org_id = $n::uuid` in **every** `org_*` table of the statement (including sub-selects and joins).
5. Optional parameters arrive as `NULL`: use `COALESCE($n::int, default)`.
6. `DESTRUCTIVE` rows need a `confirm_phrase` (at least 3 characters). Prefer narrow `WHERE` clauses and `NOT EXISTS` guards for immutable evidence tables.
7. Provide EN + AR `title/title2`, `description/description2`, `guidance_md/guidance_md2` (tiny markdown: paragraphs, `- ` bullets, `1. ` steps, `**bold**`, `` `code` ``).
8. **Validate against the live schema** (remote DB, read-only) before writing: column names, types, NOT NULL columns without defaults (for example `org_ntf_outbox_dtl.idempotency_key`). `EXPLAIN` a copy of the statement with literals to prove it parses and plans without running it.
9. New permissions or nav entries still follow CLAUDE.md rules #10/#11.

`param_schema` entry: `{"name","type":"text|uuid|int|bool|timestamp","required":true|false,"label","label2","description"}`.

Use `manage_via` to say where the real change happens (`UI`, `HOSTING_ENV`, `EXTERNAL_CONSOLE`, `MIGRATION`, `GIT`). `MIGRATION` can never be `RUN_IN_UI`.

## 7. Permissions

| Code | Grants |
|---|---|
| `hq_ops:read` (0610) | See the catalog, SQL, guidance and history |
| `hq_ops:run_operations` (0611) | Run `READ` and `WRITE` operations |
| `hq_ops:run_destructive` (0611) | Additionally run `DESTRUCTIVE` operations |

SUPER_ADMIN already holds `*`. Assign the others on the HQ roles screen. No maker/checker rule: the permission is the only gate.

## 8. API

| Method and path | Permission |
|---|---|
| `GET /ops/operations?module=&risk=&exec_mode=` | `hq_ops:read` |
| `GET /ops/operations/:code` | `hq_ops:read` |
| `GET /ops/operations/:code/runs?limit=` | `hq_ops:read` |
| `POST /ops/operations/:code/run` body `{params, confirm?}` | `hq_ops:run_operations` (+ `hq_ops:run_destructive` for DESTRUCTIVE) |

## 9. Known limits

- Until 0611 is applied the screen shows its load-error state (the RPC does not exist).
- The platform-api repository uses a narrow typed bridge until DB types are regenerated after 0611.
- The READ read-only guard relies on rolling back a sub-transaction; this behaviour was reasoned from PostgreSQL semantics and the `set_config` call was probed read-only, but the full function can only be exercised after the migration is applied.
- Guidance is rendered with a tiny built-in markdown subset (no links/tables).
