# Progress summary — Workflow Order Advance

**Updated:** 2026-07-25  
**Overall:** P4 public confirm actor in repo (apply **0437** next)

## Accurate status

```text
Discovery signed; migrations through 0436 applied (operator)
0437 created: system actor + public_tracking ready/OFD → delivered
Public confirm-received → CONFIRM_DELIVERY when V2 on
ActionBar false-bounce fixed (hasLoaded)
Next: apply 0437 → smoke public confirm + cancel/hold → P3 PATCH gate / P6 / P7
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

## Remaining

- [ ] Apply `0437_sys_wf_public_confirm_actor.sql`
- [ ] Smoke cancel/hold/stop + public confirm-received
- [ ] P6 tenant profile UI
- [ ] P7 e2e + checklist + `/documentation`
- [ ] V1.1 return sub-order
