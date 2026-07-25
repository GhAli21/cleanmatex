# Progress summary — Workflow Order Advance

**Updated:** 2026-07-25  
**Overall:** Canary smoke done; P3 stage screens wired; **0434 skip edges applied**

## Accurate status

```text
Discovery signed; migrations through 0434 applied (operator)
P3: useOrderTransition → executeAction under client canary
WorkflowActionBar on prep/processing/assembly/qa/packing/ready
0434 skip transitions applied — template flag skips ready to smoke
Next: re-smoke full stage path (stages on/off) → cancel/return + P5 retire Legacy
```

## Completed

- [x] ADR, discovery, catalogs, engine, canary smoke (RELEASE_FOR_PICKUP)
- [x] Stage Complete buttons use engine when public canary flag on
- [x] Action bars on processing / assembly / qa / packing
- [x] preferredToStatus + skip-edge migration `0434` applied

## Remaining

- [ ] Re-smoke processing→ready with assembly/qa/packing off and on
- [ ] Cancel/return engine wire
- [ ] P4 public confirm actor
- [ ] P5 block Legacy/Enhanced when server flag on
- [ ] P6 tenant profile UI
- [ ] P7 e2e + checklist + `/documentation`
