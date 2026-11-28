# Step 9 — Prove it, soak, fold the docs

Status (28 Nov 2026): **docs fold done (RUNBOOK.md written, the six I11 documents marked superseded). The proof runs and the 48-hour soak need the deployed system: Owner with Dev, after steps 6g / 7 / 8 are committed and deployed.**

Pass criteria (DESIGN §10.2 step 9): **zero duplicate messages, zero cross-tenant writes, empty dead-letter queue** at the end of the soak.

## Before starting

1. Commit and deploy web-admin, cmx-workers, HQ API, HQ web (everything from steps 5–8, 6g, 7).
2. HQ → Ops → Jobs: every queue and schedule the Owner wants live is on; Workers shows `cmx-workers` and `hq-api` running; Dead letters handled (QA 7.4); no alert.
3. Sentry alert rule on tag `ops_alert` in place (RUNBOOK §3).

## 9.1 Run each job twice (idempotency)

For each scheduled job: Jobs tab → **Run now**, wait for the result, **Run now** again.

| Job | Check after the second run |
|---|---|
| Gift card / loyalty / credit note expiry | Recent jobs: second run `{"found":0}` or same expired count 0; no second EXPIRE ledger row per card / note / lot |
| POS rollover | No session paused or closed twice (session events: one per session) |
| File purge | Second run `{"purged":0,...}` |
| ERP retry (queue a SYSTEM_ERROR as in QA 6.3, retry it twice from the Workbench) | One journal per source document; second retry ends RETRIED / no new journal |
| Finance reaction (redrive one order-history job from Recent jobs data by re-publishing the event: submit then edit an order) | One order-history row per event (`org_ops_job_effect_tr` claims once) |
| Notification (`ntf.deliver`: QA 5.3 order email; then redrive the same job id from Dead letters if it failed) | One provider message per outbox row (`provider_message_id` set once) |

The database already refuses a second effect claim (`org_ops_job_effect_tr` unique `effect_key` per Organization) and a second outbox row for the same send (`org_ntf_outbox_dtl` unique `idempotency_key`). So the proof is on the results: after the double runs, the business tables above show one row per event / card / note / session, and every delivered outbox row has one `provider_message_id` and one SENT history.

## 9.2 Kill a consumer mid-job

1. Queue a long batch (a campaign test to many demo recipients, or a file purge with many deleted files).
2. While Recent jobs shows a job Running, restart the cmx-workers service on Render (and separately HQ API during `ntf.deliver`).
3. **Expected:** the job is retried after its expiry (`expire_s`) or heartbeat loss, completes once; no duplicate sends (`org_ntf_outbox_dtl`: one SENT per row), no half-applied row; Workers shows the new instance; WORKER_SILENT fires only if the restart exceeded 2 minutes.

## 9.3 Provider timeouts

1. Temporarily point the demo Organization's SMS (or email) provider to an unreachable endpoint (HQ → Notifications → Connections, demo only).
2. Send one notification. **Expected:** `ntf.deliver` retries with backoff; after the last retry the outbox row is FAILED_TEMPORARY / ACCEPTANCE_UNCERTAIN per the provider result, the job is in Dead letters, the DEAD_LETTER alert fires once; `ntf.reconcile` settles uncertain rows. Restore the provider; Redrive; exactly one message arrives.

## 9.4 48-hour soak (demo Organizations)

Normal demo use for 48 hours: orders, payments, POS sessions across the business-day boundary, gift cards and credit notes with short expiry dates, a small campaign.

Check every 12 hours and at the end:

| Check | Pass |
|---|---|
| Alert banner / Sentry `ops_alert` events | None unexplained |
| Dead letters | Empty at the end (each one explained and redriven or deleted) |
| Duplicates | Effects and outbox rows are unique by constraint; check the results instead: one order-history entry per order event, one EXPIRE ledger row per expired card / note, no customer reports a repeated message, `pgboss.job` completed count per reaction queue ≈ events published for it |
| Cross-tenant writes | For every reaction row written in the soak, its `tenant_org_id` equals the event's (`org_domain_events_outbox.tenant_org_id`) — spot-check 20 rows per reaction type |
| Workers | Both running all 48 h (restarts by deploy only) |
| Database | `pgboss.job` size stays bounded (retention 7 days); connections stay under the pool limits (cmx-workers 4, HQ API pool) |

Record the evidence (screenshots of the tabs, query results) in STATUS.md, step 9 row.

## 9.5 Docs fold (done 28 Nov)

| Old (I11, `docs/pending_to_production/16_11_2026/`) | Now |
|---|---|
| `I11_background_execution_V2_ARCHITECTURE.md` | Already moved: [DESIGN.md](DESIGN.md) |
| `I11_background_execution_EXPERT_REPLAN.md`, `..._redesign_ADR.md`, `..._handler_contracts.md` | Superseded by [DESIGN.md](DESIGN.md) (header added) |
| `I11_background_execution_RUNBOOK.md` | Superseded by [RUNBOOK.md](RUNBOOK.md) (header added) |
| `I11_background_execution_QA_TEST_GUIDE.md` | Superseded by [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) (header added) |
| `I11_background_execution_redesign_PLAN.md` | Kept as the dated progress log of the program |

One design ([DESIGN.md](DESIGN.md)), one runbook ([RUNBOOK.md](RUNBOOK.md)), one QA guide ([QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)); STATUS / RESUME / STEP plans stay as the working record.
