# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **V1.0 release hardening reopened** |
| Status | Engine cutover, public tracking, auditable counter pickup, delivery proof/audit, and the read-only Workboard are implemented. New orders with an HQ semantic profile assignment resolve one immutable artifact and persist the exact profile version, artifact, revision, checksum, and schema-version snapshot. `listAvailableActions`, `executeAction`, Workboard, and workflow context now use that artifact for semantic orders, enforcing module visibility, owner-stage routing, action bindings, command channel, reason/evidence requirements, hard-block gates, and typed profile-integrity failures without consulting mutable catalogs. V2 floor screens submit actions rather than template-derived destinations. Semantic rack, preparation, and financial release gates now read the same transaction-locked order facts in both action discovery and execution; unpaid balances block release and B2B credit remains fail-closed pending durable invoice/reservation validation. Legacy orders remain on the temporary pinned-graph/live-contract compatibility path; staff delivery completion remains fail-closed pending P7R assurance and rollout approval. |
| Date | 2026-08-22 |
| Version | [version.txt](version.txt) → `0.4.9-p7r-delivery-proof-audit` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (engineering) | Extend the shared semantic gate evaluator with durable B2B invoice/reservation, fulfilment, piece, QA, and evidence facts; then cut over every stage-owned service/API to the compiled artifact path. Remove the pinned-graph/global-catalog execution fallback only after consumer and database-integration assurance proves no active caller depends on it. Complete P7R Delivery assurance afterwards. |
| Next (operator) | Review and apply `0455_workboard_permission_navigation.sql`, then verify Workboard visibility for a supervisor role, filters, and owner-stage deep links on both a pinned V2 order and a legacy order. Continue direct/staged counter-handover, pay-on-collection, and public-tracking smoke. Do not smoke staff S10 until delivery hardening is approved. |
| Next (product) | V1.1 return sub-order / projection follow-up after V1.0 acceptance |
| Ready for production canary | **No for full V1.0** — public confirmation is green; staff delivery/POD remains a release blocker |
