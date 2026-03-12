---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Settings Reference

Tenant settings catalog from `sys_tenant_settings_cd`.

**Source:** `.claude/docs/Allsettings.json`, `.claude/docs/Allsettings.md`, `sys_tenant_settings_cd` table

## Resolution Hierarchy (7 layers)

1. SYSTEM_DEFAULT
2. SYSTEM_PROFILE
3. TENANT_OVERRIDE
4. BRANCH_OVERRIDE
5. USER_OVERRIDE

**RPC:** `fn_stng_resolve_all_settings(p_tenant_id, p_branch_id, p_user_id)`  
**Single setting:** `fn_stng_resolve_setting_value(p_tenant_id, p_setting_code, p_branch_id, p_user_id)`

## Key Columns

| Column | Description |
|--------|-------------|
| setting_code | Unique code (e.g., TENANT_CURRENCY) |
| setting_name | Display name (EN) |
| setting_name2 | Display name (AR) |
| stng_category_code | Category: SYSTEM, GENERAL, ORDERS, WORKFLOW, UI_UX, RECEIPTS, INVOICES, FINANCE, SERVICE_PREF |
| stng_scope | SYSTEM, TENANT |
| stng_data_type | TEXT, ENUM, INTEGER, BOOLEAN, etc. |
| stng_default_value_jsonb | Default value |
| stng_edit_policy | FREELY_EDITABLE, plan_bound, etc. |
| stng_depends_on_flags | Feature flags that gate this setting |
| stng_required_min_layer | Minimum layer for override |

## Setting Codes (from tenant-settings.service SETTING_CODES)

| Code | Description |
|------|-------------|
| TENANT_CURRENCY | Tenant currency code |
| TENANT_DECIMAL_PLACES | Decimal places for money |
| TENANT_VAT_RATE | VAT rate |
| DEFAULT_PHONE_COUNTRY_CODE | Default phone country |
| TENANT_DEFAULT_GUEST_CUSTOMER_ID | Default guest customer |
| USING_SPLIT_ORDER | Split order enabled |
| USE_REJECT_TO_SOLVE | Reject to solve enabled |
| USE_TRACK_BY_PIECE | Track by piece |
| REJECT_ROW_COLOR | Reject row color |
| AUTO_CLOSE_DAYS | Auto close days |
| PEAK_SEASON_START | Peak season start |
| BRANCH_CURRENCY | Branch currency |
| SERVICE_PREF_PACKING_PER_PIECE_ENABLED | Per-piece packing (Enterprise) |
| SERVICE_PREF_ENFORCE_COMPATIBILITY | Enforce pref compatibility |
| SERVICE_PREF_PROCESSING_CONFIRMATION | Processing confirmation (Enterprise) |

## Full Catalog

See [.claude/docs/Allsettings.md](../../.claude/docs/Allsettings.md) for human-readable table.  
See [.claude/docs/Allsettings.json](../../.claude/docs/Allsettings.json) for structured JSON.

## See Also

- [SETTINGS_BY_CATEGORY](SETTINGS_BY_CATEGORY.md)
- [SETTINGS_USAGE](SETTINGS_USAGE.md)
- [.cursor/rules/settings-reference.mdc](../../../.cursor/rules/settings-reference.mdc)
