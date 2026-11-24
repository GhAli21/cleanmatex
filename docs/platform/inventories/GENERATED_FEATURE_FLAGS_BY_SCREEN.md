# GENERATED Feature Flags — Screen

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.


Generated: 2026-11-23T23:37:53.059Z

| Flag key | File | Line | Context |
| --- | --- | --- | --- |
| advanced_analytics | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 708 | {selectedPlan.feature_flags.advanced_analytics && <li>✓ {t('featureAdvancedAnalyticsFull')}</li>} |
| api_access | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 579 | {plan.feature_flags.api_access && ( |
| api_access | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 709 | {selectedPlan.feature_flags.api_access && <li>✓ {t('featureApiFull')}</li>} |
| b2b_contracts | src/features/customers/ui/customer-create-modal.tsx | 56 | const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS) |
| driver_app | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 573 | {plan.feature_flags.driver_app && ( |
| driver_app | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 706 | {selectedPlan.feature_flags.driver_app && <li>✓ {t('featureDriverAppFull')}</li>} |
| multi_branch | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 576 | {plan.feature_flags.multi_branch && ( |
| multi_branch | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 707 | {selectedPlan.feature_flags.multi_branch && <li>✓ {t('featureMultiBranchFull')}</li>} |
| multi_currency_fx | src/features/fx/ui/currency-fx-screen.tsx | 32 | const multiCurrencyAllowed = useFeature('multi_currency_fx'); |
| order_fin_refund_execution | app/dashboard/internal_fin/refunds/page.tsx | 46 | currentTenantCan('order_fin_refund_execution').catch(() => false), |
| order_fin_refund_execution | src/features/orders/ui/order-financial/refund-initiate-dialog.tsx | 196 | const refundExecutionEnabled = useFeature('order_fin_refund_execution'); |
| order_fin_refund_ui | app/dashboard/internal_fin/refunds/page.tsx | 44 | currentTenantCan('order_fin_refund_ui').catch(() => false), |
| order_fin_refund_ui | src/features/orders/ui/order-financial/order-payments-credits-tables.tsx | 91 | const refundUiEnabled = useFeature('order_fin_refund_ui'); |
| order_fin_sv_funding_capture | src/features/customers/ui/customer-stored-value-tab.tsx | 107 | const fundingCaptureEnabled = useFeature('order_fin_sv_funding_capture'); |
| order_fin_voucher_unwind | app/dashboard/internal_fin/vouchers/[voucherId]/page.tsx | 91 | const unwindEnabled = await canAccess(auth.tenantId, 'order_fin_voucher_unwind'); |
| pdf_invoices | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 567 | {plan.feature_flags.pdf_invoices && ( |
| pdf_invoices | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 704 | {selectedPlan.feature_flags.pdf_invoices && <li>✓ {t('featurePdfFull')}</li>} |
| usePlanFlags | src/features/orders/ui/new-order-content.tsx | 110 | usePlanFlags(); |
| whatsapp_receipts | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 570 | {plan.feature_flags.whatsapp_receipts && ( |
| whatsapp_receipts | src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx | 705 | {selectedPlan.feature_flags.whatsapp_receipts && <li>✓ {t('featureWhatsappFull')}</li>} |
