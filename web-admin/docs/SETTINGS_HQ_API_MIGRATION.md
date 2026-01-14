# Settings HQ API Migration

## Overview

This document describes the migration of settings resolution from direct database function calls to Platform HQ API calls.

## What Changed

### Before

- Next.js API routes called `supabase.rpc('fn_stng_resolve_all_settings')` directly
- Settings resolution logic was duplicated in database functions

### After

- Next.js API routes call Platform HQ API (`cleanmatexsaas/platform-api`)
- All settings resolution goes through centralized `StngResolverService`
- Single source of truth for settings logic

## New Files Created

1. **`lib/api/hq-api-client.ts`**

   - Server-side client for calling Platform HQ API
   - Handles authentication (service token or forwarded client token)
   - Transforms HQ API response format to cleanmatex format

2. **API Routes** (all proxy to HQ API):
   - `app/api/settings/tenants/[tenantId]/effective/route.ts` - Get effective settings
   - `app/api/settings/tenants/[tenantId]/explain/[settingCode]/route.ts` - Explain setting resolution
   - `app/api/settings/tenants/[tenantId]/recompute/route.ts` - Recompute cache
   - `app/api/settings/tenants/[tenantId]/overrides/route.ts` - Upsert override (PATCH)
   - `app/api/settings/tenants/[tenantId]/overrides/[settingCode]/route.ts` - Delete override (DELETE)
   - `app/api/settings/tenants/[tenantId]/profile/route.ts` - Get tenant profile info

## Environment Variables

Add to `.env.local`:

```env
# Platform HQ API Configuration
HQ_API_URL=http://localhost:3002/api/hq/v1
HQ_SERVICE_TOKEN=your-service-token-here  # Optional, falls back to forwarded client token
```

## Authentication

The HQ API client uses a hybrid authentication approach:

1. **Primary**: Forward `Authorization` header from client request
2. **Fallback**: Use `HQ_SERVICE_TOKEN` environment variable

This allows:

- User-scoped requests to forward user tokens
- Server-side operations to use service token

## Testing Checklist

### Prerequisites

1. Platform HQ API (`cleanmatexsaas/platform-api`) must be running on port 3002
2. Set `HQ_API_URL` in `.env.local`
3. Optionally set `HQ_SERVICE_TOKEN` if not forwarding client tokens

### Test Endpoints

1. **Effective Settings**

   ```bash
   curl http://localhost:3000/api/settings/tenants/me/effective
   ```

2. **Explain Setting**

   ```bash
   curl http://localhost:3000/api/settings/tenants/me/explain/workflow.max_concurrent_orders
   ```

3. **Recompute Cache**

   ```bash
   curl -X POST http://localhost:3000/api/settings/tenants/me/recompute
   ```

4. **Get Profile Info**

   ```bash
   curl http://localhost:3000/api/settings/tenants/me/profile
   ```

5. **Upsert Override**

   ```bash
   curl -X PATCH http://localhost:3000/api/settings/tenants/me/overrides \
     -H "Content-Type: application/json" \
     -d '{"settingCode": "workflow.max_concurrent_orders", "value": 20}'
   ```

6. **Delete Override**
   ```bash
   curl -X DELETE http://localhost:3000/api/settings/tenants/me/overrides/workflow.max_concurrent_orders
   ```

### Verify Response Format

All endpoints should return responses in the format expected by `settings-client.ts`:

- Effective settings: `{ data: ResolvedSetting[] }`
- Explain: `ExplainTrace` object
- Profile: `TenantProfileInfo` object

## Troubleshooting

### Error: "No authentication token available"

- **Solution**: Set `HQ_SERVICE_TOKEN` in `.env.local` or ensure client requests include `Authorization` header

### Error: "Failed to fetch effective settings"

- **Check**: Platform HQ API is running and accessible at `HQ_API_URL`
- **Check**: Network connectivity between cleanmatex and HQ API
- **Check**: CORS configuration in HQ API allows requests from cleanmatex

### Error: "401 Unauthorized"

- **Check**: Service token is valid (if using service token)
- **Check**: Client token is valid (if forwarding client token)
- **Check**: HQ API JWT validation is working

## Rollback

If issues arise, you can temporarily revert to database function calls:

1. Restore original `route.ts` files from git history
2. Remove `hq-api-client.ts` import
3. Restore `supabase.rpc()` calls

However, this should only be temporary - the goal is to fully migrate to HQ API.

## Architecture Benefits

1. **Centralized Logic**: All settings resolution in one place (`StngResolverService`)
2. **Easier Maintenance**: Changes to resolution logic only need to be made in HQ API
3. **Better Testing**: Can test resolution logic independently
4. **Consistency**: All clients (cleanmatex, cleanmatexsaas) use same resolution logic
5. **Performance**: HQ API can implement caching, optimization, etc.
