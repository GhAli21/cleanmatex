# Progress Summary - 10-03-2026

## Goal

Refresh all project documentation with no intentional gaps, align docs to real implementation, reduce conflicting guidance, and separate active authority from historical material.

## Completed Waves

### Wave 1: Core Entry Docs

Completed:

- repo entry docs updated
- docs hub updated
- primary module READMEs added or refreshed
- session urgent decision workflow file created and approved

Impact:

- top-level documentation is now far more discoverable
- placeholder or stale entrypoint guidance was removed
- planning authority direction is now explicit

### Wave 2: Shared Database And Module Guidance

Completed:

- `supabase/` docs refreshed
- script docs refreshed
- root `.clauderc` and `cmx-api/.clauderc` aligned to current repo reality

Impact:

- stale folder references such as `production/` vs `xproduction/` and `seeds/` vs `xseeds/` were reduced
- reset-heavy or overly broad guidance was softened in active docs

### Wave 3: Feature Doc Reconciliation

Completed:

- placeholder feature READMEs replaced with implementation-truthful summaries
- overclaiming feature docs downgraded to historical completion snapshots where needed
- stronger feature packs were distinguished from weaker or historical sibling folders

Impact:

- `docs/features/**` now has clearer active-vs-historical signals in the touched folders
- dashboard and order-related documentation conflicts were reduced

### Wave 4: Web Admin Markdown Cleanup

Completed:

- stale UI blueprint/example docs softened into historical or contextual references
- deployment and navigation testing docs updated away from older misleading defaults
- Prisma-local docs reframed as `web-admin`-specific rather than repo-wide authority

Impact:

- current UI import policy now has less competition from legacy markdown guidance
- risky outdated operational instructions are reduced in active local docs

### Wave 5: Guidance Authority Cleanup

Completed:

- `CLAUDE.md` aligned with current stack and planning direction
- selected `.claude/docs/**` guidance updated to reduce authority conflicts
- selected skill docs updated with clearer authority notes

Impact:

- less conflict between current repo truth and older guidance layers
- clearer distinction between historical guidance and current implementation authority

### Wave 6: Related-Files Consolidation Start

Completed:

- canonical grouping indexes were added for split dashboard and order feature families
- split sibling-folder READMEs were updated to point back to the canonical feature folder
- a session consolidation map was added to track same-feature docs spread across multiple folders

Impact:

- same-feature documentation is easier to discover from one canonical location
- split payment/workflow/dashboard folders now read as related history or subdomains instead of parallel equal authorities

### Wave 7: Remaining High-Risk Drift Cleanup

Completed:

- remaining placeholder feature READMEs were replaced with truthful summaries
- additional overclaiming status docs were downgraded to historical snapshots
- remaining high-risk `web-admin` Prisma and UI markdown was normalized
- high-risk `.claude` database, commands, multitenancy, architecture, and documentation guidance was rewritten to current repo reality

Impact:

- fewer active docs now compete with current module READMEs and `CLAUDE.md`
- dangerous reset-heavy or Prisma-first instructions were removed from remaining high-risk guidance docs
- more fragmented feature families now clearly point back to canonical folders

## In Progress

- more `docs/features/**` reconciliation
- archive/history normalization under approved Option C
- more physical relocation of same-feature docs into canonical feature/history folders

## Remaining Risks

- many legacy files still contain historical path references, version drift, or Prisma-first assumptions
- `docs/plan_cr/` still exists and must be gradually reconciled into `docs/plan/`
- some feature packs remain fragmented and need deeper current-code verification
- several same-feature files are now logically grouped but not yet fully physically relocated

## Current Best-Use Rule

For now, prefer this authority order:

1. current code and actual module structure
2. `CLAUDE.md`
3. current module READMEs and `docs/README.md`
4. `docs/plan/`
5. feature-local docs after checking whether they are active or historical
6. older `.claude` and migration-era docs as supporting context only
