# Database Helper Scripts

This directory contains local helper scripts for database setup, reseeding, and demo-user support during development.

## Files In Scope

- `reset-with-seeds.ps1`
- `reset-production.ps1`
- `load-seeds.ps1`
- `create-demo-admins.js`

## Important Usage Rule

These scripts are for intentional local development workflows only.

- do not recommend destructive reset flows as the default path in feature docs
- document clearly when a script destroys local data
- if a safer non-destructive workflow is enough, prefer that in documentation

## Script Summary

### `reset-with-seeds.ps1`

Use this only when you intentionally want a fresh local database plus demo data.

- destructive to local data
- expected to rebuild schema, load seed data, and prepare a local demo state

### `reset-production.ps1`

Use this only when you intentionally want a clean local schema without demo data.

- destructive to local data
- expected to rebuild schema without local demo seeding

### `load-seeds.ps1`

Use this when the schema already exists and you only need to load demo or lookup data into the local environment.

### `create-demo-admins.js`

Use this when demo users need to be created or repaired in a local environment after schema and seed data already exist.

## Common Local Workflow

1. Start shared services from the repo root.
2. Decide whether you need a destructive reset or only a non-destructive data load.
3. Run the appropriate script intentionally.
4. Verify local app login and tenant visibility afterward.

## Dependencies

- PowerShell for `.ps1` helpers
- Node.js 20+ for JS helpers
- local Supabase services when the script depends on the shared database
- workspace dependencies installed where required

## Troubleshooting

If a script fails:

- verify local services are running
- verify required workspace dependencies are installed
- verify the referenced schema and seed directories still match the actual `supabase/` folder structure
- update documentation if the script behavior has changed from what this README describes

## Related Documentation

- `../../README.md`
- `../../docs/README.md`
- `../../supabase/README.md`
- `../../supabase/migrations/xproduction/README.md`
- `../../supabase/migrations/xseeds/README.md`
