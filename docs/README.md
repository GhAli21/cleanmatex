# CleanMateX Documentation Index

This directory contains the project documentation hub: active plans, feature docs, operational guides, technical references, and historical archives.

## Start Here

Use these files first:

1. `../README.md`: repo entrypoint and module map
2. `../CLAUDE.md`: project guardrails and implementation rules
3. `plan/master_plan_cc_01.md`: primary high-level master plan reference
4. `features/`: feature-level docs, implementation notes, and PRD-aligned material
5. `dev/claude-code-efficiency-guide.md`: workflow guidance for AI-assisted development

## Documentation Areas

The real `docs/` structure is broader than the older index implied. Current areas include:

- `features/`: feature folders, implementation notes, PRD-linked docs, and status files
- `plan/`: high-level plans and older planning references
- `plan_cr/`: broad PRD and planning corpus that still overlaps with `plan/`
- `dev/`: development workflows, migration notes, implementation aids, and troubleshooting
- `api/`: API references and backend-facing technical docs
- `config/`: environment and configuration guidance
- `deployment/`: deployment-related notes and external deployment pointers
- `Database_Design/`: schema notes and database references
- `security/`: security and tenant-isolation references
- `migration/`: migration-specific supporting docs
- `testing/`: testing references
- `users/`, `admins/`, `developers/`: audience-specific docs
- `implementation/`: implementation support material
- `master_data/`: data and setup references
- `navigation/`: navigation/tree-related docs
- `langs/`: language and localization support docs
- `_archive/`: retired or historical documentation
- loose root files such as `troubleshooting.md`, `progress.md`, and `development-setup.md`

## Planning And PRD Guidance

Planning material currently spans two parallel areas:

- `plan/`: treat this as the primary home for the high-level master plan
- `plan_cr/`: treat this as a large PRD and planning backlog that still needs consolidation

Until the planning corpus is fully normalized:

- use `plan/master_plan_cc_01.md` as the primary high-level roadmap reference
- cross-check important planning assumptions against `plan_cr/` and implemented code/docs
- do not assume a PRD is current unless it matches the already implemented scope

## Module Documentation

Important module-level documentation lives outside `docs/` too:

- `../web-admin/README.md`
- `../cmx-api/README.md`
- `../supabase/README.md`
- `../scripts/README.md`
- `../mobile-apps/README.md`
- `../packages/README.md`
- `../infra/README.md`
- `../qa/README.md`

Use those together with feature and plan docs so module reality and feature docs stay compatible.

## How To Use This Documentation

### If you are onboarding

- start with `../README.md`
- read `../CLAUDE.md`
- use `dev/claude-code-efficiency-guide.md`

### If you are updating a feature

- check the relevant folder under `features/`
- check overlapping PRDs in `plan/` and `plan_cr/`
- update implementation-facing docs and PRDs together when both exist

### If you are working on data or migrations

- check `../supabase/README.md`
- review `Database_Design/`
- use `security/` and `dev/` notes for multi-tenancy and migration workflow

### If you are working on UI or admin flows

- check `../web-admin/README.md`
- use feature docs under `features/`
- cross-check i18n and UI rules from `../CLAUDE.md`

## Documentation Standards

When updating docs in this repository:

- reconcile docs to the already implemented reality
- keep module docs and PRDs compatible and consolidated
- clearly label implemented, in-progress, deferred, and proposed scope
- archive stale duplicates instead of leaving them alongside active docs
- capture unresolved decisions in a dated `current_urgent_decesion_YYYY_MM_DD.md` file before treating them as approved direction

## Known Ongoing Cleanup Areas

These are under active documentation consolidation:

- overlap between `plan/` and `plan_cr/`
- inconsistent feature-folder naming under `features/`
- older loose root docs inside `docs/`
- stale indexes such as `folders_lookup.md`

## Navigation

- `../README.md`
- `../CLAUDE.md`
- `plan/master_plan_cc_01.md`
- `features/`
