# Progress summary — Workflow Order Advance

**Updated:** 2026-09-04  
**Overall:** Create hydration leftover close-out **done**. Catalog **1.3.0**. **Next:** floor smoke HC1/HC2 + H1–H4; S10 canary unsigned.

## Accurate status

```text
Discovery signed; 0437, 0441, and 0442 applied locally and remotely by operator
Public confirm-received → engine CONFIRM_DELIVERY
Public tracking shows pay-on-collection due + disables confirm after delivered
Public links use opaque /track/{token} paths
ActionBar false-bounce fixed (hasLoaded)
Tenant workflow settings now show read-only effective profile on V2
All production workflow writers and transition readers cut over to app engine/catalogs
Legacy raw PATCH/bulk writers retired with authenticated 410 responses
Migration 0442 applied to revoke Legacy/Enhanced workflow RPC execution grants without dropping functions
Focused pre-audit validation: 49 Jest tests + 2 anonymous Playwright tests passed
Release audit: direct staff delivered shortcuts disabled; delivery/POD is NO-GO pending atomicity, RBAC, route, concurrency, and payment remediation
Preparation completion now uses an authenticated atomic stage command/API with required idempotency and workflow concurrency checks
Counter pickup now uses an authenticated atomic stage command/API with release fulfilment, collection gate, idempotency, and workflow concurrency checks
Ready worklists, detail, and public tracking now distinguish not-yet-released from available-for-pickup without exposing internal rack/staff data
Public Ready confirmation requires an active pickup release and reuses the counter-handover command; duplicate active release actions are blocked server-side
Delivery proof/audit is a reusable tenant-scoped read surface on Delivery Stop Detail and Order Details; private object keys stay server-side and evidence links are signed for five minutes
Workboard is implemented as a dedicated `workboard:read` supervisor projection with tenant filters and stage-owned deep links; queue membership and ownership resolve from the order live `wf_profile_version_id`, and orders without a complete version binding are excluded from operational visibility
Workboard owner metrics now group by live profile version identity (`wf_profile_version_id`), so supervisor totals never merge distinct live policy versions
Semantic Profile Runtime governance accepted: ADR-SAAS-MNG-0009 replaces the P0 graph-pin as the future runtime, with DRAFT -> PILOT -> PUBLISHED -> RETIRED, HQ-only Pilot assignment governance, and identical tenant production paths for test/demo execution
Semantic Profile Runtime schema migration `0457` applied locally and remotely by operator; generated database types regenerated and updated
Semantic Profile Runtime action cutover: semantic-order action listing/execution reads only the order-pinned immutable artifact; it enforces screen visibility, channel bindings, action edges, reason requirements, evidence fail-closed behavior, and typed profile-integrity failures without mutable catalog fallback
Semantic runtime enforcement: observer modules remain read-only even if malformed artifact input emits an execution; action discovery and execution require an enabled primary owner and owner status membership, except an explicit cross-cutting command such as `public_tracking` with a declared edge/channel. Semantic financial gate runtime shares transaction-locked rack, preparation, payment-type, and outstanding-balance facts; positive balances block `fin_release_eligible`, unknown gates fail closed, and `CREDIT_INVOICE` delegates to the isolated B2B payment-hold seam, currently non-blocking because order creation owns the existing B2B credit decision

Semantic initial-state enforcement: normal, remote, retail, and Quick Drop create paths resolve initial status from the immutable profile artifact; unmatched semantic policy now rejects order creation with `PROFILE_INITIAL_RULE_UNMATCHED` instead of silently using a legacy status shortcut

Semantic assignment safety: conflicting profile/version bindings at the same applicable specificity now reject new-order profile resolution rather than using creation timestamp as a hidden policy tie-breaker
Semantic service-scope safety: every distinct order-item service category resolves its own workflow assignment; conflicting immutable snapshots require an explicit order split and return `PROFILE_SERVICE_SCOPE_CONFLICT` instead of pinning the first item's policy
Ready pickup-policy UX: if the compiled profile omits the `pickup_handover` command surface, the stage panel explains the missing policy in EN/AR rather than displaying an empty action area or bypassing the stage API
Semantic context cutover: V2 Processing, QA, Assembly, and Packing no longer derive destinations from mutable template flags; their actions resolve the immutable artifact edge server-side. The compatibility workflow-context endpoint now projects semantic modules from the order artifact and returns a typed profile error instead of consulting template configuration.
Shared extended gate runtime: piece, QA, pickup/delivery collection, pickup-release, delivery-stop, and POD-evidence gates now use the same locked-order facts as rack/preparation/finance. Missing facts fail closed in semantic mode. Partial fulfilment, returns, and OTP remain fail closed. Catalog seed `0463_sys_wf_gate_ops_fulfilment.sql` applied locally and remotely by the operator (2026-08-22).
Stage-owned command adapters are live for Processing, Assembly, QA pass/fail, Packing, and Ready release, with bearer+CSRF parity and no destination guessing. Ready Details now presents make-available, remaining collection, and confirm-pickup in one panel. Processing list Mark Ready uses `/api/v1/processing/{id}/complete`.
Staff delivery complete uses the same ActionBar + stage-owned pattern as Ready: `/dashboard/delivery/{id}` with hidden generic `CONFIRM_DELIVERY`. If a pending/in-transit stop exists, the stop command writes POD + stop + route + engine; otherwise `POST /api/v1/delivery/orders/{orderId}/complete` confirms from the order and never invents a dummy route. Catalog already maps `CONFIRM_DELIVERY` on `driver_delivery`; simple vs routed is HQ binding of `delivery_stop_active` / POD evidence on the published artifact. Legacy capturePOD/route writers remain 503; generic `/actions` and `/transition` reject CONFIRM_DELIVERY. Semantic snapshot orders with compiled delivery evidence permit independent optional signature/photo/POD/notes methods and required counts/notes. The stop POD method list is filtered by that compiled evidence (`GET /api/v1/delivery/pod-methods?stopId=`). Pickup completion enforces required compiled pickup notes. OTP may be authored as optional but completion still rejects it. Local DB tests cover collection blocking, tenant isolation, OTP reject, already-delivered, engine-failure rollback, and the happy path with route counters. Order-keyed unit tests cover collection blocking, existing-stop refuse, notes-only complete, and compiled photo without a stop. Complete requires delivery:pod and orders:transition.
Warning/override gate decisions are live for semantic snapshot orders: available-actions issues HMAC acknowledgement challenges; execute re-evaluates live facts, records org_wf_gate_decision_mst plus WORKFLOW_GATE_DECISION_ACCEPTED, and ActionBar collects acknowledgement or a minimum-length override reason. Public channels remain hard-block only. Processing-list Mark Ready still fail-closes with WF_GATE_ACK_REQUIRED if that action is compiled with a warning.
Floor worklists send `workflow_screen`; semantic orders use artifact membership rather than a live contract status list.
Absolute semantic-only cutover: engine, workflow context, Workboard, floor lists, client transition adapter, and new-order initial status no longer read graph pins, templates, live catalogs, status filters, or fallback statuses. Unsnapshotted historic/test orders fail closed operationally and must be recreated; migration `0464` is applied locally and remotely and prevents future incomplete active order snapshots. HQ effective preview/tenant simulation are artifact-backed and legacy HQ authoring writes are retired with `LEGACY_WORKFLOW_RETIRED`.
Automated semantic-profile assurance: Pilot only on HQ test/demo tenants; latest assignment stays PUBLISHED; forged screen/channel rejected; PROFILE_* integrity maps to HTTP 409. Residual: S10 canary, performance soak, visual a11y/RTL, HQ/tenant close-out.
Cross-project validation (2026-08-26): HQ workflow service tests passed 33/33; HQ semantic-policy mapper tests passed 6/6; HQ API/web builds, scoped ESLint, and EN/AR parity passed. Tenant semantic runtime tests passed 24/24 and `web-admin` typecheck passed.
Next: recreate affected test orders. For simple delivery, HQ must leave `delivery_stop_active` unbound on `CONFIRM_DELIVERY` and compile/publish. Then run the operator/e2e canary for routed staff POD smoke S10 (`p7-harden`). Durable B2B policy remains a separate B2B feature.
```

## Completed

- [x] ADR, discovery, catalogs, engine, canary smoke
- [x] Stage screens + ActionBar + skip edges + rack (0434/0435)
- [x] No auto-jump to next stage after complete
- [x] Cancel orchestrator (narrow allowlist, no Fin unwind) + hold/stop engine
- [x] P5: `/transition` and domain writers are engine-only; no server fallback
- [x] ADR_CANCEL_RETURN_RULES Accepted + vocabulary §5 updated
- [x] Apply `0436_sys_wf_cancel_hold_stop_adr.sql`
- [x] P4 public confirm actor (code + migration 0437 create-only)
- [x] P3: PATCH/bulk status retired with 410
- [x] P6 tenant profile UI on `settings/workflows` for V2 tenants
- [ ] P7R architecture and hardening reopened: establish reusable workflow-command/stage-service APIs before delivery remediation; existing tests did not cover staff POD atomicity, authorization, route consistency, or payment gates
- [x] P7R foundation: transaction-composable WorkflowEngine plus atomic Delivery completion (order-keyed and stop-owned); legacy route/POD writers remain 503
- [x] P7R Preparation: atomic stage-owned completion command/API; legacy server action derives tenant/actor from server authentication
- [x] P7R Pickup: atomic counter-handover command/API; `CONFIRM_PICKUP` fulfils release audit and transitions ready → delivered
- [x] P7R Pickup availability: tenant-safe release-state read model, staff/public visibility, public-release prerequisite, and duplicate-release fail-closed guard
- [x] P7R Delivery proof/audit: reusable authenticated tenant-scoped API/card on Delivery Stop Detail and Order Details, with signed private evidence links and focused service/API coverage
- [x] P7R Workboard: tenant-safe read model/API, RBAC/access contract, EN/AR Cmx screen, supervisor filters, and owner-stage routing from immutable semantic artifacts (legacy compatibility retained temporarily)
- [x] P0 semantic profile snapshot: new orders persist exact artifact identity, revision, checksum, and schema version; loader validates snapshots fail closed
- [x] P0 semantic gate runtime: shared rack/preparation/financial evaluator uses transaction-locked order facts for action list and execution; unpaid release blocks consistently and B2B credit delegates to a non-blocking B2B-owned policy seam
- [x] P0 semantic extended gates: piece, QA, collection, pickup-release, delivery-stop, and POD-evidence evaluators share the same locked facts; unsupported partial/return/OTP remain fail closed; catalog seed `0463` applied locally and remotely
- [x] P7R stage commands: Processing, Assembly, QA, Packing, and Ready/Release use versioned adapters; Ready fulfilment panel unifies pickup/collection; Processing list no longer guesses `toStatus`
- [x] P0 semantic runtime enforcement: action list/execution, Workboard, and floor worklists use immutable artifacts for semantic orders; graph-pin execution is retired for profile-stamped orders; unsnapshotted historic orders still use live catalogs
- [x] Warning/override gate-decision runtime: HMAC acknowledgement, RBAC override, immutable ledger/outbox, public hard-block, staff ActionBar dialogs
- [x] Compiled POD method list: `GET /api/v1/delivery/pod-methods?stopId=` narrows catalog methods to snapshot evidence
- [x] P0 semantic context: V2 floor-page actions no longer guess destinations from template flags; artifact-backed workflow context remains display-only and legacy template context is isolated to legacy orders
- [x] P5 reader exit: screen contracts/available transitions use catalogs and app engine
- [x] P5 grant contraction migration `0442` applied locally and remotely
- [x] Documentation pack refresh: guide files + token rollout notes

## Remaining

- [x] Apply `0437_sys_wf_public_confirm_actor.sql`
- [x] Apply `0441_public_order_tracking_tokens.sql` local and remote (operator confirmed)
- [x] Automated public confirm-received smoke
- [x] Apply `0442_retire_workflow_rpc_grants.sql` locally and remotely (operator confirmed 2026-08-14)
- [x] Define initial P7R Delivery command contract: tenant context, permissions, validation, idempotency, concurrency, audit/outbox, and standard errors
- [x] Establish stage-owned services/APIs for Processing, Quality, Packing, Ready/Release, Pickup, and atomic Delivery complete; legacy capturePOD/route writers remain 503
- [x] Implement atomic staff POD + stop/route + `CONFIRM_DELIVERY` transaction as the P7R delivery service
- [x] Delivery floor detail (`/dashboard/delivery/{id}`) with ActionBar + stage-owned confirm; order-keyed complete when no stop exists; no dummy routes
- [x] Enforce collect-first for remaining PAY_ON_COLLECTION (Order Fin modal; command does not collect money)
- [x] Enforce method-specific POD evidence (SIGNATURE/PHOTO/MIXED), idempotency, and collection policy; OTP remains fail-closed
- [x] Delivery DB coverage includes collection, isolation, OTP, already-delivered, engine-failure rollback, happy-path route counters, stale-version rollback, idempotent replay, and serialized dual-complete
- [x] Complete API requires `delivery:pod` and `orders:transition`; denial does not call the command
- [x] Remove graph-pin/legacy execution for profile-stamped snapshot orders (`p7r-profile-no-legacy-cutover`)
- [x] Automated semantic-profile assurance for Pilot/PUBLISHED, forged screen/channel, snapshot integrity, and PROFILE_* HTTP 409 (`p7r-profile-assurance`)
- [ ] Make the explicit staff S10 rollout decision after e2e/canary (`p7-harden`)
- [ ] Repeat production cancel/hold/resume/stop smoke after `0442`; keep S10 unsigned until the rollout decision
- [ ] Sign pilot T01-T18 and rollback rehearsal
- [x] Build the supervisor Workboard
- [x] Migrate Processing, QA, Packing, Assembly, Ready/Release callers to stage-owned APIs
- [ ] V1.1 return sub-order
