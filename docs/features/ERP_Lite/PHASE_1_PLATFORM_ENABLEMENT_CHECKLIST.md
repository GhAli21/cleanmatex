---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_1_PLATFORM_ENABLEMENT_CHECKLIST_2026_03_28
status: Approved
approved_date: 2026-03-28
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Phase 1 Platform Enablement Checklist

## 1. Purpose

This document converts the approved ERP-Lite pack into the exact `Phase 1` platform enablement execution checklist.

Phase 1 is limited to:
- feature enablement
- permissions
- settings
- navigation
- route shells
- governance/runtime ownership split

Phase 1 must not implement finance posting logic, reports, or schema-heavy finance runtime behavior.

---

## 2. Canonical Dependencies

This checklist depends on:

- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [APPROVAL_CHECKLIST_FOR_PHASE_0.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/APPROVAL_CHECKLIST_FOR_PHASE_0.md)

If any of the above are revised, this checklist must be revalidated.

---

## 3. Phase 1 Outcome

Phase 1 is complete only when all of the following are true:

- ERP-Lite has a gated shell in tenant runtime
- ERP-Lite has defined HQ-governed enablement and policy hooks
- flags, permissions, navigation, and settings are frozen
- route shells exist without premature finance logic
- migration ownership split is explicit
- implementation can move to Phase 2 and Phase 3 without ambiguity

## 3.1 Current Execution Status

Current status: `Complete`

Completed implementation/results:

- feature flags were seeded and applied via migrations `0175` to `0178`
- ERP-Lite permissions, navigation, and allowed settings were seeded and applied
- tenant runtime shell routes were created under `/dashboard/erp-lite/*`
- route access contracts and runtime page/layout guards were implemented
- feature flag constants/types and settings constants were aligned to the applied seeds
- EN/AR shell and access-state messages were added

Open environment note:

- `npm run build` and `npm run check:i18n` could not be completed on this machine because local Node/npm execution is blocked by `WSL 1 is not supported`

---

## 4. Cross-Project Ownership Split

## 4.1 `cleanmatexsaas` Ownership in Phase 1

Platform HQ owns:

- ERP-Lite feature packaging and plan gating
- HQ-governed auto-post runtime behavior policy shell
- governance publication readiness for future finance packages

## 4.2 `cleanmatex` Ownership in Phase 1

Tenant runtime owns:

- Finance & Accounting navigation shell
- ERP-Lite route shells
- tenant-visible enablement checks
- permission gating
- feature-flag consumption
- tenant settings shell for allowed tenant configuration

## 4.3 Critical Rule

Auto-post runtime behavior configuration is `platform-level`, not tenant-owned.

That means:

- do not model invoice/payment auto-post behavior as tenant-configured core policy in Phase 1
- tenant runtime may consume published HQ policy
- tenant settings may only control allowed tenant-side behavior that does not override HQ policy

---

## 5. Feature Flags Checklist

## 5.1 Approved Flag Set

Use the following flag keys:

- `erp_lite_enabled`
- `erp_lite_gl_enabled`
- `erp_lite_reports_enabled`
- `erp_lite_ar_enabled`
- `erp_lite_expenses_enabled`
- `erp_lite_bank_recon_enabled`
- `erp_lite_ap_enabled`
- `erp_lite_po_enabled`
- `erp_lite_branch_pl_enabled`

## 5.2 Phase 1 Required Actions

- [x] confirm these flag keys remain canonical
- [x] confirm parent-child gating model
- [x] define flag dependency behavior in tenant runtime nav and route checks
- [x] define plan-binding assumptions in HQ governance

## 5.3 Phase 1 Notes

- `erp_lite_enabled` is the parent gate
- child modules must not render or activate when parent gate is disabled
- v1 runtime should actively use only the v1-relevant flags
- v2/v3 flags may exist early but should not drive implementation before their phases

---

## 6. Permissions Checklist

## 6.1 Section Gate

Use:

- `erp_lite:view`

## 6.2 Phase 1 Required Permission Set

For shell and future-safe access planning, keep these permission codes:

- `erp_lite_coa:view`
- `erp_lite_coa:create`
- `erp_lite_coa:edit`
- `erp_lite_coa:delete`
- `erp_lite_gl:view`
- `erp_lite_gl:edit`
- `erp_lite_gl:reverse`
- `erp_lite_reports:view`
- `erp_lite_reports:export`
- `erp_lite_ar:view`
- `erp_lite_expenses:view`
- `erp_lite_expenses:create`
- `erp_lite_expenses:approve`
- `erp_lite_bank_recon:view`
- `erp_lite_bank_recon:edit`
- `erp_lite_ap:view`
- `erp_lite_ap:create`
- `erp_lite_ap:edit`
- `erp_lite_po:view`
- `erp_lite_po:create`
- `erp_lite_po:edit`
- `erp_lite_branch_pl:view`

## 6.3 Recommended Additional Future-Safe Permissions

These are not mandatory for minimal shell rendering, but should be frozen now if you want permission stability:

- `erp_lite_gl:post`
- `erp_lite_gl:repost`
- `erp_lite_exceptions:view`
- `erp_lite_exceptions:retry`
- `erp_lite_exceptions:repost`
- `erp_lite_periods:view`
- `erp_lite_periods:close`
- `erp_lite_periods:reopen`

Strong recommendation:
- prefer explicit `post` / `repost` / `retry` permissions instead of overloading `edit`

## 6.4 Phase 1 Required Actions

- [x] freeze the final permission code list for Phase 1
- [x] decide whether future-safe permissions will be seeded now or in Phase 1
- [x] map each screen shell to one main permission code
- [x] confirm role-default strategy for `super_admin`, `tenant_admin`, and finance roles

---

## 7. Tenant Settings Checklist

## 7.1 Allowed Tenant Settings in Phase 1

The following remain valid tenant-side settings:

- `ERP_LITE_ENABLED`
- `ERP_LITE_FISCAL_YEAR_START`
- `ERP_LITE_FIRST_PERIOD_START`
- `ERP_LITE_PERIOD_CLOSE_ENABLED`

These may be added later when their modules are active:

- `ERP_LITE_BANK_RECON_MATCH_TOLERANCE_DAYS`
- `ERP_LITE_EXPENSE_APPROVAL_REQUIRED`

## 7.2 Settings That Must Not Be Treated as Tenant-Owned Core Policy

Do not use tenant settings as the authoritative source for:

- `ERP_LITE_AUTO_POST_INVOICES`
- `ERP_LITE_AUTO_POST_PAYMENTS`

Reason:
- auto-post runtime behavior is HQ-governed platform policy
- runtime may observe or display published policy, but tenant settings must not redefine core posting behavior

Recommended treatment:
- remove these from Phase 1 implementation scope
- revisit later only if there is an explicitly approved tenant-allowed override model

## 7.3 Phase 1 Required Actions

- [x] freeze the allowed tenant setting list
- [x] explicitly exclude tenant-owned core auto-post settings from current Phase 1 implementation
- [x] confirm settings category code `ERP_LITE`
- [x] define which settings are shell-only vs runtime-active in v1

---

## 8. Navigation Checklist

## 8.1 Parent Navigation Node

Use:

- `comp_code`: `erp_lite`
- label: `Finance & Accounting`
- path: `/dashboard/erp-lite`
- feature flag: `erp_lite_enabled`
- main permission: `erp_lite:view`

## 8.2 Child Nodes

Use the following child shells:

| comp_code | path | flag | main permission |
| --- | --- | --- | --- |
| `erp_lite_coa` | `/dashboard/erp-lite/coa` | `erp_lite_gl_enabled` | `erp_lite_coa:view` |
| `erp_lite_gl` | `/dashboard/erp-lite/gl` | `erp_lite_gl_enabled` | `erp_lite_gl:view` |
| `erp_lite_reports` | `/dashboard/erp-lite/reports` | `erp_lite_reports_enabled` | `erp_lite_reports:view` |
| `erp_lite_ar` | `/dashboard/erp-lite/ar` | `erp_lite_ar_enabled` | `erp_lite_ar:view` |
| `erp_lite_expenses` | `/dashboard/erp-lite/expenses` | `erp_lite_expenses_enabled` | `erp_lite_expenses:view` |
| `erp_lite_bank_recon` | `/dashboard/erp-lite/bank-recon` | `erp_lite_bank_recon_enabled` | `erp_lite_bank_recon:view` |
| `erp_lite_ap` | `/dashboard/erp-lite/ap` | `erp_lite_ap_enabled` | `erp_lite_ap:view` |
| `erp_lite_po` | `/dashboard/erp-lite/po` | `erp_lite_po_enabled` | `erp_lite_po:view` |
| `erp_lite_branch_pl` | `/dashboard/erp-lite/branch-pl` | `erp_lite_branch_pl_enabled` | `erp_lite_branch_pl:view` |

## 8.3 Phase 1 Required Actions

- [x] freeze parent and child `comp_code` values
- [x] freeze route path pattern under `/dashboard/erp-lite/*`
- [x] decide whether any child routes stay hidden until later phases even if placeholders exist
- [x] confirm EN/AR labels for parent and child nodes

---

## 9. Route Shell Checklist

## 9.1 Required Route Shells in `cleanmatex`

Create shell-only route placeholders for:

- `/dashboard/erp-lite`
- `/dashboard/erp-lite/coa`
- `/dashboard/erp-lite/gl`
- `/dashboard/erp-lite/reports`
- `/dashboard/erp-lite/ar`
- `/dashboard/erp-lite/expenses`

Optional placeholder shells now, depending on your preference:

- `/dashboard/erp-lite/bank-recon`
- `/dashboard/erp-lite/ap`
- `/dashboard/erp-lite/po`
- `/dashboard/erp-lite/branch-pl`

## 9.2 Shell Behavior

Each shell should:

- enforce flag and permission gating
- render minimal placeholder state only
- avoid finance logic, schema calls, or posting behavior
- remain bilingual-ready

## 9.3 Phase 1 Required Actions

- [ ] create the parent route shell
- [ ] create approved child shells
- [ ] wire gating checks consistently
- [ ] confirm placeholder UX text and i18n namespace use

---

## 10. i18n Checklist

Phase 1 must add only the shell-level keys needed for navigation and placeholder states.

Minimum namespace:

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

Phase 1 required actions:

- [ ] freeze minimal shell i18n key set
- [ ] add EN and AR values
- [ ] verify RTL-safe shell rendering

---

## 11. Migration Ownership Split

## 11.1 Migrations Created in `cleanmatex` Only

If Phase 1 requires DB changes, migration files are created only in:

- `cleanmatex/supabase/migrations/`

Likely Phase 1 migration groups:

- ERP-Lite feature flags / plan mappings
- ERP-Lite permissions / default role mappings
- ERP-Lite navigation entries
- ERP-Lite settings category and tenant settings

## 11.2 `cleanmatexsaas` Must Not Create Migrations

HQ/governance-side implementation in `cleanmatexsaas` may consume shared DB objects, but it must not author migrations there.

## 11.3 Phase 1 Required Actions

- [ ] identify which Phase 0 changes truly require migrations
- [ ] list exact migration groups before authoring SQL files
- [ ] stop for user review before any migration is applied

---

## 12. Deliverables by Project

## 12.1 `cleanmatex`

- approved shell route map
- approved nav structure
- approved permission and flag consumption rules
- approved tenant setting list
- minimal i18n shell keys

## 12.2 `cleanmatexsaas`

- approved HQ ownership statement for plan/flag governance
- approved shell-level publication/policy placeholder for future auto-post governance

---

## 13. Explicitly Deferred From Phase 0

Do not implement in Phase 1:

- COA runtime CRUD behavior
- GL runtime logic
- posting engine
- auto-post execution
- finance reports
- expenses behavior
- petty cash behavior
- AP/PO logic
- bank reconciliation logic

Phase 1 is platform enablement and shell only.

---

## 14. Final Execution Checklist

- [ ] feature flag keys frozen
- [ ] permission code list frozen
- [ ] allowed tenant setting list frozen
- [ ] tenant-owned core auto-post settings excluded
- [ ] nav codes and route paths frozen
- [ ] route shell scope frozen
- [ ] shell i18n key set frozen
- [ ] migration ownership split accepted
- [ ] no finance logic slipped into Phase 0

When all items above are complete, Phase 1 can be executed safely.
