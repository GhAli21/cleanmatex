# 11 — Implementation Roadmap

**Detail:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · **Scope:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)
**Status (2026-09-10):** this table is the original phase plan and is kept for scope-lock traceability; it does not track live status. For current phase/progress see `current_status.md` (updated 2026-09-10) and `13_Production_Readiness_Checklist.md`. Actual progress well past this table's original "P0c (current)" marker: engine cutover, delivery/pickup atomic commands, S10 staff routed POD canary (SIGNED 2026-09-05), Delivery Feature Completion Phases 1–6, and Gate 5 HQ compiled-artifact retirement (applied both DBs 2026-09-10) are all done. Remaining V1.0 blockers per the readiness checklist: `PAY_ON_COLLECTION` acceptance gate (parked), canary/rollback rehearsal, and the rest of T01–T18 (see `12_Test_Plan.md`).

| Phase | Outcome | Status (2026-09-10) |
|-------|---------|---------|
| **P0c** | Correction pass | Done |
| **P0 sign-off** | Discovery signed | Done (2026-07-25) |
| **P1** | Additive schema + seed (rename only if needed) | Done |
| **P2 / P2b** | Engine + screen integrations | Done |
| **P3–P7** | Cutover → Studio-lite → harden | Done — P7R delivery floor + S10 canary signed |
| **V1.1** | Multidim projections, stage executions, work groups MVP | Not started |
| **V1.2** | Outsourcing, richer HQ designer | Not started |
| **Final** | `/documentation` pack | This refresh pass (2026-09-10); V1.0 blockers above still open |
