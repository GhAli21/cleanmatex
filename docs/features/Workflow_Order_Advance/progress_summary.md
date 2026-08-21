# Progress summary — Workflow Order Advance

**Updated:** 2026-08-21
**Overall:** Engine cutover, public tracking, counter pickup, and read-only delivery proof/audit are implemented; staff delivery completion and P7R assurance remain release-blocking

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
Workboard is implemented as a dedicated `workboard:read` supervisor projection with historical P0 pinned-graph routing, tenant filters, and stage-owned deep links; migration `0455` remains operator-owned
Semantic Profile Runtime governance accepted: ADR-SAAS-MNG-0009 replaces the P0 graph-pin as the future runtime, with DRAFT -> PILOT -> PUBLISHED -> RETIRED, HQ-only Pilot assignment governance, and identical tenant production paths for test/demo execution
Semantic Profile Runtime schema migration `0457` applied locally and remotely by operator; generated database types regenerated and updated
Next: implement HQ semantic profile compiler/lifecycle APIs, then tenant artifact runtime before consumer cutover; complete stage-service boundaries, delivery database-backed assurance/caller cutover, S10, post-0442 smoke, and pilot T01-T18
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
- [x] P7R foundation: transaction-composable WorkflowEngine plus server-disabled atomic Delivery completion command and contract
- [x] P7R Preparation: atomic stage-owned completion command/API; legacy server action derives tenant/actor from server authentication
- [x] P7R Pickup: atomic counter-handover command/API; `CONFIRM_PICKUP` fulfils release audit and transitions ready → delivered
- [x] P7R Pickup availability: tenant-safe release-state read model, staff/public visibility, public-release prerequisite, and duplicate-release fail-closed guard
- [x] P7R Delivery proof/audit: reusable authenticated tenant-scoped API/card on Delivery Stop Detail and Order Details, with signed private evidence links and focused service/API coverage
- [x] P7R Workboard: tenant-safe, profile-pinned read model/API, RBAC/access contract, EN/AR Cmx screen, supervisor filters, and owner-stage routing
- [x] P5 reader exit: screen contracts/available transitions use catalogs and app engine
- [x] P5 grant contraction migration `0442` applied locally and remotely
- [x] Documentation pack refresh: guide files + token rollout notes

## Remaining

- [x] Apply `0437_sys_wf_public_confirm_actor.sql`
- [x] Apply `0441_public_order_tracking_tokens.sql` local and remote (operator confirmed)
- [x] Automated public confirm-received smoke
- [x] Apply `0442_retire_workflow_rpc_grants.sql` locally and remotely (operator confirmed 2026-08-14)
- [x] Define initial P7R Delivery command contract: tenant context, permissions, validation, idempotency, concurrency, audit/outbox, and standard errors
- [ ] Establish stage-owned services/APIs so Processing, Quality, Packing, Ready/Release, and remaining Delivery writers do not rely on screen-local workflow writers
- [x] Implement server-disabled atomic staff POD + stop/route + `CONFIRM_DELIVERY` transaction as the first P7R service
- [ ] Compose approved payment collection into the staff flow or retain the enforced collect-first operational contract with complete UI/mobile support
- [ ] Enforce method-specific POD evidence, idempotency/concurrency, deferred-payment collection policy, and route-counter consistency
- [ ] Complete Delivery database-backed rollback, tenant-isolation, concurrency, route-counter, payment, and RBAC regression coverage, then make the explicit staff-rollout decision and cut callers to the versioned API
- [ ] Repeat production cancel/hold/resume/stop smoke after `0442`; keep delivery S10 blocked until hardening lands
- [ ] Sign pilot T01-T18 and rollback rehearsal
- [x] Build the supervisor Workboard
- [ ] Migrate remaining stage callers to stage-owned service/API boundaries
- [ ] V1.1 return sub-order
