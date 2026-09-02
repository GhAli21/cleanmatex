# 09 — Audit, Notifications, Observability

**Status:** Live normalized runtime observe events are in tenant services · **Date:** 2026-08-29

## 1. History

Every `executeAction` writes order history (actionCode, from/to, actor, state_version, idempotency key).

## 2. Outbox — reuse central

- Emit via existing `emitEventTx` / central outbox (see `outbox.service.ts`, history consumer patterns)
- Do **not** default to `org_wf_outbox_tr`
- Single emitter during dual-path cutover (no double notify)
- Consumers: notifications, Fin/ERP — compatibility matrix required before flip

## 3. Logs

Structured observe helper: `web-admin/lib/services/workflow/workflow-observability.ts`.

Command INFO: `wf.command.ok` / `wf.command.idempotent_replay` with `tenantId`, `orderId`, `screen`, `actionCode`, `channel`, `latencyMs`, optional `requestId` / `profileVersionId`.

Fail-closed WARN: `wf.policy.incomplete|unavailable`, `wf.command.denied|conflict|profile_integrity`, `wf.public_confirm.rejected`.

Successful policy loads are DEBUG (`wf.policy.loaded` / `wf.policy.cache_hit`) so floor worklists do not flood INFO.

**Never log** tracking tokens, POD object keys, notes, or money amounts. Support procedure: [technical_docs/live_runtime_support.md](technical_docs/live_runtime_support.md). HQ Studio/on-call events are `hq.wf.*` in the sibling HQ repo.

## 4. Metrics

In-process counters (same event names) plus log aggregation. Count policy integrity failures, command denials/conflicts/replays, pickup/delivery commits, and public confirm rejects. Alert thresholds are in the support runbook. Outbox lag remains the existing outbox alerts.
