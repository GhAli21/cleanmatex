# Progress summary — Workflow Order Advance

**Updated:** 2026-08-14
**Overall:** P1–P7 repository implementation and RPC grant contraction deployed; finish post-apply smoke and pilot acceptance

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
Focused validation: 49 Jest tests + 2 anonymous Playwright tests passed
Next: repeat post-0442 smoke → monitor legacy RPC denials → sign pilot T01-T18
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
- [x] P7 hardening: order-control unit policy, workflow service coverage, and anonymous tracking E2E
- [x] P5 reader exit: screen contracts/available transitions use catalogs and app engine
- [x] P5 grant contraction migration `0442` applied locally and remotely
- [x] Documentation pack refresh: guide files + token rollout notes

## Remaining

- [x] Apply `0437_sys_wf_public_confirm_actor.sql`
- [x] Apply `0441_public_order_tracking_tokens.sql` local and remote (operator confirmed)
- [x] Automated public confirm-received smoke
- [x] Apply `0442_retire_workflow_rpc_grants.sql` locally and remotely (operator confirmed 2026-08-14)
- [ ] Repeat production cancel/hold/resume/stop + delivery smoke after `0442`
- [ ] Sign pilot T01-T18 and rollback rehearsal
- [ ] V1.1 return sub-order
