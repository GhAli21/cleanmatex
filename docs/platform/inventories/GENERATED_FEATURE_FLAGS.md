# GENERATED Feature Flags

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-06-20T08:37:52.671Z

| Flag key | Surface | File | Line | Context |
| --- | --- | --- | --- | --- |
| advanced_analytics | screen | app/dashboard/subscription/page.tsx | 670 | {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>} |
| advanced_analytics | navigation | config/navigation.ts | 518 | //featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS, |
| api_access | screen | app/dashboard/subscription/page.tsx | 541 | {plan.feature_flags.api_access && ( |
| api_access | screen | app/dashboard/subscription/page.tsx | 671 | {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>} |
| b2b_contracts | screen | src/features/billing/ui/invoice-filters-bar.tsx | 25 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS); |
| b2b_contracts | screen | src/features/customers/ui/customer-create-modal.tsx | 43 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS) |
| b2b_contracts | navigation | config/navigation.ts | 281 | //featureFlag: 'b2b_contracts', |
| b2b_contracts | navigation | config/navigation.ts | 289 | //featureFlag: 'b2b_contracts', |
| b2b_contracts | navigation | config/navigation.ts | 297 | //featureFlag: 'b2b_contracts', |
| b2b_contracts | navigation | config/navigation.ts | 305 | //featureFlag: 'b2b_contracts', |
| campaigns_enabled | navigation | config/navigation.ts | 776 | featureFlag: FLAG_KEYS.CAMPAIGNS_ENABLED, |
| driver_app | screen | app/dashboard/subscription/page.tsx | 535 | {plan.feature_flags.driver_app && ( |
| driver_app | screen | app/dashboard/subscription/page.tsx | 668 | {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>} |
| driver_app | navigation | config/navigation.ts | 200 | featureFlag: FLAG_KEYS.DRIVER_APP, |
| driver_app | navigation | config/navigation.ts | 208 | featureFlag: FLAG_KEYS.DRIVER_APP, |
| driver_app | navigation | config/navigation.ts | 216 | featureFlag: FLAG_KEYS.DRIVER_APP, |
| erp_lite_ap_enabled | navigation | config/navigation.ts | 680 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AP_ENABLED, |
| erp_lite_ar_enabled | navigation | config/navigation.ts | 672 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AR_ENABLED, |
| erp_lite_bank_recon_enabled | navigation | config/navigation.ts | 704 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED, |
| erp_lite_branch_pl_enabled | navigation | config/navigation.ts | 712 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED, |
| erp_lite_enabled | service | lib/services/erp-lite-feature-guard.ts | 11 | await requireFeature(tenantId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED); |
| erp_lite_enabled | navigation | config/navigation.ts | 575 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 583 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 592 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 600 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 608 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 616 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 624 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 632 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 640 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 648 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 656 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 664 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 672 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AR_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 680 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AP_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 688 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_PO_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 696 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 704 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 712 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 720 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_expenses_enabled | navigation | config/navigation.ts | 696 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED, |
| erp_lite_gl_enabled | navigation | config/navigation.ts | 648 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_gl_enabled | navigation | config/navigation.ts | 656 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_po_enabled | navigation | config/navigation.ts | 688 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_PO_ENABLED, |
| getFeatureFlags | api | app/api/feature-flags/route.ts | 23 | const flags = await Promise.race([getFeatureFlags(tenantId), timeoutPromise]) |
| getFeatureFlags | api | app/api/navigation/route.ts | 88 | const flags = await withTimeout(getFeatureFlags(tenantId), 3000) |
| getFeatureFlags | api | app/api/navigation/route.ts | 125 | const featureFlags = await getFeatureFlags(authContext.tenantId) |
| getFeatureFlags | api | app/api/settings/tenants/[tenantId]/feature-flags/route.ts | 34 | const flags = await hqApiClient.getFeatureFlags({ |
| getFeatureFlags | service | lib/api/hq-api-client.ts | 402 | async getFeatureFlags(options?: { authHeader?: string | null; search?: string }) { |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 142 | export async function getFeatureFlags(tenantId: string): Promise<FeatureFlags> { |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 197 | return getFeatureFlags(user.user_metadata.tenant_org_id); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 214 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 247 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 299 | return getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 337 | return getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 360 | return getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/pricing-mode-resolver.service.ts | 63 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/workflow-service-enhanced.ts | 221 | const featureFlags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/workflow-service-enhanced.ts | 422 | const flags = await getFeatureFlags(tenantId); |
| multi_branch | screen | app/dashboard/subscription/page.tsx | 538 | {plan.feature_flags.multi_branch && ( |
| multi_branch | screen | app/dashboard/subscription/page.tsx | 669 | {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>} |
| online_booking | api | app/api/v1/public/customer/booking/route.ts | 360 | const bookingEnabled = await canAccess(tenantId, 'online_booking'); |
| online_booking | api | app/api/v1/public/customer/booking/route.ts | 683 | const bookingEnabled = await canAccess(body.tenantId, 'online_booking'); |
| pdf_invoices | screen | app/dashboard/subscription/page.tsx | 529 | {plan.feature_flags.pdf_invoices && ( |
| pdf_invoices | screen | app/dashboard/subscription/page.tsx | 666 | {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>} |
| pdf_invoices | service | lib/services/feature-flags.service.ts | 406 | *   await requireFeature(tenantId, FEATURE_FLAG_KEYS.PDF_INVOICES); |
| pdf_invoices | screen | src/features/auth/ui/RequireFeature.tsx | 231 | * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES) |
| pdf_invoices | screen | src/features/auth/ui/RequireFeature.tsx | 271 | * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES) |
| tax_inclusive_pricing | screen | src/features/settings/ui/branch-settings-screen.tsx | 38 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| tax_inclusive_pricing | screen | src/features/settings/ui/tenant-settings-screen.tsx | 28 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| usePlanFlags | hook | src/features/orders/hooks/use-plan-flags.ts | 30 | export function usePlanFlags() { |
| usePlanFlags | screen | src/features/orders/ui/new-order-content.tsx | 71 | const { bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled } = usePlanFlags(); |
| whatsapp_receipts | screen | app/dashboard/subscription/page.tsx | 532 | {plan.feature_flags.whatsapp_receipts && ( |
| whatsapp_receipts | screen | app/dashboard/subscription/page.tsx | 667 | {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>} |
