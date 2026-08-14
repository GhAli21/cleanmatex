# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **V1.0 release hardening reopened** |
| Status | Engine cutover and public tracking complete; staff delivery/POD is fail-closed pending remediation |
| Date | 2026-08-14 |
| Version | [version.txt](version.txt) → `0.4.4-p7r-preparation-command` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (engineering) | Add database-backed P7R Delivery rollback/tenancy/concurrency/payment tests, evidence storage controls, and caller cutover; then migrate Processing, Quality, Packing, Ready/Release, and Pickup to the same stage-command model |
| Next (operator) | Do not smoke staff S10 until the hardening work lands; continue non-delivery post-`0442` smoke |
| Next (product) | V1.1 return sub-order / projection follow-up after V1.0 acceptance |
| Ready for production canary | **No for full V1.0** — public confirmation is green; staff delivery/POD remains a release blocker |
