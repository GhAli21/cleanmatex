# PR-03: Enforce Zod v4 Boundary Validation on Financial & Tenant Mutations
**Branch:** `refactor/pr-03-zod-boundary-validation`
**Depends On:** nothing. This is not a design-system package; it is an independent track and does not block PR-04 … PR-07.
**Scope:** `web-admin/lib/validations/validate-boundary.ts`, `web-admin/app/actions/**`, `web-admin/app/api/**`

> **Audited 2026-11-21 (read-only scan of Tier-1 domains).** Zod v4 is installed and existing schemas live in `web-admin/lib/validations/`. The earlier unverified *"13–19% coverage"* estimate is retired — actual measured Tier-1 coverage is **70.0% (`123 / 176` files)**, leaving a tightly scoped gap of **21 JSON-mutating API routes + 6 mutating Server Actions** (plus 1 multipart import route to verify).

## Progress

| Wave | Scope | Status | Date | Result |
|---|---|---|---|---|
| **Audit** | Tier-1 read-only gap scan (`176` files across 4 domains) | **Done** | 2026-11-21 | `123/176` (`70.0%`) covered; `21` JSON routes + `6` mutating Server Actions missing Zod |
| **Wave 0** | Shared boundary helper (`lib/validations/validate-boundary.ts`) + unit tests | Pending | — | — |
| **Wave 1** | Orders, POS, Payments, Invoices & Vouchers (`9` API routes + `4` Server Actions) | Pending | — | — |
| **Wave 2** | Settings, Tenant Registration & Branches (`3` API routes + `2` Server Actions) | Pending | — | — |
| **Wave 3** | Catalog, Price Lists & Products (`9` API routes + `1` multipart check) | Pending | — | — |
| **Verification** | `typecheck`, `audit-tenant-guard.mjs`, Jest suites, `eslint`, `npm run build` | Pending | — | — |

## Objective
Close the remaining Tier-1 boundary validation gaps by enforcing Zod v4 schemas on all unvalidated money-handling, order-mutating, tenant-configuration, and catalog/pricing mutation endpoints (Server Actions and API route handlers) without changing valid API contracts, permissions, or money calculations.

## Measured Tier-1 Baseline (2026-11-21)

| Tier-1 Domain | Already Using Zod | JSON-Mutating API Gaps | Mutating Server Action Gaps | Notes |
|---|---:|---:|---:|---|
| 1. Orders & POS Intake | `38 / 60` (`63.3%`) | `7` | `1` | Excludes 4 read-only `get-order*` actions & 11 no-body trigger routes (re-verify `status` / `bulk-status` body parsing in Wave 1) |
| 2. Payments, Invoices & Vouchers | `56 / 70` (`80.0%`) | `2` | `3` | Excludes read-only list/validate actions & 5 webhook/no-body trigger routes |
| 3. Catalog & Pricing | `12 / 22` (`54.5%`) | `9` | `0` | Plus 1 multipart route (`api/v1/pricing/import/route.ts`) to check |
| 4. Settings, Tenants & Branches | `17 / 24` (`70.8%`) | `3` | `2` | `lib/validations/tax-schemas.ts` already exists; reuse/extend it |
| **Total** | **`123 / 176` (`70.0%`)** | **`21`** | **`6`** | **27 concrete mutation files to wire** |

## Mandatory Rules & Invariants

1. **Use `zUuidLike()` — never `z.string().uuid()` for entity IDs:**
   - Zod v4 `.uuid()` enforces strict RFC-4122 version/variant bits and rejects seeded/demo Postgres UUIDs (e.g. `11111111-1111-1111-1111-111111111111`).
   - Always import `zUuidLike` from `@/lib/validations/uuid-like` (`web-admin/lib/validations/uuid-like.ts`).
2. **Flat return shape for `strict: false`:**
   - `web-admin` compiles with `strict: false`, which breaks TypeScript discriminated-union narrowing.
   - Helpers must return a flat shape: `{ success: boolean; data?: T; error?: string; fieldErrors?: Record<string, string[]> }` (and for route handlers, `{ success: boolean; data?: T; response?: NextResponse }`).
3. **Strip or reject server-owned fields:**
   - Never accept `tenant_org_id`, `tenantId`, `created_by`, or `updated_by` from client payloads (strip via Zod object parsing or explicitly reject where appropriate). Tenant context must come exclusively from server-side `tenant-context.ts` / auth context.
4. **Reuse existing domain schemas first:**
   - Check `web-admin/lib/validations/` (e.g. `order-schema.ts`, `edit-order-schemas.ts`, `workflow-schema.ts`, `ar-invoice-schemas.ts`, `tax-schemas.ts`) before creating new schema files.
5. **Backward-compatible contracts & tenant guard invariants:**
   - Do not change any API response contract, permission check, or money calculation. Every previously accepted valid payload must remain accepted.
   - Every mutated `org_*` query must retain explicit `tenant_org_id` filtering and pass `node scripts/audit-tenant-guard.mjs`.

## Execution Plan

### Wave 0: Standardized Validation Helper
- Create `web-admin/lib/validations/validate-boundary.ts` (alongside existing schemas in `lib/validations/`):
  - `validateActionInput<T>(schema: z.ZodType<T>, rawInput: unknown)` → `{ success: boolean; data?: T; error?: string; fieldErrors?: Record<string, string[]> }`
  - `validateRequestBody<T>(schema: z.ZodType<T>, request: Request)` → parses JSON safely (returns `400` on malformed JSON) and validates with `schema`, returning `{ success: boolean; data?: T; response?: NextResponse }`.
  - `formatZodFieldErrors(error: z.ZodError)` → clean `Record<string, string[]>` summary using Zod v4 `issues`.
- Add unit tests in `web-admin/__tests__/lib/validations/validate-boundary.test.ts` covering valid payloads, malformed JSON, invalid types, stripped `tenant_org_id`/`created_by`, and `zUuidLike` seeded UUIDs.

### Wave 1: Orders, POS, Payments, Invoices & Vouchers (Highest Risk — 9 API Routes + 4 Server Actions)
**Orders & POS JSON-Mutating API Routes (7):**
1. `web-admin/app/api/v1/orders/[id]/batch-update/route.ts`
2. `web-admin/app/api/v1/orders/[id]/charges/[chargeId]/void/route.ts`
3. `web-admin/app/api/v1/orders/[id]/fix-order-data/route.ts`
4. `web-admin/app/api/v1/orders/[id]/items/[itemId]/pieces/route.ts`
5. `web-admin/app/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/route.ts`
6. `web-admin/app/api/v1/orders/[id]/transition/route.ts`
7. `web-admin/app/api/v1/orders/[id]/unlock/route.ts`
- *(Quick check during Wave 1: inspect `app/api/orders/[orderId]/status/route.ts` and `app/api/orders/bulk-status/route.ts` to confirm if they accept JSON bodies; wire if so.)*

**Orders Mutating Server Actions (1):**
8. `web-admin/app/actions/orders/ready-order-actions.ts`

**Payments, Invoices & Vouchers JSON-Mutating API Routes (2):**
9. `web-admin/app/api/v1/finance/vouchers/[voucherId]/cancel/route.ts`
10. `web-admin/app/api/v1/finance/vouchers/[voucherId]/post/route.ts`

**Payments, Invoices & Vouchers Mutating Server Actions (3):**
11. `web-admin/app/actions/payments/invoice-actions.ts`
12. `web-admin/app/actions/payments/voucher-actions.ts`
13. `web-admin/app/actions/payments/voucher-crud-actions.ts`

### Wave 2: Settings, Tenants & Branches (3 API Routes + 2 Server Actions)
**JSON-Mutating API Routes (3):**
1. `web-admin/app/api/settings/tenants/[tenantId]/overrides/route.ts`
2. `web-admin/app/api/v1/tenants/register/route.ts`
3. `web-admin/app/api/v1/branches/[id]/route.ts`

**Mutating Server Actions (2):**
4. `web-admin/app/actions/settings/screen-contracts-actions.ts`
5. `web-admin/app/actions/settings/tax-actions.ts` *(reuse/extend `web-admin/lib/validations/tax-schemas.ts`)*

### Wave 3: Catalog, Price Lists & Products (9 API Routes + 1 Multipart Check)
**JSON-Mutating API Routes (9):**
1. `web-admin/app/api/v1/price-lists/route.ts`
2. `web-admin/app/api/v1/price-lists/[id]/route.ts`
3. `web-admin/app/api/v1/price-lists/[id]/items/route.ts`
4. `web-admin/app/api/v1/price-lists/[id]/items/[itemId]/route.ts`
5. `web-admin/app/api/v1/products/route.ts`
6. `web-admin/app/api/v1/products/[id]/route.ts`
7. `web-admin/app/api/v1/products/import/route.ts`
8. `web-admin/app/api/v1/pricing/import-all-products/route.ts`
9. `web-admin/app/api/v1/categories/route.ts`

**Multipart Check (1):**
10. `web-admin/app/api/v1/pricing/import/route.ts` — verify file/form-data field validation and size/type guards.

## Explicitly Excluded (Not Gaps)
- **Read-only Server Actions:** `get-order*.ts`, `invoice-list-actions.ts`, `voucher-list-actions.ts`, `validate-gift-card.ts`, `validate-promo.ts`.
- **No-body trigger / webhook routes:** `financial-reconcile`, `apply-bundle/[bundleCode]`, `items/[itemId]/complete`, `service-prefs/confirm`, `pieces/sync`, `lock`, `payments/[paymentId]/verify`, `refunds/[refundId]/approve`, and payment webhooks (still validate path params with `zUuidLike()` if any route lacks param checks).

## Verification Gate
Run from `web-admin/` after each wave (and full gate at PR closeout):
1. `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` — 0 errors
2. `node scripts/audit-tenant-guard.mjs` — PASS
3. `npx jest __tests__/lib/validations/validate-boundary.test.ts` + targeted order, payment, voucher, settings, and catalog test suites — PASS
4. `npx eslint . --quiet` — 0 errors
5. `npm run build` — PASS
6. Verify malformed/invalid payloads on newly wired endpoints return clean `400` / structured validation errors without reaching Prisma.
