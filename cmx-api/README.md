# cmx-api

CleanMateX **client API** — NestJS + Supabase. Serves mobile apps, integrations, and external clients.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS 10
- **Database:** Supabase (PostgreSQL); typed client, no Prisma
- **Auth:** Supabase Auth; JWT + refresh token
- **API:** REST, OpenAPI/Swagger at `/api/docs`

**Supabase:** One **shared Supabase instance** for the whole platform. Same database schema; **separate project/module folders** (e.g. `cmx-api/`, `web-admin/`) that all connect to it. Supabase project lives at repo root: `supabase/` (from cmx-api: `../supabase`). Run Supabase CLI (e.g. `supabase start`, `supabase gen types`) from that directory.

## Setup

```bash
# From repo root
cd cmx-api
cp .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

npm install
npm run start:dev
```

- **Base URL:** http://localhost:3004
- **API prefix:** `/api/v1`
- **Health:** GET http://localhost:3004/api/v1/health
- **Swagger:** http://localhost:3004/api/docs

## Commands

| Command              | Description          |
| -------------------- | -------------------- |
| `npm run start:dev`  | Start with watch     |
| `npm run build`      | Build for production |
| `npm run start:prod` | Run production build |
| `npm run test`       | Unit tests           |
| `npm run lint`       | Lint                 |

## Auth & tenant contract

**Tenant resolution (hard rule: missing tenant → 401/403):**

1. JWT claim `tenant_org_id`
2. Header `X-Tenant-Id` (platform ops only)
3. Reject if unresolved (no implicit defaults)

Protected routes must use `JwtAuthGuard` and `TenantGuard`. Document this in OpenAPI for clients.

## Request context & tracing

Every request has:

- `traceId`, `requestId` — set by middleware
- `tenantOrgId`, `userId`, `roles[]` — from JWT (after auth)

**Hard rule:** Every log and every error response includes `traceId`.

## Pagination

List endpoints use:

- **Query:** `page`, `limit`, `sort`, `order`, `search`
- **Response:** `{ data: [], meta: { page, limit, total } }`

Use `PaginationQueryDto` and `createPaginatedResponse()` from `common/`.

## Idempotency

Mutations (orders, payments, webhooks) support `Idempotency-Key` header. Replay returns stored response. Use `IdempotencyInterceptor` on mutation routes.

## Links

- [Root README](../README.md)
- [Backend skill](../.claude/skills/backend/SKILL.md) — NestJS + Supabase standards
