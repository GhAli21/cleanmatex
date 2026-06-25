# GENERATED Feature Flags — Screen

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-06-25T14:10:31.840Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| advanced_analytics | app/dashboard/subscription/page.tsx | 670 | {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>} |
| api_access | app/dashboard/subscription/page.tsx | 541 | {plan.feature_flags.api_access && ( |
| api_access | app/dashboard/subscription/page.tsx | 671 | {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>} |
| b2b_contracts | src/features/billing/ui/invoice-filters-bar.tsx | 25 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS); |
| b2b_contracts | src/features/customers/ui/customer-create-modal.tsx | 43 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS) |
| driver_app | app/dashboard/subscription/page.tsx | 535 | {plan.feature_flags.driver_app && ( |
| driver_app | app/dashboard/subscription/page.tsx | 668 | {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>} |
| multi_branch | app/dashboard/subscription/page.tsx | 538 | {plan.feature_flags.multi_branch && ( |
| multi_branch | app/dashboard/subscription/page.tsx | 669 | {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>} |
| pdf_invoices | app/dashboard/subscription/page.tsx | 529 | {plan.feature_flags.pdf_invoices && ( |
| pdf_invoices | app/dashboard/subscription/page.tsx | 666 | {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>} |
| pdf_invoices | src/features/auth/ui/RequireFeature.tsx | 231 | * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES) |
| pdf_invoices | src/features/auth/ui/RequireFeature.tsx | 271 | * const canExportPDF = useFeature(FEATURE_FLAG_KEYS.PDF_INVOICES) |
| tax_inclusive_pricing | src/features/settings/ui/branch-settings-screen.tsx | 38 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| tax_inclusive_pricing | src/features/settings/ui/tenant-settings-screen.tsx | 28 | const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING); |
| usePlanFlags | src/features/orders/ui/new-order-content.tsx | 71 | const { bundlesEnabled, repeatLastOrderEnabled, smartSuggestionsEnabled } = usePlanFlags(); |
| whatsapp_receipts | app/dashboard/subscription/page.tsx | 532 | {plan.feature_flags.whatsapp_receipts && ( |
| whatsapp_receipts | app/dashboard/subscription/page.tsx | 667 | {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>} |
