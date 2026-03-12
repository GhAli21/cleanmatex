---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Settings Usage

Where each setting is used in the codebase.

**Source:** Grep for `getSettingValue`, `fn_stng_resolve`, `SETTING_CODES`, setting codes

## Service & Hooks

| File | Usage |
|------|-------|
| `web-admin/lib/services/tenant-settings.service.ts` | Main service, `getAllResolvedSettings`, `checkIfSettingAllowed`, `getSettingValue` — calls `fn_stng_resolve_all_settings` |
| `web-admin/lib/hooks/useTenantSettings.ts` | `getProcessingSettings`, `checkIfSettingAllowed` |

## By Setting Code

| Setting Code | Used In | Context |
|--------------|---------|---------|
| TENANT_CURRENCY, TENANT_DECIMAL_PLACES | payment-service.ts, order-calculation.service.ts, report-service.ts | Currency config |
| TENANT_VAT_RATE | tax.service.ts, pricing.service.ts, preparation preview | Tax calculation |
| DEFAULT_PHONE_COUNTRY_CODE | customers.service.ts, get-phone-country-code action | Phone input default |
| TENANT_DEFAULT_GUEST_CUSTOMER_ID | tenant-settings/default-guest-customer API | Default guest customer |
| USING_SPLIT_ORDER, USE_REJECT_TO_SOLVE, USE_TRACK_BY_PIECE, REJECT_ROW_COLOR | order-service.ts, useTenantSettings | Processing settings |
| AUTO_CLOSE_DAYS, PEAK_SEASON_START | (check order-service) | Order lifecycle |
| BRANCH_CURRENCY | (branch-scoped) | Branch-level currency |
| SERVICE_PREF_PACKING_PER_PIECE_ENABLED | TenantProcessingSettings | Per-piece packing (Enterprise) |
| SERVICE_PREF_ENFORCE_COMPATIBILITY | TenantProcessingSettings | Enforce pref compatibility |
| SERVICE_PREF_PROCESSING_CONFIRMATION | TenantProcessingSettings | Processing confirmation (Enterprise) |

## API Routes

| Route | Setting(s) |
|-------|------------|
| GET /api/v1/tenant-settings/default-guest-customer | TENANT_DEFAULT_GUEST_CUSTOMER_ID |
| GET /api/v1/preparation/[id]/preview | TENANT_VAT_RATE |

## Actions

| Action | Setting(s) |
|--------|-------------|
| get-phone-country-code | DEFAULT_PHONE_COUNTRY_CODE |
| get-currency-config | TENANT_CURRENCY, TENANT_DECIMAL_PLACES |

## See Also

- [SETTINGS_REFERENCE](SETTINGS_REFERENCE.md)
- [SETTINGS_BY_CATEGORY](SETTINGS_BY_CATEGORY.md)
