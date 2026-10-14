# Config Registry — Operator and Developer Guide (P4)

**Status:** CREATED, migration `0612_ops_config_registry.sql` **NOT APPLIED**. API and screen are built and tested against mocks; nothing here has run against a real database yet.
**Screen:** HQ `/ops/config` (sidebar: Operations → Configuration Registry). **API:** `GET/PUT/PATCH/DELETE/POST /ops/config…` in HQ platform-api module `ops-config`.
**Permissions:** `hq_ops:read` (view), `hq_ops:manage_config` (plain keys, Check now), `hq_ops:manage_secrets` (secret or encrypted keys). SUPER_ADMIN already holds `*`.

## 1. What it is

An inventory of configuration keys (environment variables and settings) with, per key:

| Field | Meaning |
|---|---|
| `source_policy` | Where the live value may come from (section 2). Column default is `DB_ONLY`. |
| `env_var_name` | The environment variable that carries the key on its host. |
| `is_secret` / `is_encrypted` | `is_secret` implies `is_encrypted` (database CHECK). Encrypted values are stored only as an AES-256-GCM envelope and are **write-only**. A non-secret key may still be encrypted. |
| `is_bootstrap` | Needed before the database is reachable. Forced `ENV_ONLY`, never stored (CHECK). |
| `is_wired` | `true` only once application code reads the key through `ConfigResolverService`. While `false`, a value stored here is **not consumed** by anything. |
| `manage_via` | `UI`, `HOSTING_ENV`, `EXTERNAL_CONSOLE`, `MIGRATION`, `GIT`. Non-UI keys show a guidance panel (EN/AR). |
| `applies_to_app` | `PLATFORM_API`, `PLATFORM_WORKERS`, `TENANT_WEB`, `ALL`. |

Tables: `sys_ops_config_cf` (registry) and `sys_ops_config_chg_log` (history: action, actor, **fingerprints only**).

## 2. Source policies

| Policy | Live value | Notes |
|---|---|---|
| `DB_ONLY` | The stored value. Environment ignored. | Default for new keys. Switching to it requires a stored value. |
| `ENV_ONLY` | The environment variable. | The registry holds no value (CHECK). Switching to it discards any stored value and needs explicit confirmation. |
| `BOTH_MUST_MATCH` | The value when env and stored value are equal; otherwise **refused** (`ConfigSourceMismatchError`, no value in the message). | Requires a stored value. Compared by SHA-256, so it works for encrypted values without decrypting for the comparison. |
| `ENV_OVERRIDES_DB` | Env when set, else the stored value. | Today's behaviour for existing keys. **Every seeded key that already works as env-wins uses this**, so applying 0612 changes no behaviour. |

Seeded key defaults: bootstrap keys `ENV_ONLY`; everything else `ENV_OVERRIDES_DB`. Converting a key to `DB_ONLY` is a deliberate per-key decision (section 7).

## 3. Bootstrap limits (honest)

Never storable here: database URL, Supabase URL/keys/JWT secret, `HQ_ENCRYPTION_MASTER_KEY`, `JWT_SECRET`, the inter-app service keys (`HQ_SERVICE_ROLE_KEY`, `NTF_HQ_SERVICE_ROLE_KEY`), `REDIS_URL`. They are needed before the database or the master key is available, so they stay in the hosting environment. The API (`BOOTSTRAP_KEY` → HTTP 409) and the database both refuse to set, clear or re-policy them. Rotate them in the hosting provider and restart.

`HQ_SERVICE_ROLE_KEY` (HQ side) and `NTF_HQ_SERVICE_ROLE_KEY` (tenant side) must be equal; the registry cannot compare them because each lives in a different host environment.

## 4. Secrets handling

- HQ platform-api encrypts with the existing `EncryptionService` (AES-256-GCM, versioned envelope, master key `HQ_ENCRYPTION_MASTER_KEY` read from the environment only). The database receives ciphertext plus a SHA-256 fingerprint and never sees the master key.
- Nothing returns a secret: `fn_ops_config_list` omits ciphertext and fingerprints and returns `db_value` only for plain non-secret rows; the API echoes metadata only. `fn_ops_config_get_raw` (ciphertext, fingerprint) is service-role-only and used in-process by the resolver and the check; its output never reaches a controller response or a log.
- Audit and history carry a fingerprint (audit: first 12 hex chars; history table: full digest), never a value or ciphertext. Errors never echo a submitted value.
- Values are trimmed before fingerprinting/storing; the environment value is trimmed the same way, so a stray newline cannot cause a false mismatch.
- Residual risks: a fingerprint of a low-entropy value (a short flag, a phone number) can be guessed offline. This is acceptable for non-secrets (they are shown anyway) and for high-entropy secrets; do not store a low-entropy secret. Rotating `HQ_ENCRYPTION_MASTER_KEY` makes every stored envelope undecryptable until values are re-entered (no re-encryption tool exists yet).
- Do not paste a secret into chat, tickets or a repository file; type it into the write-only field.

## 5. "Check now" and its limit

`POST /ops/config/check` reports, per key: set / not set in the **HQ platform-api process environment**, set / not set in the database, and for `BOTH_MUST_MATCH` MATCH / MISMATCH from fingerprints. Statuses: `OK`, `MISSING`, `MATCH`, `MISMATCH`, `UNCHECKABLE`, persisted to `last_check_status`.

**One process cannot read another host's environment.** Keys that read their environment on another app (`TENANT_WEB`, `PLATFORM_WORKERS`) and need it (every policy except `DB_ONLY`) are reported `UNCHECKABLE`. Real cross-host agreement needs each app to report its own environment (an HQ→tenant call or a heartbeat). That does not exist yet.

## 6. Adding a key through a migration

1. Look up the next migration number (list `supabase/migrations/`) and create a **new** file; never edit an existing one.
2. Insert the row idempotently: `INSERT INTO public.sys_ops_config_cf (...) VALUES (...) ON CONFLICT (config_key) DO NOTHING;`
   - `config_key`: lowercase dotted, at most 120 chars (`^[a-z0-9_]+(\.[a-z0-9_]+)*$`).
   - Secrets: `is_secret = true`, `is_encrypted = true`, `value_type = 'SECRET_STRING'`.
   - `source_policy`: `ENV_OVERRIDES_DB` for a key that already works as env-wins; `ENV_ONLY` + `is_bootstrap = true` + `manage_via = 'HOSTING_ENV'` for bootstrap keys. Anything except `DB_ONLY` needs `env_var_name`.
   - `is_wired = false` until the consuming code is converted; set `requires_restart = true` until then.
   - Provide EN and AR `name`, `description`, `guidance`, `guidance2` for any key not managed from the UI.
   - Never put a value in the migration. Values are entered through the screen.
3. Document every column with `COMMENT ON` per the migration standards.
4. Create the file, **stop**, and have the owner review and apply it.

## 7. Per-key conversion checklist

Convert one key at a time: replace the direct read with `ConfigResolverService.resolve(key, { envFallback: '<ENV_NAME>' })`, flip `is_wired` in a new migration, add a test for the call site, and only then (optionally) change the policy in the UI.

The resolver (`modules/ops-config/config-resolver.service.ts`): short TTL cache (45 s, stale served on a read failure), decrypts in-process only, falls back to `envFallback` when the key is not registered or the registry cannot be read (so a converted call site keeps working before 0612 is applied), refuses `BOTH_MUST_MATCH` disagreement without leaking a value.

**Converted (R6, 2026-10-14; migration `0615` flips `is_wired`):** every HQ platform-api call site below reads its key through `ConfigResolverService` via `resolveConfigValue(resolver, key, ENV_NAME)` (`modules/ops-config/config-resolve.util.ts`). Under the seeded `ENV_OVERRIDES_DB` policy behaviour is unchanged while the environment variable is set. A registry refusal (`BOTH_MUST_MATCH` mismatch, undecryptable value) fails closed: providers return `PROVIDER_NOT_CONFIGURED`, webhook signature checks return invalid, the queue flag falls back to direct dispatch, FCM treats the key as unset. Caller-supplied (tenant BYO) credentials never consult the registry. Without a resolver in the Nest context the legacy env read applies (trimmed; empty = not set).

| Key | Call site |
|---|---|
| `ntf.hq.resend.api_key`, `ntf.hq.resend.from_email` | `EmailResendProvider`; sender-verify uses the key via `ProviderAccountsService`; `HqPasswordMailer` no longer pre-checks the env |
| `ntf.hq.twilio.account_sid` / `auth_token` | `SmsTwilioProvider`, `WhatsAppMetaProvider.sendViaTwilio`, `TwilioContentImporterService.resolveCredentials` (now async), `WebhooksService` (auth token) |
| `ntf.hq.twilio.sms_from` / `whatsapp_from` | `SmsTwilioProvider`, `WhatsAppMetaProvider`, `RouteDispatchService` |
| `ntf.hq.twilio.webhook_url` | `WebhooksService` signature verification |
| `ntf.hq.twilio.content_cred_ref` / `content_cred_ver` | `TwilioContentImporterService.resolveCredentials` (security gate: an operator with `hq_ops:manage_config` can now change the approved credential reference; env still wins under the default policy) |
| `ntf.hq.meta.app_secret` / `wa_access_token` / `wa_phone_number_id` | `WebhooksService`, `WhatsAppMetaProvider.sendViaMeta` |
| `ntf.hq.fcm.server_key` | `PushHqProvider.sendFcm` |
| `ntf.hq.queue_enabled` | `DispatchService.isQueueEnabled()` — evaluated per request, so a change takes effect within 45 s without a restart |

Tests: `dispatch/__tests__/config-registry-wiring.spec.ts`, `email-resend.resolver.spec.ts`, `config-resolve.util.spec.ts`.

**Bootstrap keys** (`HQ_ENCRYPTION_MASTER_KEY`, `HQ_SERVICE_ROLE_KEY`, `JWT_SECRET`, database/Supabase settings, `HQ_RBAC_ENFORCEMENT_ENABLED` and similar): never convert.

**Registry v2 (owner decisions 2026-10-15; migrations `0615` schema, `0617` data):**

1. **The registry is the single authority.** The tenant app flags that lived in `sys_ntf_runtime_cf` are copied into the registry by `0617` (inside the database, with fingerprints and change-log rows). After every reader (tenant `lib/notifications/config.ts`, HQ governance, Setup Health) and the HQ Runtime Config screen have been switched, `sys_ntf_runtime_cf` is dropped in a later migration. Until then both exist; do not edit the old one.
2. **Encryption is a per-key choice, never implied by `is_secret`.** `is_encrypted` defaults to `false` (plain text) for every key. `is_secret` only means write-only (never shown, logged or audited; needs `hq_ops:manage_secrets`). `0615` drops `ck_sys_ops_config_cf_secenc` and flips every seeded key that holds no value to plain. Switch a key with `fn_ops_config_set_encryption` only while it has no stored value. **Consequence:** a plain secret is readable by anyone with database or backup access, and any app holding the service role (the tenant app) can read it through `fn_ops_config_get_raw`. For HQ-only secrets, tick "encrypted" before storing the value.
3. **`applies_to_app` is a JSONB list** `[{"app":"TENANT_WEB","is_still_used":true}]`. Suggested apps: `HQ_API`, `HQ_WEB`, `HQ_WORKERS`, `TENANT_WEB`, `TENANT_API`, `MARKETING_WEB`, `CUSTOMER_MOBILE_APP`, `DATABASE`. The vocabulary is open (shape-checked only). `is_still_used = false` marks a variable that is declared in env files but no code reads.
4. **`env_var_scope_val` (JSONB) + `env_var_value`** record where the variable lives: one object per scope `{scope, env_var_name, is_it_there: yes|no|unknown, value, fingerprint, description, is_still_used}`. `value` exists only for non-secret keys (database CHECK); secrets record presence and a 12-hex fingerprint. `env_var_value` is a representative non-secret value. Both are informational; the live value is always decided by `source_policy`.
5. **Six source policies:** `DB_ONLY`, `ENV_ONLY`, `ENV_OVERRIDES_DB` (env, else stored), `DB_OVERRIDES_ENV` (stored, else env), `BOTH_MUST_MATCH`, `TAKE_EXISTING_DB_OR_ENV` (whichever exists; stored wins; Check now reports `DRIFT` when both exist and differ). New check status `DRIFT`.

**Re-seed (`0617`)** completes the 50 seeded keys and registers 86 more, found by reading the code and every `.env*` file of both repositories (names only). Excluded on purpose: test/dev tooling (`E2E_*`, `TEST_*`, `PLAYWRIGHT_BASE_URL`, `LOCAL_REST_*`, `COMPOSE_PROJECT_NAME`, `REMOTE_DATABASE_URL`, `SERVICE_USER_ID_REMOTE`, `SUPABASE_DB_PASSWORD`, `ENV_FILE`, `AUTH_TOKEN`) and host-injected variables (`NODE_ENV`, `VERCEL`, `RENDER_EXTERNAL_URL`). Variables declared in env files that no code reads are registered with `is_still_used = false`. The generated key↔variable map is `config_key_env_map.json`.

**Loading environment values (never a migration):** `node scripts/ops/seed-config-from-env.mjs --env TENANT_WEB=<file> --env HQ_API=<file> ... --out supabase/seeds/local/<name>.sql` reads the env files you name and writes a git-ignored SQL file for ONE database (`--dry-run` prints counts only). It stores plain values only for keys whose policy allows one (never bootstrap or ENV_ONLY keys), secrets only with `--include-secrets` (as plain text, per the owner decision), and records presence/fingerprints in `env_var_scope_val`. Choose the files matching the target database (local vs cloud profiles).

**Tenant app (R6b, after `0615`/`0617` are applied and types regenerated):** a tenant resolver in web-admin reads the registry through `fn_ops_config_get_raw(p_key, p_app => 'TENANT_WEB')` with the same policy matrix and cache as the HQ resolver; `lib/notifications/config.ts` and the tenant secrets (Twilio, Resend, Meta, VAPID, OneSignal, FCM, webhook secrets) are then read through it. Plain-stored tenant secrets need no HQ master key, which removes the earlier blocker.
**`ntf.app.outbox_secret` (pg_cron bearer) — migration `0616`:** the secret moves from plain text in `sys_ntf_runtime_cf` to Supabase Vault (`ntf_outbox_secret`). Cron wrappers call `fn_ntf_cron_post`, which reads it inside the database. The plain-text row is deleted. The old value is committed in migration `0355`: treat it as burned and rotate with `SELECT public.fn_ntf_rotate_outbox_secret('<new 32+ char value>')`, then set the same value as `NOTIFICATIONS_OUTBOX_SECRET` on the tenant host and redeploy. Migration `0616` also repairs `ntf-reconcile-outbox`, which read non-persistable GUCs and was a silent no-op.

## 8. Operator steps once 0612 is applied

1. Open Operations → Configuration Registry. Every key should show; bootstrap and `ENV_ONLY` keys say "Environment only".
2. Press **Check now**. `UNCHECKABLE` is expected for tenant-app keys.
3. Safe first exercise: edit `ntf.hq.resend.from_email` (plain). While `HQ_RESEND_FROM_EMAIL` is set in the HQ environment it still wins (the dialog warns); change its policy to `DB_ONLY` only after storing the value, if you want the screen to be authoritative.
4. Anything marked "Not wired yet": storing a value is safe but has no effect until that key is converted.

## 9. Not verified yet

- The migration has been syntax-parsed only (114 statements, pglast), never run. Function behaviour (policy matrix inside the database, `fn_ops_config_set` shape rules, `record_check` with the CHECK vocabulary) is unexecuted; the same rules are mirrored and unit-tested in the API.
- DB types for both apps were not regenerated; the repository uses a narrow typed bridge (as in P1).
- The screen has not been opened in a browser against a live API.
- The `hq_ops:manage_config` / `hq_ops:manage_secrets` permissions exist only after 0612 is applied.
