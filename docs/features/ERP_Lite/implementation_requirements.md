---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# ERP-Lite Implementation Requirements

Platform-level items for ERP-Lite feature. See [docs/platform/README.md](../../platform/README.md) for reference.

---

## 1. Feature Flags

| Flag | Description | Plans |
|------|-------------|-------|
| `erp_lite_enabled` | Master switch for ERP-Lite | PRO, ENTERPRISE |
| `erp_lite_gl_enabled` | COA + GL | PRO, ENTERPRISE |
| `erp_lite_reports_enabled` | Financial reports | PRO, ENTERPRISE |
| `erp_lite_ar_enabled` | AR aging | PRO, ENTERPRISE |
| `erp_lite_bank_recon_enabled` | Bank reconciliation | PRO, ENTERPRISE |
| `erp_lite_ap_enabled` | Accounts Payable | ENTERPRISE |
| `erp_lite_po_enabled` | Purchase Orders | ENTERPRISE |
| `erp_lite_expenses_enabled` | Expense management | ENTERPRISE |
| `erp_lite_branch_pl_enabled` | Branch P&L | PRO, ENTERPRISE |

**Migration:** Add to `hq_ff_feature_flags_mst` and `sys_ff_pln_flag_mappings_dtl`. See [FEATURE_FLAGS.md](FEATURE_FLAGS.md).

---

## 2. Permissions

Add to `sys_auth_permissions` and assign to roles via `sys_auth_role_default_permissions`:

- `erp_lite:view`
- `erp_lite_coa:view`, `erp_lite_coa:create`, `erp_lite_coa:edit`, `erp_lite_coa:delete`
- `erp_lite_gl:view`, `erp_lite_gl:edit`, `erp_lite_gl:reverse`
- `erp_lite_reports:view`, `erp_lite_reports:export`
- `erp_lite_ar:view`
- `erp_lite_bank_recon:view`, `erp_lite_bank_recon:edit`
- `erp_lite_ap:view`, `erp_lite_ap:create`, `erp_lite_ap:edit`
- `erp_lite_po:view`, `erp_lite_po:create`, `erp_lite_po:edit`
- `erp_lite_expenses:view`, `erp_lite_expenses:create`, `erp_lite_expenses:approve`
- `erp_lite_branch_pl:view`

**Migration:** See [PERMISSIONS.md](PERMISSIONS.md).

---

## 3. Navigation Tree / Screen

- Add **Finance & Accounting** section to `sys_components_cd`
- Parent: `erp_lite` — `feature_flag: ["erp_lite_enabled"]`
- Children (each with own `feature_flag` and `main_permission_code`):

| comp_code | label | comp_path | feature_flag | main_permission_code |
|-----------|-------|-----------|--------------|----------------------|
| erp_lite | Finance & Accounting | /dashboard/erp-lite | ["erp_lite_enabled"] | erp_lite:view |
| erp_lite_coa | Chart of Accounts | /dashboard/erp-lite/coa | ["erp_lite_gl_enabled"] | erp_lite_coa:view |
| erp_lite_gl | General Ledger | /dashboard/erp-lite/gl | ["erp_lite_gl_enabled"] | erp_lite_gl:view |
| erp_lite_reports | Financial Reports | /dashboard/erp-lite/reports | ["erp_lite_reports_enabled"] | erp_lite_reports:view |
| erp_lite_ar | AR Aging | /dashboard/erp-lite/ar | ["erp_lite_ar_enabled"] | erp_lite_ar:view |
| erp_lite_bank_recon | Bank Reconciliation | /dashboard/erp-lite/bank-recon | ["erp_lite_bank_recon_enabled"] | erp_lite_bank_recon:view |
| erp_lite_ap | Accounts Payable | /dashboard/erp-lite/ap | ["erp_lite_ap_enabled"] | erp_lite_ap:view |
| erp_lite_po | Purchase Orders | /dashboard/erp-lite/po | ["erp_lite_po_enabled"] | erp_lite_po:view |
| erp_lite_expenses | Expenses | /dashboard/erp-lite/expenses | ["erp_lite_expenses_enabled"] | erp_lite_expenses:view |
| erp_lite_branch_pl | Branch P&L | /dashboard/erp-lite/branch-pl | ["erp_lite_branch_pl_enabled"] | erp_lite_branch_pl:view |

---

## 4. Settings

Add to `sys_tenant_settings_cd` (new category `ERP_LITE`):

| setting_code | Description |
|--------------|-------------|
| ERP_LITE_ENABLED | Tenant self-serve disable |
| ERP_LITE_FISCAL_YEAR_START | Fiscal year start month (1–12) |
| ERP_LITE_FIRST_PERIOD_START | First period start date |
| ERP_LITE_AUTO_POST_INVOICES | Auto-post invoices to GL |
| ERP_LITE_AUTO_POST_PAYMENTS | Auto-post payments to GL |
| ERP_LITE_PERIOD_CLOSE_ENABLED | Allow period close |
| ERP_LITE_BANK_RECON_MATCH_TOLERANCE_DAYS | Bank match date tolerance |
| ERP_LITE_EXPENSE_APPROVAL_REQUIRED | Expense approval required |

**Migration:** See [SETTINGS.md](SETTINGS.md).

---

## 5. i18n Keys

Add `erp_lite.*` namespace to `web-admin/messages/en.json`, `ar.json`:

- `erp_lite.title`, `erp_lite.coa`, `erp_lite.gl`, `erp_lite.reports`, `erp_lite.ar`, etc.
- Reuse `common.*` where possible (e.g. `common.save`, `common.cancel`)

---

## 6. API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/v1/erp-lite/coa | List Chart of Accounts |
| POST | /api/v1/erp-lite/coa | Create account |
| GET | /api/v1/erp-lite/coa/:id | Get account |
| PATCH | /api/v1/erp-lite/coa/:id | Update account |
| GET | /api/v1/erp-lite/gl | List GL entries (filtered) |
| POST | /api/v1/erp-lite/gl | Create manual GL entry |
| GET | /api/v1/erp-lite/reports/pl | P&L report |
| GET | /api/v1/erp-lite/reports/balance-sheet | Balance Sheet |
| GET | /api/v1/erp-lite/reports/cash-flow | Cash Flow |
| GET | /api/v1/erp-lite/ar/aging | AR aging report |
| GET | /api/v1/erp-lite/bank-recon | Bank reconciliation data |
| POST | /api/v1/erp-lite/bank-recon/import | Import bank transactions |
| POST | /api/v1/erp-lite/bank-recon/match | Match transaction |
| ... | (AP, PO, Expenses, Branch P&L) | Per module |

---

## 7. Database Migrations

Create **new** migrations (do not modify existing):

| Migration | Purpose |
|-----------|---------|
| `NNNN_erp_lite_feature_flags.sql` | hq_ff_feature_flags_mst, sys_ff_pln_flag_mappings_dtl |
| `NNNN_erp_lite_permissions_navigation.sql` | sys_auth_permissions, sys_components_cd |
| `NNNN_erp_lite_settings.sql` | sys_tenant_settings_cd (ERP_LITE category + settings) |
| `NNNN_erp_lite_schema.sql` | org_fin_chart_of_accounts_mst, org_fin_gl_entries_tr, RLS |
| (Phase 2+) | org_fin_bank_*, org_fin_ap_*, org_fin_po_*, org_fin_expenses_* |

**Rule:** Never modify existing migration files. Use the latest numeric sequence from `supabase/migrations/` and increment by `+1` for each new file, for example after `0174_...` use `0175_...`.

---

## 8. Constants / Types

- `web-admin/lib/constants/erp-lite.ts`: ACCOUNT_TYPES, GL_REFERENCE_TYPES, AGING_BUCKETS
- `web-admin/lib/types/erp-lite.ts`: ChartOfAccount, GlEntry, ArAgingRow, etc.

---

## 9. Integration Points

- **Invoice create/update:** Call `createGlEntriesForInvoice()` when `ERP_LITE_AUTO_POST_INVOICES` is true
- **Payment create:** Call `createGlEntriesForPayment()` when `ERP_LITE_AUTO_POST_PAYMENTS` is true
- **Refund:** Call `createGlEntriesForRefund()`
- **B2B:** AR aging uses `org_invoice_mst` + `org_customers_mst`; integrate with B2B statements

---

## 10. Environment Variables

None required for Phase 1. Phase 3 (Bank Recon) may need file upload limits.

---

## 11. Checklist Summary

- [ ] Feature flags (hq_ff_feature_flags_mst, sys_ff_pln_flag_mappings_dtl)
- [ ] Permissions (sys_auth_permissions, sys_auth_role_default_permissions)
- [ ] Navigation (sys_components_cd)
- [ ] Settings (sys_tenant_settings_cd, ERP_LITE category)
- [ ] i18n keys (en.json, ar.json)
- [ ] API routes
- [ ] Database schema (org_fin_*)
- [ ] GL posting service + invoice/payment hooks
- [ ] Constants and types
