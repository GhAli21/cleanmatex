# Progress summary — Workflow Order Advance

**Updated:** 2026-07-25  
**Overall:** P3 cancel/return cutover + P5 transition gate landed in repo

## Accurate status

```text
Discovery signed; migrations through 0435 applied (operator)
0436 cancel/return graph parity created (apply next)
Cancel/return: Fin disposition + executeAction + unwind when V2 on
Transition API: V2 tenant flag blocks Legacy/Enhanced entirely
Next: apply 0436 → smoke cancel/return → public confirm (P4) / e2e (P7)
```

## Completed

- [x] ADR, discovery, catalogs, engine, canary smoke
- [x] Stage screens + ActionBar + skip edges + rack (0434/0435)
- [x] No auto-jump to next stage after complete
- [x] Cancel/return orchestrator + engine audit columns
- [x] P5: `/transition` uses engine only when `workflow_engine_v2` on

## Remaining

- [ ] Apply `0436_sys_wf_cancel_return_graph_parity.sql`
- [ ] Smoke cancel (paid + unpaid) and return → `returned`
- [ ] P4 public confirm actor
- [ ] P6 tenant profile UI
- [ ] P7 e2e + checklist + `/documentation`
