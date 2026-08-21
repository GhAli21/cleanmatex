# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **V1.0 release hardening reopened** |
| Status | Engine cutover, public tracking, auditable counter pickup, delivery proof/audit, and the read-only Workboard are implemented. Workboard uses pinned V2 profile memberships per order and stage-owned deep links; staff delivery completion remains fail-closed pending P7R assurance and rollout approval. |
| Date | 2026-08-21 |
| Version | [version.txt](version.txt) → `0.4.9-p7r-delivery-proof-audit` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (engineering) | Complete P7R Delivery database-backed rollback/tenancy/concurrency/payment/RBAC coverage and caller cutover; then migrate Processing, Quality, Packing, and Ready/Release to the same stage-command model |
| Next (operator) | Review and apply `0455_workboard_permission_navigation.sql`, then verify Workboard visibility for a supervisor role, filters, and owner-stage deep links on both a pinned V2 order and a legacy order. Continue direct/staged counter-handover, pay-on-collection, and public-tracking smoke. Do not smoke staff S10 until delivery hardening is approved. |
| Next (product) | V1.1 return sub-order / projection follow-up after V1.0 acceptance |
| Ready for production canary | **No for full V1.0** — public confirmation is green; staff delivery/POD remains a release blocker |
