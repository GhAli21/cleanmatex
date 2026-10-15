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
| I2 | Wait one minute; HQ → Operations → Jobs: `ntf-process-outbox`, `ntf-process-campaigns`, `ntf-reconcile-outbox`. | Recent runs `DISPATCHED`/`SUCCESS`; no `skipped: secret missing` warning. |
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
| T23 | Audit: HQ audit log for action `notification_template.test_send`. | One entry per send, recipient masked (`o***@example.com`), template, version, status; no credentials. |
| T24 | SMS test: allow-list your phone (+E.164), channel SMS, send. Then try WhatsApp. | SMS arrives prefixed `[TEST]`; WhatsApp shows "available for email and SMS". |

## W. Operational safety (R14, migrations 0625 + 0626)

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
| T1 | NOT RUN | Campaign pause mid-run not exercised. |
| T2 | NOT RUN | Campaign cancel not exercised. |
| T3 | NOT RUN | Needs Redis stop (test env). |
| T4 | NOT RUN | Date-only ready-by notification text not checked. |
| T5 | NOT RUN | Tenant token vs HQ endpoint 403 not called. |
| T6 | NOT RUN | Tenant metadata spoof → 403 not called. |
| T7 | NOT RUN | Audit scrubbing after credential rotate not checked. |
| T8 | NOT RUN | Cap race parallel dispatch not run. |
| T9 | PARTIAL | Quota screen has Plan Defaults + Tenant Overrides only — **no Tenant position tab** on hqsaas. Source has `position` tab (`quota-screen.tsx:41,524-542`) — not deployed. Search Demo org id → No quota records. |
| T10 | NOT RUN | Provider-reject refund path not run. |
| T11 | NOT RUN | Needs Redis outage. |
| T12 | NOT RUN | Needs read-only SQL on quota reservation tables. |
| T13 | PASS | `ntf-quota-rsv-sweep` present, recent SUCCESS ~8:05 PM (every 5 min). Mid-send kill not done. |
| T14 | NOT RUN | Create override for every metric not done. |
| T15 | BLOCKED | No **Preview & test** on Assembly Completed template (only Edit Header / Add Version / Retire). Source has `previewAndTest` (`templates-screen.tsx:641-642`) — not deployed. |
| T16 | NOT RUN | Depends on Preview dialog. |
| T17 | NOT RUN | Needs user without `hq_notifications:test_send`. |
| T18 | NOT RUN | Needs Preview & test + allow-list. |
| T19 | NOT RUN | Depends on T18. |
| T20 | NOT RUN | Needs suppression list. |
| T21 | NOT RUN | Needs Tenant position + test send. |
| T22 | NOT RUN | Rate limit not exercised. |
| T23 | NOT RUN | Audit `notification_template.test_send` not checked. |
| T24 | NOT RUN | SMS/WhatsApp test-send not run. |
| T25 | BLOCKED | `/en/notifications/operations` → **404**. Sidebar/API exist in source (`app/notifications/operations/page.tsx`, `cmx-sidebar.tsx:205`) — **built, not deployed**. |
| T26 | NOT RUN | Depends on Operations screen. |
| T27 | NOT RUN | Depends on T26. |
| T28 | NOT RUN | Depends on Operations + queue. |
| T29 | NOT RUN | Failover rule not run. |
| T30 | NOT RUN | Circuit open drill not run. |
| T31 | NOT RUN | Probing cool-down not run. |
| T32 | NOT RUN | Reset circuit not run. |
| T33 | NOT RUN | Needs user without `hq_notifications:operate`. |
| T34 | NOT RUN | Usage reconciliation not run. |
| T35 | NOT RUN | Needs Redis workers + pause WhatsApp. |
| Q | NOT RUN | Jest/tsc suites not run this session. |

**Counts:** PASS 12 · FAIL 5 · PARTIAL 7 · BLOCKED 19 · NOT RUN 48 · (total scenario rows 91 including H-* and Q)

**Test data left behind:** none — four keys touched and restored to original (Not set / plain / ENV_OVERRIDES_DB as applicable):
1. `ntf.hq.resend.from_email`
2. `ntf.hq.test_send_per_min` (policy only)
3. `tenant.workflow.gate_challenge_secret`
4. `tenant.order_change_review.proof_secret`

### Tester suggestions — Financial_Expert_Tester (FET-POC-S#)

- **P0 FET-POC-S1:** Set `HQ_ENCRYPTION_MASTER_KEY` (base64, 32 bytes) on the HQ API host and restart. Unblocks 0.2, C1 convert, F0 panel/`config.key_rotation`, and encrypted value flows. Do **not** set `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` except during an F1 rotation drill.
- **P0 FET-POC-S2:** Redeploy `platform-web` (and API if needed) to HEAD `b068ee9`+. Unblocks history icon (E1/E2), Module filter (A2), Notifications Operations (T25), Preview & test (T15), Quota Tenant position (T9) — all present in source, absent/404 on hqsaas.
- **P0 FET-POC-S3:** `ops-key-rotation-panel.tsx:34` — replace `if (isError \|\| !status) return null` with an error/empty state (title + fix link). Missing master key currently hides the Encryption keys panel entirely.
- **P1 FET-POC-S4:** `ops-health.checks.ts:219-230` — exclude `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` from bootstrap FAIL when unset (optional except during active rotation). Matches catalog guidance that PREVIOUS is only for rotation.
- **P1 FET-POC-S5:** Permission hydration race — `use-permission.ts` + `ops-health-screen.tsx:64` / config screen: while `user` is loading, show skeleton; only show "No access" when session is ready and `hq_ops:read` is missing. Fixes transient EN No access and `/ar/ops/health` false deny (P4).
- **P1 FET-POC-S6:** `ops-health.catalog.ts:114-115` plain_secrets guidance still says clear/switch/re-enter; update to prefer Lock in-place convert (`ops-config.service.ts:227-248`) when master key is present; keep re-enter for STALE_VALUE / missing key.
- **P1 FET-POC-S7:** Fix `ntf.hq.twilio.content_cred_ref` (config.required_keys FAIL) — store/set the Twilio content credential ref or adjust required-key list if not yet used.
- **P1 FET-POC-S8:** Jobs — set `ntf-outbox-processor` intended schedule to `* * * * *` (clear `*/30` drift); enable or document `ntf-campaign-scheduler` Disabled state.
- **P2 FET-POC-S9:** Guide accuracy — key count ~136 → **146**; policy labels are humanized ("Whichever exists…"); job ids `ntf-process-outbox`/`ntf-process-campaigns` → `ntf-outbox-processor`/`ntf-campaign-scheduler`.
- **P2 FET-POC-S10:** Arabic Config — translate module group headers (raw `ntf`/`platform`/… today); fingerprints/key names stay LTR (already).
- **P2 FET-POC-S11:** Provision a read-only HQ user (`hq_ops:read` only) for P1/E3/F6 and a manage_config-without-secrets user for P2.
- **P2 FET-POC-S12:** C2 — retest encrypted Set-value after S1; if field still appears stuck, harden `ops-config-value-dialog.tsx` against password-manager autofill (string "[secret value hidden]" is not in repo i18n).
