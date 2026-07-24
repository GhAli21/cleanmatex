# Overnight checkpoint — Workflow Order Advance

**Date:** 2026-07-24  
**Authority:** [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)

## Expert decision (2026-07-24)

**Mass rename map = deferred.** V1.0 is additive catalogs + engine. See [PRODUCTION_DECISION_RENAME.md](PRODUCTION_DECISION_RENAME.md).

## What shipped in code/docs (pending your DB apply + canary)

| Area | Status | Notes |
|------|--------|--------|
| P0 ADR + docs correction | Done | Discovery SQL **not signed** |
| Rename map | **Rejected for V1.0** | Additive only |
| P1 migrations | **Files created — not applied** | `0427`, `0428` |
| P2 engine + APIs | Done | + release rows on RELEASE_* |
| UI/UX | Partial | `WorkflowActionBar` on prep + ready; FastItemizer → prep complete API under canary |
| Flag | Catalog + resolver | `workflow_engine_v2` HQ key + env force-on |
| Graph check | Script ready | `scripts/workflow/check_sys_wf_graph.sql` |
| P3 writers | Partial | See [WRITER_INVENTORY.md](WRITER_INVENTORY.md) |
| P4–P7 | Remaining | Public actor, retire Legacy/Enhanced, full screen action bars, e2e, `/documentation` |

## How to activate (after you review/apply migrations)

1. Apply `0427` then `0428` via your normal Supabase process (**do not** ask agents to apply).
2. Regenerate Prisma client if needed (`npx prisma generate` in `web-admin`).
3. Set `WORKFLOW_ENGINE_V2=true` (server) and `NEXT_PUBLIC_WORKFLOW_ENGINE_V2=true` (UI hook).
4. Prefer `GET …/available-actions` + `POST …/actions` with `Idempotency-Key`.
5. Reconnect remote MCP and fill [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md).

## Rollback

Unset `WORKFLOW_ENGINE_V2` / `NEXT_PUBLIC_WORKFLOW_ENGINE_V2`. Schema is additive (expand/contract later).

## Remaining writers to cut over (P3)

- Enhanced/Legacy transition when flag off
- Batch auto-ready, PATCH/bulk status, ItemProcessing status flips, public confirm-intake, cancel/return RPCs, workflow-stats
