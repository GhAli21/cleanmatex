---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# ERP-Lite Settings

Tenant settings for ERP-Lite are stored in `sys_tenant_settings_cd` and resolved via `fn_stng_resolve_setting_value`. Settings that depend on feature flags use `stng_depends_on_flags`.

---

## Settings Catalog

### ERP_LITE_ENABLED

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_ENABLED |
| setting_name | ERP-Lite Enabled |
| setting_name2 | تفعيل ERP-Lite |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | BOOLEAN |
| stng_default_value_jsonb | true |
| stng_depends_on_flags | ["erp_lite_enabled"] |
| stng_is_overridable | true |
| Description | Tenant self-serve disable. When plan enables erp_lite_enabled, tenant can override to false. |

---

### ERP_LITE_FISCAL_YEAR_START

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_FISCAL_YEAR_START |
| setting_name | Fiscal Year Start Month |
| setting_name2 | شهر بداية السنة المالية |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | INTEGER |
| stng_default_value_jsonb | 1 |
| stng_validation_jsonb | {"min": 1, "max": 12} |
| stng_depends_on_flags | ["erp_lite_enabled"] |
| Description | Month (1–12) when fiscal year starts. Default: January. |

---

### ERP_LITE_FIRST_PERIOD_START

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_FIRST_PERIOD_START |
| setting_name | First Period Start Date |
| setting_name2 | تاريخ بداية الفترة الأولى |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | TEXT |
| stng_default_value_jsonb | null |
| stng_validation_jsonb | {"regex": "^\\d{4}-\\d{2}-\\d{2}$"} |
| stng_depends_on_flags | ["erp_lite_enabled"] |
| Description | Date (YYYY-MM-DD) when first accounting period starts. Used for period close. |

---

### ERP_LITE_AUTO_POST_INVOICES

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_AUTO_POST_INVOICES |
| setting_name | Auto-Post Invoices to GL |
| setting_name2 | ترحيل الفواتير تلقائياً إلى دفتر الأستاذ |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | BOOLEAN |
| stng_default_value_jsonb | true |
| stng_depends_on_flags | ["erp_lite_enabled", "erp_lite_gl_enabled"] |
| Description | When true, invoice create/update triggers GL posting. |

---

### ERP_LITE_AUTO_POST_PAYMENTS

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_AUTO_POST_PAYMENTS |
| setting_name | Auto-Post Payments to GL |
| setting_name2 | ترحيل المدفوعات تلقائياً إلى دفتر الأستاذ |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | BOOLEAN |
| stng_default_value_jsonb | true |
| stng_depends_on_flags | ["erp_lite_enabled", "erp_lite_gl_enabled"] |
| Description | When true, payment create triggers GL posting. |

---

### ERP_LITE_PERIOD_CLOSE_ENABLED

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_PERIOD_CLOSE_ENABLED |
| setting_name | Allow Period Close |
| setting_name2 | السماح بإغلاق الفترة |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | BOOLEAN |
| stng_default_value_jsonb | false |
| stng_depends_on_flags | ["erp_lite_enabled", "erp_lite_gl_enabled"] |
| Description | When true, tenant can close prior periods (lock GL edits). |

---

### ERP_LITE_BANK_RECON_MATCH_TOLERANCE_DAYS

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_BANK_RECON_MATCH_TOLERANCE_DAYS |
| setting_name | Bank Match Date Tolerance (Days) |
| setting_name2 | تسامح تاريخ المطابقة البنكية (أيام) |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | INTEGER |
| stng_default_value_jsonb | 3 |
| stng_validation_jsonb | {"min": 0, "max": 14} |
| stng_depends_on_flags | ["erp_lite_enabled", "erp_lite_bank_recon_enabled"] |
| Description | Days tolerance for auto-matching bank tx to payments by amount. |

---

### ERP_LITE_EXPENSE_APPROVAL_REQUIRED

| Attribute | Value |
|-----------|-------|
| setting_code | ERP_LITE_EXPENSE_APPROVAL_REQUIRED |
| setting_name | Expense Approval Required |
| setting_name2 | الموافقة على المصروفات مطلوبة |
| stng_category_code | ERP_LITE |
| stng_scope | TENANT |
| stng_data_type | BOOLEAN |
| stng_default_value_jsonb | true |
| stng_depends_on_flags | ["erp_lite_enabled", "erp_lite_expenses_enabled"] |
| Description | When true, expense claims require approval before reimbursement. |

---

## New Category: ERP_LITE

Add `ERP_LITE` to `sys_stng_categories_cd` (or equivalent) for settings grouping:

| Code | Name | Name2 |
|------|------|-------|
| ERP_LITE | Finance & Accounting | المالية والمحاسبة |

---

## Migration Template

```sql
-- Add ERP_LITE category if not exists
INSERT INTO sys_stng_categories_cd (stng_category_code, stng_category_name, stng_category_name2, ...)
VALUES ('ERP_LITE', 'Finance & Accounting', 'المالية والمحاسبة', ...)
ON CONFLICT DO NOTHING;

-- Add settings
INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_depends_on_flags,
  setting_name, setting_name2, setting_desc, setting_desc2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, rec_status, is_active
) VALUES
  ('ERP_LITE_ENABLED', 'ERP_LITE', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, '["erp_lite_enabled"]'::jsonb, 'ERP-Lite Enabled', 'تفعيل ERP-Lite', 'Tenant self-serve disable for ERP-Lite', 'تعطيل ذاتي للمستأجر', 'toggle', 'ERP_LITE', 0, CURRENT_TIMESTAMP, 'system_admin', 1, true),
  ('ERP_LITE_FISCAL_YEAR_START', 'ERP_LITE', 'TENANT', 'INTEGER', '1'::jsonb, '{"min":1,"max":12}'::jsonb, true, '["erp_lite_enabled"]'::jsonb, 'Fiscal Year Start Month', 'شهر بداية السنة المالية', 'Month (1-12) when fiscal year starts', 'الشهر (1-12) لبداية السنة المالية', 'number-input', 'ERP_LITE', 1, CURRENT_TIMESTAMP, 'system_admin', 1, true),
  -- ... (remaining settings)
ON CONFLICT (setting_code) DO UPDATE SET ...;
```

---

## Resolution

- Settings with `stng_depends_on_flags` are gated by feature flags (Layer 4 in `fn_stng_resolve_setting_value`).
- If any flag in the array is false, the setting resolves to catalog default and `v_source_layer := 'FEATURE_FLAG'`.
- Tenant overrides in `org_tenant_settings_cf` apply when flags allow.

---

## See Also

- [SETTINGS_REFERENCE](../../platform/settings/SETTINGS_REFERENCE.md)
- [MIGRATIONS_0160_0161_0162](../../platform/feature_flags/MIGRATIONS_0160_0161_0162.md)
