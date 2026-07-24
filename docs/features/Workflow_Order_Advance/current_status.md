# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **P1–P3 partial in repo** (canary off) |
| Status | Migrations **created, not applied**; remote discovery **unsigned** |
| Date | 2026-07-24 (overnight) |
| Version | [version.txt](version.txt) → `0.3.0-p1-p2-engine` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (you) | Review/apply `0427`+`0428` → reconnect remote MCP / paste discovery → set `WORKFLOW_ENGINE_V2=true` on canary tenant |
| Next (code) | P4 public actor + release harden; P5 retire Legacy/Enhanced; P6 tenant UI; P7 e2e; `/documentation` |
| Ready for production canary | **No** — until migrations applied + discovery signed + flag tested |
