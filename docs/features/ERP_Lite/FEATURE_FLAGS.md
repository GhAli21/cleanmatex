---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# ERP-Lite Feature Flags

Feature flags for ERP-Lite are stored in `hq_ff_feature_flags_mst` and mapped to plans via `sys_ff_pln_flag_mappings_dtl`. Resolution uses `hq_ff_get_effective_value` / `hq_ff_get_effective_values_batch`.

---

## Main Feature Flag

| Flag Key | Name | Description | Plans |
|----------|------|-------------|-------|
| `erp_lite_enabled` | ERP-Lite Enabled | Master switch. When false, entire ERP-Lite module is hidden. All sub-module flags require this to be true. | PRO, ENTERPRISE |

**Usage:** Gate the Finance & Accounting navigation section and all ERP-Lite routes.

---

## Per-Module Feature Flags

| Flag Key | Name | Description | Plans |
|----------|------|-------------|-------|
| `erp_lite_gl_enabled` | General Ledger | Chart of Accounts + GL + auto-post from invoices/payments | PRO, ENTERPRISE |
| `erp_lite_reports_enabled` | Financial Reports | P&L, Balance Sheet, Cash Flow | PRO, ENTERPRISE |
| `erp_lite_ar_enabled` | AR Aging | Customer outstanding balances by aging bucket | PRO, ENTERPRISE |
| `erp_lite_bank_recon_enabled` | Bank Reconciliation | Import bank statements, match to payments | PRO, ENTERPRISE |
| `erp_lite_ap_enabled` | Accounts Payable | Supplier invoices, AP payments | ENTERPRISE |
| `erp_lite_po_enabled` | Purchase Orders | POs for consumables/supplies | ENTERPRISE |
| `erp_lite_expenses_enabled` | Expense Management | Expense claims, approvals | ENTERPRISE |
| `erp_lite_branch_pl_enabled` | Branch P&L | Profitability by branch | PRO, ENTERPRISE |

---

## Resolution Logic

1. **Main gate:** If `erp_lite_enabled` is false, all ERP-Lite features are disabled regardless of sub-module flags.
2. **Sub-module:** Each module (GL, reports, AR, etc.) is gated by its own flag.
3. **Plan binding:** Flags are `plan_bound`; values come from `sys_ff_pln_flag_mappings_dtl` for tenant's plan.
4. **Override:** Tenant can disable via `org_ff_overrides_cf` for `erp_lite_enabled` (self-serve opt-out).

---

## hq_ff_feature_flags_mst Seed (Migration)

```sql
-- Main flag
INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, data_type, default_value, plan_binding_type,
  enabled_plan_codes, allows_tenant_override, comp_code
) VALUES (
  'erp_lite_enabled', 'ERP-Lite Enabled', 'تفعيل ERP-Lite',
  'Master switch for Finance & Accounting module', 'المفتاح الرئيسي لوحدة المالية والمحاسبة',
  'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound',
  '["PRO", "ENTERPRISE"]'::jsonb, true, 'erp_lite'
);

-- Sub-module flags (all require erp_lite_enabled)
INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, data_type, default_value, plan_binding_type,
  enabled_plan_codes, allows_tenant_override, comp_code
) VALUES
  ('erp_lite_gl_enabled', 'GL Module', 'وحدة دفتر الأستاذ', 'Chart of Accounts + General Ledger', 'دليل الحسابات + دفتر الأستاذ العام', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_reports_enabled', 'Financial Reports', 'التقارير المالية', 'P&L, Balance Sheet, Cash Flow', 'قائمة الدخل، الميزانية، التدفق النقدي', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_ar_enabled', 'AR Aging', 'تقييم الذمم المدينة', 'Accounts Receivable aging', 'تقييم الذمم المدينة', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_bank_recon_enabled', 'Bank Reconciliation', 'التسوية البنكية', 'Bank statement import and matching', 'استيراد ومطابقة كشف الحساب البنكي', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_ap_enabled', 'Accounts Payable', 'حسابات الدائنين', 'Supplier invoices and payments', 'فواتير الموردين والمدفوعات', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_po_enabled', 'Purchase Orders', 'أوامر الشراء', 'Purchase orders for consumables', 'أوامر الشراء للمستهلكات', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_expenses_enabled', 'Expense Management', 'إدارة المصروفات', 'Expense claims and approvals', 'مطالبات المصروفات والموافقات', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, false, 'erp_lite'),
  ('erp_lite_branch_pl_enabled', 'Branch P&L', 'قائمة دخل الفروع', 'Profitability by branch', 'الربحية حسب الفرع', 'tenant_feature', 'boolean', 'false'::jsonb, 'plan_bound', '["PRO", "ENTERPRISE"]'::jsonb, false, 'erp_lite');
```

---

## sys_ff_pln_flag_mappings_dtl Seed (Migration)

For boolean flags, set `plan_specific_value = true` (or non-null) and `is_enabled = true` so the RPC returns `true` for the plan.

```sql
-- PRO plan: erp_lite_enabled, gl, reports, ar, bank_recon, branch_pl
INSERT INTO sys_ff_pln_flag_mappings_dtl (plan_code, flag_key, plan_specific_value, is_enabled, created_at, created_by)
SELECT 'PRO', f, true, true, CURRENT_TIMESTAMP, 'system_admin'
FROM unnest(ARRAY['erp_lite_enabled', 'erp_lite_gl_enabled', 'erp_lite_reports_enabled', 'erp_lite_ar_enabled', 'erp_lite_bank_recon_enabled', 'erp_lite_branch_pl_enabled']) AS f
ON CONFLICT (plan_code, flag_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- ENTERPRISE plan: all flags
INSERT INTO sys_ff_pln_flag_mappings_dtl (plan_code, flag_key, plan_specific_value, is_enabled, created_at, created_by)
SELECT 'ENTERPRISE', f, true, true, CURRENT_TIMESTAMP, 'system_admin'
FROM unnest(ARRAY['erp_lite_enabled', 'erp_lite_gl_enabled', 'erp_lite_reports_enabled', 'erp_lite_ar_enabled', 'erp_lite_bank_recon_enabled', 'erp_lite_ap_enabled', 'erp_lite_po_enabled', 'erp_lite_expenses_enabled', 'erp_lite_branch_pl_enabled']) AS f
ON CONFLICT (plan_code, flag_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;
```

---

## Frontend Usage

```typescript
// Check main gate
const erpLiteEnabled = featureFlags.erp_lite_enabled === true;

// Check sub-module (only if main gate is true)
const glEnabled = erpLiteEnabled && featureFlags.erp_lite_gl_enabled === true;
const reportsEnabled = erpLiteEnabled && featureFlags.erp_lite_reports_enabled === true;
// etc.
```

---

## Navigation Integration

- Parent section `erp_lite` (Finance & Accounting): `feature_flag: ["erp_lite_enabled"]`
- Child screens: each has its own `feature_flag` (e.g. `["erp_lite_gl_enabled"]`) so the nav tree hides items the tenant doesn't have access to.

---

## See Also

- [FEATURE_FLAGS_REFERENCE](../../platform/feature_flags/FEATURE_FLAGS_REFERENCE.md)
- [MIGRATIONS_0158_0159](../../platform/feature_flags/MIGRATIONS_0158_0159.md)
