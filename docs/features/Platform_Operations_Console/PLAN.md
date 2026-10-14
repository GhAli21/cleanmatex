# Platform Operations Console (HQ) — Plan

**Status:** Decisions in §7 answered 2026-10-14; **P0–P4 all built and verified 2026-10-14** (migrations 0610/0611/0612 applied to both DBs; no migration for P3). See [STATUS.md](./STATUS.md) for evidence and the open list — none of the four ops screens has been browser-tested yet, and only one config key has been converted to the resolver.
**Date:** 2026-10-14 · **Origin:** user request after the Notification Hub go-live checklist ([15_operator_go_live_checklist.md](../Notification_And_Communication_Hub/Setup_And_Config/15_operator_go_live_checklist.md)) — "I want everything to be done from screens/UIs."
**Owner repos:** HQ UI + API in `cleanmatexsaas` (platform-web / platform-api); **all migrations in `cleanmatex`** (created-not-applied, user applies). Platform-wide by design, rolled out Notification-Hub-first.

## 1. Problem (grounded in the live database, 2026-10-14)

- 17 `pg_cron` jobs exist across modules `ntf`, `fin`, `auth`, housekeeping; **7 are inactive** (3 `ntf-*`, 4 `fin-*`) and `ntf-outbox-processor` runs every 30 min instead of the tracked 1 min — **nobody could see this** without querying `cron.job`. Drift lives outside any tracked migration.
- `cleanup-cron-job-run-details` truncates `cron.job_run_details` every 14 days, so run history is short-lived.
- Config is split: tenant `sys_ntf_runtime_cf` (key/value, env override wins), HQ `process.env` reads, no inventory of required variables, no way to see "is X set / do both apps agree".
- Operator-only SQL and external-console steps (Resend/Twilio dashboards, hosting env) exist only as prose in docs.

## 2. Capabilities (maps 1:1 to the user's four points)

### A. Job Registry + Manager
- **Tables (new, `sys_*`):** `sys_ops_job_cf` (job_code, name/name2, description/description2, category, module/sub_system, kind `PG_CRON` (v1) | `BULLMQ` | `HTTP`, `cron_job_name`, default_schedule, schedule, desired_enabled, run_now_allowed, owner_note, source_migration, standard audit cols) and `sys_ops_job_run_dtl` (own durable run log: started/finished, status, message, trigger = SCHEDULE|MANUAL, actor) — durable because `job_run_details` is wiped every 14 days.
- **Screen:** list with module/category filters; per job: desired vs **actual** state (`cron.job`), **drift badge**, schedule edit (validated cron expression), enable/disable, **Run now**, last real status (from `cron.job_run_details` + own log), full description.
- **Safety:** UI edits only `schedule`, `desired_enabled`, notes — **never the SQL command** (commands are seeded by migrations only). All changes go through `SECURITY DEFINER` functions (`fn_ops_job_set_state`, `fn_ops_job_run_now`, pinned `search_path`, service_role only) that wrap `cron.alter_job`; every action audited. A reconcile read shows drift instead of silently "fixing" it.
- **Seed:** the 17 existing jobs with real descriptions. Convention going forward: any migration that schedules a job also registers it.

### B. Config Registry (replaces ad-hoc env var knowledge)
- **Table:** `sys_ops_config_cf` — config_key, module, description, value_type, `is_secret`, `source_policy` ∈ `DB_ONLY` (**default**) | `ENV_ONLY` | `BOTH_MUST_MATCH` | `ENV_OVERRIDES_DB` (today's behaviour, for compatibility), `env_var_name`, `db_value` (plain) / `db_value_enc` (secret envelope), `is_bootstrap`, `requires_restart`, validation rule, `manage_via` (see D), guidance, last-check result.
- **One resolver** (`resolveConfig(key)`) in each app honouring the policy, short TTL cache, replacing scattered `process.env` / `getRuntimeString` reads **key by key** (notification keys first — incl. `NTF_HQ_*`, `HQ_TWILIO_*`, `RESEND_*`).
- **Never displayed:** secret values. UI shows set/not-set, last-updated, and for `BOTH_MUST_MATCH` only a **match/mismatch** result computed from hashes.
- **Honest limits:** (1) *Bootstrap* values can never live in the DB (DB URL, Supabase keys, `HQ_ENCRYPTION_MASTER_KEY` — chicken-and-egg); they stay `ENV_ONLY` + guidance. (2) A process cannot read another host's env: "do both agree" requires each app to report its own env presence/hash (HQ→tenant S2S call, or heartbeat).

### C. Guided Operations Catalog (**not** a free SQL console)
- **Tables:** `sys_ops_operation_cf` (code, title, description, module, category, **risk** `READ|WRITE|DESTRUCTIVE`, `sql_text` shown verbatim, typed parameter schema, `exec_mode` `RUN_IN_UI | COPY_ONLY | GUIDE_ONLY`, `verify_sql`, guidance_md) and `sys_ops_operation_run_dtl` (who/when/params/outcome).
- **Screen:** shows the **exact SQL + description + guidance**; buttons **Run now** (only `RUN_IN_UI`) or **Copy** with step-by-step instructions. READ ops run directly; WRITE needs confirm; DESTRUCTIVE needs typed confirmation phrase.
- **Hard rules:** parameters are bound, never concatenated; execution only through a whitelisted function by `operation_code` (the UI can't submit SQL text); **no DDL / no migrations from the UI** (CLAUDE.md rule #3 — those stay "copy + guide"); arbitrary SQL may only be *displayed* (COPY_ONLY), never executed.
- **Seed:** every SQL snippet handed to the operator so far (cron fixes, WhatsApp/SMS pilot test insert with parameters, `hq_ntf_dispatch_log` evidence query, tenant opt-in metadata, retention check).

### D. Setup Health + "can't do it here" guidance
- Every config/job/operation row carries `manage_via` ∈ `UI | HOSTING_ENV | EXTERNAL_CONSOLE (Resend/Twilio) | MIGRATION | GIT` + `guidance_md` + link. Each Notification Hub HQ screen gets a **Setup guidance** panel for anything not UI-manageable.
- New **Setup Health** page aggregates read-only checks: required config set/matching, jobs drift, accounts verified, template bindings complete, webhook secret set + test event received, routes active per tenant. Replaces most of the manual checklist with green/red items, each linking to its fix.

## 3. Security & governance
- New HQ permissions (migration-seeded, `resource:action`): `hq_ops:read`, `hq_ops:manage_jobs`, `hq_ops:run_operations`, `hq_ops:manage_config`, `hq_ops:manage_secrets`. Destructive/secret actions on separate permissions (no maker≠checker rule — permission is the only gate).
- Every mutation audited with actor, before/after (secrets: hash/fingerprint only). Secrets: AES-GCM envelope via existing HQ `EncryptionService`, **write-only** (never read back), master key stays env-only.
- Tenant isolation: registries are platform-global `sys_*` (no tenant data); any operation touching `org_*` must declare and bind `tenant_org_id` as a required parameter.

## 4. Risks (called out up front)
1. **Secrets in DB** widen blast radius of a DB leak → mitigated by envelope encryption + env-only master key; bootstrap secrets excluded.
2. **Resolver rollout touches every config read** → incremental per key, tests per key, `ENV_OVERRIDES_DB` keeps old behaviour until a key is migrated. *Default `DB_ONLY` conflicts with today's "env wins" semantics, so each key is converted deliberately, not flipped globally.*
3. **Running operations from a browser against production** → curated catalog, risk tiers, confirmations, audit; no free SQL.
4. **`cron.alter_job` privilege** on Supabase must be confirmed (function owner / `postgres` role) before P1 is declared feasible.
5. **Run-now for HTTP-trigger jobs** depends on runtime config (`app.*` GUCs / `sys_ntf_runtime_cf`) being set — Run now must report "prerequisite missing", not a vague failure.
6. Registry can itself drift from reality → show drift, never auto-heal silently.

## 5. Phasing (each phase: tests, EN/AR i18n, docs, STATUS, migrations created-not-applied)
| Phase | Scope | Why this order |
|---|---|---|
| P0 | Permissions migration, audit hooks, shared registry conventions | Foundation for all |
| P1 | **Job Registry + Manager** (seed 17 jobs) | Highest value, lowest risk; immediately exposes the 7 inactive jobs / schedule drift |
| P2 | Operations catalog — READ ops first, then WRITE/DESTRUCTIVE | Replaces hand-delivered SQL |
| P3 | Setup Health + guidance panels on NTF screens | Aggregates P1–P2 data |
| P4 | Config Registry + resolver, notification keys first, then platform-wide | Largest blast radius → last, once the console and audit exist |

## 6. Out of scope
Editing job SQL from the UI; free-form SQL execution; applying migrations from the UI; storing bootstrap secrets in the DB; tenant-facing (non-HQ) ops screens.

## 7. Decisions (answered by the user 2026-10-14)
1. **Secrets:** each config row carries its own boolean **`is_encrypted`** (user's design). Rule layered on top: `is_secret = true` ⇒ `is_encrypted` must be true (DB CHECK); non-secret rows may be plain or encrypted. Encrypted values are write-only (never displayed/read back); master key and bootstrap values stay env-only. *(Applies in P4; P1 has no config rows.)*
2. **SQL:** curated catalog — run-now / copy-only / guide-only. No free-form SQL console.
3. **Scope:** platform-wide registry, Notification Hub first.
4. **First phase:** P1 Job Manager — **approved to build.**

Risk 4 update: `cron.alter_job` privilege is **confirmed workable** — the `postgres` role changed a pg_cron job via the Supabase SQL path earlier in this program; a `SECURITY DEFINER` function owned by the migration owner will carry the same privilege.
