# GENERATED Feature Flags — Service

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-11-12T18:49:12.171Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| erp_lite_enabled | lib/services/erp-lite-feature-guard.ts | 11 | await requireFeature(tenantId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED); |
| getFeatureFlags | lib/api/hq-api-client.ts | 406 | async getFeatureFlags(options?: { authHeader?: string | null; search?: string }) { |
| getFeatureFlags | lib/services/feature-flags.service.ts | 143 | export async function getFeatureFlags(tenantId: string): Promise<FeatureFlags> { |
| getFeatureFlags | lib/services/feature-flags.service.ts | 195 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 212 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 241 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 295 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 333 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/feature-flags.service.ts | 356 | return getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/order-change/order-change-legacy-writer-guard.ts | 137 | getFeatureFlags(tenantId), |
| getFeatureFlags | lib/services/order-change/order-change-preview-reads.ts | 107 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/pricing-mode-resolver.service.ts | 63 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/setup-health/setup-health.service.ts | 70 | getFeatureFlags(tenantOrgId), |
| getFeatureFlags | lib/services/workflow-service-enhanced.ts | 225 | const featureFlags = await getFeatureFlags(tenantId); |
| getFeatureFlags | lib/services/workflow-service-enhanced.ts | 446 | const flags = await getFeatureFlags(tenantId); |
| order_fin_voucher_unwind | lib/services/voucher-reversal.service.ts | 88 | const unwindEnabled = await canAccess(tenantOrgId, 'order_fin_voucher_unwind'); |
| pdf_invoices | lib/services/feature-flags.service.ts | 402 | *   await requireFeature(tenantId, FEATURE_FLAG_KEYS.PDF_INVOICES); |
