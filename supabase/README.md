# CleanMateX Supabase Workspace

This directory contains the shared Supabase workspace for CleanMateX. It is the central location for schema-related assets, migration history, seed-related material, and selected database operation guides used by the rest of the repository.

## Purpose

Use this directory as the shared database and auth reference for:

- `web-admin/`
- `cmx-api/`
- future mobile clients
- local development workflows that depend on the shared Supabase stack

## What Lives Here

- `migrations/`: migration history and supporting notes
- `RUN_SYNC_PERMISSIONS.md`: operational guide for syncing missing permissions
- generated and helper SQL assets used with the shared platform schema

## Important Rules

- Treat this as the shared database source area for the repo
- All tenant-scoped data must respect `tenant_org_id`
- Use RLS and tenant-safe patterns for `org_*` tables
- Do not treat destructive reset flows as the default recommendation in feature or module docs
- If a schema/process guide conflicts with implemented code or top-level project guardrails, update the doc before relying on it

## Related Documentation

- `../README.md`
- `../docs/README.md`
- `../CLAUDE.md`
- `migrations/xproduction/README.md`
- `migrations/xseeds/README.md`
- `RUN_SYNC_PERMISSIONS.md`

## Documentation Cleanup Note

This area still contains historical naming patterns such as `xproduction` and `xseeds`, while some older docs still reference `production/` and `seeds/`. During documentation refresh work, always reconcile those references to the actual current folder structure before reusing them elsewhere.
