# Human-Friendly Codes — Permissions, navigation and feature flag (P6)

Status: written 2026-10-31 (Asia/Muscat, UTC+4). Migrations `0688_hq_doc_seq_permissions.sql` and `0689_ord_label_image_cols_deprecated.sql` were **applied by you on 2026-11-01** (local + remote). Decisions A-54..A-56 were made by the assistant while you were away; **reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; plan §20).

## 1. HQ permissions (platform-api / platform-web)

| Code | Name (EN) | Name (AR) | Used by (P7) |
|------|-----------|-----------|--------------|
| `hq_doc_seq:read` | Read document numbering | عرض ترقيم المستندات | Code Types list, drawer, preview; Code Consistency screen |
| `hq_general_config:read` | Read general numbering defaults | عرض الإعدادات العامة للترقيم | General Config screen (view) |
| `hq_general_config:manage` | Manage general numbering defaults | إدارة الإعدادات العامة للترقيم | General Config screen (save) |

- Style: colon codes, `resource_code` / `action_code` taken with `split_part` (A-08, same as `0612` / `0625`).
- Guard in HQ API: `@UseGuards(JwtAuthGuard, HqIdentityGuard, HqPermissionGuard)` + `@RequireHqPermission('hq_doc_seq:read')`.
- Constants: kept next to the P7 module that uses them (same as `PERM_OPERATE` in `notifications-hq`).

## 2. Who gets them

| Role | Gets the codes? | How |
|------|-----------------|-----|
| `SUPER_ADMIN` | Yes, all 3 | Already holds `*` in `hq_role_permissions` |
| `TECH_ADMIN` | Yes, all 3 (**`0690` applied 2026-11-05**, A-71) | `0690_hq_doc_seq_role_grants.sql` |
| `SUPPORT` | `hq_doc_seq:read` only (**`0690` applied 2026-11-05**, A-71) | `0690_hq_doc_seq_role_grants.sql` |
| Other roles (`BUSINESS_ADMIN`, `ANALYST`, `VIEWER`, custom) | No, until you grant them | HQ → Roles screen (A-54) |

Recommendation (A-54), done by `0690` (A-71, **applied 2026-11-05**): give `hq_doc_seq:read` to `TECH_ADMIN` and `SUPPORT`, and `hq_general_config:read` + `hq_general_config:manage` only to `TECH_ADMIN`. Note: `VIEWER` holds `*.view`, which does **not** match `:read` codes.

## 3. Tenant side (web-admin)

- No new tenant permission (A-09 default). The scan and label APIs use `orders:read` (`lib/constants/permissions/orders-perm.ts`).
- The UI access contract does not change, so `rebuild-ui-access-contract` is not needed (A-55).

## 4. Navigation

- HQ nav is code in `platform-web/components/layout/sidebar.tsx`. The three entries (Code Types, Code Consistency, General Config) are added with the P7 screens. No nav migration (`navigation_doc_seq` skipped, A-22 / A-55).
- No tenant page was added (A-11), so no `sys_components_cd` row.

## 5. Feature flag

- `human_codes_scan_labels` (`hq_ff_feature_flags_mst`, default off) already came with `0684` (A-14). It gates the global scan dialog and the new label print. Numbering in the database is never behind a flag. The old `label_printing` flag is removed from web-admin code (P11, A-72); its DB row stays until you approve removing it.

## 6. Deprecated columns (A-48, A-56)

- `0689` sets `COMMENT ON COLUMN … 'DEPRECATED (HFC P6, 0689): …'` on `org_orders_mst.qr_code` and `org_orders_mst.barcode`. They are not read since P4. They are **not** dropped; a drop needs its own approval.

## 6a. Where P7 uses them (2026-10-31)

| Code | API (`/api/hq/v1/…`) | Screen (platform-web) |
|------|----------------------|-----------------------|
| `hq_doc_seq:read` | `GET doc-seq/types`, `GET doc-seq/types/:code`, `GET doc-seq/types/:code/preview`, `GET doc-seq/consistency` | `/system-codes/doc-seq-types`, `/system-codes/doc-seq-consistency` |
| `hq_general_config:read` | `GET general-config`, `GET general-config/options` | `/settings/general-config` (view); tenant wizard prefill (best effort) |
| `hq_general_config:manage` | `PATCH general-config` | Edit button + dialog on `/settings/general-config` |

A user without the read code sees a "no access" panel; without `manage` the screen is read-only with a note.

## 7. Apply and test

See `DEV_GUIDE_DOC_SEQ_ENGINE.md` §21 (pre-checks, apply, `supabase/tests/hfc_p6_safety.test.sql`, rollback).
