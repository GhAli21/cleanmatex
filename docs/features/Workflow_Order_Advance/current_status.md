# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **P1–P3 partial in repo** (canary off) |
| Status | Migrations applied (local+remote); remote discovery **signed** 2026-07-25 |
| Date | 2026-07-24 (overnight) |
| Version | [version.txt](version.txt) → `0.3.0-p1-p2-engine` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (you) | Enable HQ `workflow_engine_v2` (or env) on **one** canary tenant; smoke prep → processing + ready release actions |
| Next (code) | P4 public actor + release harden; P5 retire Legacy/Enhanced; P6 tenant UI; P7 e2e; `/documentation` |
| Ready for production canary | **Yes (single-tenant)** — discovery OK; enable flag and smoke |
