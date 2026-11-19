# GENERATED Feature Flags — Screen

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-11-19T20:40:46.887Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| advanced_analytics | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 689 | {selectedPlan.feature_flags.advanced_analytics && <li>✓ Advanced Analytics</li>} |
| api_access | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 562 | {plan.feature_flags.api_access && ( |
| api_access | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 690 | {selectedPlan.feature_flags.api_access && <li>✓ API Access</li>} |
| b2b_contracts | src/features/customers/ui/customer-create-modal.tsx | 55 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS) |
| driver_app | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 556 | {plan.feature_flags.driver_app && ( |
| driver_app | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 687 | {selectedPlan.feature_flags.driver_app && <li>✓ Driver App</li>} |
| multi_branch | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 559 | {plan.feature_flags.multi_branch && ( |
| multi_branch | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 688 | {selectedPlan.feature_flags.multi_branch && <li>✓ Multi-Branch Support</li>} |
| multi_currency_fx | src/features/fx/ui/currency-fx-screen.tsx | 32 | const multiCurrencyAllowed = useFeature('multi_currency_fx'); |
| order_fin_refund_execution | app/dashboard/internal_fin/refunds/page.tsx | 46 | currentTenantCan('order_fin_refund_execution').catch(() => false), |
| order_fin_refund_execution | src/features/orders/ui/order-financial/refund-initiate-dialog.tsx | 196 | const refundExecutionEnabled = useFeature('order_fin_refund_execution'); |
| order_fin_refund_ui | app/dashboard/internal_fin/refunds/page.tsx | 44 | currentTenantCan('order_fin_refund_ui').catch(() => false), |
| order_fin_refund_ui | src/features/orders/ui/order-financial/order-payments-credits-tables.tsx | 91 | const refundUiEnabled = useFeature('order_fin_refund_ui'); |
| order_fin_sv_funding_capture | src/features/customers/ui/customer-stored-value-tab.tsx | 107 | const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture'); |
| order_fin_voucher_unwind | app/dashboard/internal_fin/vouchers/[voucherId]/page.tsx | 91 | const unwindEnabled = await canAccess(auth.tenantId, 'order_fin_voucher_unwind'); |
| pdf_invoices | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 550 | {plan.feature_flags.pdf_invoices && ( |
| pdf_invoices | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 685 | {selectedPlan.feature_flags.pdf_invoices && <li>✓ PDF Invoices</li>} |
| usePlanFlags | src/features/orders/ui/new-order-content.tsx | 110 | usePlanFlags(); |
| whatsapp_receipts | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 553 | {plan.feature_flags.whatsapp_receipts && ( |
| whatsapp_receipts | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 686 | {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ WhatsApp Receipts</li>} |
