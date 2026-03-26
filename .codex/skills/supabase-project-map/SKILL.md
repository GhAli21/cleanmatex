---
name: supabase-project-map
description: Connect to CleanMateX Supabase environments, inspect local or remote project state safely, and map where Supabase is used across this repository. Use when onboarding to Supabase, doing read-only discovery, or orienting future work.
user-invocable: true
---

# Supabase Project Map

Use this skill when the task is to understand how CleanMateX connects to Supabase, which environment to inspect, and where Supabase-related code and schema live in this repo.

## Scope

- Project: `cleanmatex` only
- Purpose: onboarding, read-only discovery, project mapping
- Not for: applying migrations, resetting databases, or changing infrastructure

## Guardrails

- Never run `supabase db reset`.
- Never apply migrations from the agent. Create SQL files only, then stop for user review.
- Never modify existing migration files.
- In tenant-facing code, every `org_*` query must remain tenant-scoped by `tenant_org_id`.
- Treat `SUPABASE_SERVICE_ROLE_KEY` as sensitive and server-only.

## Environment Selection

Choose one target first:

- `supabase_local`
  - MCP endpoint: `http://192.168.100.24:54321/mcp`
  - Use for local schema/data discovery tied to this workspace
- `supabase_remote`
  - MCP endpoint: `https://mcp.supabase.com/mcp?project_ref=ndjjycdgtponhosvztdg`
  - Use for read-only discovery against the hosted project

If MCP access is unavailable in the current session, fall back to repository evidence from the paths listed in [project-map.md](./references/project-map.md) and state that the map is file-based rather than live-database verified.

## Workflow

1. Confirm the active project is `cleanmatex`, not `cleanmatexsaas`.
2. Decide whether the task needs `supabase_local`, `supabase_remote`, or only file-based inspection.
3. Read the repo map in [project-map.md](./references/project-map.md).
4. For live discovery, keep operations read-only:
   - inspect schemas, tables, functions, policies, storage buckets, auth settings
   - prefer listing and describing over changing anything
5. For code mapping, inspect these first:
   - `supabase/`
   - `web-admin/lib/supabase/`
   - `cmx-api/src/supabase/`
   - `docs/config/`
   - `.codex/docs/supabase-rules.md`
6. Summarize findings in four parts:
   - target environment used
   - how the app connects
   - where schema and migrations live
   - tenant-isolation and service-role risks

## What To Return

Return a compact map with:

- environment chosen: local, remote, or file-based only
- connection points: env vars, client wrappers, ports, MCP endpoint
- database authority: `supabase/migrations/`, `supabase/config.toml`, tests, schemas
- app touchpoints: `web-admin` client/server wrappers and `cmx-api` admin client
- safety notes: RLS, `tenant_org_id`, migration restrictions

## References

- [project-map.md](./references/project-map.md)
