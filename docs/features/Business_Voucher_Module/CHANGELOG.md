# Business Voucher Module — CHANGELOG

## [1.0.0] — 2026-05-20

### Added

**Database (migrations 0300–0307)**
- Extended `org_fin_vouchers_mst` with full BVM columns: `voucher_status`, `posting_status`, `direction`, party fields, all amount fields, `idempotency_key`, audit timestamps
- Created `org_fin_voucher_trx_lines_dtl` — universal transaction lines table with RLS, composite PK, 6 indexes
- Created sys lookup tables: `sys_fin_vch_type_cd`, `sys_fin_vch_line_type_cd`, `sys_fin_vch_line_role_cd`, `sys_fin_vch_target_type_cd`, `sys_fin_vch_direction_cd`
- Created expense category tables: `sys_fin_exp_cat_cd` (8 seeded), `org_fin_exp_cat_cf` (tenant-scoped with RLS)
- Added `fin_voucher_id` + `fin_voucher_trx_line_id` back-link columns to 6 operational tables
- Seeded 18 BVM permissions into `sys_auth_permissions` + role mapping in `sys_auth_role_default_permissions`
- Added navigation entries for BVM voucher screens under `internal_fin` section
- Finalized `voucher_type` column: backfilled old short codes (`RECEIPT` → `RECEIPT_VOUCHER` etc.), dropped old column, renamed bridge column

**Services**
- `voucher-biz.service.ts` — createBizVoucher, updateBizVoucher, getBizVoucherById, listBizVouchers, cancelBizVoucher
- `voucher-line.service.ts` — addVoucherLine, updateVoucherLine, deleteDraftVoucherLine, listVoucherLines
- `voucher-number.service.ts` — advisory-lock serialized voucher number generation (RV/PV/RF/ADJ/TR prefixes)
- `voucher-validation.service.ts` — pure validation: status transitions, mutability, role restrictions, line rules, posting pre-checks
- `voucher-posting.service.ts` — single-transaction posting orchestrator with idempotency, audit log, domain event outbox
- `voucher-reversal.service.ts` — voucher and line reversal, creates mirror voucher with opposite-direction lines

**Server Actions**
- `app/actions/finance/voucher-actions.ts` — 7 actions (create, update, post, cancel, reverse, detail, list)
- `app/actions/finance/voucher-line-actions.ts` — 5 actions (add, update, delete-draft, reverse, list)

**API Routes** (14 endpoints under `/api/v1/finance/vouchers/`)
- Full REST CRUD + post/cancel/reverse lifecycle actions
- Line sub-resource CRUD + reverse
- Lookup endpoints (types, line-roles, expense-categories) — filtered by user role

**Feature Module** (`src/features/finance/vouchers/`)
- Client-side access helpers (`vouchers-access.ts`)
- Zod schemas: `voucher-header-schema.ts`, `voucher-line-schema.ts`
- UI components: `VouchersTable`, `VoucherStatusBadge`, `VoucherDirectionBadge`, `VoucherLineTable`, `VoucherCancelDialog`, `VoucherReversalDialog`

**UI Pages** (`app/dashboard/internal_fin/vouchers/`)
- List page with filters and server pagination
- 3-step create wizard (Header → Lines → Review & Post)
- Detail page with Summary / Lines / Audit tabs

**Navigation**
- `NAV_TRANSLATION_KEY_MAP` entries added for `internal_fin`, `finance_vouchers`, `finance_vouchers_new`, `finance_vouchers_reports`
- Dual-write: `config/navigation.ts` + DB migration 0305

**i18n**
- `finance.vouchers.*` key block in `en.json` + `ar.json` (50+ keys)
- Navigation keys: `internalFinanceOps`, `businessVouchers`, `newVoucher`, `voucherReports`

**Tests**
- 53 tests passing: `voucher-validation.test.ts` (41) + `voucher-posting.test.ts` (12)

### Changed

- `lib/constants/voucher.ts` — added BVM constants (`VOUCHER_TYPE`, `VOUCHER_STATUS`, `GL_POSTING_STATUS`, `LINE_TYPE`, `LINE_ROLE`, `TARGET_TYPE`, `WIRING_STATUS`, `LINE_ROLE_REQUIREMENTS`, `CASHIER_ALLOWED_*`). Legacy exports (`VOUCHER_TYPE_LEGACY`, `VOUCHER_STATUS_LEGACY`) kept for backward compatibility.
- `lib/services/voucher-service.ts` — updated `voucher_type` references to new BVM enum values post-migration 0307
- `lib/services/refund-voucher-service.ts` — same update
- `app/actions/payments/voucher-crud-actions.ts` — updated `voucher_type` field to BVM enum values
- `web-admin/prisma/schema.prisma` — added all new BVM models and fields

### Deferred

- Wiring service (Phase W1/W2): populate back-links between voucher lines and operational tables
- GL posting service: manage `posting_status` independently of `voucher_status`
- `sys_fin_vch_type_cd` and `sys_fin_vch_line_role_cd` Prisma model definitions (lookup routes use raw SQL)
- Expense category settings page for tenant customization
