# 09 — Audit, Notifications, Observability

**Status:** P0 correction pass · **Date:** 2026-07-24

## 1. History

Every `executeAction` writes order history (actionCode, from/to, actor, state_version, idempotency key).

## 2. Outbox — reuse central

- Emit via existing `emitEventTx` / central outbox (see `outbox.service.ts`, history consumer patterns)
- Do **not** default to `org_wf_outbox_tr`
- Single emitter during dual-path cutover (no double notify)
- Consumers: notifications, Fin/ERP — compatibility matrix required before flip

## 3. Logs (P2 before canary)

`tenantId`, `orderId`, `screen`, `actionCode`, `from`, `to`, `gates`, `stateVersion`, `idempotencyKey`, `latencyMs`, `outcome`

## 4. Metrics

Success/fail, gate blocks, version conflicts, idempotency replay, outbox lag
