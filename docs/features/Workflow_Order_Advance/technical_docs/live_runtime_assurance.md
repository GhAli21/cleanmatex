# Live normalized profile-version runtime — automated assurance

**Audience:** tenant engineering  
**Runtime:** `WorkflowPolicyResolver` on live profile-version rows. Compiled artifacts are not authority.  
**Related:** [LIVE_NORMALIZED_PROFILE_RUNTIME.md](../LIVE_NORMALIZED_PROFILE_RUNTIME.md), [live_runtime_support.md](live_runtime_support.md)  
**Historical compiled-era notes:** [semantic_profile_assurance.md](semantic_profile_assurance.md) (do not treat as V1.0 runtime law)

This is not the staff S10 operator/e2e canary. Support must never edit `org_orders_mst.current_status`.

## What is proven

| Concern | Evidence |
|---------|----------|
| No compiled-artifact fallback | Source scan: resolver, artifact wrapper, create binding, Workboard, floor lists, pickup, delivery, public tracking never mention `sys_wf_prof_ver_artifact_cf`. Create persists version identity only. |
| Incomplete / unbound | Incomplete version binding throws `PROFILE_SNAPSHOT_INCOMPLETE` without querying policy rows. Fully unbound returns null (engine then fail-closes). Floor lists and Workboard exclude those orders. |
| Pilot vs Published | Resolver caches Published by `version_id:policy_revision` only. Pilot is assembled on every load. `DRAFT` / `RETIRED` / profile-id mismatch → `PROFILE_ARTIFACT_UNAVAILABLE` without assemble. Assignment table is never consulted at execute time. |
| Owner vs observer | Runtime adapter keeps observer screens read-only even if an execution row exists. Direct `CONFIRM_PICKUP` from observed `ready` requires `pickup_handover` + that edge + `allow_direct_counter_pickup`. Workboard observer execute is rejected (0470 guard DB tests). |
| Channel | Server-derived cookie → `staff_web`, bearer → `mobile`, verified OPEN POS → `pos` on pickup/intake/delivery only. Runtime returns no edge for `mobile` on staff_web-only 0472 floor execs, `staff_web` on public-only OFD confirm, or `public_web` on `CONFIRM_PICKUP`. |
| HTTP integrity | `PROFILE_*` → 409; `ACTION_NOT_ALLOWED` → 403 on stage adapters and public OFD confirm. |
| Fulfilment fail-closed | Pickup and delivery unit tests reject unbound orders. Pickup DB tests cover SIMPLE live policy happy path, isolation, collection, OTP, already-delivered, engine rollback, stale version, idempotent replay (local DB). |
| Observe privacy | `toWorkflowObserveContext` drops tokens, notes, proof keys, and money. Resolver/command events stay countable. |

## What remains (not this slice)

- Operator/e2e staff POD delivery smoke **S10**
- Performance soak under concurrent commands
- Local demo `org_wf_profile_assign_cf` if running tenant against localhost (reviewed script `scripts/workflow/local_demo_wf_v2_simple_assign.sql`; remote already assigned)
- Open-order profile migration (explicit approved process, not support)
- Partial fulfilment (Off)

## Commands

```bash
cd web-admin
npx jest --testPathPattern="workflow-policy-resolver.service|semantic-workflow-artifact.service|semantic-workflow-runtime.service|workflow-engine.no-legacy|workflow-profile-resolution.service|workboard-query.service|stage-worklist-query.service|pickup-completion.service|delivery-completion.service|public-order-tracking.service|workflow-observability|workflow-command-channel|workflow-engine-http" --no-coverage
npm run test:db-integration -- pickup-handover.db.test.ts
```
