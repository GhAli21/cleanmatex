# ADR — Scope and P0 correction pass (expert lock)

**Date:** 2026-07-24  
**Status:** Accepted  
**Decider:** Engineering (expert production path)

## Context

ChatGPT evaluation of the P0 pack demanded Full Pack V1 (multidim columns, work groups, outsourcing, HQ designer, customer milestones) and immediate `operational_status` rename before P1. That conflicts with a safe production cutover of today’s dual Legacy/Enhanced engines.

## Decision

**Engine-first production V1 (V1.0)**, then **phased V1.1 / V1.2** for platform depth — not a single big-bang Full Pack.

### V1.0 (must ship for production cutover)

- Single app `WorkflowEngine`; action codes; `listAvailableActions` = execute policy
- Config catalogs + transitions/actions/gates/initial rules; **HQ-authored publish + assign**
- Tenant: read-only effective profile + optional pick from HQ-approved list; **no** tenant editing of transitions/statuses/gates/initial rules
- Worklist SoT during cutover: `current_status` (physical column); dual-write `status`; later contract migration
- Ready ≠ release; Fin eligibility; release records for partial fulfilment
- Reuse **central** outbox/idempotency where they exist
- `state_version` concurrency (not `updated_at` alone)
- Atomic `CONFIRM_DELIVERY` with POD in payload
- Retail: not auto-`closed`; closure only after policy
- Prep: `preparation_status` bridge only; target stage-execution model
- Rename tables only when responsibility is wrong — not rename-for-prefix as P1 primary
- **Explicit:** the plan “Rename map” (`sys_workflow_template_*` → `sys_wf_*`, etc.) is **deferred**. V1.0 ships additive catalogs; optional later expand→contract rename is hygiene, not a production gate.
- Writer inventory elimination; canary; RLS; EN/AR

### V1.1 (same product line, after engine stable)

- Derived/projected multidimensional summaries (fulfilment/exception/custody/customer milestone) — prefer projections or additive columns; contract migration off overloaded single-status semantics
- Stage executions as permanent stage SoT (retire header side fields)
- Work groups for mixed-service parallel routes (minimal viable)

### V1.2

- Full outsourcing jobs/vendors/reconciliation
- Richer HQ Platform designer UX in cleanmatexsaas (tenant consumes via HQ API)
- Expanded customer milestone notification mapping

### Explicitly rejected for V1.0

- Big-bang rename `current_status` → `operational_status` as P1 prerequisite
- Permanent Legacy + Enhanced adapters
- DB facade RPCs as transition authority
- Tenant Workflow Studio that edits graph/rules
- Parallel `sys_workflow_definitions_*` long-name stack
- Feature-specific outbox when central outbox works

## Consequences

- P0 marked **correction pass / incomplete** until docs match this ADR
- P1 remains blocked until **remote** discovery + this ADR reflected in 01–13
- Discovery always uses **remote** DB (`supabase_remote` MCP, read-only) — see [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md)
- ChatGPT Full Pack remains **reference**, not authority
- Central outbox/idempotency reuse is locked from code evidence even before remote row counts land
