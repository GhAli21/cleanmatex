# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **P1–P3 partial in repo** (canary off) |
| Status | Migrations applied (local+remote); remote discovery **signed** 2026-07-25 |
| Date | 2026-07-24 (overnight) |
| Version | [version.txt](version.txt) → `0.3.9-p4-public-tracking-token` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (you) | Apply `0441`; smoke public confirm-received after `0437` (verify disabled state + opaque link + pay-on-collection notice); smoke cancel/hold/stop |
| Next (code) | P7 e2e + checklist + docs refresh; P5 retire RPCs; return V1.1 |
| Ready for production canary | **Yes (single-tenant)** — discovery OK; enable flag and smoke |
