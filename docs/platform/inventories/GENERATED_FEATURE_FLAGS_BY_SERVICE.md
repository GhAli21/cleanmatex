# GENERATED Feature Flags — Service

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-06-26T17:39:53.124Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| erp_lite_enabled | lib/services/erp-lite-feature-guard.ts | 11 | await requireFeature(tenantId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED); |
| getFeatureFlags | lib/api/hq-api-client.ts | 402 | async getFeatureFlags(options?: { authHeader?: string | null; search?: string }) { |
| getFeatureFlags | lib/services/feature-flags.service.ts | 142 | export async function getFeatureFlags(tenantId: string): Promise<FeatureFlags> { |
| getFeatureFlags | lib/services/feature-flags.service.ts | 197 | return getFeatureFlags(user.user_metadata.tenant_org_id); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 214 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 247 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 299 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 337 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 360 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/pricing-mode-resolver.service.ts | 63 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/workflow-service-enhanced.ts | 221 | const featureFlags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/workflow-service-enhanced.ts | 422 | const flags = await getFeatureFlags(tenantId); |
| pdf_invoices | lib/services/feature-flags.service.ts | 406 | *   await requireFeature(tenantId, FEATURE_FLAG_KEYS.PDF_INVOICES); |
