# PR-03: Enforce Zod v4 Boundary Validation on Financial & Tenant Mutations
**Branch:** `refactor/pr-03-zod-boundary-validation`
**Depends On:** `PR-02`
**Scope:** `web-admin/app/actions/**`, `web-admin/app/api/**`, `web-admin/src/features/**/schemas/`

## Objective
Close the P0 boundary validation gap (currently 13–19% coverage) by enforcing strict Zod v4 schemas on all money-handling, order-mutating, RBAC, and tenant-configuration Server Actions and API routes.

## Tasks

### 1. Create Standardized Validation Helper
- Create `web-admin/src/lib/validation/validate-boundary.ts` providing reusable helpers for:
  - Next.js Server Actions (`validateActionInput(schema, rawInput)` returning typed `{ ok: true, data } | { ok: false, error, fieldErrors }`).
  - Next.js Route Handlers (`validateRequestBody(schema, request)` returning parsed data or standardized `400 Bad Request` JSON response).
- Ensure schemas explicitly strip or reject `tenant_org_id`, `tenantId`, `id`, and audit fields (`created_by`, `updated_by`) from client payloads—tenant context must always come exclusively from server-side `tenant-context.ts`.

### 2. Tier-1 Domain Zod v4 Schemas & Wiring
Audit and wire strict Zod v4 schemas across all mutation endpoints (`'use server'` actions and `POST`/`PUT`/`PATCH`/`DELETE` route handlers) in these critical domains:
1. **Orders & POS Intake** (`app/actions/orders/**`, `app/api/**/orders/**`)
2. **Payments, Invoices, Vouchers & Cash/Ledger** (`app/actions/payments/**`, `app/api/**/payments/**`, `invoices/**`, `vouchers/**`)
3. **Catalog, Pricing & Garment Preferences** (`app/actions/catalog/**`, `app/api/**/catalog/**`, `pricing/**`)
4. **Tenant Settings, Users & RBAC Permissions** (`app/actions/settings/**`, `app/api/**/settings/**`, `users/**`, `roles/**`)

### 3. Preserve Multi-Tenant Guard Invariants
- Verify every mutated Prisma call still explicitly scopes by `tenant_org_id` from `tenant-context.ts` and passes `scripts/audit-tenant-guard.ts`.

## Verification Gate
- Run `npm run typecheck` and `node scripts/audit-tenant-guard.ts` (or project audit script).
- Verify invalid/malformed payloads return clean `400` / structured validation errors without reaching Prisma.