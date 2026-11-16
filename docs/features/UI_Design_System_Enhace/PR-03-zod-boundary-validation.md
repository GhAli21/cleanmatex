# PR-03: Enforce Zod v4 Boundary Validation on Financial & Tenant Mutations
**Branch:** `refactor/pr-03-zod-boundary-validation`
**Depends On:** nothing. This is not a design-system package; it is an independent track and does not block PR-04 … PR-07.
**Scope:** `web-admin/app/actions/**`, `web-admin/app/api/**`, `web-admin/src/features/**/model/`

> Reviewed 2026-11-16. Zod 4 is installed. The coverage figure below is unverified; measure it first.

## Objective
Close the P0 boundary validation gap (stated as 13–19% coverage) by enforcing strict Zod v4 schemas on all money-handling, order-mutating, RBAC, and tenant-configuration Server Actions and API routes.

## Tasks

### 1. Create Standardized Validation Helper
- Search `web-admin/lib/` for an existing validation helper first and extend it if one exists. Otherwise create `web-admin/lib/validation/validate-boundary.ts` (shared infrastructure lives in root `lib/`, not `src/lib/`) providing reusable helpers for:
  - Next.js Server Actions (`validateActionInput(schema, rawInput)` returning the flat shape `{ success: boolean; data?: T; error?: string; fieldErrors?: … }`). Do **not** use a discriminated union: web-admin compiles with `strict: false`, which breaks narrowing on one.
  - Next.js Route Handlers (`validateRequestBody(schema, request)` returning parsed data or standardized `400 Bad Request` JSON response).
- Ensure schemas explicitly strip or reject `tenant_org_id`, `tenantId`, `id`, and audit fields (`created_by`, `updated_by`) from client payloads—tenant context must always come exclusively from server-side `tenant-context.ts`.

### 2. Tier-1 Domain Zod v4 Schemas & Wiring
Audit and wire strict Zod v4 schemas across all mutation endpoints (`'use server'` actions and `POST`/`PUT`/`PATCH`/`DELETE` route handlers) in these critical domains:
1. **Orders & POS Intake** (`app/actions/orders/**`, `app/api/**/orders/**`)
2. **Payments, Invoices, Vouchers & Cash/Ledger** (`app/actions/payments/**`, `app/api/**/payments/**`, `invoices/**`, `vouchers/**`)
3. **Catalog, Pricing & Garment Preferences** (`app/actions/catalog/**`, `app/api/**/catalog/**`, `pricing/**`)
4. **Tenant Settings, Users & RBAC Permissions** (`app/actions/settings/**`, `app/api/**/settings/**`, `users/**`, `roles/**`)

### 3. Preserve Multi-Tenant Guard Invariants
- Verify every mutated Prisma call still explicitly scopes by `tenant_org_id` from `tenant-context.ts` and passes `web-admin/scripts/audit-tenant-guard.mjs`.
- Do not change any API contract, permission check or money calculation while adding validation. A payload that was accepted before and is valid must still be accepted.

## Verification Gate
- Run `npm run typecheck` and `node scripts/audit-tenant-guard.mjs` from `web-admin`.
- Run the existing order and payment tests.
- Verify invalid/malformed payloads return clean `400` / structured validation errors without reaching Prisma.