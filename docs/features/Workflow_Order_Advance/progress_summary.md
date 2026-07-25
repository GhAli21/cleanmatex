# Progress summary — Workflow Order Advance

**Updated:** 2026-07-25  
**Overall:** P6 tenant profile UI in repo; public confirm UX hardened; run **0437** smoke next

## Accurate status

```text
Discovery signed; migrations through 0436 applied (operator)
0437 created: system actor + public_tracking ready/OFD → delivered
Public confirm-received → CONFIRM_DELIVERY when V2 on
Public tracking shows pay-on-collection due + disables confirm after delivered
ActionBar false-bounce fixed (hasLoaded)
Tenant workflow settings now show read-only effective profile on V2
Next: apply 0437 → smoke public confirm + cancel/hold → P7 / docs
```

## Completed

- [x] ADR, discovery, catalogs, engine, canary smoke
- [x] Stage screens + ActionBar + skip edges + rack (0434/0435)
- [x] No auto-jump to next stage after complete
- [x] Cancel orchestrator (narrow allowlist, no Fin unwind) + hold/stop engine
- [x] P5: `/transition` uses engine only when `workflow_engine_v2` on
- [x] ADR_CANCEL_RETURN_RULES Accepted + vocabulary §5 updated
- [x] Apply `0436_sys_wf_cancel_hold_stop_adr.sql`
- [x] P4 public confirm actor (code + migration 0437 create-only)
- [x] P3: PATCH/bulk status gated 410 when V2 on
- [x] P6 tenant profile UI on `settings/workflows` for V2 tenants

## Remaining

- [ ] Apply `0437_sys_wf_public_confirm_actor.sql`
- [ ] Smoke cancel/hold/stop + public confirm-received
- [ ] P7 e2e + checklist + `/documentation`
- [ ] V1.1 return sub-order
