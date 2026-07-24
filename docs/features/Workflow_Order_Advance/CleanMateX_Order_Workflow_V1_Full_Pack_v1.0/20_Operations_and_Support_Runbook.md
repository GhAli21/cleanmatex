# CleanMateX Order Workflow V1 — Operations and Support Runbook

**Document ID:** CMX-OW-V1-PACK-020  
**Version:** 1.0  
**Status:** Operations specification

## 1. Dashboards

Command volume/success/latency/conflicts/replays/blockers, projection drift, outbox lag/dead letters, ready-by risk, vendor overdue, partial fulfilment aging, delivery failures, authorization denials, 5xx.

## 2. Alerts

Critical: cross-tenant, double release spike, rebuild failure, migration failure, outbox unavailable, payment/release inconsistency, unknown custody.

High: command failure spike, p95 breach, vendor overdue, delivery failures, dead-letter growth.

## 3. Stale state

Confirm another command changed the order, reload state/actions, never force overwrite, investigate frequent conflicts.

## 4. Projection drift

Query diagnostic, identify authoritative records, run tenant/order rebuild, verify history, record incident, fix root cause. Do not directly edit projections.

## 5. Outbox backlog

Check worker/provider, retry/dead letter, resume safely, confirm idempotency. Do not rerun workflow command to resend notification.

## 6. Release conflict

Inspect active release lines, history/idempotency, physical custody, and resolve through cancellation/return policy. Never delete release history.

## 7. Outsourcing discrepancy

Block completion, record missing/wrong/damaged, create issue/hold, inspect custody evidence, manager resolve, reconcile, continue.

## 8. Delivery mismatch

Inspect command/history/outbox, verify release authority, rebuild projections, confirm POD. Never manually set completed.

## 9. Payment/release mismatch

Query Order Fin, verify facts, refresh eligibility, never modify payment from workflow, escalate finance defect.

## 10. Assignment issue

Resolve effective assignment trace, confirm published/active version, service/branch scope, plan/market. Do not casually edit active snapshots.

## 11. Emergency disable

Use feature flag or assignment rollback for new orders. Existing orders retain snapshots. Active migration requires approved process.

## 12. Pre-production reset

Confirm no customers, backup/tag, record migration list, reset, replay, seed, test, verify integrations, sign off.

## 13. Backup/restore

Schema, data, roles, migration history, evidence metadata, Git tag, deployment version. Restore rehearsal before GA.

## 14. Support evidence

Capture tenant/order, correlation, action, actor/source, state version, history, release/job, error, time, screenshot/log. Protect PII/evidence.

## 15. Severity

S1: cross tenant, money duplication, double handover, data/custody loss.

S2: broad block, migration failure, collection/delivery unavailable, drift at scale.

S3: individual order, notification delay, UI defect.

## 16. Maintenance jobs

Drift scan, outbox retry/dead letter, vendor overdue, SLA warning, approval expiry, assignment activation, evidence retention. Jobs are idempotent/tenant-aware.

## 17. Acceptance criteria

Support can trace actions, rebuild projections, retry notifications without rerunning commands, and recover from reset/backup without arbitrary status editing.
