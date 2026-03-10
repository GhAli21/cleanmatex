# How To Run `sync_missing_permissions.sql`

This guide explains how to execute `sync_missing_permissions.sql` safely in a local development environment.

## Purpose

Use this script when component-linked permissions need to be synchronized into the database without relying on a broader migration or reset workflow.

## Prerequisites

- local Supabase services are running
- database access is available on the local development port
- `sync_missing_permissions.sql` exists in this directory

## Recommended Method: `psql`

From the project root:

```powershell
cd supabase
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f sync_missing_permissions.sql
```

## Alternative Method: Supabase Studio

1. Open Supabase Studio at `http://localhost:54323`
2. Open the SQL editor
3. Paste the contents of `sync_missing_permissions.sql`
4. Run the script and review the output

## Verification

After running the script, verify that:

- the expected permissions exist
- the expected role-permission mappings exist
- no unexpected errors were reported

## Troubleshooting

### Connection issues

- run `supabase status`
- start local services if needed

### Missing relations or schema mismatch

- verify that the local schema is up to date with the current shared database structure
- prefer aligning migrations and schema docs before recommending destructive reset workflows

### No permissions inserted

This can be valid if the permissions already exist. The script should be safe to rerun when it is designed to be idempotent.

## Notes

- use this as a targeted local maintenance step
- if the script should become part of controlled schema history, create a proper migration intentionally and document it
- do not treat this guide as approval to run destructive database resets by default
