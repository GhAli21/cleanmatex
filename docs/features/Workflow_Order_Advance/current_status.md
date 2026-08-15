# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **V1.0 release hardening reopened** |
| Status | Engine cutover, public tracking, and auditable counter-pickup availability/handover are deployed locally and remotely; local database acceptance passed; staff delivery/POD is fail-closed pending remediation |
| Date | 2026-08-15 |
| Version | [version.txt](version.txt) → `0.4.8-pickup-cutover-hardening` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (engineering) | Add database-backed P7R Delivery rollback/tenancy/concurrency/payment tests, evidence storage controls, and caller cutover; then migrate Processing, Quality, Packing, and Ready/Release to the same stage-command model |
| Next (operator) | Smoke direct and staged counter handover, pay-on-collection blocking, and public tracking in the promoted environment; do not smoke staff S10 until delivery hardening lands |
| Next (product) | V1.1 return sub-order / projection follow-up after V1.0 acceptance |
| Ready for production canary | **No for full V1.0** — public confirmation is green; staff delivery/POD remains a release blocker |
