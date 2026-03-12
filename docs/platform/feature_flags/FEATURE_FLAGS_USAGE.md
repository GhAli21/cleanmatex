---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Feature Flags Usage

Where each feature flag is checked in the codebase.

**Source:** Grep for `getFeatureFlags`, `canAccess`, `requireFeature`, `currentTenantCan`, `feature_flag`

## Service & API

| File | Usage |
|------|-------|
| `web-admin/lib/services/feature-flags.service.ts` | `getFeatureFlags`, `canAccess`, `currentTenantCan`, `canAccessMultiple`, `requireFeature`, `updateFeatureFlags`, `resetToDefaults`, `compareFeatures` |
| `web-admin/app/api/feature-flags/route.ts` | `getFeatureFlags(tenantId)` — returns flags for tenant |
| `web-admin/app/api/settings/tenants/[tenantId]/feature-flags/route.ts` | `hqApiClient.getFeatureFlags` — HQ API proxy |
| `web-admin/lib/api/hq-api-client.ts` | `getFeatureFlags` — HQ API client |

## Workflow & Navigation

| File | Usage |
|------|-------|
| `web-admin/lib/services/workflow-service-enhanced.ts` | `getFeatureFlags(tenantId)` — used for workflow config |
| `web-admin/lib/services/navigation.service.ts` | `feature_flag` — passes `p_feature_flags` to `fn_sys_nav_tree_visible_items` |
| `web-admin/app/api/navigation/route.ts` | (commented) `getFeatureFlags` |
| `web-admin/app/api/navigation/components/route.ts` | `feature_flag` in component payload |

## Subscription & Settings UI

| File | Usage |
|------|-------|
| `web-admin/app/dashboard/subscription/page.tsx` | `plan.feature_flags.pdf_invoices`, `whatsapp_receipts`, `driver_app`, `multi_branch`, `api_access`, `advanced_analytics` — display plan features |
| `web-admin/src/features/settings/ui/SubscriptionSettings.tsx` | `tenant.feature_flags` — display tenant overrides |
| `web-admin/lib/services/subscriptions.service.ts` | `feature_flags` in plan/upgrade flow |
| `web-admin/app/api/v1/subscriptions/upgrade/route.ts` | `feature_flags` in response |

## Navigation Management

| File | Usage |
|------|-------|
| `web-admin/src/features/settings/ui/NavigationItemForm.tsx` | `feature_flag` — edit feature_flag for nav items |
| `web-admin/app/api/navigation/components/[id]/route.ts` | `feature_flag` in update payload |

## Widget (Dashboard)

| File | Usage |
|------|-------|
| `web-admin/src/features/dashboard/ui/Widget.tsx` | `featureFlag?: FeatureFlagKey` — prop for future feature-flag gating (TODO: integrate with actual service) |

## Flag-by-Flag Usage

| Flag | Used In |
|------|---------|
| pdf_invoices | subscription page, FEATURE_FLAGS constant |
| whatsapp_receipts | subscription page, FEATURE_FLAGS |
| driver_app | subscription page |
| multi_branch | subscription page |
| api_access | subscription page |
| advanced_analytics | subscription page |
| service_preferences_enabled, packing_preferences_enabled, etc. | hq_ff_feature_flags_mst, workflow-service (indirect via getFeatureFlags) |

## See Also

- [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md)
- [NAVIGATION_FEATURE_FLAGS](NAVIGATION_FEATURE_FLAGS.md)
- [TENANT_AND_PLAN_FLAGS](TENANT_AND_PLAN_FLAGS.md)
