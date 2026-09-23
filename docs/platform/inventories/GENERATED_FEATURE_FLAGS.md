# GENERATED Feature Flags

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-09-23T08:15:20.861Z

| Flag key | Surface | File | Line | Context |
| --- | --- | --- | --- | --- |
| advanced_analytics | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 676 | {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>} |
| advanced_analytics | navigation | config/navigation.ts | 558 | //featureFlag: FLAG_KEYS.ADVANCED_ANALYTICS, |
| api_access | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 547 | {plan.feature_flags.api_access && ( |
| api_access | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 677 | {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>} |
| b2b_contracts | screen | src/features/billing/ui/invoice-filters-bar.tsx | 25 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS); |
| b2b_contracts | screen | src/features/customers/ui/customer-create-modal.tsx | 43 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS) |
| b2b_contracts | navigation | config/navigation.ts | 299 | //featureFlag: 'b2b_contracts', |
| b2b_contracts | navigation | config/navigation.ts | 307 | //featureFlag: 'b2b_contracts', |
| b2b_contracts | navigation | config/navigation.ts | 315 | //featureFlag: 'b2b_contracts', |
| b2b_contracts | navigation | config/navigation.ts | 323 | //featureFlag: 'b2b_contracts', |
| campaigns_enabled | navigation | config/navigation.ts | 808 | featureFlag: FLAG_KEYS.CAMPAIGNS_ENABLED, |
| driver_app | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 541 | {plan.feature_flags.driver_app && ( |
| driver_app | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 674 | {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>} |
| erp_lite_ap_enabled | navigation | config/navigation.ts | 720 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AP_ENABLED, |
| erp_lite_ar_enabled | navigation | config/navigation.ts | 712 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AR_ENABLED, |
| erp_lite_bank_recon_enabled | navigation | config/navigation.ts | 744 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED, |
| erp_lite_branch_pl_enabled | navigation | config/navigation.ts | 752 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED, |
| erp_lite_enabled | service | lib/services/erp-lite-feature-guard.ts | 11 | await requireFeature(tenantId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED); |
| erp_lite_enabled | navigation | config/navigation.ts | 615 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 623 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 632 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 640 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 648 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 656 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 664 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 672 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 680 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 688 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 696 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 704 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 712 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AR_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 720 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_AP_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 728 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_PO_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 736 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 744 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 752 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED, |
| erp_lite_enabled | navigation | config/navigation.ts | 760 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED, |
| erp_lite_expenses_enabled | navigation | config/navigation.ts | 736 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED, |
| erp_lite_gl_enabled | navigation | config/navigation.ts | 688 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_gl_enabled | navigation | config/navigation.ts | 696 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_GL_ENABLED, |
| erp_lite_po_enabled | navigation | config/navigation.ts | 728 | featureFlag: FLAG_KEYS.ERP_LITE_ENABLED,//featureFlag: FLAG_KEYS.ERP_LITE_PO_ENABLED, |
| getFeatureFlags | api | app/api/feature-flags/route.ts | 23 | const flags = await Promise.race([getFeatureFlags(tenantId), timeoutPromise]) |
| getFeatureFlags | api | app/api/navigation/route.ts | 88 | const flags = await withTimeout(getFeatureFlags(tenantId), 3000) |
| getFeatureFlags | api | app/api/navigation/route.ts | 125 | const featureFlags = await getFeatureFlags(authContext.tenantId) |
| getFeatureFlags | api | app/api/settings/tenants/[tenantId]/feature-flags/route.ts | 34 | const flags = await hqApiClient.getFeatureFlags({ |
| getFeatureFlags | service | lib/api/hq-api-client.ts | 402 | async getFeatureFlags(options?: { authHeader?: string | null; search?: string }) { |
| getFeatureFlags | workflow | lib/config/workflow-engine-v2.server.ts | 31 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 142 | export async function getFeatureFlags(tenantId: string): Promise<FeatureFlags> { |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 197 | return getFeatureFlags(user.user_metadata.tenant_org_id); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 214 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 247 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 301 | return getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 339 | return getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/feature-flags.service.ts | 362 | return getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/pricing-mode-resolver.service.ts | 63 | const flags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/workflow-service-enhanced.ts | 220 | const featureFlags = await getFeatureFlags(tenantId); |
| getFeatureFlags | service | lib/services/workflow-service-enhanced.ts | 425 | const flags = await getFeatureFlags(tenantId); |
| multi_branch | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 544 | {plan.feature_flags.multi_branch && ( |
| multi_branch | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 675 | {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>} |
| online_booking | api | app/api/v1/public/customer/booking/route.ts | 372 | const bookingEnabled = await canAccess(tenantId, 'online_booking'); |
| online_booking | api | app/api/v1/public/customer/booking/route.ts | 695 | const bookingEnabled = await canAccess(body.tenantId, 'online_booking'); |
| order_fin_governed_amendments | service | lib/services/order-service.ts | 3065 | const governedFlagEnabled = await canAccess(tenantId, 'order_fin_governed_amendments'); |
| order_fin_refund_execution | api | app/api/v1/orders/refunds/[refundId]/process/route.ts | 53 | const executionEnabled = await canAccess(tenantId, 'order_fin_refund_execution'); |
| order_fin_refund_execution | screen | app/dashboard/internal_fin/refunds/page.tsx | 41 | currentTenantCan('order_fin_refund_execution').catch(() => false), |
| order_fin_refund_execution | screen | src/features/orders/ui/order-financial/refund-initiate-dialog.tsx | 194 | const refundExecutionEnabled = useFeature('order_fin_refund_execution'); |
| order_fin_refund_ui | screen | app/dashboard/internal_fin/refunds/page.tsx | 39 | currentTenantCan('order_fin_refund_ui').catch(() => false), |
| order_fin_refund_ui | screen | src/features/orders/ui/order-financial/order-payments-credits-tables.tsx | 89 | const refundUiEnabled = useFeature('order_fin_refund_ui'); |
| order_fin_sv_funding_capture | server_action | app/actions/customers/stored-value-actions.ts | 279 | const flagOn = await currentTenantCan('order_fin_sv_funding_capture'); |
| order_fin_sv_funding_capture | server_action | app/actions/customers/stored-value-actions.ts | 332 | const flagOn = await currentTenantCan('order_fin_sv_funding_capture'); |
| order_fin_sv_funding_capture | server_action | app/actions/marketing/gift-card-actions.ts | 266 | const flagOn = await currentTenantCan('order_fin_sv_funding_capture'); |
| order_fin_sv_funding_capture | screen | src/features/customers/ui/customer-stored-value-tab.tsx | 78 | const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture'); |
| order_fin_sv_funding_capture | screen | src/features/marketing/ui/gift-card-sell-dialog.tsx | 101 | const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture'); |
| order_fin_voucher_unwind | screen | app/dashboard/internal_fin/vouchers/[voucherId]/page.tsx | 86 | const unwindEnabled = await canAccess(auth.tenantId, 'order_fin_voucher_unwind'); |
| order_fin_voucher_unwind | service | lib/services/voucher-reversal.service.ts | 89 | const unwindEnabled = await canAccess(tenantOrgId, 'order_fin_voucher_unwind'); |
| pdf_invoices | service | lib/services/feature-flags.service.ts | 408 | *   await requireFeature(tenantId, FEATURE_FLAG_KEYS.PDF_INVOICES); |
| pdf_invoices | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 535 | {plan.feature_flags.pdf_invoices && ( |
| pdf_invoices | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 672 | {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>} |
| tax_inclusive_pricing | screen | src/features/settings/ui/branch-settings-screen.tsx | 38 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| tax_inclusive_pricing | screen | src/features/settings/ui/tenant-settings-screen.tsx | 28 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| usePlanFlags | hook | src/features/orders/hooks/use-plan-flags.ts | 30 | export function usePlanFlags() { |
| usePlanFlags | screen | src/features/orders/ui/new-order-content.tsx | 75 | const { bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled } = usePlanFlags(); |
| whatsapp_receipts | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 538 | {plan.feature_flags.whatsapp_receipts && ( |
| whatsapp_receipts | screen | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 673 | {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>} |
