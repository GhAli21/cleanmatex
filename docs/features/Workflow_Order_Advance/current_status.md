# Current status — Workflow Order Advance

| Field | Value |
|-------|--------|
| Phase | **P7 hardening + documentation pack refresh** (canary off) |
| Status | Discovery signed 2026-07-25; `0437` applied by operator; tokenized public tracking shipped in repo; `0441` still pending apply |
| Date | 2026-07-25 |
| Version | [version.txt](version.txt) → `0.3.10-p7-doc-pack-hardening` |
| Scope ADR | [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) |
| Checkpoint | [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md) |
| Writers | [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| Next (you) | Apply `0441_public_order_tracking_tokens.sql`; smoke public confirm-received after `0437` (verify opaque link, pay-on-collection notice, delivered disabled state); smoke cancel/hold/stop |
| Next (code) | P7 e2e/canary hardening; P5 retire RPCs; V1.1 return sub-order |
| Ready for production canary | **Yes (single-tenant)** — discovery OK; enable flag and smoke |
