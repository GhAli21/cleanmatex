# CleanMateX Documentation Index

This directory is the human-facing documentation hub for CleanMateX.

It contains active plans, feature documentation, technical references, operational notes, and historical material. The repo is still carrying older parallel documentation structures, so this index focuses on how to find the current best source of truth quickly.

## Start Here

Use these references first:

1. `../README.md` for the repository entrypoint and module map
2. `../CLAUDE.md` for project guardrails and implementation rules
3. `plan/master_plan_cc_01.md` for the primary high-level roadmap
4. `features/` for feature-level documentation packs and implementation history
5. `dev/claude-code-efficiency-guide.md` for AI-assisted workflow guidance

## Documentation Model

For feature work, prefer a complete documentation pack instead of isolated files.

The target pack for a feature or meaningful sub-scope is:

- `README.md`
- `development_plan.md`
- `progress_summary.md`
- `current_status.md`
- `developer_guide.md`
- `developer_guide_mermaid.md`
- `user_guide.md`
- `user_guide_mermaid.md`
- `deploy_guide.md`
- `testing_guide_and_scenarios.md`
- `CHANGELOG.md`
- `version.txt`
- `technical_docs/`
- lookup/index files for that folder level when needed

Some older feature folders still use legacy names or partial structures. When improving docs, prefer converging toward this pack rather than creating more one-off files.

## Documentation Areas

Current documentation areas include:

- `features/` for feature folders, implementation notes, PRD-linked material, and status tracking
- `plan/` for active roadmap and planning material
- `plan_cr/` for older and overlapping PRD/planning content that still requires consolidation
- `dev/` for development workflows, migration notes, implementation aids, and troubleshooting
- `api/` for API and backend-facing references
- `config/` for configuration and environment guidance
- `deployment/` for deployment notes
- `Database_Design/` for schema and data references
- `security/` for security and tenant-isolation references
- `migration/` for migration support docs
- `testing/` for testing references
- `users/`, `admins/`, and `developers/` for audience-specific docs
- `implementation/` for implementation support material
- `master_data/` for setup and data references
- `navigation/` for navigation and tree-related docs
- `langs/` for localization references
- `_archive/` for retired or historical documentation
- root files such as `troubleshooting.md`, `progress.md`, and `development-setup.md`

## Feature Documentation Guidance

When working on a feature:

- start in `features/`
- look for the feature `README.md` first
- check whether the folder already has a development plan, status snapshot, progress log, developer guide, user guide, and testing guide
- update the existing canonical folder instead of creating a duplicate feature folder
- keep lookup/index files current when the folder has multiple sub-scopes

Useful related indexes:

- `folders_lookup.md`
- `features/folders_lookup.md`

## Planning And PRD Guidance

Planning material currently spans two parallel areas:

- `plan/` is the primary home for the high-level master plan
- `plan_cr/` is a large PRD and planning backlog that still needs consolidation

Until the planning corpus is fully normalized:

- use `plan/master_plan_cc_01.md` as the primary high-level roadmap
- cross-check important planning assumptions against `plan_cr/` and implemented code/docs
- do not assume a PRD is current unless it matches implemented reality

## Module Documentation Outside `docs/`

Important module-level documentation also lives outside this folder:

- `../web-admin/README.md`
- `../cmx-api/README.md`
- `../supabase/README.md`
- `../scripts/README.md`
- `../cmx_mobile_apps/README.md`
- `../packages/README.md`
- `../infra/README.md`
- `../qa/README.md`

Use those together with feature docs so implementation reality and feature documentation stay aligned.

## How To Use This Documentation

### If you are onboarding

- start with `../README.md`
- read `../CLAUDE.md`
- use `dev/claude-code-efficiency-guide.md`

### If you are updating a feature

- check the relevant folder under `features/`
- identify the canonical feature folder before editing
- update feature status/progress/docs together where possible
- cross-check overlapping PRDs in `plan/` and `plan_cr/`

### If you are working on data or migrations

- check `../supabase/README.md`
- review `Database_Design/`
- use `security/` and `dev/` notes for multitenancy and migration workflow

### If you are working on UI or admin flows

- check `../web-admin/README.md`
- use feature docs under `features/`
- cross-check i18n and UI rules from `../CLAUDE.md`

## Documentation Standards

When updating docs in this repository:

- reconcile docs to implemented reality
- prefer completing an existing documentation pack over creating scattered helper files
- clearly label implemented, in-progress, deferred, proposed, and historical scope
- keep module docs and PRDs compatible with implementation reality
- archive stale duplicates instead of leaving them beside active docs
- capture unresolved decisions explicitly before treating them as approved direction

## Known Ongoing Cleanup Areas

These areas are still under consolidation:

- overlap between `plan/` and `plan_cr/`
- inconsistent naming across older feature folders
- older loose root docs inside `docs/`
- stale or incomplete folder lookup indexes
- legacy one-off documentation files that should eventually be folded into feature packs

## Navigation

- `../README.md`
- `../CLAUDE.md`
- `plan/master_plan_cc_01.md`
- `features/`
- `folders_lookup.md`
