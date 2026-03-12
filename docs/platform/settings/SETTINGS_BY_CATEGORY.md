---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Settings by Category

Settings grouped by `stng_category_code`.

**Source:** `.claude/docs/Allsettings.json`, `sys_tenant_settings_cd`

## Categories

| Category | Description | Example Codes |
|----------|-------------|---------------|
| SYSTEM | System-level (not tenant-overridable) | SYS_TIMEZONE |
| GENERAL | General tenant settings | TENANT_TIMEZONE, TENANT_LANGUAGE, TENANT_DATE_FORMAT, TENANT_TIME_FORMAT, DEFAULT_PHONE_COUNTRY_CODE |
| ORDERS | Order-related | ORD_READY_BY_REQUIRED, ORD_QUICK_DROP_ENABLED, ORD_ALLOW_BACKWARD_TRANSITIONS |
| WORKFLOW | Workflow configuration | WF_TEMPLATE_DEFAULT |
| UI_UX | UI/UX settings | UI_RTL_ENABLED |
| RECEIPTS | Receipt settings | RCPT_WHATSAPP_ENABLED, PRN_THERMAL_ENABLED |
| INVOICES | Invoice settings | INV_PDF_ENABLED |
| FINANCE | Finance/tax | TAX_RATE, TENANT_VAT_ENABLED |
| SERVICE_PREF | Service preferences | SERVICE_PREF_DEFAULT_PACKING, SERVICE_PREF_ENFORCE_COMPATIBILITY, SERVICE_PREF_PROCESSING_CONFIRMATION |

## Resolution Order

From `tenant-settings.service.ts` and `fn_stng_resolve_all_settings`:

1. **SYSTEM_DEFAULT** — System-wide default
2. **SYSTEM_PROFILE** — Profile-based (e.g., GCC)
3. **TENANT_OVERRIDE** — Tenant-level override
4. **BRANCH_OVERRIDE** — Branch-level override
5. **USER_OVERRIDE** — User-level override

Last non-null value wins.

## See Also

- [SETTINGS_REFERENCE](SETTINGS_REFERENCE.md)
- [SETTINGS_USAGE](SETTINGS_USAGE.md)
- [PLAN_BOUND_SETTINGS](PLAN_BOUND_SETTINGS.md)
