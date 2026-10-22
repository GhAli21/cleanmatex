# Notification Hub — Owner Remaining Work Guide

**Written:** 2026-10-22 · **For:** the owner / operator (not a coding task list) · **Why it exists:** all Notification Hub code is built in both repos. What is left cannot be done by editing code. It needs a test environment, a person with database or API access, or a decision. Follow this file top to bottom when you are ready; tick the boxes as you go.

Related: [RESUME_CONTINUATION.md](./RESUME_CONTINUATION.md) section 7 (state) · [plan section 23.2](./notification-hub-production-implementation-plan.md) (closure snapshot) · [QA guide](../Platform_Operations_Console/qa_test_guide.md) (full scenario text, T1–T46) · [Runbooks](./Runbooks/index.md).

---

## 0. How the pieces fit (read once)

| Part | What it is | Who does it | Needs |
|---|---|---|---|
| **A** | Deploy + commit | Owner | Hosting access, git |
| **B** | Re-run browser QA that the bot could not finish | Owner or the bot | Deployed HQ (Part A) |
| **C** | Staging-only QA rows (T1–T3, T5–T8, T10–T12, T20–T21, T26–T28, T30–T32, T35–T37) | Developer + owner | A staging/test environment |
| **D** | Restore drill (Runbook 10, Part A) | Owner (database access) | A throwaway Supabase project + its own Redis |
| **E** | Runbook owners (13 runbooks) | Owner (decision) | A names list |
| **F** | Operator clean-up items | Owner | Database SQL access, Config screen |
| **G** | Owner decisions D1–D5 | Owner | Nothing |

Order that works best: **A → B → G → F → C → D → E**. Then record results (Part H) and tell Claude, who marks the plans closed.

**Hard rules for everything below**
- Never run any of this against a real customer's data. The demo organization is `11111111-1111-1111-1111-111111111111`.
- Migrations are applied only by you. Nothing in this guide needs a new migration.
- Every SQL below is read-only unless it says "WRITE". Always keep the `tenant_org_id` filter when it is shown.
- A cron time shown in HQ is UTC (04:00 UTC = 08:00 Muscat).

---

## Part A — Deploy and commit

- [ ] **A1. Deploy HQ platform-api and platform-web** (your usual hosting steps). Why: the fixes for the HTTP 400 on pause/test-send, the permission checks, the hidden write buttons and the new Notification Audit page only exist in code until deployed.
- [ ] **A2. Commit both repos.**
  - Tenant repo `F:\jhapp\cleanmatex`: docs (STATUS, RESUME, plan, QA guide, this file) and `supabase/migrations/0636_ntf_backfill_import_var_labels.sql` (already applied).
  - HQ repo `F:\jhapp\cleanmatexsaas`: `operations.dto.ts`, `template-preview.dto.ts` (now use `IsUuidIfEnabled`), `templates.controller.ts` (manage permission on variable/locale edit), deletion of the temporary `is-database-uuid` decorator and spec, and the two test mocks `broadcast-center-screen.test.tsx`, `quota-screen.test.tsx`.
- [ ] **A3. Check the validation switch:** `select chk_isuuid, uuid_regex from cmx_p_tmp;` Expected `chk_isuuid = false`. If it is ever set to `true`, the demo organization id (not a standard UUID version) is rejected again with HTTP 400 unless `uuid_regex` is relaxed.
- [ ] **A4. Optional but advised:** run `npm run build` in `platform-web` (not run after the 2026-10-17 changes). Do not run two builds at once.

---

## Part B — Browser re-QA (the bot or you)

These rows failed or were blocked only because of the bugs fixed on 2026-10-17. After Part A they should work. Test in HQ as a super admin unless stated.

| Row | What to do (HQ screen) | Expected result |
|---|---|---|
| T42 | Notifications → Operations → **Paused organizations**. Enter the demo organization id, All channels, reason "QA", Pause, confirm. Send a test message for that organization. | Pause succeeds (no HTTP 400). The send is refused with `TENANT_PAUSED`. |
| T43 | Press **Resume** on that row, send again. | Message is sent; list empty; Setup Health `tenants.paused` OK; audit shows `notification_tenant.paused` and `.resumed`. |
| T44 | Pause the demo organization for SMS only. Send an email and an SMS. | Email sent, SMS refused with `TENANT_PAUSED`; pausing again says "already in that state"; pausing without a reason is refused. |
| T18 | Operations → Config: set `ntf.hq.test_recipients` to your own email. Templates → a template with an approved version → **Preview & test** → fill all placeholders → Render → test-send EMAIL to that address for the demo organization, tick confirmation. | Email arrives, subject prefixed `[TEST]`. No HTTP 400. |
| T19 | Same send to an address NOT on the list. | Clear message "not on the test-recipient allow-list"; nothing sent. Clearing the list refuses every send. |
| T22 | Send more than `ntf.hq.test_send_per_min` tests inside one minute. | HTTP 429 above the limit. Another operator is not affected. |
| T23 | Sidebar → Notification & Comm Hub → **Notification Audit** (`/notifications/audit`), tab **Admin actions**, filter Action type `notification_template`. Then open the tab **Sending log** and find the same send (paste its idempotency key in "Find by id"). | One `notification_template.test_send` audit entry per send, with who and when; the Sending log row shows the status and, if the provider refused, the reason. Column headers show `Label - [db_column]`. The other tabs (Delivery receipts, Organization outbox, Send attempts, Provider control, Organization pauses) load without error. |
| T20, T21 | Needs a working test send (T18). T20: add your address to the demo organization's suppression list (tenant side) and send again → refused 409. Remove it afterwards. T21: `select sum(sent_count) from org_ntf_usage_daily where tenant_org_id = '11111111-1111-1111-1111-111111111111';` before and after a test send. | T20 refused; T21 unchanged (test sends are never counted). |
| Read-only check (T17, T33, T45) | Log in with a limited HQ test user (create one with read-only notification permission only). Open Templates, Routes, Providers, Quota, Broadcast, Tenant Config, Operations. | No Add / Edit / Activate / Approve / Import / Pause / Resume buttons anywhere. API write calls answer 403. |
| Jobs / Operations flash | Open HQ → Operations → Jobs and the Operations catalog as a limited user. | No intermittent "no permission" flash while permissions load. |
| PDT1–PDT17 | Pick-don't-type checks listed in [REPORT_Notification_Screens_Pick_Dont_Type_Implementation.md](./REPORT_Notification_Screens_Pick_Dont_Type_Implementation.md). | Every field that the system already knows is a pick list. |

Create the limited HQ test users (owner action already on the list): in HQ → Roles, use the QA roles that hold only read, or only `hq_notifications:operate`/`test_send`. Only SUPER_ADMIN and 3 QA roles hold notification/ops permissions today.

**If a test email fails (2026-10-22 finding):** the dialog now shows the provider's reason. A Resend HTTP 403 usually means the from-address domain is not verified in Resend. Check Resend dashboard → Domains and Logs, then set `ntf.hq.resend.from_email` (HQ → Operations → Config) to an address on the verified domain; if the `HQ_RESEND_FROM_EMAIL` environment variable is set on the HQ API host it overrides the registry, so change it there.

**Record:** write a dated line per row in `Platform_Operations_Console/qa_test_guide.md` ("Retest r3 2026-10-22 …") and tell Claude if anything fails: failures are handled first.

---

## Part C — Staging-only QA rows (need a test environment)

Prerequisite for the whole part: a **test environment** with its own database copy, its own Redis, sandbox/fake providers, and a throwaway organization. Never use the shared live HQ. Use the demo organization or a new test one. Take the exact steps and expected results from `qa_test_guide.md` (row numbers below); this section tells you what each needs.

### C1. Campaign pause / cancel mid-run (T1, T2)
- **Needs:** a campaign with **at least 20 customers who consented** to the channel. The demo organization has only 4 customers and no consent flag, so create ≥20 test customers with consent (tenant app → Customers; consent card) and a campaign in the tenant app (Marketing → Campaigns; the New Campaign dialog must offer the real channel, not only IN_APP).
- **Do:** approve the campaign, and the moment it shows RUNNING click **Pause** (T1) — repeat with **Cancel** (T2).
- **Expected:** T1: sending stops within one target; the rest stay PENDING; status stays PAUSED (never COMPLETED); Resume finishes the rest and ends COMPLETED. T2: stays CANCELLED; no more outbox rows.
- **Why it matters:** this bug (campaign finishing as COMPLETED after pause) was fixed in code on 2026-10-15; only a real run proves it.

### C2. Redis queue outage (T3, T11, T35)
- **Needs:** test environment where you can stop and start Redis; registry key `ntf.hq.queue_enabled = true`.
- **T3:** stop Redis. Send an SMS through HQ dispatch with a fixed idempotency key. Start Redis. Send the same key again.
  Expected: first call HTTP 503; second call is **sent** (not answered from a stuck "pending" row).
- **T11:** same outage; confirm `Reserved` in Quota → Tenant position does not grow during the 503; after Redis returns the same key sends.
- **T35:** with the queue enabled, **Pause** WhatsApp/Twilio, enqueue a WhatsApp message, watch the worker log. Expected "Job … held (PAUSED)"; after **Resume** it is sent within a minute; the job did not fail or use retries.

### C3. Access boundary with tenant tokens (T5, T6, T37) — needs a developer / API client
- **Get a token:** log in to the tenant app as a normal tenant admin, copy the Supabase access token from the browser (developer tools → Application → local storage / network request header). Use a REST client (curl, Postman).
- **T5:** `GET {HQ_API}/notifications/quota` and `GET {HQ_API}/ops/config` with the tenant token → 403 "This endpoint requires an HQ session". With an HQ operator token → 200.
- **T6:** edit your tenant user's metadata to include `permissions: ["hq_ops:manage_secrets"]`, then `POST {HQ_API}/ops/keys/reencrypt` with that token → 403 (a tenant session never becomes an HQ operator).
- **T37:** with the tenant token call `GET {HQ_API}/audit-logs`, `GET {HQ_API}/billing/...`, `POST {HQ_API}/feature-flags`, `GET {HQ_API}/tenants` → all 403. Then `GET {HQ_API}/settings/tenants/<other tenant id>/effective` → 403 "A tenant session can only access its own tenant"; with your own tenant id → 200. Finally open tenant Settings and Users screens as a normal admin → still work. With an HQ operator token every call is allowed.
- **Remove the metadata edit afterwards.**

### C4. Credential rotation leaves no secret in the audit (T7)
- **Needs:** a tenant-private provider credential on a test organization.
- **Do:** rotate it (HQ → Providers → Manage connections → the tenant-private account → rotate), then open `/notifications/audit` and filter the organization; also read the raw `hq_audit_logs` rows for that resource.
- **Expected:** no token, key, authorization header or envelope text in any audit record (including inside lists/details).

### C5. Quota cap race and quota refunds (T8, T10, T12, plus T9, T13)
- **Needs:** sandbox provider, ability to send 20 requests at once, read-only SQL.
- **T8:** HQ → Notifications → Quota → Tenant Overrides: metric **SMS**, hard cap **5** for the test organization. Fire 20 SMS dispatches **in parallel** (for example 20 concurrent `POST {HQ_API}/notifications/dispatch` calls, different idempotency keys, sandbox provider). Expected: at most 5 accepted; the rest PERMANENT_FAILURE / QUOTA_EXCEEDED; never 6.
- **T9:** during and right after, Quota → **Tenant position**, paste the organization id, Show position. During: Reserved > 0. After: Reserved 0, Used 5, state "Cap reached".
- **T10:** send one SMS the provider rejects (bad number). Expected: the unit is given back — Used unchanged, Reserved 0.
- **T12 (read-only SQL after a few real sends):**
  `select status, count(*) from org_ntf_quota_rsv_dtl group by 1;` and `select count(*) from org_ntf_usage_daily;`
  Expected: COMMITTED rows match SENT messages; usage rows exist.
- **T13:** HQ → Operations → Jobs → `ntf-quota-rsv-sweep` is active every 5 minutes with recent SUCCESS. Optional: kill a sender mid-send; its RESERVED row turns EXPIRED within about 20 minutes.
- **Afterwards:** delete the cap-5 override.

### C6. Pause, drain, failover and circuit breaker with live provider traffic (T26–T28, T30–T32, T36)
- **Needs:** real or sandbox provider traffic so the Operations health table has rows (the bot saw "No provider traffic", so there were no Pause/Drain controls to press).
- **T26:** **Pause** RESEND on EMAIL with a reason; send an order email (or test-send). Expected: command FAILED, no email sent; `select status, error_code from hq_ntf_dispatch_log order by created_at desc limit 1;` → FAILED / PROVIDER_PAUSED; quota unit not consumed; Setup Health `providers.control` WARN; audit `notification_provider.paused`.
- **T27:** **Resume**; send again → goes out; Setup Health OK.
- **T28:** **Drain** RESEND on SMS while queued SMS jobs exist (queue enabled) → new SMS commands refused; already queued ones still delivered.
- **T30:** force failures: send ≥10 emails to `fail-temp@example.com` through a sandbox route (or break the provider key) so ≥50 % fail within 10 minutes. Expected within about 1 minute: circuit **Open** with reason "N of M commands failed…", Setup Health `providers.control` FAIL, alert on the webhook set in `platform.ops.alert_webhook_url`, audit `notification_provider.breaker_open`. Refused commands do not count as failures.
- **T31:** wait the cool-down (default 2 minutes) with no traffic → circuit **Probing**; one good message closes it; a failing probe reopens it.
- **T32:** **Reset circuit** on an open one → closes at once; `GET {HQ_API}/notifications/operations/history?provider_code=…&channel_code=…` shows who and why.
- **T36:** after T30/T31 closed the circuit, keep sending good messages for 5 minutes → stays Closed, no new alert.
- **T29 (failover to a second provider)** stays blocked: it needs a second real provider (see decision D1). It is *not* part of this part.

**Record:** after each row, add a dated line to `qa_test_guide.md` and tell Claude about any failure.

---

## Part D — Restore drill (Runbook 10, Part A)

Goal: prove that after a database restore you do **not** send customers messages twice and do not lose queued work. The runbook text is [Runbooks/10_restore_and_retention_cleanup.md](./Runbooks/10_restore_and_retention_cleanup.md); this is the order to run it. Takes about 2 hours, once. **Never on production.**

- [ ] **D1. Make the staging copy.** Supabase dashboard → new project named `cleanmatex-restore-drill` → Database → Backups → pick a daily backup or a point in time → "Restore to a new project" (needs a plan with backups/PITR). If the plan has no PITR: `supabase db dump` of production, load into the new project. Give it its own Redis (a free Upstash or local instance). Point a test HQ API at both.
- [ ] **D2. Create the situation.** In staging send 20 sandbox messages. Write down the time `T_restore`. Send 20 more. Pause the provider and leave 5 of the second batch queued.
- [ ] **D3. Simulate the restore.** Restore the staging database again to `T_restore` (or reload the dump taken before the second batch). **Leave Redis as it is** — it now holds the second batch's jobs, which is the dangerous state.
- [ ] **D4. Run the runbook procedure in order and note the time and results of each step:**
  1. Stop sending: disable `ntf-outbox-processor`, `ntf-outbox-retry`, `ntf-campaign-scheduler`, `ntf-reconcile-outbox` in HQ → Operations → Jobs (a restore can bring the schedule back enabled); stop workers/HQ API or Pause every provider/channel.
  2. Restore the database (done in D3).
  3. Empty the notification queues in Redis (BullMQ obliterate on the dispatch queues) — the database is the source of truth.
  4. Run the consistency checks (read-only): rows with no live claim; `reconcile_state` counts (expect no `ACCEPTANCE_UNCERTAIN`); overdue retries (expect 0); stale quota reservations (expect 0); provider control state; usage vs sends via `fn_ntf_usage_reconcile(current_date - 7, current_date)` (expect 0 rows); jobs back as intended. The exact queries are in Runbook 10, step 4.
  5. Reconcile uncertain rows with the jobs still disabled: `POST <tenant app>/api/notifications/reconcile-outbox` with the outbox bearer secret; review `FAILED_PERMANENT` rows with `RECONCILIATION_REQUIRED:`.
  6. Review window: compare provider logs `T_restore → now` with the restored outbox. A message sent but missing is a "ghost" send (nothing to do but tell the business). A message queued but **already** sent is a duplicate risk — mark it `FAILED_PERMANENT` with a note before re-enabling.
  7. Re-enable: resume providers; enable jobs in this order — `ntf-outbox-retry`, `ntf-outbox-processor`, `ntf-campaign-scheduler`, `ntf-reconcile-outbox`; start workers and API; send one test message per channel; after 15 minutes Setup Health `providers.control`, `usage.reconciliation`, `jobs.last_run` must be OK.
- [ ] **D5. Pass criteria:** no message of the second batch is sent twice; every check query is healthy at the end; one test message per channel arrives; Setup Health OK after 15 minutes.
- [ ] **D6. Record it:** create `Runbooks/DRILL_LOG_<date>.md` (copy the structure of `DRILL_LOG_2026-10-15.md`) with the owner's name, times, results and surprises. Then delete the staging project.
- If a step goes wrong: leave the jobs disabled and the providers paused — that state is safe and reversible.

---

## Part E — Runbook owners

All 13 runbooks have no named owner. An owner = the person who runs the procedure during an incident and keeps the file current. Copy this table into `Runbooks/12_operator_handover.md` (section 6) once filled, and put the owner's name at the top of each runbook.

| # | Runbook | Suggested kind of owner | Owner (fill in) | Backup | Last drilled |
|---|---|---|---|---|---|
| 01 | Connection verification & rotation | Operator with provider consoles | | | |
| 02 | Sender registration | Operator with provider consoles | | | |
| 03 | Template import, submission & approval | Operator + whoever manages Twilio templates | | | |
| 04 | Tenant activation (route lifecycle) | Operator (`hq_notifications:manage`) | | | |
| 05 | Consent / opt-out | Customer-care / compliance contact | | | |
| 06 | Safe test | Operator (`hq_notifications:test_send`) | | | |
| 07 | Retry vs reconciliation | Operator with database access | | | |
| 08 | Incident pause / drain | On-call operator (`hq_notifications:operate`) | | | 2026-10-15 (automated) |
| 09 | Provider outage | On-call operator | | | 2026-10-15 (automated) |
| 10 | Restore & retention cleanup | Operator with database access | | | Part D |
| 11 | Billing / usage reconciliation | Finance-aware operator | | | 2026-10-15 (automated) |
| 12 | Operator handover | Owner | | | n/a |
| 13 | Master-key rotation & config drift | Security-aware operator | | | 2026-10-15 (automated) |

Also decide and write down: an on-call contact (the handover runbook says no such roster exists in either repo) and who receives the alert webhook (`platform.ops.alert_webhook_url`). Drills marked "automated" ran with sandbox connectors; a human walk-through is still due.

---

## Part F — Operator clean-up items

### F1. Close the two stuck demo outbox rows
Two demo WhatsApp rows have been `PROCESSING` for more than 30 days with no claim and no lease, so no job ever finishes them. Demo data only.
1. **Read first (no change):**
   `select id, tenant_org_id, channel_code, status, updated_at from org_ntf_outbox_dtl where status = 'PROCESSING' and lease_expires_at is null and updated_at < now() - interval '7 days' and tenant_org_id = '<demo tenant id>';`
   Expect 2 rows. Confirm they are demo rows.
2. **WRITE (run per tenant, tenant filter mandatory):**
   `update org_ntf_outbox_dtl set status = 'FAILED_PERMANENT', error_message = 'RECONCILIATION_REQUIRED: legacy row without lease, closed manually', finalized_at = now(), updated_at = now() where status = 'PROCESSING' and lease_expires_at is null and updated_at < now() - interval '7 days' and tenant_org_id = '<demo tenant id>';`
3. Re-run the read query → 0 rows.

### F2. Encrypt plain-text secrets in the config registry
Some registry values are stored as plain text. Only do this after you confirm `HQ_ENCRYPTION_MASTER_KEY` is set on the HQ API host.
1. HQ → Operations → **Config**: rows show a "Stored as plain text" badge.
2. For each secret key: the lock/unlock action converts a key to encrypted **only while no value is stored**. So: note the value from its source, clear the stored value, switch the key to encrypted, and re-enter the value (write-only afterwards; needs `hq_ops:manage_secrets`).
3. Check Setup Health `config.*` and the "Encryption keys" panel report nothing pending.
4. Never store: database URL, Supabase keys, JWT secret, `HQ_ENCRYPTION_MASTER_KEY`, `REDIS_URL`, inter-app service keys (they must come from the environment).
5. Reference: `Platform_Operations_Console/config_registry_guide.md` and Runbook 13.

### F3. Optional cleanups
- [ ] Delete or leave the extra **draft** version on `assembly.completed.default` created by the T16 QA run (Templates screen). A draft is never used for sending; if the screen offers no delete, leave it.
- [ ] Delete the **six QA quota overrides** on the Saudi tenant (Quota → Tenant Overrides → remove each row). They were created by the QA metric test (T14).
- [ ] **Arabic body of `order.created.default` v2:** Templates → that template → Add Version → write the Arabic body; and, if it is a WhatsApp template, create the matching Arabic Twilio Content template in the Twilio console, get it approved, then import it (Runbook 03). Until then Arabic orders use the existing text.
- [ ] Confirm the three job schedules in HQ → Operations → Jobs match the baseline from migration 0632: `ntf-outbox-processor` every minute, `ntf-campaign-scheduler` every 5 minutes. The push sweep is currently enabled live (a rebuild from 0632 would bring it back disabled — see D4).

---

## Part G — Owner decisions (D1–D5)

Decide each, or tell Claude to park it in `Skipped_On_Purpose.md`.

| # | Decision | Context | Options |
|---|---|---|---|
| D1 | T29 failover needs a second real provider | `SANDBOX_EMAIL` is not a catalog provider; kept for later by your earlier decision. See `NTF_Guide_To_Add_Second_Provider.md`. | Choose the provider and give credentials (for example SES / SendGrid for email) → Claude builds the connector. Or park it. |
| D2 | Who may view the tenant **Permissions** catalog | Page `F:\jhapp\cleanmatex\web-admin\app\dashboard\settings\permissions\page.tsx`, route `/dashboard/settings/permissions`. It shows "Access Denied" to the tested admin because it allows only roles `admin`/`tenant_admin` or permissions `*:*`, `settings:*`, `permissions:*`. | Widen to a specific role/permission, or keep as is (read-only page for platform-managed catalog). |
| D3 | Dead **Filters** button on HQ Settings → Audit Trail | `F:\jhapp\cleanmatexsaas\platform-web\app\settings\audit\page.tsx`, screen `src/features/settings/ui/audit-trail-screen.tsx`. It belongs to the settings audit, outside this hub; notification actions have their own `/notifications/audit`. | Fix it as a small separate task, or park. |
| D4 | Keep the push-subscription sweep enabled by migration | Live: enabled. Migration 0632 would bring it back disabled on a rebuild. | New migration to record "enabled", or leave as the live setting. |
| D5 | Wording items | Cron times are UTC (04:00 UTC = 08:00 Muscat); `ntf-campaign-scheduler` description still says "every minute" (it runs every 5). | Fix text / show local time, or park. |

---

## Part H — Closing the plans

The plans are closed only when:
- [ ] Part A done and HQ deployed.
- [ ] Part B shows no open failure.
- [ ] Part C rows are done or explicitly accepted as "not run, reason" by you.
- [ ] Part D drill recorded (or explicitly deferred with a date).
- [ ] Part E owners named.
- [ ] Part F items done.
- [ ] Part G decided or parked.

Then tell Claude: "Close the Notification Hub plans." Claude will update the plan (section 23.2), `STATUS.md`, `RESUME_CONTINUATION.md`, the Ops Console `STATUS.md`, and the QA guide, and record the closure date.

If any test in Parts B or C fails, send the row number, what you did, what you saw (screenshot or response text), and the HQ API log line if you have it. Failures are handled first.
