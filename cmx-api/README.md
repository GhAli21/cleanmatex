# CleanMateX API

`cmx-api` is the NestJS client API for CleanMateX. It serves external clients, mobile applications, partner integrations, and API-first backend workflows against the shared platform database.

## Stack

- NestJS 10
- TypeScript
- Supabase client integrations
- Swagger/OpenAPI
- Jest and Supertest-based testing
- Shared Supabase schema from `../supabase`

## Runtime Defaults

- Default port: `3004`
- API prefix: `/api/v1`
- Swagger: `/api/docs`
- Health endpoint: `/api/v1/health`

The current bootstrap uses `process.env.PORT ?? 3004` in `src/main.ts`.

## Local Development

```bash
cd cmx-api
npm install
npm run start:dev
```

Make sure shared local services are already running from the repo root when this API needs the database and related infrastructure.

## Commands

```bash
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
npm run test:openapi
```

## Shared Database Contract

This module does not own a separate database. It connects to the shared Supabase project located at `../supabase`.

- schema, migrations, and seed-related assets live in `../supabase`
- tenant-aware database rules from the main project still apply here
- local Supabase CLI operations should be run from the repo-level `supabase/` directory

## Auth And Tenant Rules

Tenant resolution is a hard requirement:

1. JWT claim `tenant_org_id`
2. `X-Tenant-Id` header only for approved platform operations
3. reject requests when tenant context cannot be resolved safely

Protected endpoints should document authentication and tenant requirements clearly in OpenAPI.

## API Conventions

- Use REST endpoints under `/api/v1`
- Document request and response contracts in Swagger
- Use pagination for list endpoints
- Include request tracing and structured error context
- Treat multi-tenant isolation as a first-class requirement

## Testing

- `npm run test`: unit tests
- `npm run test:e2e`: end-to-end tests
- `npm run test:openapi`: OpenAPI contract-focused checks

## Related Documentation

- `../README.md`
- `../docs/README.md`
- `../CLAUDE.md`
- `../supabase/README.md`
- `../.claude/skills/backend/SKILL.md`

## Documentation Notes

This module currently has a light local documentation surface compared with `web-admin`. As the API surface grows, update this README alongside endpoint docs and feature documentation so implementation reality, PRDs, and backend guidance stay aligned.
