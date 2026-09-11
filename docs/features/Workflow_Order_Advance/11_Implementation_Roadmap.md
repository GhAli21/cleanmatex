# 11 — Implementation Roadmap

**Detail:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · **Scope:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)
**Status (2026-09-11):** original phase table kept for scope-lock. Live status: `current_status.md` and `13_Production_Readiness_Checklist.md`. V1.0 engineering is past S10 / T01–T18 (T15 CI graph-validator owner-deferred). Remaining V1.0 operator work: apply `0499`, HQ Check policy on SIMPLE v4, quick-drop smoke. Next product train is V1.0.x (open-order migrate + 46 planned Check-policy codes) then V1.1.

| Phase | Outcome | Status (2026-09-10) |
|-------|---------|---------|
| **P0c** | Correction pass | Done |
| **P0 sign-off** | Discovery signed | Done (2026-07-25) |
| **P1** | Additive schema + seed (rename only if needed) | Done |
| **P2 / P2b** | Engine + screen integrations | Done |
| **P3–P7** | Cutover → Studio-lite → harden | Done — P7R delivery floor + S10 canary signed |
| **V1.1** | Multidim projections, stage executions, work groups MVP | Not started |
| **V1.2** | Outsourcing, richer HQ designer | Not started |
| **Final** | `/documentation` pack | V1.0 close-out refresh 2026-09-11; full pack audit (`lwpr-tenant-docs-final`) still open |
