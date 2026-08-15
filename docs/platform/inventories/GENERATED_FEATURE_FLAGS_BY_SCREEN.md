# GENERATED Feature Flags — Screen

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-08-14T21:08:51.307Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| advanced_analytics | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 669 | {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>} |
| api_access | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 540 | {plan.feature_flags.api_access && ( |
| api_access | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 670 | {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>} |
| b2b_contracts | src/features/billing/ui/invoice-filters-bar.tsx | 25 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS); |
| b2b_contracts | src/features/customers/ui/customer-create-modal.tsx | 43 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS) |
| driver_app | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 534 | {plan.feature_flags.driver_app && ( |
| driver_app | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 667 | {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>} |
| multi_branch | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 537 | {plan.feature_flags.multi_branch && ( |
| multi_branch | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 668 | {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>} |
| order_fin_refund_execution | app/dashboard/internal_fin/refunds/page.tsx | 41 | currentTenantCan('order_fin_refund_execution').catch(() => false), |
| order_fin_refund_execution | src/features/orders/ui/order-financial/refund-initiate-dialog.tsx | 182 | const refundExecutionEnabled = useFeature('order_fin_refund_execution'); |
| order_fin_refund_ui | app/dashboard/internal_fin/refunds/page.tsx | 39 | currentTenantCan('order_fin_refund_ui').catch(() => false), |
| order_fin_refund_ui | src/features/orders/ui/order-financial/order-payments-credits-tables.tsx | 89 | const refundUiEnabled = useFeature('order_fin_refund_ui'); |
| order_fin_sv_funding_capture | src/features/customers/ui/customer-stored-value-tab.tsx | 77 | const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture'); |
| order_fin_sv_funding_capture | src/features/marketing/ui/gift-card-sell-dialog.tsx | 101 | const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture'); |
| pdf_invoices | src/features/auth/ui/RequireFeature.tsx | 231 | * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES) |
| pdf_invoices | src/features/auth/ui/RequireFeature.tsx | 271 | * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES) |
| pdf_invoices | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 528 | {plan.feature_flags.pdf_invoices && ( |
| pdf_invoices | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 665 | {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>} |
| tax_inclusive_pricing | src/features/settings/ui/branch-settings-screen.tsx | 38 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| tax_inclusive_pricing | src/features/settings/ui/tenant-settings-screen.tsx | 28 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| usePlanFlags | src/features/orders/ui/new-order-content.tsx | 75 | const { bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled } = usePlanFlags(); |
| whatsapp_receipts | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 531 | {plan.feature_flags.whatsapp_receipts && ( |
| whatsapp_receipts | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 666 | {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>} |
