# GrokBot run: Owner UI tasks for Browser Bot (HQ console)
Run: 2026-10-17 04:45–05:17 (Asia/Muscat, UTC+4) · https://hqsaas.cleanmatex.com · operator admin@cleanmatex.com
Source prompt: PROMPT_Owner_UI_Tasks_For_Browser_Bot.md · Screenshots: box /workspace/hq-qa/ (copied to GrokBot_HQ_SC folder beside this file)

## Task 1: delete 6 QA quota overrides (tenant c9ac29d1-219c-4a3a-8887-f860550c32be)
| Item | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| Pre-check | Exactly 6 rows, reason "QA retest test data - generous cap" | 6 rows: CAMPAIGN, EMAIL, IN_APP, PUSH, SMS, WHATSAPP; MONTHLY, hard cap 100000, correct reason, same tenant | PASS | t1_before.png |
| Delete | Each deleted with confirmation | 6 deleted; each dialog "Delete the override for tenant … and metric [X]? The plan default will apply again."; toast "Quota override removed" | PASS | — |
| After reload | No override for tenant | "0 override rows matched / No quota records found" | PASS | t1_after.png |

## Task 2: limited HQ test users
| Item | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| Role QA Ops Read (QA_OPS_READ) | hq_ops:read only | As expected | PASS | — |
| Role QA Ops Config No Secrets (QA_OPS_CONFIG_NO_SECRETS) | hq_ops:read + manage_config, no manage_secrets | As expected | PASS | — |
| Role QA Notifications Read (QA_NOTIFICATIONS_READ) | hq_notifications:read only | As expected | PASS | — |
| Users | jhtest.dev21+opsread / +opsconfig / +notifread @gmail.com, one role each | Created; form has no password field, temp password shown once, set at forced first-login change. Password: set | PASS | — |
| Ops Read: Jobs | Read-only | Intermittent "You do not have permission to view scheduled jobs" vs full list on other loads; no run/edit controls | FAIL (flaky) | t2_opsread_scheduled_jobs.png |
| Ops Read: Operations Catalog | Read-only | "Read-only mode" banner but lists 11 ops incl. destructive "Delete pilot test rows" with "Run here" tags; detail shows only History/Copy; some loads "No access" | FAIL (flaky/misleading) | t2_opsread_operations_catalog*.png |
| Ops Read: Config Registry | Read-only | "Read-only access", only Show details | PASS | t2_opsread_config_readonly.png |
| Ops Read: Setup Health | Read-only | Loads, only Refresh | PASS | — |
| Ops Config: non-secret edit | Can edit | "Set value: SMTP port" opened, cancelled, not saved | PASS | t2_opsconfig_set_value_nonsecret_cancelled.png |
| Ops Config: secrets | No reveal/edit | Secret rows only history icon | PASS | t2_opsconfig_secret_rows_no_setvalue.png |
| Notif Read | No Add/Edit/Activate/Suspend/Pause/Test-send | Visible+enabled: Import Twilio template, Manage connections, Review templates, Add Config, New Template, New Campaign, Run report, Add Pricing + row menus; also Add Version / Edit Header on template page. Channels, Analytics clean | FAIL | t2_notifread_unit_pricing_add_button.png |
Note: verification used sign out/in in same tab, not a private window. All test users signed out.

## Task 3: ntf- job schedules (read only, nothing changed)
| Job | Expected | Actual | Result |
|---|---|---|---|
| ntf-outbox-processor | every minute | `* * * * *`, enabled, In sync, Success 04:48 | PASS |
| ntf-campaign-scheduler | every 5 min (override) | `*/5 * * * *`, enabled, In sync, Success 04:45; no override marker; description still says "intended to run every minute" | PASS (note) |
| ntf-outbox-retry | every 5 min | `*/5`, enabled, In sync, Success 04:45 | PASS |
| ntf-quota-rsv-sweep | every 5 min | `*/5`, enabled, In sync, Success 04:45 | PASS |
| ntf-reconcile-outbox | every 5 min | `*/5`, enabled, In sync, Success 04:45 | PASS |
| ntf-retention-sweep | daily 04:00 | `0 4 * * *`, enabled, In sync, last Success Oct 16 08:00 (display looks like UTC→local) | PASS (note) |
| ntf-sweep-stale-push-subs | weekly Sun 03:00 enabled | `0 3 * * 0`, enabled, In sync, no runs yet | PASS |
Screens: t3_jobs_p1.png, t3_jobs_p2.png

## Task 4: QA scenarios T1–T46 (live shared HQ; read/preview only, nothing sent)
| ID | Result | Evidence |
|---|---|---|
| T1, T2 | BLOCKED | Needs 20 consenting test customers + campaign; not on shared HQ |
| T3, T8, T11, T35 | BLOCKED | Need Redis stop / parallel dispatch; staging only (guide runbook 10) |
| T4, T41 | BLOCKED (not run) | Need order creation + notification text check in tenant app |
| T5, T6, T7, T37 | BLOCKED | Need tenant access token + curl / developer |
| T9 | PASS | Tenant c9ac… all channels Used 0, Reserved 0, "Sends allowed" · t4_T9.png |
| T10, T12 | BLOCKED | Need real send / SQL |
| T13 | PASS (read part); kill-sender BLOCKED | `*/5`, runs Success every 5 min · t4_T13.png |
| T14 | BLOCKED | Would create overrides on live; not run |
| T15 | PASS (note) | "Assembly Completed" v1 EN+AR, `{{order_number}}` input, re-render resolved; EMAIL badge reads "In-app text (no text for this channel)" · t4_T15.png |
| T16 | BLOCKED | No DRAFT versions exist (117 templates all approved) · t4_T16.png |
| T17 | PASS | notifread: no test-send block · t4_T17.png |
| T18–T22, T24 | BLOCKED | Real test sends / suppression / rate limit; not run without explicit approval |
| T23 | BLOCKED | Audit Trail shows setting changes only; Filters button does nothing · t4_T23.png |
| T25 | PASS (partial) | Window selector works; "No provider traffic"; Control/Circuit columns not rendered without rows · t4_T25.png |
| T26–T32, T36 | BLOCKED | Pause/drain/failover/breaker on live providers; test env only |
| T33 | PASS | notifread: no Pause/Drain/Resume/Reset/Add-rule · t4_T33.png |
| T34, T46 | PASS | 2026-10-11..17 "No differences" · t4_T34.png, t4_T46.png |
| T38 | BLOCKED | Changes live config value; not run |
| T39 | PASS (partial) | EN "Standard text · 66 chars · 1 part", AR "Unicode · 65 chars · 1 part"; long-text warning not exercised · t4_T39.png |
| T40 | BLOCKED (not run) | Tenant app check pending |
| T42–T44 | BLOCKED | Pausing demo org + sends; awaiting owner OK |
| T45 | PASS | notifread: list visible, no Pause/Resume · t4_T45.png |
| P1 / E3 | PASS | opsread: 147 keys, read-only notice, history works · t4_P1_E3.png |

## Task 5: left for the owner
- Restore drill rehearsal on staging.
- Assigning runbook owners.

## Unexpected
1. QA Notifications Read role sees enabled write buttons on many notification screens (Task 2) plus Add Version / Edit Header on templates.
2. QA Ops Read gets intermittent "no permission" on Scheduled Jobs and Operations Catalog; catalog shows destructive ops with "Run here" tags.
3. EMAIL preview badge says "In-app text (no text for this channel)".
4. Audit Trail has no notification actions and Filters button is dead (T23).
5. ntf-campaign-scheduler: no override marker; description still says every minute.
6. Retention sweep last run shows 08:00 vs 04:00 schedule (time zone display).
7. HQ new-user form has no password field (temp password + forced change).
