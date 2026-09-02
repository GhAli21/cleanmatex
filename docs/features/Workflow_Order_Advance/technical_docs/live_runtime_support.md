# Live workflow runtime — support runbook

**Audience:** tenant support / on-call  
**Runtime:** live normalized profile-version rows (`WorkflowPolicyResolver`). Do not treat compiled artifacts as authority.  
**Related:** [LIVE_NORMALIZED_PROFILE_RUNTIME.md](../LIVE_NORMALIZED_PROFILE_RUNTIME.md), [09_Audit_Notifications_Observability.md](../09_Audit_Notifications_Observability.md)

Support must **never** update `org_orders_mst.current_status` (or `status`) directly. HQ Studio/on-call: [HQ live_runtime_support.md](F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/Workflow_Engine_HQ/live_runtime_support.md).

## 1. Safe diagnosis fields

Search logs for `feature=workflow` and `event` starting with `wf.`. Allowed context:

- `tenantId`, `orderId`, `profileId`, `profileVersionId`, `versionNo`, `policyRevision`
- `screen`, `actionCode`, `channel`, `errorCode`, `latencyMs`, `requestId`
- `httpStatus` on public confirm rejects

Never ask for or paste public tracking tokens, POD object keys, notes, or money amounts into tickets.

## 2. Event → meaning

| Event | Meaning | First check |
|---|---|---|
| `wf.policy.incomplete` | Order binding is missing `wf_profile_id` / `wf_profile_version_id` / `wf_version_no` | Recreate the order under an assigned live profile. Do not migrate open-order status. |
| `wf.policy.unavailable` | Bound version is not active Pilot/Published | HQ assignment / version lifecycle. Existing orders keep their bound version. |
| `wf.policy.loaded` / `wf.policy.cache_hit` | Resolver succeeded (debug) | Noise unless paired with a command failure |
| `wf.command.denied` | Channel, screen membership, gate, or reason | Live exec/channel/gate rows for that version; server-derived channel (`staff_web` / `mobile` / `pos` / `public_web`) |
| `wf.command.conflict` | `VERSION_CONFLICT` or idempotency mismatch | Reload `stateVersion`; do not reuse a key with a different payload |
| `wf.command.profile_integrity` | `PROFILE_*` on execute | Same as incomplete/unavailable |
| `wf.command.idempotent_replay` | Safe replay of the original result | Not a failure |
| `wf.pickup.committed` / `wf.delivery.committed` | Stage-owned handover wrote | History + outbox should exist for the same order |
| `wf.public_confirm.rejected` | Public confirm 4xx | Release required, channel `public_web`, or live policy |

## 3. Assignment and Pilot

- Changing `org_wf_profile_assign_cf` affects **new** orders only.
- Production Published versions are immutable. A policy fix needs a new version + new-order assignment.
- Pilot is executable only on HQ test/demo tenants. Do not “fix” a live order by editing Published rows.
- Local DB only: reviewed script `scripts/workflow/local_demo_wf_v2_simple_assign.sql` (not a migration; do not run on remote).

## 4. Blocked gates

Re-run available-actions for the owning screen. Hard blocks (`GATE_*`, `WF_GATE_HARD_BLOCKED`) need facts (rack, collection, release, stop, evidence). Warning/override needs a fresh HMAC challenge or override permission — public tracking never overrides.

## 5. Alerts (log-derived)

Until a metrics backend is wired, count `event` in the log pipeline:

| Signal | Suggested threshold | Owner |
|---|---|---|
| `wf.policy.incomplete` or `wf.policy.unavailable` sustained | > 10 / 5 min on one tenant | Tenant workflow + HQ assignment |
| `wf.command.conflict` spike | p95 conflicts with unchanged clients | Tenant app / retry bugs |
| `wf.command.denied` spike after a publish | Immediate | HQ Check policy vs 0472 channels |
| Cross-tenant 404/403 anomalies | Any unexpected rise | Security + tenant isolation |
| Outbox retry backlog | Existing outbox alerts | Notifications |

## 6. Escalation

If the only remaining “fix” would be rewriting an in-flight order’s profile version or status, **stop**. Capture `tenantId`, `orderId`, `profileVersionId`, `event`, `errorCode`, and escalate. Open-order profile migration is an explicit approved process, not a support action.
