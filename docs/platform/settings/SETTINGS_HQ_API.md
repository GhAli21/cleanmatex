---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Settings HQ API

HQ API and settings-client for settings resolution.

**Source:** `web-admin/docs/SETTINGS_HQ_API_MIGRATION.md`, `web-admin/lib/api/hq-api-client.ts`, `web-admin/lib/api/settings-client.ts`

## HQ API Client

**File:** `web-admin/lib/api/hq-api-client.ts`

- Server-side client for Platform HQ API (`cleanmatexsaas/platform-api`)
- Handles authentication (service token or forwarded client token)
- Transforms HQ API response to CleanMateX format

## API Routes (proxy to HQ API)

| Route | Purpose |
|-------|---------|
| GET /api/settings/tenants/[tenantId]/effective | Get effective settings |
| GET /api/settings/tenants/[tenantId]/explain/[settingCode] | Explain setting resolution |
| POST /api/settings/tenants/[tenantId]/recompute | Recompute cache |
| PATCH /api/settings/tenants/[tenantId]/overrides | Upsert override |
| DELETE /api/settings/tenants/[tenantId]/overrides/[settingCode] | Delete override |
| GET /api/settings/tenants/[tenantId]/profile | Get tenant profile info |

## Settings Client

**File:** `web-admin/lib/api/settings-client.ts`

- Client for calling settings API from frontend
- Used by settings UI components

## Environment Variables

```env
HQ_API_URL=http://localhost:3002/api/hq/v1
HQ_SERVICE_TOKEN=your-service-token-here  # Optional
```

## Tenant Profile API

**Route:** `web-admin/app/api/settings/tenants/[tenantId]/profile/route.ts`

- Returns tenant profile info including settings-related data

## See Also

- [SETTINGS_REFERENCE](SETTINGS_REFERENCE.md)
- [web-admin/docs/SETTINGS_HQ_API_MIGRATION.md](../../web-admin/docs/SETTINGS_HQ_API_MIGRATION.md)
- [web-admin/docs/TESTING_SETTINGS_HQ_API.md](../../web-admin/docs/TESTING_SETTINGS_HQ_API.md)
