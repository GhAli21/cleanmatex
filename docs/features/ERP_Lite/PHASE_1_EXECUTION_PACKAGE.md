---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_1_EXECUTION_PACKAGE_2026_03_28
status: Approved
approved_date: 2026-03-28
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Phase 1 Execution Package

## 1. Purpose

This document is the implementation-ready package for `Phase 1: Platform Enablement`.

It defines:
- exact Phase 1 scope
- exact migration group names
- exact feature flag list
- exact permission list
- exact navigation and route shell plan
- exact settings treatment for Phase 1
- exact i18n shell keys
- project-by-project implementation ownership

Phase 1 must remain shell and enablement only.

## 1.1 Current Status

Current status: `Implemented`

Completed scope:

- feature flags, permissions, navigation, and settings migrations created and applied
- ERP-Lite shell routes implemented in `cleanmatex`
- route access contracts and runtime guards implemented
- ERP-Lite flag/settings constants aligned to the applied database seeds
- EN/AR shell and access-state text added

Validation note:

- Node-based frontend validation remains blocked in the local environment because `npm` fails with `WSL 1 is not supported`

---

## 2. Phase 1 Boundary

Phase 1 includes:
- feature flag readiness
- permissions readiness
- allowed tenant settings readiness
- navigation records
- route shell creation
- shell i18n keys
- HQ/runtime ownership wiring

Phase 1 does not include:
- COA CRUD logic
- GL runtime logic
- posting engine
- auto-post execution
- reports
- expenses logic
- petty cash logic
- finance schema runtime tables

---

## 3. Project Ownership

## 3.1 `cleanmatexsaas` (Platform Level HQ)

Phase 1 HQ work:
- confirm plan/flag governance usage for ERP-Lite
- confirm future HQ-governed auto-post policy shell ownership
- prepare future governance publication entry points if shell work is needed

## 3.2 `cleanmatex` (Tenant Runtime)

Phase 1 tenant work:
- consume ERP-Lite flags
- consume ERP-Lite permissions
- use allowed tenant settings only
- add Finance & Accounting shell navigation
- add `/dashboard/erp-lite/*` route shells
- add shell i18n keys in EN/AR

## 3.3 Critical Rule

Core auto-post runtime behavior is not tenant-owned.

Phase 1 must not implement tenant-owned settings that redefine:
- invoice auto-post core behavior
- payment auto-post core behavior

---

## 4. Exact Feature Flag Set

Use these flag keys exactly:

- `erp_lite_enabled`
- `erp_lite_gl_enabled`
- `erp_lite_reports_enabled`
- `erp_lite_ar_enabled`
- `erp_lite_expenses_enabled`
- `erp_lite_bank_recon_enabled`
- `erp_lite_ap_enabled`
- `erp_lite_po_enabled`
- `erp_lite_branch_pl_enabled`

Phase 1 implementation rule:
- parent gate: `erp_lite_enabled`
- child route/nav visibility uses sub-module flag + permission

---

## 5. Exact Permission Set

## 5.1 Required for Phase 1 Shells

- `erp_lite:view`
- `erp_lite_coa:view`
- `erp_lite_gl:view`
- `erp_lite_reports:view`
- `erp_lite_ar:view`
- `erp_lite_expenses:view`
- `erp_lite_bank_recon:view`
- `erp_lite_ap:view`
- `erp_lite_po:view`
- `erp_lite_branch_pl:view`

## 5.2 Seed Now If You Want Stable Permission Contracts Early

- `erp_lite_coa:create`
- `erp_lite_coa:edit`
- `erp_lite_coa:delete`
- `erp_lite_gl:edit`
- `erp_lite_gl:reverse`
- `erp_lite_reports:export`
- `erp_lite_expenses:create`
- `erp_lite_expenses:approve`
- `erp_lite_bank_recon:edit`
- `erp_lite_ap:create`
- `erp_lite_ap:edit`
- `erp_lite_po:create`
- `erp_lite_po:edit`
- `erp_lite_gl:post`
- `erp_lite_gl:repost`
- `erp_lite_exceptions:view`
- `erp_lite_exceptions:retry`
- `erp_lite_exceptions:repost`
- `erp_lite_periods:view`
- `erp_lite_periods:close`
- `erp_lite_periods:reopen`

Recommendation:
- seed the future-safe permissions now to avoid permission churn later

---

## 6. Exact Tenant Settings Treatment

## 6.1 Allowed in Phase 1

Keep these settings in scope:

- `ERP_LITE_ENABLED`
- `ERP_LITE_FISCAL_YEAR_START`
- `ERP_LITE_FIRST_PERIOD_START`
- `ERP_LITE_PERIOD_CLOSE_ENABLED`

Do not activate module-specific settings in Phase 1 unless the shell must display them:

- `ERP_LITE_BANK_RECON_MATCH_TOLERANCE_DAYS`
- `ERP_LITE_EXPENSE_APPROVAL_REQUIRED`

## 6.2 Explicitly Excluded from Phase 1

Do not implement tenant-owned core settings for:

- `ERP_LITE_AUTO_POST_INVOICES`
- `ERP_LITE_AUTO_POST_PAYMENTS`

Reason:
- these conflict with the approved HQ-governed auto-post policy model

---

## 7. Exact Navigation Records

## 7.1 Parent

| Field | Value |
|---|---|
| `comp_code` | `erp_lite` |
| `label` | `Finance & Accounting` |
| `path` | `/dashboard/erp-lite` |
| `feature_flag` | `["erp_lite_enabled"]` |
| `main_permission_code` | `erp_lite:view` |

## 7.2 Children

| `comp_code` | `path` | `feature_flag` | `main_permission_code` |
|---|---|---|---|
| `erp_lite_coa` | `/dashboard/erp-lite/coa` | `["erp_lite_gl_enabled"]` | `erp_lite_coa:view` |
| `erp_lite_gl` | `/dashboard/erp-lite/gl` | `["erp_lite_gl_enabled"]` | `erp_lite_gl:view` |
| `erp_lite_reports` | `/dashboard/erp-lite/reports` | `["erp_lite_reports_enabled"]` | `erp_lite_reports:view` |
| `erp_lite_ar` | `/dashboard/erp-lite/ar` | `["erp_lite_ar_enabled"]` | `erp_lite_ar:view` |
| `erp_lite_expenses` | `/dashboard/erp-lite/expenses` | `["erp_lite_expenses_enabled"]` | `erp_lite_expenses:view` |
| `erp_lite_bank_recon` | `/dashboard/erp-lite/bank-recon` | `["erp_lite_bank_recon_enabled"]` | `erp_lite_bank_recon:view` |
| `erp_lite_ap` | `/dashboard/erp-lite/ap` | `["erp_lite_ap_enabled"]` | `erp_lite_ap:view` |
| `erp_lite_po` | `/dashboard/erp-lite/po` | `["erp_lite_po_enabled"]` | `erp_lite_po:view` |
| `erp_lite_branch_pl` | `/dashboard/erp-lite/branch-pl` | `["erp_lite_branch_pl_enabled"]` | `erp_lite_branch_pl:view` |

---

## 8. Exact Route File Plan in `cleanmatex`

Create shell routes under `web-admin/app/dashboard/`:

- `web-admin/app/dashboard/erp-lite/page.tsx`
- `web-admin/app/dashboard/erp-lite/coa/page.tsx`
- `web-admin/app/dashboard/erp-lite/gl/page.tsx`
- `web-admin/app/dashboard/erp-lite/reports/page.tsx`
- `web-admin/app/dashboard/erp-lite/ar/page.tsx`
- `web-admin/app/dashboard/erp-lite/expenses/page.tsx`

Optional placeholder shells now if you want stable route contracts early:

- `web-admin/app/dashboard/erp-lite/bank-recon/page.tsx`
- `web-admin/app/dashboard/erp-lite/ap/page.tsx`
- `web-admin/app/dashboard/erp-lite/po/page.tsx`
- `web-admin/app/dashboard/erp-lite/branch-pl/page.tsx`

Shell page behavior:
- permission + flag gated
- placeholder only
- bilingual-ready
- no finance runtime logic

---

## 9. Exact i18n File Plan

Update:

- `web-admin/messages/en.json`
- `web-admin/messages/ar.json`

Add minimum keys:

- `erp_lite.title`
- `erp_lite.subtitle`
- `erp_lite.sections.coa`
- `erp_lite.sections.gl`
- `erp_lite.sections.reports`
- `erp_lite.sections.ar`
- `erp_lite.sections.expenses`
- `erp_lite.sections.bank_recon`
- `erp_lite.sections.ap`
- `erp_lite.sections.po`
- `erp_lite.sections.branch_pl`
- `erp_lite.placeholder.title`
- `erp_lite.placeholder.description`

---

## 10. Exact Migration Group Names

Phase 1 migration authoring, if needed, should use new migration files only in:

- `cleanmatex/supabase/migrations/`

Migration naming rule:

- use the repository numeric sequence format: `NNNN_descriptive_name.sql`
- inspect `cleanmatex/supabase/migrations/`
- take the latest numeric sequence
- increment by `+1`

Current repo example at time of approval:

- latest numbered migration found: `0174_create_seed_preference_kinds_function.sql`
- next migration must start from: `0175_`

Recommended Phase 1 migration groups using the current sequence:

1. `0175_erp_lite_phase1_feature_flags.sql`
2. `0176_erp_lite_phase1_permissions.sql`
3. `0177_erp_lite_phase1_navigation.sql`
4. `0178_erp_lite_phase1_settings.sql`

If you prefer fewer files:

1. `0175_erp_lite_phase1_flags_permissions.sql`
2. `0176_erp_lite_phase1_navigation_settings.sql`

Best-practice recommendation:
- separate flags/permissions from navigation/settings to keep review simpler

---

## 11. Migration Ownership Rule

- migrations are created only in `cleanmatex`
- migrations are never created in `cleanmatexsaas`
- agent creates SQL files only
- user reviews and applies migrations

---

## 12. Exact Deliverables by Project

## 12.1 `cleanmatexsaas`

- flag-governance usage confirmed
- HQ ownership of future auto-post policy shell confirmed
- no tenant-policy leakage into HQ governance model

## 12.2 `cleanmatex`

- route shell files created
- nav records planned
- flags and permissions consumed
- allowed tenant settings frozen
- EN/AR shell keys added

---

## 13. Validation for Phase 1

After Phase 1 implementation:

- route shells compile
- gated nav behaves correctly
- hidden routes remain inaccessible when flag/permission fail
- EN/AR shell text renders correctly
- no finance logic has been introduced
- `npm run build` succeeds in `web-admin`

---

## 14. Final Ready Checklist

- [ ] flag list frozen
- [ ] permission list frozen
- [ ] allowed tenant settings frozen
- [ ] auto-post tenant settings excluded
- [ ] navigation records frozen
- [ ] route file plan frozen
- [ ] shell i18n keys frozen
- [ ] migration group names frozen
- [ ] migration ownership split accepted
- [ ] validation plan accepted

When all items above are accepted, Phase 1 is ready for implementation.
