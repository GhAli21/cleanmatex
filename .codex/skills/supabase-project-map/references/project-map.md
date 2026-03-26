# CleanMateX Supabase Map

## MCP Targets

- Local MCP: `supabase_local` -> `http://192.168.100.24:54321/mcp`
- Remote MCP: `supabase_remote` -> `https://mcp.supabase.com/mcp?project_ref=ndjjycdgtponhosvztdg`

Use MCP for read-only discovery when available. If it is not available in the current session, use the repository paths below.

## Local Runtime Ports

Derived from `supabase/config.toml`:

- API: `http://127.0.0.1:54321`
- Postgres: `54322`
- Studio: `http://127.0.0.1:54323`
- Inbucket: `http://127.0.0.1:54324`

## Repo Authority

### Shared database source of truth

- `supabase/config.toml`
- `supabase/migrations/`
- `supabase/schemas/`
- `supabase/tests/`
- `supabase/types.ts`

Rules:

- Create new migrations only in `supabase/migrations/`
- Never edit existing migration files
- Never apply migrations from the agent
- Never use reset workflows by default

### Web app touchpoints

- `web-admin/lib/supabase/client.ts`
  - browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `web-admin/lib/supabase/server.ts`
  - server client with cookie-backed auth and RLS
  - contains `createAdminSupabaseClient()` using `SUPABASE_SERVICE_ROLE_KEY`
- `web-admin/types/database.ts`
  - generated database types target

### API touchpoints

- `cmx-api/src/supabase/supabase-admin.service.ts`
  - service-role Supabase client for server-side admin access
- `cmx-api/src/modules/auth/auth.service.ts`
  - anon-key client for token refresh

## Environment Variables To Look For

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Primary repo references:

- `.env.example`
- `cmx-api/.env.example`
- `docs/config/supabase_auth_setup.md`
- `docs/development-setup.md`

## Project Structure Relevant To Supabase

- `supabase/`
  - local project config, migrations, schema snapshots, SQL tests
- `web-admin/`
  - Next.js tenant-facing app using Supabase browser and server wrappers
- `cmx-api/`
  - NestJS API with service-role admin access on the server
- `docs/config/`
  - Supabase auth and key setup notes
- `.codex/docs/supabase-rules.md`
  - tenant isolation and client usage rules

## Safe Discovery Checklist

When mapping the project, check these in order:

1. `supabase/config.toml`
2. latest files in `supabase/migrations/`
3. `web-admin/lib/supabase/client.ts`
4. `web-admin/lib/supabase/server.ts`
5. `cmx-api/src/supabase/supabase-admin.service.ts`
6. `docs/development-setup.md`
7. `.codex/docs/supabase-rules.md`

## Risk Notes

- `org_*` tables are tenant-scoped and must respect `tenant_org_id`.
- `sys_*` tables are global and need extra care when accessed from tenant-facing code.
- Service-role clients bypass RLS and must stay on trusted server paths only.
- Local scripts in `package.json` include reset commands, but project rules override them: do not use reset unless the user explicitly asks and approves.
