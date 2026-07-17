# Standards Audit — CleanMateX

## 1. Title

- Repository name: `cleanmatex`
- Audit date: July 16, 2026
- Auditor role: Senior software architect and repository auditor
- Scope of review: Repository governance and standards docs, active module configuration, representative code paths, tests, access-contract and architecture guidance, and current enforcement signals across `web-admin/`, `cmx-api/`, `supabase/`, and repository-level docs/config

## 2. Executive Summary

The current repository state shows a clear difference between policy text and enforced implementation. The most credible current standards are tenant isolation centered on `tenant_org_id`, `supabase/` as the shared schema and migration authority, `web-admin` as the primary active application using Next.js App Router and server actions, EN/AR localization with RTL support, and a partial but active access-contract / platform-inventory governance layer. The weakest areas are TypeScript strictness in `web-admin`, broad logger adoption, and full authorization enforcement coverage.

### Main strengths

- Tenant isolation is visible in docs, runtime code, and tests:
  `AGENTS.md:10-11`, `AGENTS.md:48`, `web-admin/lib/prisma-middleware.ts:4-6`, `62-68`, `71-77`, `96-135`, `web-admin/__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts:54-79`, `107-209`
- `supabase/` is still the shared schema/migration authority in documentation and structure:
  `README.md`, `supabase/README.md`, `AGENTS.md:68-81`
- `web-admin` has real current governance and structure around App Router, server actions, i18n, and access contracts:
  `web-admin/README.md:47-54`, `66-74`, `76-83`, `web-admin/app/layout.tsx`, `web-admin/src/features/access/page-access-registry.ts`
- Validation is established in current practice:
  Zod-heavy patterns in `web-admin`, plus Nest validation in `cmx-api/src/main.ts`

### Main risks

- `web-admin` is not strict TypeScript, despite policy text claiming strictness:
  `AGENTS.md:178-183` vs `web-admin/tsconfig.json:9-12`
- `web-admin` build tooling intentionally ignores TypeScript build errors:
  `web-admin/next.config.ts:39-42`
- Authorization metadata is more mature than route-level enforcement proof:
  `web-admin/src/features/orders/access/orders-access.ts:149-154`, `210-214`, `252-255`
- Logging is only partially standardized in current code:
  centralized logger exists in `web-admin/lib/utils/logger.ts`, but direct `console.*` remains in active code paths

### Main gaps

- No current-state standards doc cleanly separates enforced practice from target policy
- No clear proof that access contracts completely cover route enforcement
- No clear repository-wide logging standard enforced by tools or tests
- `cmx-api` appears stricter and cleaner in configuration, but also much smaller in active surface than `web-admin`

### Canonicality note

When docs, code, tests, and tooling disagree, this audit treats the following as the current truth in order of reliability:

1. active tool/config files
2. current code behavior
3. tests
4. docs and policy text

That means broad policy claims in `AGENTS.md` are treated as aspirational unless they are reflected in active configuration, code, or tests.

## 3. Audit Method

### What was reviewed

- Governance and standards docs:
  `AGENTS.md`, `README.md`, `docs/README.md`, `web-admin/README.md`, `cmx-api/README.md`, `supabase/README.md`
- Active configuration:
  `package.json`, `web-admin/package.json`, `web-admin/tsconfig.json`, `web-admin/next.config.ts`, `web-admin/eslint.config.mjs`, `cmx-api/tsconfig.json`, `cmx-api/.eslintrc.js`
- Representative code paths:
  `web-admin/lib/prisma-middleware.ts`, `web-admin/lib/db/tenant-context.ts`, `web-admin/lib/middleware/require-permission.ts`, `web-admin/lib/services/permission-service-server.ts`, `web-admin/lib/utils/logger.ts`, `web-admin/lib/db/prisma.ts`, `web-admin/src/features/access/page-access-registry.ts`, `web-admin/src/features/orders/access/orders-access.ts`, `web-admin/app/dashboard/orders/page.tsx`
- Tests:
  `web-admin/__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts`, `web-admin/__tests__/services/permission-service.test.ts`, `web-admin/e2e/dashboard-route-smoke.spec.ts`, plus SQL/RLS-related evidence in `supabase/tests/**` from repository search

### Evidence types used

- Observed in code
- Observed in docs
- Observed in tests
- Recommended / inferred only when clearly labeled

### What was not fully verified

- Full route-by-route permission coverage across every API file
- Full repository-wide logger usage inventory
- Full repository-wide Prisma/Supabase usage census across every feature
- Full ADR corpus consistency, because ADR-style material appears distributed rather than clearly centralized

## 4. Repository-Wide Standards Detected

### 4.1 Tenant-owned data should be scoped by `tenant_org_id`

- Finding label:
  Observed in docs
  Observed in code
  Observed in tests
- Scope:
  Repository-wide as a documented rule
  Module-specific as a directly verified runtime pattern in `web-admin`
  Partial / emerging as a fully proven enforcement standard across the whole repo
- Enforcement:
  Convention-only
  Doc-only
  Test-enforced
  Partial runtime enforcement

#### Documented standard

- `AGENTS.md:10-11` says API/service/backend logic should always filter by `tenant_org_id`
- `AGENTS.md:48` says every query must filter by `tenant_org_id`
- `README.md:126` says tenant-scoped data must honor `tenant_org_id`

#### Observed in code

- `web-admin/lib/prisma-middleware.ts:4-6` describes automatic `tenant_org_id` enforcement for `org_*` tables
- `web-admin/lib/prisma-middleware.ts:33-39` scopes the middleware to `org_*` models
- `web-admin/lib/prisma-middleware.ts:62-68`, `71-77`, `96-135` injects `tenant_org_id` into read/write operations
- `web-admin/lib/db/tenant-context.ts:44-49` provides `withTenantContext()`
- `web-admin/lib/db/tenant-context.ts:97-110` provides `withTenantFromSession()`
- `web-admin/lib/db/tenant-context.ts:127-133` validates tenant membership via `org_users_mst`
- `cmx-api/src/common/guards/tenant.guard.ts` and `cmx-api/src/common/guards/jwt-auth.guard.ts` were found by search as tenant-context guard files, which supports the pattern in a second module, though they were not reopened line-by-line in this pass

#### Observed in tests

- `web-admin/__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts:54-79` tests cross-tenant access returning "Order not found"
- `web-admin/__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts:107-209` tests tenant IDs for workflow RPCs coming from the order record, not caller input
- `supabase/tests/rls_policies.test.sql` and `supabase/tests/workflow_functions.test.sql` were found by search and include `tenant_org_id` and JWT-claim-based RLS test setup, which supports tenant isolation at the shared DB layer, though not re-read line-by-line in this pass

#### Tooling support

- No clear compile-time enforcement across the repository
- Prisma middleware gives runtime coverage for Prisma-based `web-admin` flows only

#### Assessment

- Current-state truth:
  This is one of the best-supported standards in the repo
- Caution:
  It should not be described as fully tool-enforced repository-wide because the proof is strongest in docs, `web-admin` runtime middleware, and selected tests

### 4.2 `supabase/` is the shared schema and migration authority

- Finding label:
  Observed in docs
- Scope:
  Repository-wide
- Enforcement:
  Doc-only
  Convention-only

#### Documented standard

- `README.md` defines `supabase/` as shared DB/auth/RLS/migrations
- `supabase/README.md:1-18` defines the shared workspace purpose
- `AGENTS.md:68-81` says this project owns all migrations and frames cross-project ownership

#### Observed in code

- Repository structure supports it
- The active app modules do not present alternative schema authorities

#### Observed in tests

- `supabase/tests/**` existence supports active schema-level verification work, but does not by itself prove ownership policy

#### Tooling support

- Not clearly established as tool-enforced

#### Assessment

- Current-state truth:
  Yes, this is a reliable repository-wide organizational standard

### 4.3 EN/AR localization with RTL support

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Repository-wide as policy
  Module-specific as directly verified implementation in `web-admin`
- Enforcement:
  Doc-only
  Convention-only
  Tool-enforced in part

#### Documented standard

- `AGENTS.md:50` makes bilingual support mandatory
- `AGENTS.md:93`, `203-209` requires parallel EN/AR key updates and `check:i18n`
- `web-admin/README.md:66-74` documents locale tree parity and RTL preservation

#### Observed in code

- `web-admin/app/layout.tsx:23-35` loads locale and sets `dir` based on `ar` vs `ltr`
- `web-admin/next.config.ts:4-6` wires `next-intl`
- `web-admin/app/public/orders/[tenantId]/[orderNo]/page.tsx` was found by search importing `next-intl/server`, reinforcing module-wide i18n usage

#### Observed in tests

- Not clearly established from the sampled tests

#### Tooling support

- `package.json` and `web-admin/package.json` include `check:i18n`
- `web-admin/README.md:73` explicitly references the parity check

#### Assessment

- Current-state truth:
  This is a real current `web-admin` standard with tooling support for parity
- Caution:
  The implementation was not sampled across all user-facing features, so repository-wide practical consistency was not fully verified

### 4.4 Access contracts and platform inventory workflows

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Module-specific (`web-admin`)
  Partial / emerging
- Enforcement:
  Convention-only
  Tool-enforced in part

#### Documented standard

- `AGENTS.md:14`, `58`, `100`, `104-122` prescribes the access-contract and platform-inventory workflow
- `docs/platform/ui-access-contract/user_guide.md` documents the route contracts and sync/check flow

#### Observed in code

- `web-admin/src/features/access/page-access-registry.ts` is the central merged registry
- `web-admin/src/features/orders/access/orders-access.ts:3-5` says some pages rely on navigation visibility and backend enforcement rather than explicit page gates
- `web-admin/src/features/orders/access/orders-access.ts:149-154`, `210-214`, `252-255` explicitly records routes where no `requirePermission` was found in local inventory
- `web-admin/data/platform/platform-info-inventory.json` was found by search containing `requirePermission` inventory entries

#### Observed in tests

- `web-admin/package.json` includes `check:access-contracts`
- Direct access-contract test source was not reopened in this pass

#### Tooling support

- `package.json` includes `check:ui-access-contract`, `sync:ui-access-contract`, `rebuild:ui-access-contract`
- `web-admin/package.json` includes `check:access-contracts`

#### Assessment

- Current-state truth:
  The workflow is real and active in `web-admin`
- Caution:
  Treat it as partial enforcement, not complete authorization coverage

### 4.5 Cmx UI import restrictions

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Module-specific (`web-admin`)
  Partial / emerging
- Enforcement:
  Tool-enforced in part
  Doc-only in part

#### Documented standard

- `AGENTS.md:201-216` describes a broad Cmx-only UI rule
- `web-admin/README.md:56-64` requires `@ui/*` domains and forbids legacy component imports

#### Observed in code

- `web-admin/eslint.config.mjs:89-115` blocks imports from `@/components/ui`, `@ui/compat`, and some retired route paths
- `web-admin/app/dashboard/orders/page.tsx:119-166` still uses raw structural markup and styled `Link` directly

#### Observed in tests

- Not clearly established

#### Tooling support

- Import restrictions are tool-enforced
- Full “Cmx-only” UI purity is not tool-enforced based on the sampled lint config

#### Assessment

- Current-state truth:
  Legacy import restrictions are real
- Docs/code conflict:
  The broad prose rule is more aspirational than the actual lint enforcement

## 5. Architecture and Layering

### Current module structure

- `README.md` describes `web-admin/`, `cmx-api/`, and `supabase/` as the main modules
- `package.json` workspaces include `web-admin`, `cmx-api`, and `packages/*`
- `web-admin/README.md:47-54` describes `app/`, `src/ui/`, `lib/`, `messages/`, `docs/`, `prisma/`

### Layering conventions observed

- `web-admin`:
  App Router pages and routes in `app/**`
  shared services/utilities in `lib/**`
  feature-level organization in `src/features/**`
  shared UI in `src/ui/**`
- `cmx-api`:
  module-based Nest layout with `common/`, `modules/`, `config/`, `supabase/`
- `supabase`:
  migrations, tests, functions, and schema-related assets

### Where layering is strong

- Thin route / orchestrator separation is visible in high-value flows such as:
  `web-admin/app/api/v1/orders/submit-order/route.ts`
- Cross-cutting concerns are centralized in some areas:
  `web-admin/lib/prisma-middleware.ts`
  `web-admin/lib/db/tenant-context.ts`
  `web-admin/lib/middleware/require-permission.ts`
  `web-admin/lib/utils/logger.ts`

### Where layering is weak or mixed

- `web-admin` pages still combine page composition, auth/error display, and direct styled HTML:
  `web-admin/app/dashboard/orders/page.tsx:52-66`, `119-166`
- Data-access patterns are mixed:
  Prisma middleware for some flows
  Supabase RPC and direct client access for permission/auth flows
- Governance is broader than actual code enforcement in several areas, especially TS strictness and UI purity

## 6. Language and Framework Conventions

### TypeScript

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Not clearly established repository-wide
  Module-specific and conflicting
- Enforcement:
  Tool-enforced in `cmx-api`
  Convention-only / contradicted in `web-admin`

#### Evidence

- Policy text:
  `AGENTS.md:178-183` says "TypeScript strict, no `any`"
- `web-admin` current config:
  `web-admin/tsconfig.json:9-12` sets `allowJs: true`, `skipLibCheck: true`, `strict: false`
- `web-admin` lint:
  `web-admin/eslint.config.mjs:118-132` disables many TS safety rules including `@typescript-eslint/no-explicit-any`
- `web-admin` sampled code still uses `any`:
  `web-admin/lib/middleware/require-permission.ts:28-33`
  `web-admin/lib/prisma-middleware.ts:29`, `84`
- `cmx-api` current config is stricter:
  `cmx-api/tsconfig.json`
  `cmx-api/.eslintrc.js`

#### Assessment

- Current-state truth:
  Strict TypeScript is false as a current repository-wide standard
- More accurate statement:
  `cmx-api` is stricter; `web-admin` is not

### Next.js

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Module-specific (`web-admin`)
- Enforcement:
  Convention-only

#### Evidence

- `web-admin/README.md:47-54` documents App Router structure
- `web-admin/app/layout.tsx` is the async root layout
- `web-admin/app/dashboard/orders/page.tsx:43-47` is an async server component
- `web-admin/app/actions/**` reflects active server-action usage

### Supabase

- Finding label:
  Observed in docs
  Observed in code
  Observed in tests
- Scope:
  Repository-wide as shared platform dependency
  Module-specific in implementation details
- Enforcement:
  Convention-only

#### Evidence

- `supabase/README.md`
- `web-admin/lib/services/permission-service-server.ts:62`, `121-141`, `181-184`
- `web-admin/lib/middleware/require-permission.ts:47-63`
- `web-admin/__tests__/services/permission-service.test.ts:57-64`, `79-91`
- `cmx-api/src/modules/auth/auth.service.ts` (previously reviewed) uses Supabase auth refresh

### Prisma

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Module-specific (`web-admin`)
- Enforcement:
  Convention-only
  Partial runtime enforcement

#### Evidence

- `web-admin/README.md:15` says Prisma generation is in the build pipeline
- `web-admin/lib/db/prisma.ts:40-47` uses a singleton Prisma client
- `web-admin/lib/db/prisma.ts:57-89` applies tenant and performance middleware once
- `web-admin/lib/prisma-middleware.ts:151-175` forbids per-request Prisma clients for pool safety

### Naming and folder organization

- Finding label:
  Observed in docs
  Observed in code
- Scope:
  Module-specific in most cases
  Partial / emerging repository-wide
- Enforcement:
  Convention-only

#### Evidence

- Feature folders:
  `web-admin/src/features/orders`, `inventory`, `marketing`, `users`
- Access contracts:
  `web-admin/src/features/*/access/*-access.ts`
- Permission constants:
  `web-admin/lib/constants/permissions/*-perm.ts`
- Docs themselves admit naming drift:
  `docs/README.md:38`, `144-152`

## 7. Security and Domain Rules

### Multi-tenancy

- Best-supported current standard in the repo
- Evidence already listed in section 4.1

### Authorization

- Finding label:
  Observed in code
  Observed in docs
  Observed in tests
- Scope:
  Module-specific (`web-admin`)
  Partial / emerging
- Enforcement:
  Convention-only
  Partial test enforcement

#### Evidence

- `web-admin/lib/middleware/require-permission.ts:92-150` provides `requirePermission`
- `web-admin/lib/middleware/require-permission.ts:158-213` provides any/all permission variants
- `web-admin/src/features/orders/access/orders-access.ts:149-154`, `210-214`, `252-255` documents gaps where explicit permission gates were not found
- `web-admin/__tests__/services/permission-service.test.ts:77-105` verifies permission RPC behavior

#### Assessment

- Current-state truth:
  Permission middleware exists and is meaningful
- Caution:
  Authorization should not be described as completely enforced across all local APIs

### RBAC / ABAC

- Finding label:
  Observed in code
  Observed in docs
- Scope:
  Module-specific (`web-admin`)
  Partial / emerging
- Enforcement:
  Convention-only

#### Evidence

- RBAC permission codes are central in:
  `web-admin/lib/constants/permissions/**`
- Access contracts encode permissions and feature flags:
  `web-admin/src/features/orders/access/orders-access.ts:17-20`, `33-42`, `47-49`, `99-102`
- Resource-scoped permission checks exist in:
  `web-admin/lib/services/permission-service-server.ts:120-137`

#### Assessment

- Current-state truth:
  RBAC is clearly present
- ABAC:
  Not clearly established as a named repository-wide standard; resource scoping and feature flags provide attribute-like behavior

### Error handling

- Finding label:
  Observed in code
  Recommended / inferred
- Scope:
  Partial / emerging
- Enforcement:
  Convention-only

#### Evidence

- Strong route-level business error mapping exists in:
  `web-admin/app/api/v1/orders/submit-order/route.ts`
- Simpler catch-and-log patterns remain in many active files:
  `web-admin/app/dashboard/orders/page.tsx:57-66`
  `web-admin/lib/db/tenant-context.ts:80-83`, `136-139`, `164-167`

#### Assessment

- Current-state truth:
  Error handling is mixed, not standardized repository-wide

### Validation

- Finding label:
  Observed in docs
  Observed in code
  Observed in tests
- Scope:
  Module-specific with repetition across more than one module
- Enforcement:
  Convention-only
  Test-enforced in sampled areas

#### Evidence

- `web-admin/README.md:11-16` documents React Hook Form + Zod
- `web-admin` action and schema files use Zod extensively, including:
  `web-admin/lib/services/permission-service-server.ts` is not a validation file, but the repo search shows many `lib/validations/*.ts` and action `safeParse` usage
- `cmx-api/src/main.ts` configures global `ValidationPipe`
- `web-admin/__tests__/validations/**` were found by search, showing validation test investment

#### Assessment

- Current-state truth:
  Validation is a real current standard, though implemented differently per module

### Logging

- Finding label:
  Observed in code
  Observed in tests
- Scope:
  Partial / emerging
- Enforcement:
  Convention-only

#### Evidence

- Shared logger:
  `web-admin/lib/utils/logger.ts:3-6`, `57-68`, `208-251`
- Actual usage:
  `web-admin/lib/services/permission-service-server.ts:50-55`, `65-70`, `93-103`, `128-147`
  `web-admin/lib/middleware/require-permission.ts:127-147`
- Mixed direct console use remains:
  `web-admin/app/dashboard/orders/page.tsx:58`
  `web-admin/lib/db/tenant-context.ts:81`, `137`, `165`
  `web-admin/lib/services/permission-service-server.ts:187-192`
  `cmx-api/src/common/utils/logger.ts` was found by search using console output, which suggests logging patterns differ across modules

#### Assessment

- Current-state truth:
  Logging is not standardized enough to call repository-wide

### Performance

- Finding label:
  Observed in code
  Observed in docs
- Scope:
  Module-specific (`web-admin`)
  Partial / emerging repository-wide
- Enforcement:
  Convention-only

#### Evidence

- Prisma pool preservation:
  `web-admin/lib/db/prisma.ts:40-47`, `94-105`
  `web-admin/lib/prisma-middleware.ts:151-175`
- Concurrent page loading:
  `web-admin/app/dashboard/orders/page.tsx:98-101`
- DB indexing on tenant fields is visible in shared migration history:
  `supabase/migrations/0001_core_schema.sql:615-637`

#### Assessment

- Current-state truth:
  There are real performance-aware patterns, but not a comprehensive enforced performance standard

## 8. Testing and Verification

### What is covered well

- Tenant isolation / cross-tenant denial:
  `web-admin/__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts:54-79`, `107-209`
- Permission service behavior:
  `web-admin/__tests__/services/permission-service.test.ts:41-74`, `77-117`
- Protected-route smoke behavior:
  `web-admin/e2e/dashboard-route-smoke.spec.ts`
- Shared DB tenant/RLS posture:
  `supabase/tests/rls_policies.test.sql`, `supabase/tests/workflow_functions.test.sql` found by search

### What is weak or missing

- No proof that all access contracts map to enforced route permissions
- No strong evidence that logger usage is tested broadly
- No strong evidence that TypeScript quality gates are tested/enforced in `web-admin`
- No full audit test coverage proving repository-wide policy compliance

### Tests that demonstrate key standards

- Tenant isolation:
  `web-admin/__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts`
- Permission RPC behavior:
  `web-admin/__tests__/services/permission-service.test.ts`
- Route smoke:
  `web-admin/e2e/dashboard-route-smoke.spec.ts`

### Gaps in enforcement

- Access contracts are only partial enforcement until route-level coverage is fully verified
- Logging remains convention-based
- TS strictness is not enforced in the primary module

## 9. Documentation and Governance

### Standards docs

- Primary governance:
  `AGENTS.md`
- Module guidance:
  `README.md`, `web-admin/README.md`, `cmx-api/README.md`, `supabase/README.md`
- Documentation model and drift guidance:
  `docs/README.md`

### ADR usage

- ADR-style material exists in the repo, but a clearly centralized and consistently used ADR location was not fully verified in this pass
- Classification:
  Not clearly established

### README guidance

- `docs/README.md:5`, `38`, `85-89`, `144-152` explicitly warns about overlapping/historical docs and the need to reconcile to implementation reality
- `web-admin/README.md:94-96` says legacy Prisma/UI docs should not be treated as automatic source of truth

### AI instruction files

- `AGENTS.md` is an important policy source, but should be treated as policy/target-state truth unless supported by config/code/tests

### Canonicality and drift

- This repo explicitly documents drift in its docs:
  `docs/README.md:5`, `144-152`
- The clearest current-state conflicts are:
  `AGENTS.md:178-183` vs `web-admin/tsconfig.json:9-12`
  `AGENTS.md:201-216` vs `web-admin/app/dashboard/orders/page.tsx:119-166`
  build-gate rhetoric vs `web-admin/next.config.ts:39-42`

## 10. Inconsistencies and Risks

### Docs/code conflicts

1. Strict TS claim
   - Docs:
     `AGENTS.md:178-183`
   - Code/config:
     `web-admin/tsconfig.json:9-12`
     `web-admin/eslint.config.mjs:118-132`

2. Cmx-only UI claim
   - Docs:
     `AGENTS.md:201-216`
     `web-admin/README.md:56-64`
   - Code:
     `web-admin/app/dashboard/orders/page.tsx:119-166`

3. Build as strict enforcement
   - Docs/workflow implication:
     `AGENTS.md:49`, `146`
   - Code/config:
     `web-admin/next.config.ts:39-42`

### Tooling conflicts

- Lint blocks some legacy imports, but not the full policy surface described in docs
- Build runs, but TS build errors are intentionally ignored in `web-admin`

### Security risks

- Route contract entries explicitly document missing discovered permission gates:
  `web-admin/src/features/orders/access/orders-access.ts:149-154`, `210-214`, `252-255`
- Service-role client exists in app code and relies on discipline:
  `web-admin/lib/supabase/server.ts`

### Maintainability risks

- Governance text is broader than actual enforcement
- `web-admin` mixes direct console logging with shared logger usage
- `web-admin` is the most active module yet has the weakest TS enforcement of the main modules reviewed

### Performance risks

- Good pool-preservation patterns exist, but they are convention-based rather than comprehensively enforced by tests/tooling

## 11. Recommendations

### Critical

1. Align the documented TypeScript rule with actual `web-admin` config, or progressively restore strictness there.
2. Remove or phase down `typescript.ignoreBuildErrors` in `web-admin/next.config.ts`.
3. Audit local API routes against access contracts and close the documented permission-enforcement gaps.
4. Standardize server/runtime logging on the shared logger and reduce direct `console.*` usage.

### Important

1. Clarify the true enforceable scope of the Cmx UI rule and encode it in linting.
2. Add automated checks that map access-contract requirements to route-level permission enforcement.
3. Document the acceptable use boundaries for `createAdminSupabaseClient()` in one canonical security doc.
4. Cleanly distinguish current-state module maturity between `web-admin` and `cmx-api`.

### Nice to have

1. Add a concise “current enforced standards” doc separate from policy/AI instructions.
2. Add tests around CSRF, logging hygiene, and broader authorization coverage.
3. Add a centralized ADR index if ADRs are intended to remain part of governance.

## 12. Top 5 Confirmed Standards

1. Tenant-owned data should be scoped by `tenant_org_id`; this is directly supported by docs, `web-admin` runtime middleware, and tests.
2. `supabase/` is the shared schema and migration authority for the repository.
3. `web-admin` currently uses Next.js App Router with server actions and server-side locale loading.
4. EN/AR localization with RTL support is a real current `web-admin` standard with parity tooling support.
5. `web-admin` uses feature access contracts and related inventory/check scripts as an active governance pattern, though only partial enforcement is proven.

## 13. Top 5 Risks

1. `web-admin` is not strict TypeScript despite policy text claiming strictness.
2. `web-admin` build config ignores TypeScript build errors.
3. Authorization coverage is only partially proven; access contracts themselves record gaps.
4. Logging is not broadly standardized in current code behavior.
5. Service-role access exists in app code and depends on disciplined usage.

## 14. Top 5 Inconsistencies

1. `AGENTS.md` says “TypeScript strict, no any”; `web-admin/tsconfig.json` sets `strict: false`.
2. Docs say “Use Cmx components only”; current page code still uses raw structural markup and styled `Link`.
3. Docs imply build is a hard enforcement gate; `web-admin/next.config.ts` ignores TS build errors.
4. A centralized logger exists, but direct `console.*` usage remains in active code paths.
5. Access contracts are formalized, yet some related APIs are still documented as auth-only inference with no discovered `requirePermission`.

## 15. Top 5 Missing Docs or Enforcement Items

1. A current-state standards document that separates enforced practice from aspirational policy.
2. A canonical API authorization matrix showing auth-only vs permission-gated routes.
3. Tool-enforced coverage for the actual intended scope of the Cmx UI rule.
4. Wider logger-usage enforcement or tests for logging hygiene.
5. A documented and enforced plan for `web-admin` TypeScript quality gates, or an explicit decision that it remains non-strict.
