Local in docker:
COMPOSE_PROJECT_NAME=cleanmatex
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=sb_publishable_ACJWIzQHLZjBrEguHvfOXg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjsKTKV-Uddkm0Hg_xSvEMPvz

Important for this project:

- The `sb_publishable_...` and `sb_secret_...` local keys are not the authoritative choice for raw PostgREST/RLS troubleshooting in this repo.
- During local verification on 2026-03-26, direct SQL against `org_tenants_mst` returned rows, but a REST call using the `sb_secret_...` local key returned `[]`.
- The same REST call succeeded when using the JWT-style local service-role token from the repo root `.env.example`.

Why this happens:

- The running local PostgREST container is configured with a JWT secret and evaluates claims such as `role`.
- For local REST tests that need `service_role` behavior, a JWT-style bearer token with the expected role claim works correctly with local RLS behavior.
- In this setup, the `sb_secret_...` key should not be assumed to behave the same way for direct PostgREST testing.

Use this rule:

- For application/client configuration, keep using the local values required by the running stack.
- For raw local REST debugging against `http://localhost:54321/rest/v1/...`, prefer the JWT-style local keys from `supabase/.env.localdbjh`:
  - `LOCAL_REST_ANON_JWT`
  - `LOCAL_REST_SERVICE_ROLE_JWT`
- If those variables are missing, fall back to the JWT-style local keys from the repo root `.env.example` or from the current `supabase status` output if it is available.

Known good pattern for local REST verification:

- `LOCAL_REST_ANON_JWT`: JWT-style local anon token for direct `/rest/v1` calls
- `LOCAL_REST_SERVICE_ROLE_JWT`: JWT-style local service-role token for direct `/rest/v1` calls
- `SUPABASE_JWT_SECRET`: must match the JWT secret expected by local PostgREST

Practical note:

- If direct SQL in the local database shows rows but REST returns an empty array, check whether the request used `SUPABASE_SERVICE_ROLE_KEY=sb_secret_...` instead of `LOCAL_REST_SERVICE_ROLE_JWT`.

Supabase on the web - Not Local:
project id=ndjjycdgtponhosvztdg
PROJECT_URL=https://ndjjycdgtponhosvztdg.supabase.co
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kamp5Y2RndHBvbmhvc3Z6dGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDI5MDQsImV4cCI6MjA3NDQxODkwNH0.PLzt26W69v9AyBrkjvWCrnayN03veKNurfOU6ZRO-dA
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kamp5Y2RndHBvbmhvc3Z6dGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg0MjkwNCwiZXhwIjoyMDc0NDE4OTA0fQ.V2YcftCEcCHxxzKjn_LGjk7xq0OxFkLnE2nTidJw6_s

supabase.com login details:
jhtest.dev21@gmail.com
password
Jh@supa12
Database Password:
fNyNJhMD2315BrBr
fNyNJhMD2315BrBr
