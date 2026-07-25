# Progress summary — Workflow Order Advance

**Updated:** 2026-07-25  
**Overall:** ADR cancel/hold/stop in repo + **0436 applied** (operator)

## Accurate status

```text
Discovery signed; migrations through 0436 applied (operator)
0436 ADR cancel/hold/stop live (narrow cancel, hold/resume/stop, stopped)
Cancel: draft/intake/incomplete preparing only; NO auto Fin unwind
Return deferred to V1.1
Next: smoke cancel/hold/resume/stop → P4 / e2e
```

## Completed

- [x] ADR, discovery, catalogs, engine, canary smoke
- [x] Stage screens + ActionBar + skip edges + rack (0434/0435)
- [x] No auto-jump to next stage after complete
- [x] Cancel orchestrator (narrow allowlist, no Fin unwind) + hold/stop engine
- [x] P5: `/transition` uses engine only when `workflow_engine_v2` on
- [x] ADR_CANCEL_RETURN_RULES Accepted + vocabulary §5 updated
- [x] Apply `0436_sys_wf_cancel_hold_stop_adr.sql`

## Remaining

- [ ] Smoke cancel (early only) + hold/resume/stop (no auto money)
- [ ] P4 public confirm actor
- [ ] P6 tenant profile UI
- [ ] P7 e2e + checklist + `/documentation`
- [ ] V1.1 return sub-order
