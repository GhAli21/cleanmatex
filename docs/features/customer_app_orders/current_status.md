# Current Status — Customer App Orders (`customer_app_orders`)

**Last Updated:** 2026-11-28  
**Version:** `2.0.0`  
**Overall Status:** ✅ Implementation Complete across DB (`0859`), `web-admin` APIs & Staff POS UI, Shared Flutter Packages, and `apps/customer_app`

## Phase Completion Matrix

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Workspace docs export, migration `0859` draft, ADR v2.3.0 | ✅ Done (Applied to local + remote DBs; Prisma & Supabase types regenerated) |
| **Phase 2A** | `web-admin` Public Customer APIs & dual-scope services | ✅ Done (`tsc --noEmit` 0 errors, `eslint --quiet` 0 errors) |
| **Phase 2B** | `web-admin` Staff Quick-Drop Queue & atomic POS conversion | ✅ Done (`check:ui` 0 errors, `check:i18n` passed, `tsc --noEmit` 0 errors) |
| **Phase 3** | Shared Flutter packages (`mobile_ui`, `mobile_domain`, `mobile_services`, `mobile_l10n`) | ✅ Done (`dart analyze` 0 issues, package tests passed) |
| **Phase 4** | `apps/customer_app` 4-Tab Shell, Quick Drop, 6-Step Detailed Order, Tracker, Receipts, Profile | ✅ Done (`dart analyze` 0 issues, 0 missing EN/AR l10n keys) |
| **Phase 5** | Automated Flutter widget/provider tests & `web-admin` production build | ✅ Verified (see exact validation results below) |
| **Phase 6** | Canonical feature & mobile documentation pack | ✅ Done |

## Key Invariants Verified

- **Multi-Tenancy:** Every `org_*` read/write in `web-admin` explicitly filters by `tenant_org_id`.
- **RBAC:** Staff Quick-Drop queue & conversion routes are gated under existing `orders:read` and `orders:create` permissions (no new tenant RBAC setup required).
- **Atomic Conversion:** `linkAndConvertOrderRequestTx` locks the `org_ord_requests_mst` row (`SELECT ... FOR UPDATE`) inside the POS order transaction and enforces `409 REQUEST_ALREADY_CONVERTED`.
- **Server-Side Money Authority:** Customer Detailed Order review calls `POST /api/v1/public/customer/booking/quote` (`quoteCheckout()`); zero client-side tax/discount calculation.
- **Always-Light Fiscal Receipts:** Receipt modal paper is wrapped in `AppTheme.paperLight(locale: locale)` regardless of app Light/Dark mode.
- **Time & Timezone:** Instants are UTC `timestamptz` / RFC 3339 `Z`; Ready-By converts at presentation using branch timezone (`resolveOperationalTimeZone(..., 'ready_by', branchId)`).
