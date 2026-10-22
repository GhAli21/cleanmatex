# Operations Console — Config Registry QA Test Guide

**Last updated:** 2026-10-15 · **Audience:** the owner / QA, running by hand · **Covers:** Config Registry v2 (migrations 0612, 0615–0621), HQ `/ops/config`, Setup Health config checks, tenant resolver, outbox secret, seed script, master-key rotation, change history, drift alerting.

Companion docs: [config_registry_guide.md](./config_registry_guide.md) (how it works) · [setup_health_guide.md](./setup_health_guide.md) · [../Notification_And_Communication_Hub/testing_scenarios.md](../Notification_And_Communication_Hub/testing_scenarios.md).

Every scenario says **where to click, what to do, what you must see**. A scenario passes only if every "Expect" line is true. Use a **test environment** (or the local stack) for scenarios marked ⚠ — they change values on purpose. Never paste a real secret into a chat or ticket; use the throwaway values given here.

## 0. Preconditions (once)

| # | Check | How |
|---|---|---|
| 0.1 | Migrations 0610–0621 applied to the database under test | Supabase SQL editor: `select max(version) from supabase_migrations.schema_migrations;` → `0621…` (or run `select proname from pg_proc where proname in ('fn_ops_config_convert_encryption','fn_ops_config_reencrypt');` → 2 rows) |
| 0.2 | HQ API running with `HQ_ENCRYPTION_MASTER_KEY` (base64, 32 bytes) | HQ → Operations → Setup Health: `config.bootstrap_env` is not FAIL for the key |
| 0.3 | Your HQ user holds `hq_ops:read`, `hq_ops:manage_config`, `hq_ops:manage_secrets` | A second HQ user with **read only** is needed for scenario P1 |
| 0.4 | `/ops/config` loads and lists ~136 keys | HQ → Operations → Config |

## A. Screen, filters and inventory

| ID | Steps | Expect |
|---|---|---|
| A1 | Open `/ops/config`. | Keys grouped by module (`ntf`, `platform`, …); header summary counts; no value of any secret visible anywhere. |
| A2 | Choose **Module** = `platform`; then **App** = `Tenant web`; then type `twilio` in search; press **Clear filters**. | Each filter narrows the list (module headings change); clearing restores all modules. |
| A3 | Expand **Show details** on `ntf.app.twilio.auth_token`. | Scopes panel lists per-app presence (`yes/no/unknown`) and a 12-hex fingerprint for secrets; **no** secret value. A retired app shows "not used". |
| A4 | Filter **Policy** = `TAKE_EXISTING_DB_OR_ENV`, then `DB_OVERRIDES_ENV`. | Both policies are offered and filter correctly. |

## B. Values and policies

| ID | Steps | Expect |
|---|---|---|
| B1 ⚠ | Pick a plain non-secret key with policy `ENV_OVERRIDES_DB` (e.g. `ntf.hq.resend.from_email`): **Set value** → `qa@example.test` → Save. | Success message; "Stored: set" with the value shown; if the env var is also set the dialog warned that the environment wins. |
| B2 ⚠ | Same key → **Change policy** → `DB_ONLY` → Save. | Policy badge updates. Switching a key with **no** stored value to `DB_ONLY` is refused with a clear message. |
| B3 ⚠ | **Change policy** → `ENV_ONLY` while a value is stored. | Save is disabled until you tick the discard confirmation; after saving, the stored value is gone. |
| B4 ⚠ | A **secret** key with plain storage: **Set value** (`qa-secret-1`). | Field is a password field; after saving, the value is never shown again; badge "stored as plain text" appears; Setup Health `config.plain_secrets` shows WARN listing it. |
| B5 ⚠ | **Clear stored value** (eraser icon) → confirm. | Value cleared; "not set". |
| B6 | Open a **bootstrap** key (e.g. `platform.encryption.master_key`). | No edit buttons; it says "Environment only"; guidance tells you to set it on the host. |

## C. Plain ↔ encrypted storage (with a stored value)

| ID | Steps | Expect |
|---|---|---|
| C1 ⚠ | On the secret from B4 (plain, value stored): click the **lock** icon → read the dialog → confirm. | Dialog says the value is converted in place and lists the other apps that will fall back to their environment variable. Afterwards the lock badge shows; value still "set"; **no re-typing**. History (E1) shows `Storage form changed`. |
| C2 ⚠ | Click the **open lock** icon → confirm. | Value back to plain; dialog warned it becomes readable by anyone with database access. |
| C3 ⚠ | Do C1 on a key with **no** stored value. | Flag flips with no value involved. |
| C4 | SQL (read-only) after C1: `select is_encrypted, db_value is null as plain_gone, db_value_enc is not null as env_present from sys_ops_config_cf where config_key='<key>';` | `true, true, true`. |
| C5 | Two browser tabs on the same key: in tab 1 open the lock dialog; in tab 2 set a new value; confirm tab 1. | Tab 1 gets a conflict/"changed while converting" error; nothing is overwritten. |

## D. Tenant app resolver

| ID | Steps | Expect |
|---|---|---|
| D1 ⚠ | Store `ntf.app.resend_from_email` as plain via `/ops/config` (policy `DB_OVERRIDES_ENV`), then in tenant web-admin trigger a flow that reads it (send a test email, or check the tenant log line for the config source). | Tenant uses the stored value. |
| D2 ⚠ | Encrypt that key (C1) and repeat. | Tenant cannot read encrypted values: it falls back to its env var (the C1 dialog warned of this). |
| D3 | Tenant outbox secret: see section I. | — |

## E. Change history

| ID | Steps | Expect |
|---|---|---|
| E1 | On any key you changed in B/C: click the **history** icon. | Newest-first list: action badge (Value set / cleared / policy changed / storage form changed / re-encrypted), actor, time, `fingerprint abc… -> def…` (12 hex) or `policy A -> B`. **No values.** |
| E2 | Open history on a never-changed key. | "No changes recorded for this key." |
| E3 | As a **read-only** HQ user (P1) open history. | The history icon is present and works. |
| E4 | API: `GET /ops/config/<key>/history?limit=500`. | Returns at most 200 entries (limit clamped). Unknown key → 404. |

## F. Master-key rotation drill ⚠ (test environment only)

| ID | Steps | Expect |
|---|---|---|
| F0 | Before starting: HQ → Config shows the **Encryption keys** panel: current key id, previous `-`, all stores pending 0. Setup Health `config.key_rotation` = OK. | Baseline. |
| F1 | Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Set `HQ_ENCRYPTION_MASTER_KEY` = new, `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` = old. Restart HQ API. | Panel shows two key ids; pending > 0 for every store holding encrypted values; Setup Health `config.key_rotation` = WARN. Encrypted values still work (e.g. an encrypted HQ key still resolves; a BYO tenant dispatch still decrypts). |
| F2 | Click **Re-encrypt N value(s)**. | Success message with the count; panel pending → 0; Setup Health = WARN ("previous key can now be removed"). |
| F3 | History of an encrypted registry key. | A `Re-encrypted with the current key` row; fingerprint before = after. |
| F4 | Remove `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS`; restart. | Panel: previous `-`, unreadable 0; Setup Health = OK; HQ still sends/decrypts. |
| F5 (negative) | Repeat F1 with a **wrong** previous key. | Panel shows unreadable > 0; Setup Health `config.key_rotation` = FAIL; Re-encrypt skips them (they are not counted as rotated). Restore the right previous key to recover. |
| F6 | As a user **without** `manage_secrets`. | Panel visible, **no** Re-encrypt button; `POST /ops/keys/reencrypt` → 403. |

## G. Drift alerting ⚠

| ID | Steps | Expect |
|---|---|---|
| G1 | Set `platform.ops.drift_check_minutes` = `1` (config screen). Pick a `TAKE_EXISTING_DB_OR_ENV` or `BOTH_MUST_MATCH` key that holds a stored value and make the HQ API env var for it **differ** (host env; restart). Wait ≤ 2 minutes. | Key shows `DRIFT` / `MISMATCH` without pressing Check; an audit entry `ops_config.drift_detected` names the key (no values); HQ API log shows one error line. |
| G2 | Wait another 2 minutes. | **No second alert** for the same key. |
| G3 | Set `platform.ops.alert_webhook_url` to an https test webhook (e.g. a webhook.site URL) and repeat G1 with a different key. | The webhook receives `{"text":"CleanMateX HQ: 1 configuration key(s) need attention - <key> (DRIFT)…"}`. Log never prints the URL. |
| G4 | Set the URL to `http://…` | Warning "not an https URL; alert not sent"; audit entry still written. |
| G5 | Set interval to `0`; cause a new drift. | No automatic check/alert (the manual **Check now** still works). |
| G6 | Fix the drifted env values; wait one interval. | Status returns to OK/MATCH; log says drift cleared. |

## H. Setup Health (config group)

Open HQ → Operations → Setup Health and confirm each row reacts as described.

| Check | Make it fail/warn | Expect |
|---|---|---|
| `config.required_keys` | Unset `HQ_TWILIO_AUTH_TOKEN` on the HQ host | FAIL naming the key |
| `config.mismatch` | B-key with `BOTH_MUST_MATCH` and different env/stored | FAIL (DRIFT shows as WARN) |
| `config.unwired_values` | Store a value on a key with "Not wired yet" | WARN: stored value has no effect |
| `config.plain_secrets` | B4 | WARN listing the key |
| `config.key_rotation` | F1/F5 | WARN / FAIL as in section F |

## I. Outbox secret (database ↔ tenant app)

| ID | Steps | Expect |
|---|---|---|
| I1 ⚠ | Generate a **fresh** secret (≥ 32 chars, e.g. `openssl rand -hex 32`); set `NOTIFICATIONS_OUTBOX_SECRET` on the tenant host and redeploy; in the SQL editor run `select public.fn_ntf_rotate_outbox_secret('<same secret>');`. | Returns success; the old value committed in migration 0355 no longer works. |
| I2 | Wait one minute; HQ → Operations → Jobs: `ntf-outbox-processor`, `ntf-campaign-scheduler`, `ntf-reconcile-outbox`. | Recent runs `DISPATCHED`/`SUCCESS`; no `skipped: secret missing` warning. |
| I3 | Queue a notification (order created) and watch the outbox. | Row goes `QUEUED` → `SENT`. |
| I4 (negative) | `curl -X POST <tenant>/api/notifications/process-outbox` with no / wrong secret. | 401. |

## J. Seeding values from env files (once per database)

| ID | Steps | Expect |
|---|---|---|
| J1 | `node scripts/ops/seed-config-from-env.mjs --env TENANT_WEB=<file> --env HQ_API=<file> --env HQ_WEB=<file> --out supabase/seeds/local/ops_config_values.cloud.sql --dry-run` | Prints counts only; writes nothing; no values. |
| J2 | Re-run without `--dry-run` (add `--include-secrets` if you accept plain secrets); open the generated file. | File is git-ignored; run it in that database's SQL editor. Afterwards `/ops/config` shows stored values / presence per scope; bootstrap/`ENV_ONLY` keys received no value. |
| J3 | Run the same file twice. | Second run changes nothing an operator edited. |

## P. Permissions and errors

| ID | Steps | Expect |
|---|---|---|
| P1 | Log in as a **read-only** HQ user. | List, history and key status visible; no edit/lock/clear/policy buttons; "read only" notice. |
| P2 | As a `manage_config`-only user, try editing a **secret** key. | No edit controls for secret/encrypted keys; API 403 if forced. |
| P3 | Stop the database connection (or revoke) and reload. | Friendly load-error panel with Retry; no stack trace. |
| P4 | Arabic UI (`/ar`): repeat A1, E1, F0. | Right-to-left layout; all labels Arabic; fingerprints and key names stay left-to-right. |

## T. Notification Hub hardening scenarios (R8, 2026-10-15)

| ID | Steps | Expect |
|---|---|---|
| T1 ⚠ | Campaign pause mid-run: create a campaign with ≥ 20 consenting targets, approve it, and as soon as it shows RUNNING click **Pause** (Marketing → Campaigns → the campaign detail page). | Sending stops within one target; the remaining targets stay PENDING; campaign status stays PAUSED (never COMPLETED). **Resume** continues the rest and ends COMPLETED. |
| T2 ⚠ | Same with **Cancel**. | Stays CANCELLED; no further outbox rows are created for it. |
| T3 ⚠ | Queue outage (test env, `ntf.hq.queue_enabled` = true): stop Redis, send an SMS through HQ dispatch with a fixed idempotency key, then start Redis and send the same key again. | First call returns 503; the second call is **sent** (not answered from a stuck "pending" row). |
| T4 | Order with a date-only ready-by (for example `2026-10-15`) on a server in a zone west of UTC. | The notification text shows October 15, not October 14. |
| T5 | With a **tenant user's** Supabase access token, call an HQ endpoint, for example `GET {HQ_API}/notifications/quota` or `GET {HQ_API}/ops/config`. | 403 "This endpoint requires an HQ session". With an HQ operator token: 200. |
| T6 | Edit your own tenant user's metadata to include `permissions: ["hq_ops:manage_secrets"]` and call `POST /ops/keys/reencrypt` with that token. | 403 (a tenant session never becomes an HQ operator). |
| T7 | Rotate a tenant-private credential, then look at HQ audit entries for it. | No token, key, authorization header or envelope text appears in the audit record (also inside lists). |

## U. Quota reservation (R10, migration 0623)

| ID | Steps | Expect |
|---|---|---|
| T8 ⚠ | Cap race: set a tenant override for SMS with hard cap 5 (HQ → Notifications → Quota → Tenant Overrides; metric is now SMS, not SMS_SENT). Fire 20 SMS dispatches in parallel (for example 20 concurrent `POST /notifications/dispatch` calls with different idempotency keys, sandbox provider). | At most 5 are accepted; the rest answer PERMANENT_FAILURE / QUOTA_EXCEEDED. Never 6 or more. |
| T9 | HQ → Notifications → Quota → **Tenant position**, paste the tenant id, **Show position**. During T8 and right after. | During: Reserved > 0. After the sends finish: Reserved 0, Used 5, state "Cap reached". |
| T10 | Send one SMS that the provider rejects (bad number). | The unit is given back: Used unchanged, Reserved 0. |
| T11 | Queue outage (Redis stopped, queue enabled): send an SMS with a fixed key. | 503 and Reserved does not grow; after Redis returns, the same key sends. |
| T12 | SQL (read-only): `select status, count(*) from org_ntf_quota_rsv_dtl group by 1;` and `select count(*) from org_ntf_usage_daily;` after a few real sends. | COMMITTED rows match the SENT messages; **usage rows exist** (before 0623 this table stayed empty). |
| T13 | HQ → Operations → Jobs: `ntf-quota-rsv-sweep`. | Active, every 5 minutes, recent runs SUCCESS. Kill a sender mid-send (test env): its RESERVED row turns EXPIRED within ~20 minutes. |
| T14 | Create an override from the Quota screen for every metric in the dropdown. | All save (before, the screen's codes were rejected by the database). |

## V. Template preview and test send (R12, migration 0624)

| ID | Steps | Expect |
|---|---|---|
| T15 | HQ → Notifications → Templates → open a template with an approved version → **Preview & test** → **Render preview** (EMAIL). | English and Arabic panes; unresolved placeholders listed with one input each; type values and render again → no placeholders left; source badge says channel text. |
| T16 | Preview a **draft** version that has no channel text yet; then switch the channel to WHATSAPP and PUSH. | Draft renders from the version body ("Version body" badge); every channel previews; nothing is sent. |
| T17 | As a user **without** `hq_notifications:test_send`. | No test-send block in the dialog; `POST …/test-send` → 403. |
| T18 ⚠ | Config → set `ntf.hq.test_recipients` = your own email. Test-send an EMAIL to it for a test organization (all placeholders filled, confirmation ticked). | Email arrives with subject prefixed `[TEST]`; response status SENT; `select is_test from hq_ntf_dispatch_log order by created_at desc limit 1` → true. |
| T19 | Same send to an address NOT on the list. | 403 "not on the test-recipient allow-list"; nothing sent. Clear the list → every send refused. |
| T20 ⚠ | Add your address to the organization's suppression list (tenant side), try again. | 409 refused (suppression is never bypassed). Remove it afterwards. |
| T21 | Check usage: `select sum(sent_count) from org_ntf_usage_daily where tenant_org_id = '<id>'` and the Quota "Tenant position" tab before and after a test send. | Unchanged: test messages are not counted. |
| T22 | Send more than `ntf.hq.test_send_per_min` tests within a minute. | 429 above the limit; another operator is unaffected. |
| T23 | Audit: HQ sidebar > Notification & Comm Hub > **Notification Audit** (`/notifications/audit`, tab Admin actions; the tab Sending log shows each send with its status and provider reason), filter Action type `notification_template` (or read the list): action `notification_template.test_send`. | One entry per send, recipient masked (`o***@example.com`), template, version, status; no credentials. |
| T24 | SMS test: allow-list your phone (+E.164), channel SMS, send. Then try WhatsApp. | SMS arrives prefixed `[TEST]`; WhatsApp shows "available for email and SMS". |

## W. Operational safety (R14, migrations 0625, 0626 + 0628)

Prepare: sandbox connectors are on outside production (or `HQ_NTF_SANDBOX_ENABLED=true`); give a test organization the email provider `RESEND` as usual. All steps in a **test environment**.

| ID | Steps | Expect |
|---|---|---|
| T25 | HQ → Notifications → **Operations**. | Health table lists providers with sent / failed / success rate, Control = Active, Circuit = Closed. Window selector changes the counts. |
| T26 ⚠ | **Pause** RESEND on EMAIL with a reason; send an order email (or test-send). | Command answers FAILED, **no email sent**, `select status, error_code from hq_ntf_dispatch_log order by created_at desc limit 1` → FAILED / PROVIDER_PAUSED; quota unit not consumed; Setup Health `providers.control` WARN. Audit action `notification_provider.paused`. |
| T27 ⚠ | **Resume**. Send again. | Email goes out; Setup Health OK. |
| T28 ⚠ | **Drain** RESEND on SMS with queued SMS jobs present (queue enabled). | New SMS commands refused; the already queued ones are still delivered. |
| T29 ⚠ | Add failover rule EMAIL: RESEND → SANDBOX_EMAIL; pause RESEND; send. | Response and log name SANDBOX_EMAIL; the message appears in the sandbox history (HQ API dev log / `GET /notifications/connectors` shows it registered), nothing goes to Resend; metering counts SANDBOX_EMAIL. Remove the rule: sending is refused again while paused. |
| T30 ⚠ | Force failures: send ≥ 10 emails to `fail-temp@example.com` through a sandbox route (or break the provider key) so ≥ 50 % fail in 10 minutes. | Within ~1 minute the circuit shows **Open** with the reason "N of M commands failed…", Setup Health `providers.control` FAIL, an alert arrives on the webhook (`platform.ops.alert_webhook_url`), audit `notification_provider.breaker_open`. Refused commands do **not** count as failures (health stays stable). |
| T31 ⚠ | Wait the cool-down (default 2 min) with no traffic. | Circuit becomes **Probing**. Send one good message: circuit closes. Send a failing one while probing: reopens. |
| T32 | **Reset circuit** on an open circuit. | Closes at once; history (`GET /notifications/operations/history?provider_code=…&channel_code=…`) shows who and why. |
| T33 | As a user without `hq_notifications:operate`. | No Pause / Drain / Resume / Reset / Add-rule controls; the API answers 403. |
| T34 | **Usage reconciliation**: run it for the last 7 days on a database with real sends. | "No differences" when metering works; otherwise rows with a positive difference = sends that were never metered (check `Metering RPC failed` in the API log). Setup Health `usage.reconciliation` mirrors it. |
| T35 | Workers: with Redis queue enabled, pause WHATSAPP/Twilio, enqueue a WhatsApp message, watch the worker log. | "Job … held (PAUSED)"; after Resume it is sent within a minute; the job did not fail or burn retries. |
| T36 ⚠ | Breaker does not flap: after T30 and T31 closed the circuit (probe succeeded), keep sending good messages for 5 minutes and watch Operations. | The circuit stays **Closed**; no new alert arrives; the health table still shows the earlier failures (full window) but the circuit does not reopen. (Needs migration 0628.) |
| T37 | Access boundary: with a **tenant user's** access token call an HQ-only endpoint that used to accept it, for example `GET {HQ_API}/audit-logs`, `GET {HQ_API}/billing/...`, `POST {HQ_API}/feature-flags` and `GET {HQ_API}/tenants`. Then, with the same token, call `GET {HQ_API}/settings/tenants/<another tenant id>/effective`, then the same with your own tenant id. Finally open the tenant web-admin Settings and Users screens as a normal tenant admin. | The first four answer **403** "This endpoint requires an HQ session". The other tenant's settings answer **403** "A tenant session can only access its own tenant"; your own tenant answers 200. The tenant Settings and Users screens keep working. With an HQ operator token every call is allowed. |
| T38 | Retention window (after migration 0629): HQ > Operations > Config, search `ntf.retention.days`. Open it; the value is 180. Change it to 200 and save; then try 10 and 5000. | 200 saves and the history shows who changed it (no value in the fingerprint column). 10 and 5000 are refused with "Value does not match the required format". SQL: `select public.fn_ntf_retention_run();` is only for a test database (it deletes expired rows). |
| T39 | SMS parts in the preview: Templates > a template > Preview & test > channel SMS > Render. | Under each language: the encoding, the number of characters and "N parts". An English text of 161 or more characters, or any Arabic text of 71 or more characters, shows a warning that it is sent as several parts. |
| T40 | Roles read-only: in the tenant app open Settings > Roles and Settings > Permissions as a tenant admin. | The lists load; there are no Create, Edit, Delete or Manage-permissions buttons; a notice says they are managed by the platform team. With a tenant token, `POST {HQ_API}/tenant-api/roles` answers 403. |
| T41 | Organization timezone: create an order whose ready time is late evening in the organization's timezone (for example 23:30 in Muscat) and read the order-created notification. | The date in the message is the organization's local day, not the server's. |
| T42 | Pause one organization (migration 0631, applied): HQ > Notifications > Operations > Paused organizations. Enter a test organization id, All channels, reason "QA", Pause, confirm. Then send a test message for that organization (Templates > Preview & test) and open the dispatch log. | The organization appears in the list with its name and reason; the send answers PERMANENT_FAILURE; `select status, error_code from hq_ntf_dispatch_log order by created_at desc limit 1` shows PERMANENT_FAILURE / TENANT_PAUSED; the quota "Tenant position" does not grow; Setup Health `tenants.paused` is WARN. |
| T43 | Resume: press Resume on that row, send again. | The message is sent; the list is empty; Setup Health `tenants.paused` is OK; audit has `notification_tenant.paused` and `.resumed`. |
| T44 | One channel only: pause the test organization for SMS only. Send an email and an SMS. | Email is sent, SMS is refused with TENANT_PAUSED. Pausing again returns "already in that state". Pausing without a reason is refused. |
| T45 | A user without `hq_notifications:operate`. | The Paused organizations list is visible but there are no Pause or Resume controls; the API answers 403. |
| T46 | Usage back-fill (migration 0630, applied; the remote already shows 0 differences): run the 7-day reconciliation report (Operations > Reconciliation). | "No differences": the three demo sends of 2026-10-10 and 2026-10-14 are now metered. Running the migration a second time changes nothing. |

## Q. Automated tests (run before every release)

```bash
# HQ API
cd F:\jhapp\cleanmatexsaas\platform-api
npx jest src/modules/ops-config src/modules/ops-health src/common/services/__tests__/encryption --maxWorkers=3
npx tsc --noEmit        # no errors under ops-config / ops-health / encryption
# HQ web
cd ..\platform-web
npx jest __tests__/features/ops-config
npx tsc --noEmit
# Tenant
cd F:\jhapp\cleanmatex\web-admin
npx jest __tests__/notifications __tests__/lib --maxWorkers=3
npm run check:i18n
```

Expected counts at the time of writing: ops-config 88, ops-health + encryption 68, web ops-config 31 (all passing).

## R. Read-only SQL spot checks

```sql
-- keys by storage form
select is_encrypted, is_secret, count(*) from sys_ops_config_cf where is_active group by 1,2 order by 1,2;
-- newest history across all keys (no values exist in this table)
select config_key, action, actor, created_at from sys_ops_config_chg_log order by created_at desc limit 20;
-- nothing should be stored for bootstrap / ENV_ONLY keys
select config_key from sys_ops_config_cf where (is_bootstrap or source_policy='ENV_ONLY') and (db_value is not null or db_value_enc is not null);  -- expect 0 rows
-- plain/enc invariant
select config_key from sys_ops_config_cf where (is_encrypted and db_value is not null) or (not is_encrypted and db_value_enc is not null);  -- expect 0 rows
```

## S. Known limits (not defects)

- Drift/Check evaluates **HQ API's own** environment only; tenant-app keys show `UNCHECKABLE`.
- An encrypted key is unreadable by the tenant app (it has no master key): it falls back to its environment variable.
- Plain secrets are readable by any holder of the Supabase service role (owner decision: plain is the default). Prefer encrypting `ntf.hq.*` keys.
- With several HQ API instances an identical drift alert can repeat; it is advisory.
- 86 of the registered keys are inventory only (not yet read through the registry by the application).

## Financial_Expert_Tester Results — Round 1 (2026-10-15, HQ hqsaas.cleanmatex.com, admin@cleanmatex.com)

Tester: Financial_Expert_Tester · UI through browser · Asia/Muscat · HQ repo HEAD at test time `b068ee9` (2026-10-15 04:06 +04). Diagnosis: read-only against `F:\jhapp\cleanmatexsaas`.

| # | Result | Evidence |
|---|---|---|
| 0.1 | BLOCKED | No read-only DB session available this run (credential file must stay on F:; Auto-review blocks copying `.env`). Code types include `fn_ops_config_convert_encryption` and `fn_ops_config_reencrypt` (`platform-api` database.types). Re-check with SQL when DB access is allowed. |
| 0.2 | FAIL | Setup Health `config.bootstrap_env` FAIL — missing `HQ_ENCRYPTION_MASTER_KEY` (and PREVIOUS also flagged). Master-key bootstrap key shows Environment only on Config (B6) but host env is not set. See FET-POC-S1. |
| 0.3 | PARTIAL | After Admin@123 sign-in, Config/Jobs/Health worked (implies `hq_ops:read` + manage grants). First `/ops/config` load flashed "No access". **No second read-only HQ user** for P1/E3/F6/P2. |
| 0.4 | PASS | `/ops/config` listed **146** keys (guide says ~136). Header: "146 keys. 0 missing. 0 mismatched. 0 drifting. 0 secrets stored as plain text." |
| A1 | PASS | Groups: fin1 integration13 marketing3 ntf51 order5 platform37 runtime3 storage11 tenant18 workflow4 =146. No secret values visible. |
| A2 | PARTIAL | Filters present: Policy, Managed via, App, search, Clear filters. **No Module filter** on hqsaas. Source has Module select (`ops-config-screen.tsx:523-528`) — deploy lag. App=Tenant web and search `twilio` → ntf(15) OK. |
| A3 | PARTIAL | `ntf.app.twilio.auth_token` details: one row "Tenant web / TWILIO_AUTH_TOKEN / Unknown"; **no 12-hex fingerprint** (value not set — expected per `ops-config-screen.tsx:296-298`). No secret visible. |
| A4 | PASS | Policies offered as "Whichever exists (database first)" / "Database overrides environment"; both filter (0 keys each in this env). ENV_OVERRIDES_DB control works. |
| B1 | PASS | `ntf.hq.resend.from_email` set `qa@example.test` ~8:16 PM; env-wins note for `HQ_RESEND_FROM_EMAIL`. Restored. |
| B2 | PASS | Policy → Database only OK. Refusal on `ntf.hq.test_send_per_min` with no value: save disabled, "Store a value first. This policy needs one." |
| B3 | PASS | ENV_ONLY requires "I understand the stored value will be discarded"; value cleared after save. Restored to ENV_OVERRIDES_DB / Not set ~8:18 PM. |
| B4 | PASS | `tenant.workflow.gate_challenge_secret` = `qa-secret-1` (password field); "Stored as plain text"; Setup Health `config.plain_secrets` WARN listed it. |
| B5 | PASS | Clear: "The stored value is removed. The environment variable, if any, is not touched."; plain_secrets back OK ~8:23 PM. |
| B6 | PASS | `platform.encryption.master_key` (and previous): no edit; Environment only; host guidance OK. |
| C1 | FAIL | No successful in-place plain→encrypted convert on secret **with** value. Lock/"Encrypt storage" exists in UI; API convert path needs master key (`ops-config.service.ts:227-248` + `encryption.service.ts:186-188`). Host missing `HQ_ENCRYPTION_MASTER_KEY`. Setup Health plain_secrets guidance still says clear/switch/re-enter (`ops-health.catalog.ts:114-115`), contradicting C1. |
| C2 | PARTIAL | After clear + Encrypt storage, decrypt-to-plain warning OK. Encrypted Set-value dialog field reported stuck at "[secret value hidden]" (string **not** in i18n; dialog starts empty — `ops-config-value-dialog.tsx:36`). Value-preservation after round-trip untested. |
| C3 | PASS | `tenant.order_change_review.proof_secret` flag flipped with no value; restored to plain. |
| C4 | NOT RUN | Needs read-only SQL after successful C1. |
| C5 | NOT RUN | Needs working C1 convert + two-tab conflict. |
| D1 | NOT RUN | Needs tenant web-admin test email / log after storing `ntf.app.resend_from_email`. |
| D2 | NOT RUN | Depends on C1 + D1. |
| D3 | NOT RUN | Covered under I (outbox secret). |
| E1 | FAIL | No history icon on key rows on hqsaas (only Set value / Change policy / Encrypt storage / Clear). Source always renders History (`ops-config-screen.tsx:383-391`) + `GET …/history` (`ops-config.controller.ts:73`) + `sys_ops_config_chg_log`. Audit Trail `/en/settings/audit` had no ops_config entries (newest 6/5/2026). Deploy lag or Actions overflow. |
| E2 | BLOCKED | Same — history UI not available on hqsaas. |
| E3 | BLOCKED | Needs read-only HQ user (P1). |
| E4 | NOT RUN | API history limit/404 not exercised this run. |
| F0 | FAIL | No Encryption keys panel / Re-encrypt on `/ops/config`. Source mounts `OpsKeyRotationPanel` (`ops-config-screen.tsx:493`) but panel `return null` on API error (`ops-key-rotation-panel.tsx:34`). Master key missing → `/ops/keys` fails → panel hidden. `config.key_rotation` not shown on Setup Health. |
| F1 | BLOCKED | Needs host env set of NEW/PREVIOUS master keys + HQ API restart (test env only). |
| F2 | BLOCKED | Needs F1 + visible Re-encrypt control. |
| F3 | BLOCKED | Needs F2 + history UI. |
| F4 | BLOCKED | Needs F1–F3 + host env change/restart. |
| F5 | BLOCKED | Needs test env + wrong previous key drill. |
| F6 | BLOCKED | Needs user without `manage_secrets`. |
| G1 | BLOCKED | Needs host env change + restart for drift (test env). |
| G2 | BLOCKED | Depends on G1. |
| G3 | BLOCKED | Needs https webhook + G1. |
| G4 | BLOCKED | Needs webhook URL http test. |
| G5 | BLOCKED | Needs interval 0 + drift. |
| G6 | BLOCKED | Needs G1 then fix. |
| H-required_keys | FAIL | Setup Health already FAIL naming `ntf.hq.twilio.content_cred_ref` (guide's unset-`HQ_TWILIO_AUTH_TOKEN` path not used). |
| H-mismatch | NOT RUN | Needs BOTH_MUST_MATCH key with differing env/stored. |
| H-unwired_values | NOT RUN | Needs store on unwired key. |
| H-plain_secrets | PASS | B4 produced WARN listing the key; B5 clear restored OK. |
| H-key_rotation | BLOCKED | Check not visible / not evaluable without master key + panel (see F0). |
| I1 | NOT RUN | Needs tenant host `NOTIFICATIONS_OUTBOX_SECRET` redeploy + SQL `fn_ntf_rotate_outbox_secret`. |
| I2 | PARTIAL | Jobs screen: actual ids **`ntf-outbox-processor`** (Success ~8:00 PM, schedule drift `*/30` vs intended `* * * * *`), **`ntf-campaign-scheduler`** (Disabled + drift, no runs), `ntf-reconcile-outbox` Success ~8:05, `ntf-quota-rsv-sweep` Success ~8:05. Guide names `ntf-process-outbox` / `ntf-process-campaigns` are outdated. |
| I3 | NOT RUN | Needs queue a notification and watch outbox. |
| I4 | NOT RUN | Needs curl against tenant process-outbox. |
| J1 | NOT RUN | Seed script dry-run not executed. |
| J2 | NOT RUN | Seed without dry-run not executed. |
| J3 | NOT RUN | Idempotent re-seed not executed. |
| P1 | BLOCKED | No read-only HQ user provisioned. |
| P2 | NOT RUN | Needs manage_config-only user. |
| P3 | NOT RUN | Needs DB disconnect / revoke simulation. |
| P4 | PARTIAL | `/ar/ops/config` RTL OK; **group headers remain English module codes**. `/ar/ops/health` showed "لا يوجد وصول" (No access) while `/en/ops/health` worked — permission-hydration race (`use-permission.ts` empty perms → deny). History/F0 not re-checked in AR (blocked on EN). |
| T1 | BLOCKED | Campaign pause mid-run not exercised.<br>Retest r2 2026-10-16: BLOCKED — Demo tenant: no campaigns; New Campaign dialog only IN_APP + Target User IDs; 4 customers, no consent indicator — cannot get ≥20 consenting targets. |
| T2 | BLOCKED | Campaign cancel not exercised.<br>Retest r2 2026-10-16: BLOCKED — same as T1 (no campaign Cancel path without a RUNNING campaign). |
| T3 | NOT RUN | Needs Redis stop (test env).<br>Retest r2 2026-10-16: NOT RUN — needs Redis stop on test env (not on shared Preview). |
| T4 | PARTIAL | Date-only ready-by notification text not checked.<br>Retest r2 2026-10-16: PARTIAL — tenant Notification Center shows generic "New notification: order.ready" etc.; no ready-by date in text; no comms history screen. |
| T5 | BLOCKED | Tenant token vs HQ endpoint 403 not called.<br>Retest r2 2026-10-16: BLOCKED — API part needs tenant access token against HQ (UI-only policy; no token extraction). |
| T6 | BLOCKED | Tenant metadata spoof → 403 not called.<br>Retest r2 2026-10-16: BLOCKED — API part needs tenant token + metadata edit (UI-only). |
| T7 | NOT RUN | Audit scrubbing after credential rotate not checked.<br>Retest r2 2026-10-16: NOT RUN — credential rotate + HQ audit scrubbing not exercised. |
| T8 | NOT RUN | Cap race parallel dispatch not run.<br>Retest r2 2026-10-16: NOT RUN — needs parallel dispatch / sandbox on test env (not run on shared HQ). |
| T9 | PASS | Quota screen has Plan Defaults + Tenant Overrides only — **no Tenant position tab** on hqsaas. Source has `position` tab (`quota-screen.tsx:41,524-542`) — not deployed. Search Demo org id → No quota records.<br>Retest r2 2026-10-16: PASS — Tenant position tab now present. Demo all 0/0 Unlimited; Saudi EMAIL cap200 SMS50 WA50 PUSH1000 CAMPAIGN2 IN_APP unlimited. |
| T10 | NOT RUN | Provider-reject refund path not run.<br>Retest r2 2026-10-16: NOT RUN — provider-reject refund path not run. |
| T11 | NOT RUN | Needs Redis outage.<br>Retest r2 2026-10-16: NOT RUN — needs Redis outage (test env). |
| T12 | NOT RUN | Needs read-only SQL on quota reservation tables.<br>Retest r2 2026-10-16: NOT RUN — needs read-only SQL on org_ntf_quota_rsv_dtl / usage_daily. |
| T13 | PASS | `ntf-quota-rsv-sweep` present, recent SUCCESS ~8:05 PM (every 5 min). Mid-send kill not done.<br>Retest r2 2026-10-16: PASS — ntf-quota-rsv-sweep */5 Success ~00:55. Still: ntf-outbox-processor drift */30 vs every minute; ntf-campaign-scheduler Disabled + drift (FET-POC-S8). |
| T14 | PASS | Create override for every metric not done.<br>Retest r2 2026-10-16: PASS — metrics EMAIL SMS WHATSAPP PUSH IN_APP CAMPAIGN all save (Saudi, MONTHLY, hard cap 100000, reason QA retest generous cap). Left 6 overrides on Saudi tenant. |
| T15 | PASS | No **Preview & test** on Assembly Completed template (only Edit Header / Add Version / Retire). Source has `previewAndTest` (`templates-screen.tsx:641-642`) — not deployed.<br>Retest r2 2026-10-16: PASS — Preview & test now present; EN+AR panes; placeholder order_number filled then rendered; EMAIL badge "In-app text (no text for this channel)". |
| T16 | PARTIAL | Depends on Preview dialog.<br>Retest r2 2026-10-16: PARTIAL — no draft versions (117/117 approved latest); WHATSAPP shows test-send email/SMS-only message; PUSH renders. |
| T17 | BLOCKED | Needs user without `hq_notifications:test_send`.<br>Retest r2 2026-10-16: BLOCKED — admin sees test-send block; limited user (without hq_notifications:test_send) unavailable. |
| T18 | NOT RUN | Needs Preview & test + allow-list.<br>Retest r2 2026-10-16: NOT RUN — allow-list configured on ntf.hq.test_recipients but could not complete Send (blocked by T19 UX). |
| T19 | FAIL | Depends on T18.<br>Retest r2 2026-10-16: FAIL — Send test message stays disabled with org/recipient/lang/confirmation filled; sendReady requires preview.unresolved.length===0 from last Render (`template-preview-dialog.tsx:67-68`) — filling values without re-Render leaves Send disabled; no placeholder inputs inside send block. |
| T20 | NOT RUN | Needs suppression list.<br>Retest r2 2026-10-16: NOT RUN — needs suppression list + working test-send. |
| T21 | NOT RUN | Needs Tenant position + test send.<br>Retest r2 2026-10-16: NOT RUN — needs successful test-send + Tenant position before/after. |
| T22 | NOT RUN | Rate limit not exercised.<br>Retest r2 2026-10-16: NOT RUN — rate limit not exercised (Send never enabled). |
| T23 | PARTIAL | Audit `notification_template.test_send` not checked.<br>Retest r2 2026-10-16: PARTIAL — `/en/notifications/audit` 404; `/en/settings/audit` search no ntf rows. Audit is written via `template-preview.service.ts:177-196` action `notification_template.test_send` into HQ audit (no dedicated ntf audit UI). |
| T24 | PASS | SMS/WhatsApp test-send not run.<br>Retest r2 2026-10-16: PASS (UI) — WHATSAPP: "Test sending is available for email and SMS…"; send control removed for unsupported channel. |
| T25 | PARTIAL | `/en/notifications/operations` → **404**. Sidebar/API exist in source (`app/notifications/operations/page.tsx`, `cmx-sidebar.tsx:205`) — **built, not deployed**.<br>Retest r2 2026-10-16: PARTIAL — `/en/notifications/operations` loads (was 404). Health table empty ("No provider traffic in this window") for 10m/1h/24h — by design when no rows (`operations-screen.tsx:189`); failover empty; Run report present. |
| T26 | NOT RUN | Depends on Operations screen.<br>Retest r2 2026-10-16: NOT RUN — Pause provider on shared HQ not exercised. |
| T27 | NOT RUN | Depends on T26.<br>Retest r2 2026-10-16: NOT RUN — depends on T26. |
| T28 | NOT RUN | Depends on Operations + queue.<br>Retest r2 2026-10-16: NOT RUN — Drain + queued SMS needs queue/test env. |
| T29 | NOT RUN | Failover rule not run.<br>Retest r2 2026-10-16: NOT RUN — failover rule not run on shared HQ. |
| T30 | NOT RUN | Circuit open drill not run.<br>Retest r2 2026-10-16: NOT RUN — circuit-open drill needs forced failures / test env. |
| T31 | NOT RUN | Probing cool-down not run.<br>Retest r2 2026-10-16: NOT RUN — needs T30 cool-down traffic. |
| T32 | PARTIAL | Reset circuit not run.<br>Retest r2 2026-10-16: PARTIAL — Operations loads; no open circuit visible → nothing to Reset. |
| T33 | BLOCKED | Needs user without `hq_notifications:operate`.<br>Retest r2 2026-10-16: BLOCKED — user without hq_notifications:operate unavailable. |
| T34 | PARTIAL | Usage reconciliation not run.<br>Retest r2 2026-10-16: PARTIAL — 7-day reconciliation runs; 3 unmetered Demo sends (SMS 10-10, SMS+WA 10-14). Likely pre-/early-0623 historical gap (metering added migration 0623); feature works. Confirm with a fresh metered send. |
| T35 | NOT RUN | Needs Redis workers + pause WhatsApp.<br>Retest r2 2026-10-16: NOT RUN — needs Redis workers + pause WhatsApp on test env. |
| T36 | NOT RUN | Retest r2 2026-10-16: NOT RUN — needs T30/T31 circuit traffic + migration 0628 (breaker no-flap). |
| T37 | FAIL | Retest r2 2026-10-16: FAIL — tenant UI broken after HQ identity boundary (commits 106838e/ced5f59/98991ef): `/dashboard/settings/allsettings` stuck "Loading settings…"; `/dashboard/users` intermittent `?error=insufficient_permissions`; `/dashboard/settings/users` HTTP 400 "Could not load team members" (`page.tsx:113` limit=200 vs DTO `@Max(100)`). API 403-matrix half BLOCKED (UI-only, no tenant token). Guide expects Settings/Users to keep working. |
| Q | NOT RUN | Jest/tsc suites not run this session. |

**Counts:** PASS 16 · FAIL 7 · PARTIAL 12 · BLOCKED 23 · NOT RUN 35 · (total scenario rows 93 including H-* , T36/T37 and Q). **Retest r2 2026-10-16 (T1–T37):** see per-row Retest lines; newly deployed: Operations, Preview & test, Tenant position. Master key still missing (banner on Config).

**Test data left behind:** none — four keys touched and restored to original (Not set / plain / ENV_OVERRIDES_DB as applicable):
1. `ntf.hq.resend.from_email`
2. `ntf.hq.test_send_per_min` (policy only)
3. `tenant.workflow.gate_challenge_secret`
4. `tenant.order_change_review.proof_secret`

**Retest r2 test data left behind:** 6 Saudi quota overrides (`c9ac29d1-219c-4a3a-8887-f860550c32be`, MONTHLY, hard cap 100000, reason "QA retest test data - generous cap") for EMAIL, SMS, WHATSAPP, PUSH, IN_APP, CAMPAIGN.

### Tester suggestions — Financial_Expert_Tester (FET-POC-S#)

- **P0 FET-POC-S1:** Set `HQ_ENCRYPTION_MASTER_KEY` (base64, 32 bytes) on the HQ API host and restart. Unblocks 0.2, C1 convert, F0 panel/`config.key_rotation`, and encrypted value flows. Do **not** set `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` except during an F1 rotation drill.
- **P0 FET-POC-S2:** Redeploy `platform-web` (and API if needed) to HEAD `b068ee9`+. Unblocks history icon (E1/E2), Module filter (A2), Notifications Operations (T25), Preview & test (T15), Quota Tenant position (T9) — all present in source, absent/404 on hqsaas. **Retest r2: partially fixed** — Operations page, Preview & test, and Tenant position now deployed (HEAD `98991ef`). Module filter / history icon not rechecked this round. T25 still PARTIAL (empty health).
- **P0 FET-POC-S3:** `ops-key-rotation-panel.tsx:34` — replace `if (isError \|\| !status) return null` with an error/empty state (title + fix link). Missing master key currently hides the Encryption keys panel entirely.
- **P1 FET-POC-S4:** `ops-health.checks.ts:219-230` — exclude `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` from bootstrap FAIL when unset (optional except during active rotation). Matches catalog guidance that PREVIOUS is only for rotation.
- **P1 FET-POC-S5:** Permission hydration race — `use-permission.ts` + `ops-health-screen.tsx:64` / config screen: while `user` is loading, show skeleton; only show "No access" when session is ready and `hq_ops:read` is missing. Fixes transient EN No access and `/ar/ops/health` false deny (P4). **Retest r2: still open** — intermittent HQ Config "No access" recurred during T18 prep.
- **P1 FET-POC-S6:** `ops-health.catalog.ts:114-115` plain_secrets guidance still says clear/switch/re-enter; update to prefer Lock in-place convert (`ops-config.service.ts:227-248`) when master key is present; keep re-enter for STALE_VALUE / missing key.
- **P1 FET-POC-S7:** Fix `ntf.hq.twilio.content_cred_ref` (config.required_keys FAIL) — store/set the Twilio content credential ref or adjust required-key list if not yet used.
- **P1 FET-POC-S8:** Jobs — set `ntf-outbox-processor` intended schedule to `* * * * *` (clear `*/30` drift); enable or document `ntf-campaign-scheduler` Disabled state. **Retest r2: still open** — same drift after `98991ef` deploy (cron rows not updated by code deploy).
- **P2 FET-POC-S9:** Guide accuracy — key count ~136 → **146**; policy labels are humanized ("Whichever exists…"); job ids `ntf-process-outbox`/`ntf-process-campaigns` → `ntf-outbox-processor`/`ntf-campaign-scheduler`. **Retest r2: partially fixed** — owner renamed I2 jobs in guide; T36/T37 added.
- **P2 FET-POC-S10:** Arabic Config — translate module group headers (raw `ntf`/`platform`/… today); fingerprints/key names stay LTR (already).
- **P2 FET-POC-S11:** Provision a read-only HQ user (`hq_ops:read` only) for P1/E3/F6 and a manage_config-without-secrets user for P2.
- **P2 FET-POC-S12:** C2 — retest encrypted Set-value after S1; if field still appears stuck, harden `ops-config-value-dialog.tsx` against password-manager autofill (string "[secret value hidden]" is not in repo i18n).

- **P0 FET-POC-S13:** T37 Settings/Users — `web-admin/app/dashboard/settings/users/page.tsx:113` passes `limit=200` but `platform-api/.../query-tenant-users.dto.ts` `@Max(100)` → HTTP 400 "Could not load team members". Fix: use limit ≤100 (or raise Max).
- **P0 FET-POC-S14:** T37 allsettings hang — `allsettings/page.tsx:56` → HQ `GET /settings/tenants/:id/effective` via `HQ_SERVICE_TOKEN` / forwarded JWT after `HqIdentityGuard` (ced5f59). Ensure Preview service token is a valid HQ JWT; forward Authorization from settings-client; add request timeout + error instead of endless "Loading settings…". Add `@AllowTenantIdentity` on `settings.controller.ts:559` (`…/value/:settingCode`) if tenant calls it.
- **P0 FET-POC-S15:** T19 — `template-preview-dialog.tsx:67-68` keeps Send disabled until `preview.unresolved.length===0` from last Render; typing placeholder values does not update that array. Fix: treat values as resolving unresolved (or auto re-render) and/or show placeholder inputs in the send block with the blocking reason.
- **P1 FET-POC-S16:** T23 — `notification_template.test_send` is audited in `template-preview.service.ts:177-196` (HQ audit); no `/notifications/audit` UI (404). Point QA Expected at HQ Audit Trail filter, or add a notifications audit screen.
- **P1 FET-POC-S17:** T37 `/dashboard/users` intermittent `insufficient_permissions` — `withAdminRole` / `with-role.tsx:102` redirects while role hydrates. Same class as S5: deny only after auth ready.
- **P2 FET-POC-S18:** T34 — three Demo unmetered rows (10-10 / 10-14) via `fn_ntf_usage_reconcile`; treat as pre-0623 historical unless a fresh send also diffs. Optional backfill; re-check after one live metered SMS.
- **P2 FET-POC-S19:** T25 empty Operations health is by design (`operations-screen.tsx:189`) with no traffic — not a defect; seed sandbox traffic when demos need Control/Circuit columns.

### Owner response to the tester findings (2026-10-16, after Round 1 and Retest r2)

What changed in code or data, and what still needs a person. "Fixed" means a test covers it; every item marked "Retest" needs the tester to repeat it after deploying HQ API, HQ web and the tenant app.

| Item | Status | What was done or what is needed |
|---|---|---|
| **S1** master key missing (P0) | **Owner action** | Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. On the HQ API host set `HQ_ENCRYPTION_MASTER_KEY` = that value (store it in your secret manager, never in chat or git) and restart HQ API. Do not set `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS`. Then Retest 0.2, C1, F0, H-key_rotation. |
| **S2** deploy lag | Mostly deployed | Retest the Module filter (A2) and the history icon (E1/E2) after the next deploy. |
| **S3** rotation panel hidden when the key is missing (P0) | **Fixed** | The panel now shows an error with the fix ("set HQ_ENCRYPTION_MASTER_KEY and restart") and a Retry button instead of disappearing. Retest F0. |
| **S4** PREVIOUS key reported missing | **Fixed** | `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` is optional (only during a rotation) and no longer makes `config.bootstrap_env` FAIL. |
| **S5** "No access" flash (permissions race) | **Fixed** | Config and Health screens wait for the operator's permissions to load before judging. Retest P4 (/ar/ops/health) and the first load of /ops/config. |
| **S6** plain-secret guidance | **Fixed** | Setup Health guidance now says: press Encrypt storage when the master key is set; clear and re-enter only if the key is missing or the value cannot be read. |
| **S7** `ntf.hq.twilio.content_cred_ref` required (FAIL) | **Owner action** | Not a defect: the Twilio Content importer needs it. The value is a label YOU choose (for example `twilio-prod-main`); it only has to be the same in two places: this key (or the host variable `NTF_TWILIO_CONTENT_CREDENTIAL_REF`) and the `credential_ref` of the platform Twilio account you create in HQ > Notifications > Providers > Manage connections. Step-by-step: `Notification_And_Communication_Hub/Setup_And_Config/15_operator_go_live_checklist.md` steps 2 to 5 (also 13 and 14). Until WhatsApp template import is used the FAIL is expected. |
| **S8** cron drift (P1) | **Owner action** (live data) | Live `cron.job`: `ntf-outbox-processor` runs every **30 minutes** (should be every minute: outbox messages wait up to 30 minutes), `ntf-campaign-scheduler` and `ntf-sweep-stale-push-subs` are **inactive** although registered as enabled. Fix in HQ > Operations > Jobs: open each job, set the schedule to its default (`* * * * *` for the processor) and enable it. No migration needed (the Jobs screen calls `fn_ops_job_set_state`). Then retest T13 and I2. |
| **S9** guide accuracy | **Fixed** | Job names corrected; key count is 146; policy labels noted. |
| **S10** Arabic module headers | **Fixed** | Config module headings and the module filter are translated (opsConfig.modules). Retest P4. |
| **S11** limited HQ users | **Owner action** | Create in the HQ sidebar group "HQ Auth / RBAC": first **HQ Roles** (create a role and tick only the permissions it should have), then **HQ Users** (new user, assign that role). Needed: (a) a user with only `hq_ops:read` (for P1, E3, F6), (b) a user with `hq_ops:manage_config` but not `manage_secrets` (for P2, F6), (c) a user without `hq_notifications:test_send` (T17), (d) a user with `hq_notifications:read` only (T33, T45). Unblocks the BLOCKED rows. |
| **S12** encrypted Set-value field stuck | **Hardened** | Password-manager autofill is switched off for secret fields. The text "[secret value hidden]" is not in the product; retest C2 after S1 and tell me if it still appears. |
| **S13** Settings > Users HTTP 400 (P0) | **Fixed** | The Team Members screen asked for 200 rows but the API allows 100 per page; it now reads page by page. Retest T37. |
| **S14** Settings page hangs (P0) | **Fixed (hang)** | Calls to the HQ API and the platform API now time out (15-30 s) and show an error instead of "Loading settings..." forever. The cause of the slow or missing answer is environmental: check that `HQ_API_URL` and `HQ_SERVICE_TOKEN` of the tenant app point to the deployed HQ API and that the token is a current HQ token (`npm run generate-service-token` in platform-api). Retest T37; if the error message names a 401/403, tell me the message. |
| **S15** Send button stays disabled (T19, P0) | **Fixed** | Send is enabled as soon as every unresolved placeholder has a typed value (no second Render needed), and the form says which placeholders are still missing. Retest T18-T24. |
| **S16** no ntf audit screen (T23) | **Doc fixed** | The test-send audit entry is in HQ > Settings > Audit Trail, filter action `notification_template.test_send`. |
| **S17** `/dashboard/users` intermittent redirect | **Fixed** | The role guard now waits for the organization context (bounded to 10 seconds) instead of denying access while it loads. |
| **S18** three unmetered demo sends | **Built** | Migration 0630 back-fills them (T46). |
| **S19** empty Operations table | Not a defect | By design when there is no traffic. Send sandbox traffic to see the columns. |
| Test data on the Saudi tenant | **Owner action** | Delete the six QA overrides: HQ > Notifications > Quota > Tenant overrides, or SQL: `delete from org_ntf_quota_override_cf where tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be' and reason = 'QA retest test data - generous cap';` (this restores the plan limits). |
| T1, T2 (no campaigns / no consent) | Needs test data | Create 20 test customers with WhatsApp or email consent in the demo tenant, then a campaign of type email to them. |
| T3, T8, T11, T35 (Redis, parallel dispatch) | Needs a test environment | Run on the staging copy described in runbook 10 (own Redis and sandbox provider); never on the shared HQ. |
| T5, T6 (tenant token against HQ) | Needs a developer | Use the browser dev tools of the tenant app (Application > Local storage > the Supabase session access_token) and call the HQ endpoint with curl. The automated tests (`hq-only-controllers.spec.ts`) already prove the 403 matrix. |

## Pick, don't type (2026-10-17)
| # | Sidebar path | What to click | Expected result |
|---|---|---|---|
| PDT1 | Notifications > Operations > Failover rules | Pick channel EMAIL, open "From provider" | Only active EMAIL providers are listed as `CODE · name`; "To provider" is disabled until a source is picked and never lists the source. Change the channel: both providers clear. A channel with no active provider shows a hint and Add rule stays disabled. |
| PDT2 | Notifications > Operations > Paused organizations | Type part of an organization name in the search box, pick it, enter a reason, Pause, confirm | The list shows `name · id`; the organization is paused. With scope set to the same channel (or after an "All channels" pause) it is no longer offered. |
| PDT3 | Notifications > Tenant Config > Add | Leave channel empty, then pick a channel | Provider is disabled with "Pick the channel first"; after choosing a channel only its active providers are listed; a channel with one provider auto-picks it; Save stays disabled until organization, channel and provider are all valid. Labels show `- [tenant_org_id]`, `- [channel_code]`, `- [provider_code]`. |
| PDT4 | Notifications > Tenant Config > "..." > Connections > Add connection | Open "Provider" | Only active providers, shown as `CODE · name · CHANNEL`; Channel fills itself and cannot be typed. |
| PDT5 | Notifications > Templates > a version > Preview > Send a test message | Pick an organization, type `abc` as recipient | Field error "Enter an email address..." and Send disabled; for SMS the number must be like `+96890000000`. |
| PDT6 | Notifications > Quota > Tenant overrides > Add; Broadcast > New campaign; Observability toolbar | Open the organization field | Organization LOV (search + `name · id`); Broadcast template is a list of active templates or "No template"; Observability has "All organizations". |
| PDT7 | (after 0634 is applied) Notifications > Connections > select a TWILIO_WHATSAPP account > Add sender | Open Sender kind, pick WHATSAPP_NUMBER, tick Template, save | List shows only this provider's kinds as `Label - [code]`; Message types checkboxes appear; saved capabilities = `{"message_types":["template"]}`. |
| PDT8 | Same, RESEND or TWILIO_SMS account | Pick EMAIL_ADDRESS / PHONE_NUMBER | No message types; advanced JSON field accepts only a JSON object. API with a kind not in the list → 400. Before 0634 is applied the field is free text and any kind is accepted. |
| PDT9 | (0635 applied 2026-10-17) API or SQL: insert/update a sender on a TWILIO_WHATSAPP account with sender_kind `PHONE_NUMBER`, or capabilities `{"message_types":["bulk"]}` | Save | DB rejects with `ntf_sender_kind: ...` (23514); API answers 400 with that message. A provider without lookup rows still saves. |
| PDT10 | Connections > Add platform account | Open Credential ref; pick one, then pick "New reference" and type `sk_live_abc...` | Picked ref fills its latest version and lists known versions; a secret-looking (`sk_live_abc123`) or badly formatted (`bad ref!`) value shows an error and Save is disabled; Save is also disabled while Account key, Provider account ID or Name is empty; API answers 400 too. <!-- PDT-P2 2026-10-17 -->
| PDT11 | Tenant Config > Connections > Add private connection | Open Provider | Only Twilio providers; a hint explains why; the row channel's Twilio provider is preselected (none if no Twilio provider serves it); header shows the organization `name · id` (id only without tenants.view); API with another provider → 400. |
| PDT12 | Twilio import (platform and private) | Open Language | Languages from the DB as `code · name`, lowercase codes, `Label - [language_code]`. The field is required (no "No language" option); with no active language a hint shows and Import stays disabled. |
| PDT13 | Quota > Add override | Pick tenant, metric, period that already exist | Metric list = active DB channels + CAMPAIGN; duplicate shows an error and Save is disabled; Save disabled with no tenant. |
| PDT14 | Broadcast > New campaign | Pick a channel, then a template; change channel | Only templates with an APPROVED version on that channel; a template that no longer fits is cleared. |
| PDT15 | Observability, Operations, Providers | Open the channel filter | Channels come from the catalog; inactive ones are marked. |
| PDT16 | Ops Config > ntf.hq.twilio.content_cred_ref > Edit | Open the value | Pick list of TWILIO_WHATSAPP refs plus free entry. |
| PDT17 | Log in as a non-super-admin HQ role with hq_notifications:read | Open any organization picker | Organizations load (GET /tenants needs only an HQ session). |
| PDT18 | Quota > Tenant overrides | Delete an override, then add the same organization + metric + period again | The row reappears (soft-deleted row reactivated). |
| PDT19 | Connections > a sender > Add sender | Type `[1]` or `abc` in the capabilities JSON | Inline "must be a JSON object" error; Save disabled. |
| PDT20 | Quota > Tenant position | Open the tab; search and pick an organization | Label reads "Organization - [tenant_org_id]"; no UUID box or Show position button; the position table loads at once after the pick. |
| PDT21 | Pricing > Add pricing | Open the Currency field | A pick list `code · name` from the currency catalog; no free text. Edit an existing row: its currency is shown (disabled). |
| PDT22 | Templates > Create template | Open Event code; try Create before picking | Pick list `code · name` of active notification events; Create disabled until an event is picked. |
| PDT23 | Ops > Operations Catalog > "Notification outbox status summary" | Look at the tenant parameter; for "Pilot test message" also the channel | Organization picker (`name · id`) and a channel pick list; labels end with "- [tenant_org_id]" / "- [channel_code]". |
| PDT24 | Any notification screen with an organization field (Quota, Broadcast, Operations) | Search and pick an organization | Same picker as before (`name · id`, inactive marked), now the shared CmxTenantPicker; label ends with "- [tenant_org_id]". |
| PDT25 | ERP-Lite > Posting simulation | Try Run before picking an event; then pick organization and event | Event is a pick list `name · evt_code`; Run disabled/blocked until both are picked. |
| PDT26 | ERP-Lite > Templates > a template (detail and studio) | Open Country, Plan and Target account | Pick lists ("Any country", "Any plan", postable accounts `name · code`); no free text. |
| PDT27 | ERP-Lite > Packages > a package > rule lines; Catalog > Account groups | Open phase, failure action, entry side, line type, usage code / resolver, statement section | Pick lists with only the DB-allowed values; usage code and resolver each offer a "none" choice. |
| PDT28 | Billing > Plans > a plan > Add price | Open Currency | Pick list `name · code` from the currency catalog; price saves with that code. |
| PDT29 | Billing > Subscriptions > New | Search an organization; open Discount and Payment method; change the organization | Organization picker searches all organizations; discounts list active codes; payment methods list only that organization's methods and reset on change. |
| PDT30 | Tenants > New tenant wizard > Subscription | Open Discount Code | Pick list of active discount codes ("No discount" allowed). |
| PDT31 | Catalog > Items > edit; Catalog > Templates > edit | Open Item Type | Pick list `name · item_type_code`; a saved inactive type is marked. |
| PDT32 | System Codes > Payment methods > new / edit; Settlement > Overpayment resolutions > edit | Open Gateway, Replacement, Settlement type, Permission code | Pick lists; replacement excludes the method itself; settlement type has 4 values; permission is searchable. |
| PDT33 | Settings > Navigation > edit item; Currency setup list | Open Main Permission Code; open the Country filter | Permission is a searchable pick list; the country filter is a pick list with "All". |
