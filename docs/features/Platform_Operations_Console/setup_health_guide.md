# Setup Health Guide (HQ `/ops/health`)

**Last updated:** 2026-10-14 · **Phase:** P3 of the [Platform Operations Console](./PLAN.md) · **Audience:** platform operator
**Replaces:** most of the manual steps in the [operator go-live checklist](../Notification_And_Communication_Hub/Setup_And_Config/15_operator_go_live_checklist.md) with a green/red page.

Sibling guides: [Job Manager](./job_manager_guide.md) · [Operations Catalog](./operations_catalog_guide.md) · [Config Registry](./config_registry_guide.md).

## What the page is

HQ platform-web, sidebar **Operations → Setup Health** (first item), route `/ops/health`. It is **read-only**: it never changes anything, it tells you what is not ready and links to the screen, guided operation or console that fixes it. Needs only `hq_ops:read` (no new permission, no migration).

- **Platform checks** load when the page opens.
- **Tenant checks** load after you pick an organization in the selector.
- **Refresh** re-runs both reports (it is not polled automatically; refresh after you fix something).
- The banner shows the **worst** status of the report: `FAIL` > `WARN` > `UNKNOWN` > `OK`.

## Statuses (read this first)

| Status | Meaning |
|---|---|
| OK | Verified from real data. |
| WARN | Works, but something will surprise you (drift, fallback in use, no opt-in yet). |
| FAIL | The go-live path is blocked. |
| UNKNOWN | **HQ could not verify it. This is not "healthy".** Either the data source was unreadable (the reason is shown in the finding) or the value lives on another host HQ cannot see (the tenant web app's environment). Confirm those items where they live. |

Every check degrades to UNKNOWN with a short reason instead of failing the page, so one broken table never blanks the checklist.

## Platform checks

| Code | Group | What it checks | Status rules | How to fix |
|---|---|---|---|---|
| `registry.migrations` | Console registries | `sys_ops_job_cf`, `sys_ops_operation_cf`, `sys_ops_config_cf` are readable | FAIL when any is missing | Apply migrations 0610, 0611, 0612 (never from the UI; operation `ops.apply_migration`) |
| `jobs.drift` | Scheduled jobs | Any job with `STATE_DRIFT`, `SCHEDULE_DRIFT` or `MISSING_IN_CRON` (from the Job Manager list) | WARN on state/schedule drift, FAIL if a job is missing from cron | [Job Manager](./job_manager_guide.md): enable the job / fix the schedule |
| `jobs.last_run` | Scheduled jobs | An **active** job whose last run FAILED (deliberately disabled jobs are ignored) | FAIL | Job Manager, run history of that job; often a missing runtime setting |
| `config.required_keys` | Configuration | `ntf.hq.twilio.account_sid`, `ntf.hq.twilio.auth_token`, `ntf.hq.twilio.content_cred_ref` are set **on this platform-api host**; `ntf.hq.twilio.whatsapp_from` is the optional fallback sender | FAIL if a required key is missing, WARN if only the fallback is missing | Set the variable in the platform-api hosting environment and redeploy (`ops.set_hq_env_vars`) |
| `config.tenant_web_keys` | Configuration | `platform.tenant_hq_service_key`, `ntf.app.hq_dispatch_url`, `ntf.app.hq_route_dispatch_url` (read by the **tenant** app) | OK only if a registry value is stored; otherwise UNKNOWN | Confirm in the tenant app host, or store the value in the [Config Registry](./config_registry_guide.md) where the policy allows. Bootstrap keys are env-only, so this stays UNKNOWN until confirmed on that host |
| `config.bootstrap_env` | Configuration | Bootstrap variables of this host (DB URL, Supabase keys, JWT secret, encryption master key ...) are present (names only are reported) | FAIL listing the missing variable **names** | Hosting environment, then redeploy |
| `config.mismatch` | Configuration | Keys with policy `BOTH_MUST_MATCH`: environment and stored value agree (hash compare, no values) | FAIL on mismatch; UNKNOWN if the key belongs to another host | Config Registry: make both sides equal |
| `config.unwired_values` | Configuration | A value is stored for a key the application does not read from the registry yet (`is_wired = false`) | WARN: the stored value has **no effect** | Clear it, or wait until the key is wired |
| `providers.account.WHATSAPP` / `.SMS` / `.EMAIL` | Provider accounts | At least one active **VERIFIED** platform account per channel (`sys_ntf_prov_acct_mst`) | FAIL for WhatsApp, WARN for SMS and email (they still have legacy direct paths) | Notifications → Providers → Manage connections: create the account, then **Verify** |
| `providers.twilio_verified` | Provider accounts | A Twilio account is VERIFIED | FAIL (distinguishes "none exists" from "not verified") | Guided operation `ntf.twilio_account_verify` |
| `providers.sender.WHATSAPP` | Provider accounts | A WhatsApp sender is registered (`sys_ntf_prov_send_mst`) | WARN when none or none verified (sender verification is informational; the `HQ_TWILIO_WHATSAPP_FROM` fallback applies) | Same connections dialog |
| `templates.registered_approved` | Templates | Provider template registrations exist and at least one is `APPROVED` | FAIL none registered, WARN none approved | Notifications → Providers → Twilio import (Content SID) |
| `templates.bindings_complete` | Templates | Every registration's **current revision** has a binding for each provider slot (`provider_param_count`) | FAIL when a revision is missing or incompletely bound; UNKNOWN when nothing is registered | Open the revision → Bindings. A revision can be bound once; import a new revision to correct it |
| `webhooks.resend_secret` | Webhooks | The Resend signing secret (`RESEND_WEBHOOK_SECRET`, tenant web app) | OK if stored in the registry; otherwise UNKNOWN (HQ cannot read the tenant host) | Resend dashboard → copy the `whsec_` secret → set it on the tenant app host → redeploy (`ntf.resend_webhook_setup`) |
| `webhooks.resend_event_received` | Webhooks | Any `RESEND` row in the HQ webhook ledger (`hq_ntf_webhook_events`) | OK if seen, otherwise UNKNOWN | Resend dashboard → **Send test event**, expect HTTP 200. See the limit below |

## Tenant checks (pick an organization)

Every `org_*` read filters `tenant_org_id` explicitly. Only counts and states are read: never customer names, phone numbers or message text.

| Code | Group | What it checks | Status rules | How to fix |
|---|---|---|---|---|
| `tenant.route_active` | Routing | An `ACTIVE` route for `order.created` on `WHATSAPP` exists | FAIL when none, or only DRAFT/SUSPENDED/RETIRED (states shown) | Notifications → Tenant Configuration → row action **Routes**: create, then **Activate** |
| `tenant.route_bindings` | Routing | Each ACTIVE route points to a revision with all slots bound (platform and tenant-private revisions) | FAIL if incomplete; UNKNOWN if there is no active route | Bind the revision, or repoint the route |
| `tenant.channel_enabled` | Routing | `org_ntf_settings_cf.is_enabled` for WhatsApp | FAIL when disabled, WARN when no settings row | Tenant Configuration |
| `tenant.dispatch_via_hq` | Routing | Platform runtime flag `ntf_dispatch_via_hq` **and** the tenant's `metadata.dispatch_via_hq` are both on | OK both on; WARN otherwise (legacy direct path in use); UNKNOWN if the platform flag cannot be read | Guided operation `ntf.set_dispatch_via_hq` |
| `tenant.customer_consent` | Delivery | At least one customer has `preferences.notifications.whatsapp = true` (count only) | WARN when 0 (WhatsApp is opt-in) | Tenant app: customer card → Customer WhatsApp notifications (done outside HQ) |
| `tenant.outbox_backlog` | Delivery | Outbox rows still `QUEUED`/`PROCESSING`/`FAILED_TEMPORARY` more than 1 hour after creation | WARN > 0, FAIL ≥ 100 | Job Manager (`ntf-outbox-processor`), operation `ntf.outbox_status_summary` |
| `tenant.outbox_failed` | Delivery | `FAILED_PERMANENT` rows created in the last 7 days | WARN > 0 | Operations `ntf.outbox_status_summary`, `ntf.dispatch_log_recent` |
| `tenant.resend_webhook_evidence` | Delivery | A suppression row with source `RESEND_WEBHOOK` exists for the tenant | OK if present; UNKNOWN if none (normal until a real bounce happens) | Informational |

## Honest limits

1. **HQ cannot read another host's environment.** `config.required_keys` and `config.bootstrap_env` describe the **platform-api** host only. Tenant web app variables stay UNKNOWN until confirmed there or stored in the registry.
2. **Resend event evidence is indirect.** The tenant endpoint `/api/notifications/webhooks/resend` keeps no event ledger, so the platform check reads HQ's own ledger (usually empty) and reports UNKNOWN, never FAIL. The per-tenant suppression check is the only end-to-end proof, and only after a real bounce or complaint.
3. **Template binding completeness is a count comparison** (bound slots vs `provider_param_count`), not a content check.
4. **Backlog age uses `created_at`** (a timezone-naive column compared against UTC). The database is expected to run in UTC; a server session in another zone would blur the 1-hour threshold.
5. **Sender verification** has no live provider check; it is informational.
6. Thresholds (1 hour, 100 messages, 7 days) are constants in `platform-api/src/modules/ops-health/` (`ops-health.service.ts`, `ops-health.checks.ts`), not settings.

## "Can't do it here" guidance panels

Things that cannot be done from a screen (hosting variables, Resend/Twilio consoles, migrations) show a **Setup guidance** panel on the matching Notifications screens. The panel is the reusable `SetupGuidancePanel` (`platform-web/src/features/ops-health/ui/setup-guidance-panel.tsx`). It pulls the title, the steps and the "manage via" badge from the operations catalog (`GET /ops/operations/:code`) or the config registry, so the prose is written once, in the catalog, and linked to `/ops/operations?code=...`. It is hidden without `hq_ops:read` and degrades to a plain link if the catalog cannot be read.

| Screen | Panel source |
|---|---|
| Notifications → Providers | `ntf.twilio_account_verify` |
| Notifications → Channels | `ntf.resend_webhook_setup` |
| Operations → Configuration Registry (`/ops/config`; the old Notifications → Runtime Config screen redirects there) | `ops.set_hq_env_vars` |
| Notifications → Tenant Configuration | `ops.set_hq_env_vars` |

The Operations Catalog screen now preselects an entry from `?code=` so every "Open the operation" link lands on the right entry.

## Technical reference

- **API** (`platform-api/src/modules/ops-health`): `GET /ops/health`, `GET /ops/health/tenants/:tenantOrgId` (UUID-validated; 404 only when the tenant is positively known not to exist). Guards `JwtAuthGuard` + `HqPermissionGuard`, `hq_ops:read`. No mutations.
- Reuses, does not duplicate: `OpsJobsService.listJobs()` and `OpsConfigService.list()` / the new non-persisting `OpsConfigService.evaluate()` (exports added to `OpsJobsModule` and `OpsConfigModule`).
- Each check carries `code`, `group`, `title`/`title2`, `status`, `detail`/`detail2`, `fixKind` (`UI_LINK | OPERATION | HOSTING_ENV | EXTERNAL_CONSOLE | MIGRATION`), `fixHref` (internal HQ route or null), `guidance`/`guidance2`. Static wording lives in `ops-health.catalog.ts`; evaluators in `ops-health.checks.ts` are pure and unit-tested.
- Security: secret values, ciphertexts, fingerprints, customer identities and provider credentials never appear in a report; only names, states and counts.
- No migration was required for P3.
