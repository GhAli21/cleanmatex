# GENERATED Feature Flags — API

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-06-25T23:55:24.190Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| getFeatureFlags | app/api/feature-flags/route.ts | 23 | const flags = await Promise.race([getFeatureFlags(tenantId), timeoutPromise]) |
| getFeatureFlags | app/api/navigation/route.ts | 88 | const flags = await withTimeout(getFeatureFlags(tenantId), 3000) |
| getFeatureFlags | app/api/navigation/route.ts | 125 | const featureFlags = await getFeatureFlags(authContext.tenantId) |
| getFeatureFlags | app/api/settings/tenants/[tenantId]/feature-flags/route.ts | 34 | const flags = await hqApiClient.getFeatureFlags({ |
| online_booking | app/api/v1/public/customer/booking/route.ts | 360 | const bookingEnabled = await canAccess(tenantId, 'online_booking'); |
| online_booking | app/api/v1/public/customer/booking/route.ts | 683 | const bookingEnabled = await canAccess(body.tenantId, 'online_booking'); |
