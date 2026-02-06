---
name: cmx-api setup and docs
overview: Create a NestJS backend in cmx-api following project standards (Supabase-only, repository pattern, DTOs, tenant context), add the 6 production-grade items (request context, auth/tenant contract, pagination, idempotency, OpenAPI contract tests, CI path-based gates), and update all documentation and references from "backend" to "cmx-api".
todos:
  - id: bootstrap
    content: "Bootstrap cmx-api: package.json, tsconfig, nest-cli, eslint, prettier, .env.example, .gitignore"
    status: completed
  - id: core-app
    content: Add main.ts, app.module, config module, supabase types + admin service
    status: completed
  - id: common-layer
    content: "Add common: exception filter, guards (JWT, Tenant), decorators, interceptors, ValidationPipe"
    status: completed
  - id: health-auth
    content: Add health module and auth module (JWT + optional refresh)
    status: completed
  - id: workspaces-config
    content: Update root package.json workspaces and .clauderc to cmx-api
    status: completed
  - id: scripts
    content: Update all dev scripts and validate-env.js to cmx-api
    status: completed
  - id: docs-root-plan
    content: Update README, CLAUDE, master plan, and plan_cr backend PRDs
    status: completed
  - id: docs-features-dev
    content: Update docs/features and docs/dev and architecture project-structure
    status: completed
  - id: skills-rules
    content: Update backend skill and cursor rules to use cmx-api in examples
    status: completed
  - id: readme-verify
    content: Add cmx-api/README.md and run verification and grep for backend
    status: completed
  - id: request-context
    content: Implement request context (traceId, requestId, tenantOrgId, userId, roles) and ensure every log/error includes traceId
    status: completed
  - id: auth-tenant-contract
    content: Document and implement auth/tenant resolution (JWT then X-Tenant-Id; reject if missing)
    status: completed
  - id: pagination-contract
    content: Add standardized pagination/query (page, limit, sort, order, search) and response envelope for list endpoints
    status: completed
  - id: idempotency
    content: Add Idempotency-Key support and store for mutations (orders, payments, webhooks)
    status: completed
  - id: openapi-contract-tests
    content: Add OpenAPI snapshot contract tests and run in CI
    status: completed
  - id: ci-path-gates
    content: Add monorepo CI path-based gates (cmx-api/** and web-admin/**)
    status: completed
isProject: false
---

# cmx-api Setup and Documentation Update (Best-Practice Aligned)

## Overview

Create a production-ready NestJS API in `cmx-api` that follows CleanMateX backend standards (Supabase-only, repository pattern, DTOs, multi-tenant context) and industry best practices, then update all references from "backend" to "cmx-api" across docs, scripts, and config.

## Best-Practice Alignment

The plan follows:

- **Project standards:** [.claude/skills/backend/nestjs-standards.md](.claude/skills/backend/nestjs-standards.md) (NestJS + Supabase, no Prisma; DTOs as public contract; repository pattern; tenant context)
- **Multi-tenancy:** [.claude/skills/multitenancy/SKILL.md](.claude/skills/multitenancy/SKILL.md) (tenant_org_id on every query; tenant from request, not from DB in API)
- **Architecture:** Layered: Controller → Service → Repository; typed Supabase client; Row → domain → DTO mapping
- **API design:** Versioned prefix (`/api/v1`), OpenAPI/Swagger, consistent error payload, idempotency where practical
- **Security:** JWT + refresh; service-role only in backend; no Supabase calls in controllers
- **DX:** Strict TypeScript, ESLint (no any, module boundaries), Prettier, shared pagination/filtering

---

## Phase 1: NestJS Structure in cmx-api (Standards-Compliant)

### 1.1 Project Bootstrap

- **Stack:** NestJS + Supabase only (no Prisma). Use generated `Database` types and `@supabase/supabase-js`.
- **Root config:** `package.json`, `tsconfig.json`, `nest-cli.json`, `.eslintrc.js`, `.prettierrc`, `.env.example`, `.gitignore`.
- **Scripts:** `start`, `start:dev`, `build`, `test`, `test:e2e`, `lint`, `format`.

### 1.2 Source Layout (per nestjs-standards)

```
cmx-api/src/
├── main.ts
├── app.module.ts
├── app.controller.ts
├── app.service.ts
├── config/                    # ConfigModule (env, validation)
├── supabase/                  # Typed client only (no business logic)
│   ├── types.ts               # Generated: supabase gen types typescript --local
│   └── supabase-admin.service.ts  # createClient<Database>(url, serviceRoleKey)
├── common/
│   ├── decorators/            # @TenantId(), etc.
│   ├── filters/               # Global HttpException filter (code, message, details, traceId)
│   ├── guards/                # JwtAuthGuard, TenantGuard
│   ├── interceptors/         # LoggingInterceptor, TransformInterceptor
│   ├── pipes/                 # ValidationPipe config
│   └── utils/                 # Logger, pagination helpers
├── modules/
│   ├── auth/                  # JWT validate, refresh endpoint
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   └── dto/
│   ├── health/                # GET /api/v1/health (DB + Redis optional)
│   │   ├── health.module.ts
│   │   ├── health.controller.ts
│   │   └── health.service.ts
│   └── (future: orders, customers, etc. — each with module, controller, service, repository, dto/)
```

- **No direct Supabase in controllers.** Data access only in **repositories** (e.g. `orders.repository.ts`).
- **DTOs:** Under `modules/<feature>/dto/` with `class-validator` + `@nestjs/swagger`; they are the **public contract**.
- **Domain models (optional but recommended):** Map Supabase `Row` → domain → DTO in service/layer.

### 1.3 Core Conventions

- **Global ValidationPipe:** `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- **Tenant:** Extracted in guard/interceptor from JWT (e.g. `req.tenant.id`), passed into every service method that touches `org_*`; repositories receive tenant and add `.eq('tenant_org_id', tenantId)` to all Supabase queries.
- **Errors:** Normalized via global exception filter; JSON shape: `{ code, message, details?, traceId? }`.
- **Logging:** Structured (e.g. Pino/Winston); no raw Supabase rows in logs.
- **Idempotency:** For mutations, support idempotency key or pre-check where practical (per nestjs-standards).

### 1.4 Health and OpenAPI

- **Health:** `GET /api/v1/health` — app up; optional: DB ping, Redis ping.
- **OpenAPI:** Swagger at `/api/docs`; all controllers tagged; DTOs define schema.

### 1.5 Dependencies

- **Runtime:** `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`, `@supabase/supabase-js`, `class-validator`, `class-transformer`, logger (e.g. `pino`, `nest-pino`).
- **Dev:** `@nestjs/cli`, `@nestjs/testing`, `supertest`, `jest`, types.

---

## Phase 2: Update All "backend" → "cmx-api" References

### 2.1 Config and Root

- **package.json (root):** `workspaces`: replace `"backend"` with `"cmx-api"`.
- **.clauderc:** `directories.backend` → `"./cmx-api"`; keep or adjust `stack.backend` text if it refers to folder.
- **cmx-api/.clauderc:** Any paths/comments that say "backend" → "cmx-api".

### 2.2 Scripts

- **scripts/dev/start-services.ps1**, **start-services.sh**, **start-services_x.ps1**, **cleanmatex_how_to_start_Jh.txt:** "cd backend" / "Start backend API" → "cd cmx-api" / "Start cmx-api (client API)".
- **scripts/validate-env.js:** Descriptions "Backend API" → "cmx-api" or "Client API" as appropriate.
- **scripts/feature-readme-template.md**, **scripts/consolidate-features.ps1:** Backend API path references → point to cmx-api or `/api/v1/...` as appropriate.

### 2.3 Documentation (Systematic Pass)

- **Root:** README.md, CLAUDE.md — structure section and services table: `backend/` → `cmx-api/`, "Backend API" → "cmx-api (client API)" where it denotes the app.
- **Plans:** docs/plan/master_plan_cc_01.md; docs/plan_cr/021_backend_architecture_setup_dev_prd.md and other `*backend*` PRDs — replace folder/project name "backend" with "cmx-api"; keep conceptual "backend layer" wording where it describes the tier.
- **Features:** All docs/features/ READMEs, implementation summaries, dev guides that reference the backend folder or "backend API" as the NestJS app → "cmx-api".
- **Dev docs:** docs/dev/ (e.g. claude-code-efficiency-guide, development-setup, finance_invoices_payments_dev_guide); docs/README.md.
- **Architecture:** .claude/skills/architecture/project-structure.md — "backend (planned)" → "cmx-api (planned)".
- **Other:** docs/Complete Project Structure Documentation_Draft suggestion_01.md and any diagram or list that names the backend folder.
- **Completion note:** docs/dev/Change name fro backend to cmx-api_Jh.md — mark as done and reference this plan.

### 2.4 Skills and Rules

- **.claude/skills/backend/** (SKILL.md, nestjs-standards.md, supabase-rules.md): In examples and "Project" references, use "cmx-api" as the project/folder name where relevant; do not change skill names or conceptual "backend" meaning.
- **.cursor/rules/** (backendnestjsrules.mdc, backendstandards.mdc): Project structure examples — use `cmx-api/` instead of `backend/`.

### 2.5 Infra and Future

- **docker-compose.yml:** If/when adding an API service, name it `cmx-api` (e.g. `cmx-api:` service).
- **Future k8s/Helm:** Use `cmx-api` for deployment/app names.

---

## Phase 3: Verification and Docs

### 3.1 Verification

- From repo root: `cd cmx-api && npm install && npm run build && npm run start:dev`.
- `GET /api/v1/health` returns 200.
- `GET /api/docs` serves Swagger.
- No remaining references to a folder named "backend" in active code, config, or non-archived docs (grep excluding node_modules, .git, archive).

### 3.2 cmx-api README

- **cmx-api/README.md:** Purpose (client APIs), stack (NestJS + Supabase), setup (env, install, run), main commands (dev, build, test), API base path and Swagger URL, tenant and auth summary, link to root README and backend skill.

---

## Phase 4: Production-Grade Requirements (Non-Optional)

These six items are **required** for a system that survives scale, audits, and team growth. All are applicable to `cmx-api`.

### 4.1 Request Context & Correlation Layer

**What:** Centralized request context injected at middleware level.

**Must include:**

- `traceId`
- `requestId`
- `tenantOrgId`
- `userId`
- `roles[]`

**Why:** End-to-end tracing across logs, errors, and audits; without it, debugging production is guesswork.

**Hard rule:** Every log and every error response must include `traceId`.

**Implementation:** Middleware or interceptor that generates/reads `traceId` and `requestId`, attaches JWT-derived `tenantOrgId`, `userId`, `roles[]` to a request-scoped context (e.g. AsyncLocalStorage or NestJS `REQUEST` scope), and ensures logger and global exception filter use this context.

---

### 4.2 Auth & Tenant Resolution Contract

**What:** Formal, documented contract for how tenant identity is resolved.

**Resolution order:**

1. JWT claim `tenant_org_id`
2. Header `X-Tenant-Id` (platform ops only; restrict by role or environment)
3. Reject request if unresolved (no implicit defaults)

**Why:** Prevents silent cross-tenant data leaks; predictable behavior for frontend and integrations.

**Hard rule:** Missing tenant → 401/403. Document this contract in cmx-api README and OpenAPI description.

**Implementation:** TenantGuard (or auth middleware) resolves tenant per order above; if none, throw Unauthorized/Forbidden. No fallback tenant.

---

### 4.3 Standardized Pagination & Query Contract

**What:** One universal pattern for all list endpoints.

**Mandatory query params:** `page`, `limit`, `sort`, `order`, `search` (and optional filters per resource).

**Mandatory response envelope:**

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 200
  }
}
```

**Why:** Consistent frontend tables and filters; no special-snowflake endpoints.

**Implementation:** Shared DTOs or pipes for query parsing; shared response type/interceptor for list endpoints; document in OpenAPI and reuse in all list controllers.

---

### 4.4 Idempotency Strategy

**What:** Protection against duplicate writes and replayed requests.

**Required for:** Order creation, payments, webhooks, external callbacks.

**Chosen approach:**

- `Idempotency-Key` header (client sends unique key per logical operation).
- Store request hash + response (e.g. Redis or DB table with TTL).
- Replay returns stored response; duplicate request does not re-execute mutation.

**Why:** Payments and retries without idempotency = financial and data bugs; non-optional in SaaS.

**Implementation:** Idempotency middleware or interceptor that reads `Idempotency-Key`, looks up store; if hit return cached response; if miss run handler and store response. Apply to mutation routes (orders, payments, webhooks).

---

### 4.5 OpenAPI Contract Tests

**What:** Snapshot testing of generated Swagger/OpenAPI JSON.

**What it prevents:** Accidental breaking changes; silent contract drift between cmx-api and web-admin (or other clients).

**Why:** The API is the product; contracts must be enforced automatically.

**Implementation:** In cmx-api (or monorepo root): script or test that generates OpenAPI spec (e.g. from NestJS/Swagger), saves or compares to a committed snapshot (e.g. `openapi.spec.json` or `__snapshots__/openapi.json`). CI fails on diff. Optionally: web-admin (or client) can consume the same spec for types or mock server.

---

### 4.6 Monorepo CI Path-Based Gates

**What:** CI pipelines that run only what changed.

**Example:**

- Changes under `cmx-api/**` → run cmx-api lint, test, build (and OpenAPI contract test).
- Changes under `web-admin/**` → run web-admin lint, test, build.
- Changes under `supabase/**` → run migration checks or Supabase tooling.
- Root/docs only → optional: docs lint or link check.

**Why:** Faster CI, clearer signal, scales as repo grows.

**Implementation:** GitHub Actions (or other CI) using path filters (`paths` or `paths-filter`) to trigger appropriate jobs; no full repo build when only one app changed.

---

## Implementation Order (Revised)

1. Create NestJS app in cmx-api (config, main, app module, supabase client service, health module).
2. Add common layer: **request context (4.1)** (traceId, requestId, tenantOrgId, userId, roles), exception filter (with traceId), guards, decorators, ValidationPipe.
3. Add **auth & tenant resolution (4.2)** contract and TenantGuard (JWT → tenant; X-Tenant-Id for ops; reject if missing).
4. Add **pagination/query contract (4.3)**: shared query DTOs and response envelope for list endpoints.
5. Add **idempotency (4.4)** middleware/interceptor and store for mutations (orders, payments, webhooks).
6. Add auth module (JWT validation, refresh).
7. Add **OpenAPI contract tests (4.5)** (snapshot of generated spec in CI).
8. Add **monorepo CI path-based gates (4.6)** for cmx-api and web-admin.
9. Update root package.json workspaces and .clauderc.
10. Update all scripts and documentation (Phases 2–3).
11. Add cmx-api/README.md (include auth/tenant contract, pagination, idempotency, tracing).
12. Run verification and grep for remaining "backend" references.

---

## Success Criteria

- NestJS app in `cmx-api` runs with Supabase-only data access, repository pattern, DTOs, and tenant from request.
- Health and Swagger are available; conventions match nestjs-standards and multitenancy skill.
- **Request context:** traceId, requestId, tenantOrgId, userId, roles on every request; every log and error includes traceId.
- **Auth/tenant:** Documented resolution order; missing tenant → 401/403.
- **Pagination:** All list endpoints use shared envelope and query params (page, limit, sort, order, search).
- **Idempotency:** Mutations (orders, payments, webhooks) support Idempotency-Key and replay returns stored response.
- **OpenAPI:** Contract tests (snapshot) run in CI; no unchecked contract drift.
- **CI:** Path-based gates; changes in cmx-api only run cmx-api pipeline.
- All references to the backend folder/project name are "cmx-api" in config, scripts, and non-archived documentation.
- Single place (this plan + cmx-api README) describes how to run, extend, and operate cmx-api.
