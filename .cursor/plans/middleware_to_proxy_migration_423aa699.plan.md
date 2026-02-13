---
name: Middleware to Proxy Migration
overview: Migrate from Next.js deprecated `middleware` file convention to the new `proxy` convention. This is a simple rename-only migration with no behavioral changes required.
todos:
  - id: rename-file
    content: Rename middleware.ts to proxy.ts and update function export
  - id: docs-sync
    content: Update docs that reference web-admin/middleware.ts to proxy.ts
isProject: false
---

# Middleware to Proxy Migration Plan

## Context

Next.js 16 deprecated the `middleware.ts` file convention and renamed it to `proxy.ts`. The API surface (NextRequest, NextResponse, config.matcher) remains identical. The change clarifies that this runs at a network boundary in front of the app, distinct from Express.js-style middleware.

**Affected file:** [web-admin/middleware.ts](web-admin/middleware.ts) (project root level)

**Not affected:** All other `middleware` references in the codebase (e.g. `lib/middleware/*`, Prisma middleware) are application-level middleware and do not need changes.

## Migration Options

### Option A: Use Next.js Codemod (Recommended)

Run the official codemod from the `web-admin` directory:

```bash
cd web-admin
npx @next/codemod@canary middleware-to-proxy .
```

The codemod will:

- Rename `middleware.ts` to `proxy.ts`
- Rename the exported function from `middleware` to `proxy`

### Option B: Manual Migration

1. Rename [web-admin/middleware.ts](web-admin/middleware.ts) to `proxy.ts`
2. Update the function export:

- Change `export async function middleware(request: NextRequest)` to `export async function proxy(request: NextRequest)`

1. Update the config comment (cosmetic only):

- Change "Specify which routes this middleware should run on" to "Specify which routes this proxy should run on"

1. Update the file header comment (cosmetic only):

- Change "Next.js Middleware" to "Next.js Proxy"

## What Stays the Same

| Element                              | Action    |
| ------------------------------------ | --------- |
| `config.matcher`                     | No change |
| `NextRequest` / `NextResponse` usage | No change |
| Supabase auth, CSRF, cookie handling | No change |
| All logic inside the function        | No change |

## Runtime Note

Proxy defaults to **Node.js** runtime (middleware previously defaulted to Edge). The current [web-admin/middleware.ts](web-admin/middleware.ts) uses `createServerClient` (Supabase), `getUser()`, and database calls via `supabase.from()`. These work in Node.js. No runtime config changes needed.

## Keep Docs in Sync

Update documentation that references the root-level `web-admin/middleware.ts` (not `lib/middleware/*` or `lib/prisma-middleware.ts`). Replace `middleware.ts` with `proxy.ts` and "middleware" with "proxy" where it refers to the Next.js convention file.

**Active docs to update:**

- [docs/features/001_auth_dev_prd/route-protection-guide.md](docs/features/001_auth_dev_prd/route-protection-guide.md) - "Next.js Middleware (middleware.ts)" references
- [docs/features/001_auth_dev_prd/route-protection-summary.md](docs/features/001_auth_dev_prd/route-protection-summary.md) - File path and matcher config mention
- [docs/security/AUTH_SECURITY_IMPLEMENTATION.md](docs/security/AUTH_SECURITY_IMPLEMENTATION.md) - CSRF generation file references
- [docs/security/AUTH_SYSTEM_EVALUATION.md](docs/security/AUTH_SYSTEM_EVALUATION.md) - Route protection middleware reference
- [docs/dev/RBAC_QUICK_REFERENCE.md](docs/dev/RBAC_QUICK_REFERENCE.md) - ADMIN_ROUTES and matcher config references
- [docs/features/RBAC/README.md](docs/features/RBAC/README.md) - Route protection table
- [docs/features/RBAC/current_state_analysis.md](docs/features/RBAC/current_state_analysis.md) - Location references
- [docs/features/RBAC/user_roles_guide.md](docs/features/RBAC/user_roles_guide.md) - File path reference

**Lower priority (archive/session summaries):**

- docs/dev/SESSION_2025-10-24_SUMMARY.md
- docs/features/Dashboard_Feature/SESSION_2025-10-24_SUMMARY.md
- docs/dev/PRD-001-*.md, docs/plan_cr/004_*.md, docs/features/002_*/002_02_*.md, docs/features/007_*/007_02_*.md
- .cursor/plans/logout_page_implementation_*.plan.md

## Verification

After migration, run `npm run build` in `web-admin`. The warning should be gone:

```
✓ Compiled successfully
```

(No more: `The "middleware" file convention is deprecated. Please use "proxy" instead`)
