# Background process environment

Only the string `true` turns a flag on. Unset, `false`, or any other value leaves it off. Do not change these until the new HQ API and tenant app builds are deployed.

No secret value belongs in this file.

## Now, before that deploy

| App | Variable | Required value |
|---|---|---|
| HQ API | `PLATFORM_BG_ENABLED` | unset |
| HQ API | `PLATFORM_BG_DB_URL` | unset |
| HQ workers | `PLATFORM_WORKER_LOOPS_ENABLED` | unset, or `true` |
| HQ workers | `NTF_OUTBOX_WORKER_ENABLED` | `false` |
| HQ workers | `NTF_OUTBOX_SHADOW_ENABLED` | unset, or `false` |
| HQ workers | `FIN_GIFT_CARD_EXPIRY_ENABLED` | unset |
| HQ workers | `FIN_CREDIT_NOTE_EXPIRY_ENABLED` | unset |
| HQ workers | `FIN_LOYALTY_EXPIRY_ENABLED` | unset |
| HQ workers | `FIN_POS_ROLLOVER_ENABLED` | unset |
| HQ workers | `FIN_ERP_RETRY_ENABLED` | unset |
| HQ workers | `FIN_DOMAIN_OUTBOX_ENABLED` | unset |
| HQ workers | `NTF_CAMPAIGN_EXPANSION_ENABLED` | unset |
| Tenant app | no new flag | leave as it is |

`NTF_OUTBOX_CANARY_RUN_ID` and `NTF_OUTBOX_CANARY_TENANT_ID` stay as they are. Do not clear them.

| HQ API | 
PLATFORM_BG_ENABLED=
PLATFORM_BG_DB_URL=

| HQ workers | 
PLATFORM_WORKER_LOOPS_ENABLED=
NTF_OUTBOX_WORKER_ENABLED=false
NTF_OUTBOX_SHADOW_ENABLED=false
FIN_GIFT_CARD_EXPIRY_ENABLED=
FIN_CREDIT_NOTE_EXPIRY_ENABLED=
FIN_LOYALTY_EXPIRY_ENABLED=
FIN_POS_ROLLOVER_ENABLED=
FIN_ERP_RETRY_ENABLED=
FIN_DOMAIN_OUTBOX_ENABLED=
NTF_CAMPAIGN_EXPANSION_ENABLED=



## One cutover, after the HQ API deploy

Finance and campaign flags stay unset. Those jobs are not part of this cutover. Their build is expert replan §1.1.

| App | Variable | Required value |
|---|---|---|
| HQ API | `PLATFORM_BG_ENABLED` | `true` |
| HQ workers | `PLATFORM_WORKER_LOOPS_ENABLED` | `false` |
| HQ API | `NTF_OUTBOX_WORKER_ENABLED` | `false` |
| HQ API | `NTF_OUTBOX_SHADOW_ENABLED` | `false` |
| HQ API | `FIN_GIFT_CARD_EXPIRY_ENABLED` | unset |
| HQ API | `FIN_CREDIT_NOTE_EXPIRY_ENABLED` | unset |
| HQ API | `FIN_LOYALTY_EXPIRY_ENABLED` | unset |
| HQ API | `FIN_POS_ROLLOVER_ENABLED` | unset |
| HQ API | `FIN_ERP_RETRY_ENABLED` | unset |
| HQ API | `FIN_DOMAIN_OUTBOX_ENABLED` | unset |
| HQ API | `NTF_CAMPAIGN_EXPANSION_ENABLED` | unset |


| HQ workers |
PLATFORM_WORKER_LOOPS_ENABLED=false

| HQ API |
PLATFORM_BG_ENABLED=true
NTF_OUTBOX_WORKER_ENABLED=false
NTF_OUTBOX_SHADOW_ENABLED=false
FIN_GIFT_CARD_EXPIRY_ENABLED=
FIN_CREDIT_NOTE_EXPIRY_ENABLED=
FIN_LOYALTY_EXPIRY_ENABLED=
FIN_POS_ROLLOVER_ENABLED=
FIN_ERP_RETRY_ENABLED=
FIN_DOMAIN_OUTBOX_ENABLED=
NTF_CAMPAIGN_EXPANSION_ENABLED=

Restart both services after that pair of changes. Do not turn the API host on while worker loops are still on. Leave every `FIN_*_ENABLED` and `NTF_CAMPAIGN_EXPANSION_ENABLED` unset.

## Secrets and URL

Finance and campaign jobs use the §1.1 build. Do not set `TENANT_WEB_ADMIN_URL`, `FINANCE_OUTBOX_SECRET`, or `NOTIFICATIONS_OUTBOX_SECRET` to run them. Those names belong to the rejected tenant HTTP callers. This file does not store a secret value.

| Variable | Where | Required value |
|---|---|---|
| `PLATFORM_WORKER_API_KEY` | HQ API and HQ workers, same value | Already in use. The worker sends it when it calls the one notification-delivery operation. Do not reuse the service-role key |
| `PLATFORM_BG_DB_URL` | HQ API, optional | Direct session-mode Postgres URL, not port `6543`. Unset is valid. The 15-minute sweep still runs |

The job alert does not use a new variable. It posts to the existing HQ config key `platform.ops.alert_webhook_url` when that value is an `https` URL.

## Later, one HQ job at a time

Set that one variable to `true` on the host that is claiming, and also turn the matching job on in `/ops/jobs`. Both are required. These two are `HQ_WORKER`.

| Variable | Job |
|---|---|
| `NTF_OUTBOX_SHADOW_ENABLED` | `ntf-outbox-shadow` |
| `NTF_OUTBOX_WORKER_ENABLED` | `ntf-outbox-dispatch` |

Leave `NTF_OUTBOX_WORKER_ENABLED` at `false` until notification delivery is opened on purpose. Leave every `FIN_*_ENABLED` and `NTF_CAMPAIGN_EXPANSION_ENABLED` unset until the matching §1.1 executor is the one poster. Do not set `TENANT_WEB_ADMIN_URL` to run those jobs.
