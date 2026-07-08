# API Auth Audit

Generated: 2026-07-08T21:50:13.473Z

| Route | Methods | Auth Type | requirePermission | requireTenantAuth | getAuthContext | Needs Review |
|-------|---------|-----------|-------------------|------------------|----------------|--------------|
| /api/admin/jwt-health | GET | permission | true | false | false | false |
| /api/admin/prisma-performance | (unknown) | none | false | false | false | true |
| /api/auth/csrf-token | GET | none | false | false | false | true |
| /api/auth/login | POST | auth_only | false | false | false | true |
| /api/auth/logout | POST | auth_only | false | false | false | true |
| /api/auth/register | POST | auth_only | false | false | false | true |
| /api/auth/reset-password | POST | auth_only | false | false | false | true |
| /api/dashboard/workflow-stats | GET | auth_only | false | false | false | true |
| /api/dev/platform-inventories | GET | permission | true | false | false | false |
| /api/docs | GET | none | false | false | false | true |
| /api/feature-flags | GET | auth_only | false | false | true | true |
| /api/navigation | GET | auth_only | false | false | true | true |
| /api/navigation/components | GET, POST | auth_only | false | false | false | true |
| /api/navigation/components/[id] | GET, PUT, DELETE | auth_only | false | false | false | true |
| /api/notifications/process-campaigns | POST | none | false | false | false | true |
| /api/notifications/process-outbox | POST | none | false | false | false | true |
| /api/notifications/push-subscription | POST, DELETE | permission | true | false | false | false |
| /api/orders/[orderId]/status | GET, PATCH | auth_only | false | false | false | true |
| /api/orders/[orderId]/status-history | GET | auth_only | false | false | false | true |
| /api/orders/bulk-status | POST | auth_only | false | false | false | true |
| /api/orders/overdue | GET | auth_only | false | false | false | true |
| /api/permissions | GET | auth_only | false | false | false | true |
| /api/roles | GET, POST | auth_only | false | false | false | true |
| /api/roles/[id] | GET, PATCH, DELETE | auth_only | false | false | false | true |
| /api/roles/[id]/permissions | PUT | auth_only | false | false | false | true |
| /api/settings/catalog | GET | none | false | false | false | true |
| /api/settings/categories | GET | none | false | false | false | true |
| /api/settings/tenants/[tenantId]/effective | GET | auth_only | false | false | false | true |
| /api/settings/tenants/[tenantId]/explain/[settingCode] | GET | auth_only | false | false | false | true |
| /api/settings/tenants/[tenantId]/feature-flags | GET | none | false | false | false | true |
| /api/settings/tenants/[tenantId]/overrides | PATCH | none | false | false | false | true |
| /api/settings/tenants/[tenantId]/overrides/[settingCode] | DELETE | none | false | false | false | true |
| /api/settings/tenants/[tenantId]/profile | GET | auth_only | false | false | false | true |
| /api/settings/tenants/[tenantId]/recompute | POST | none | false | false | false | true |
| /api/v1/ar/credits | GET | permission | true | false | false | false |
| /api/v1/ar/credits/applications | POST | permission | true | false | false | false |
| /api/v1/ar/credits/applications/[id]/reverse | POST | permission | true | false | false | false |
| /api/v1/ar/customers/[customerId]/balance | GET | permission | true | false | false | false |
| /api/v1/ar/customers/[customerId]/ledger | GET | permission | true | false | false | false |
| /api/v1/ar/customers/[customerId]/statements | GET | permission | true | false | false | false |
| /api/v1/ar/customers/[customerId]/statements/print | GET | permission | true | false | false | false |
| /api/v1/ar/disputes | GET, POST | permission | true | false | false | false |
| /api/v1/ar/disputes/[id]/resolve | POST | permission | true | false | false | false |
| /api/v1/ar/dunning | GET | permission | true | false | false | false |
| /api/v1/ar/dunning/run | POST | permission | true | false | false | false |
| /api/v1/ar/invoices | GET, POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id] | GET, PATCH | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/allocations | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/allocations/[allocationId]/reverse | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/approve-sensitive | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/credit-note | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/debit-note | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/issue | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/print | GET | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/void | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/[id]/write-off | POST | permission | true | false | false | false |
| /api/v1/ar/invoices/export | GET | permission | true | false | false | false |
| /api/v1/ar/invoices/from-orders | POST | permission | true | false | false | false |
| /api/v1/ar/reports/aging | GET | permission | true | false | false | false |
| /api/v1/ar/statement-cycles | GET, POST | permission | true | false | false | false |
| /api/v1/ar/statement-cycles/[id]/preview | GET | permission | true | false | false | false |
| /api/v1/assembly/dashboard | GET | auth_only | false | false | true | true |
| /api/v1/assembly/exceptions/[id]/resolve | PATCH | auth_only | false | false | true | true |
| /api/v1/assembly/tasks | POST | auth_only | false | false | true | true |
| /api/v1/assembly/tasks/[taskId]/exceptions | POST | auth_only | false | false | true | true |
| /api/v1/assembly/tasks/[taskId]/pack | POST | auth_only | false | false | true | true |
| /api/v1/assembly/tasks/[taskId]/qa | POST | auth_only | false | false | true | true |
| /api/v1/assembly/tasks/[taskId]/scan | POST | auth_only | false | false | true | true |
| /api/v1/assembly/tasks/[taskId]/start | POST | auth_only | false | false | true | true |
| /api/v1/audit/actors | GET | auth_only | false | false | true | true |
| /api/v1/b2b-contacts | GET, POST | permission | true | false | false | false |
| /api/v1/b2b-contacts/[id] | GET, PATCH, DELETE | permission | true | false | false | false |
| /api/v1/b2b-contracts | GET, POST | permission | true | false | false | false |
| /api/v1/b2b-contracts/[id] | GET, PATCH, DELETE | permission | true | false | false | false |
| /api/v1/b2b-statements | GET | permission | true | false | false | false |
| /api/v1/b2b-statements/[id] | GET, PATCH | permission | true | false | false | false |
| /api/v1/b2b-statements/[id]/print | GET | permission | true | false | false | false |
| /api/v1/b2b-statements/generate | POST | permission | true | false | false | false |
| /api/v1/b2b/overdue-statements | GET | permission | true | false | false | false |
| /api/v1/b2b/run-dunning-actions | POST | permission | true | false | false | false |
| /api/v1/branches | GET | none | false | false | false | true |
| /api/v1/branches/[id] | GET, PATCH | none | false | false | false | true |
| /api/v1/cash-drawers | GET | permission | true | false | false | false |
| /api/v1/cash-drawers/[drawerId]/cash-movement | POST | permission | true | false | false | false |
| /api/v1/cash-drawers/[drawerId]/close-session | POST | permission | true | false | false | false |
| /api/v1/cash-drawers/[drawerId]/open-session | POST | permission | true | false | false | false |
| /api/v1/cash-drawers/[drawerId]/session/[sessionId]/summary | GET | permission | true | false | false | false |
| /api/v1/catalog/order-sources | GET, PUT | permission | true | false | false | false |
| /api/v1/catalog/packing-preferences | GET, POST | permission | true | false | false | false |
| /api/v1/catalog/packing-preferences/[code] | PUT, DELETE | permission | true | false | false | false |
| /api/v1/catalog/packing-preferences/admin | GET | permission | true | false | false | false |
| /api/v1/catalog/preference-bundles | GET, POST | permission | true | false | false | false |
| /api/v1/catalog/preference-bundles/[id] | PATCH, DELETE | permission | true | false | false | false |
| /api/v1/catalog/preference-kinds | GET | permission | true | false | false | false |
| /api/v1/catalog/preference-kinds/admin | GET, PUT | permission | true | false | false | false |
| /api/v1/catalog/service-preferences | GET, POST | permission | true | false | false | false |
| /api/v1/catalog/service-preferences/[code] | PUT, DELETE | permission | true | false | false | false |
| /api/v1/catalog/service-preferences/admin | GET | permission | true | false | false | false |
| /api/v1/categories | GET, POST | auth_only | false | false | true | true |
| /api/v1/customer-categories | GET, POST | permission | true | false | false | false |
| /api/v1/customer-categories/[code] | GET, PATCH, DELETE | permission | true | false | false | false |
| /api/v1/customer-categories/check-code | GET | permission | true | false | false | false |
| /api/v1/customer-receipts/allocation/post | POST | none | false | false | false | true |
| /api/v1/customer-receipts/allocation/preview-auto | POST | none | false | false | false | true |
| /api/v1/customer-receipts/allocation/preview-manual | POST | none | false | false | false | true |
| /api/v1/customer-receipts/post | POST | none | false | false | false | true |
| /api/v1/customers | GET, POST | permission | true | false | true | false |
| /api/v1/customers/[id] | GET, PATCH, DELETE | permission | true | false | false | false |
| /api/v1/customers/[id]/addresses | GET, POST | auth_only | false | false | true | true |
| /api/v1/customers/[id]/addresses/[addressId] | PATCH, DELETE | auth_only | false | false | true | true |
| /api/v1/customers/[id]/advance/issue | POST | permission | true | false | false | false |
| /api/v1/customers/[id]/advance/ledger | GET | permission | true | false | false | false |
| /api/v1/customers/[id]/credit-note/issue | POST | permission | true | false | false | false |
| /api/v1/customers/[id]/credit-notes | GET | permission | true | false | false | false |
| /api/v1/customers/[id]/loyalty | GET | permission | true | false | false | false |
| /api/v1/customers/[id]/open-balances | GET | permission | true | false | false | false |
| /api/v1/customers/[id]/service-prefs | GET, POST, DELETE | permission | true | false | false | false |
| /api/v1/customers/[id]/stored-value | GET | permission | true | false | false | false |
| /api/v1/customers/[id]/upgrade | POST | auth_only | false | false | true | true |
| /api/v1/customers/[id]/wallet/ledger | GET | permission | true | false | false | false |
| /api/v1/customers/[id]/wallet/top-up | POST | permission | true | false | false | false |
| /api/v1/customers/export | GET | auth_only | false | false | true | true |
| /api/v1/customers/link | POST | none | false | false | false | true |
| /api/v1/customers/merge | POST | auth_only | false | false | true | true |
| /api/v1/customers/send-otp | POST | none | false | false | false | true |
| /api/v1/customers/verify-otp | POST | none | false | false | false | true |
| /api/v1/delivery/orders/[orderId]/generate-otp | POST | auth_only | false | false | true | true |
| /api/v1/delivery/orders/[orderId]/verify-otp | POST | auth_only | false | false | true | true |
| /api/v1/delivery/routes | GET, POST | permission | true | false | true | false |
| /api/v1/delivery/routes/[id]/assign | POST | auth_only | false | false | true | true |
| /api/v1/delivery/stops/[stopId]/pod | POST | auth_only | false | false | true | true |
| /api/v1/finance/reconciliation/issues/[issueId] | PATCH | permission | true | false | false | false |
| /api/v1/finance/reconciliation/runs | GET, POST | permission | true | false | false | false |
| /api/v1/finance/reconciliation/runs/[runId] | GET | permission | true | false | false | false |
| /api/v1/finance/reports/money-position | GET | permission | true | false | false | false |
| /api/v1/finance/reports/orders-summary | GET | permission | true | false | false | false |
| /api/v1/finance/reports/payments-breakdown | GET | permission | true | false | false | false |
| /api/v1/finance/reports/reconciliation/b2b-statements | GET | permission | true | false | false | false |
| /api/v1/finance/reports/reconciliation/cash-drawer | GET | permission | true | false | false | false |
| /api/v1/finance/reports/reconciliation/excess-liability | GET | permission | true | false | false | false |
| /api/v1/finance/reports/reconciliation/overpayment-disposition | GET | permission | true | false | false | false |
| /api/v1/finance/reports/tax-report | GET | permission | true | false | false | false |
| /api/v1/finance/voucher-lines/[lineId]/linked-effects | GET | permission | true | false | false | false |
| /api/v1/finance/vouchers | GET, POST | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId] | GET, PATCH | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId]/cancel | POST | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId]/lines | GET, POST | auth_only | false | false | true | true |
| /api/v1/finance/vouchers/[voucherId]/lines/[lineId] | PATCH, DELETE | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId]/linked-effects | GET | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId]/post | POST | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId]/reconciliation | GET | permission | true | false | false | false |
| /api/v1/finance/vouchers/[voucherId]/reverse | POST | permission | true | false | false | false |
| /api/v1/finance/vouchers/lookups/expense-categories | GET | permission | true | false | false | false |
| /api/v1/finance/vouchers/lookups/line-roles | GET | permission | true | false | false | false |
| /api/v1/finance/vouchers/lookups/types | GET | permission | true | false | false | false |
| /api/v1/gift-cards/[cardCode]/balance | GET | permission | true | false | false | false |
| /api/v1/gift-cards/[cardCode]/ledger | GET | permission | true | false | false | false |
| /api/v1/loyalty/config | GET, PATCH | permission | true | false | false | false |
| /api/v1/loyalty/tiers | POST | permission | true | false | false | false |
| /api/v1/marketing/promotions | GET, POST | permission | true | false | false | false |
| /api/v1/marketing/promotions/[promoId] | GET, PATCH, DELETE | permission | true | false | false | false |
| /api/v1/marketing/promotions/validate | POST | permission | true | false | false | false |
| /api/v1/notifications | GET | permission | true | false | false | false |
| /api/v1/notifications/[id]/read | PATCH | permission | true | false | false | false |
| /api/v1/notifications/campaigns | GET, POST | permission | true | false | false | false |
| /api/v1/notifications/campaigns/[id] | GET | permission | true | false | false | false |
| /api/v1/notifications/campaigns/[id]/status | PATCH | permission | true | false | false | false |
| /api/v1/notifications/campaigns/[id]/test | POST | permission | true | false | false | false |
| /api/v1/notifications/delivery-log | GET | permission | true | false | false | false |
| /api/v1/notifications/read-all | PATCH | permission | true | false | false | false |
| /api/v1/notifications/settings | GET, PUT | permission | true | false | false | false |
| /api/v1/notifications/settings/providers | GET, POST, PUT, DELETE | permission | true | false | false | false |
| /api/v1/notifications/unread-count | GET | permission | true | false | false | false |
| /api/v1/notifications/user-prefs | GET, PUT | permission | true | false | false | false |
| /api/v1/orders | GET, POST | permission | true | false | false | false |
| /api/v1/orders/[id] | GET | none | false | false | false | true |
| /api/v1/orders/[id]/adjustments | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/batch-update | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/collect-payment | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/confirm-physical-intake | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/credit-applications | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/discounts | GET | auth_only | false | false | true | true |
| /api/v1/orders/[id]/editability | GET | none | false | false | false | true |
| /api/v1/orders/[id]/financial-reconcile | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/financial-reconciliation | GET | permission | true | false | false | false |
| /api/v1/orders/[id]/financial-summary | GET | permission | true | false | false | false |
| /api/v1/orders/[id]/fix-order-data | POST | auth_only | false | false | true | true |
| /api/v1/orders/[id]/history | GET | auth_only | false | false | true | true |
| /api/v1/orders/[id]/issue | POST | auth_only | false | false | true | true |
| /api/v1/orders/[id]/items/[itemId]/apply-bundle/[bundleCode] | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/complete | POST | auth_only | false | false | true | true |
| /api/v1/orders/[id]/items/[itemId]/packing-pref | PATCH | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces | GET, POST, PATCH | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId] | GET, PATCH, DELETE | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/conditions | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | GET, POST, DELETE | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs/confirm | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces/scan | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/pieces/sync | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/service-prefs | GET, POST, DELETE | permission | true | false | false | false |
| /api/v1/orders/[id]/items/[itemId]/step | POST | auth_only | false | false | true | true |
| /api/v1/orders/[id]/lock | POST | auth_only | false | false | false | true |
| /api/v1/orders/[id]/payments | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/payments/[paymentId]/verify | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/pieces | GET | permission | true | false | false | false |
| /api/v1/orders/[id]/refund | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/refunds | GET, POST | permission | true | false | false | false |
| /api/v1/orders/[id]/report/invoices-payments-rprt | GET | permission | true | false | false | false |
| /api/v1/orders/[id]/report/payments-rprt | GET | permission | true | false | false | false |
| /api/v1/orders/[id]/split | POST | auth_only | false | false | true | true |
| /api/v1/orders/[id]/state | GET | auth_only | false | false | true | true |
| /api/v1/orders/[id]/transition | POST | permission | true | false | false | false |
| /api/v1/orders/[id]/transitions | GET | auth_only | false | false | true | true |
| /api/v1/orders/[id]/unlock | POST | auth_only | false | false | false | true |
| /api/v1/orders/[id]/update | PATCH | permission | true | false | false | false |
| /api/v1/orders/[id]/workflow-context | GET | permission | true | false | false | false |
| /api/v1/orders/checkout-options | GET | none | false | false | false | true |
| /api/v1/orders/estimate-ready-by | POST | auth_only | false | false | true | true |
| /api/v1/orders/pieces/[pieceId]/history | GET | permission | true | false | false | false |
| /api/v1/orders/preview-financials | POST | permission | true | false | false | false |
| /api/v1/orders/preview-payment | POST | permission | true | false | false | false |
| /api/v1/orders/refunds/[refundId]/approve | PATCH | permission | true | false | false | false |
| /api/v1/orders/refunds/[refundId]/process | PATCH | permission | true | false | false | false |
| /api/v1/orders/submit-order | POST | permission | true | false | false | false |
| /api/v1/plan-flags | GET | auth_only | false | false | false | true |
| /api/v1/pos-sessions | GET | permission | true | false | false | false |
| /api/v1/pos-sessions/[sessionId]/summary | GET | permission | true | false | false | false |
| /api/v1/pos-sessions/close | POST | permission | true | false | false | false |
| /api/v1/pos-sessions/ensure-for-order-entry | POST | permission | true | false | false | false |
| /api/v1/pos-sessions/force-close | POST | permission | true | false | false | false |
| /api/v1/pos-sessions/my-active | GET | permission | true | false | false | false |
| /api/v1/pos-sessions/open | POST | permission | true | false | false | false |
| /api/v1/pos-sessions/pause | POST | permission | true | false | false | false |
| /api/v1/pos-sessions/resume | POST | permission | true | false | false | false |
| /api/v1/preferences/last-order | GET | permission | true | false | false | false |
| /api/v1/preferences/resolve | GET | permission | true | false | false | false |
| /api/v1/preferences/suggest | GET | permission | true | false | false | false |
| /api/v1/preparation | GET | auth_only | false | false | false | true |
| /api/v1/preparation/[id]/complete | POST | tenant_auth | false | true | false | false |
| /api/v1/preparation/[id]/items | POST | auth_only | false | false | false | true |
| /api/v1/preparation/[id]/items/[itemId] | PATCH, DELETE | tenant_auth | false | true | false | false |
| /api/v1/preparation/[id]/preview | GET | auth_only | false | false | false | true |
| /api/v1/preparation/[id]/start | POST | auth_only | false | false | false | true |
| /api/v1/price-lists | GET, POST | auth_only | false | false | true | true |
| /api/v1/price-lists/[id] | GET, PATCH, DELETE | auth_only | false | false | true | true |
| /api/v1/price-lists/[id]/items | POST | auth_only | false | false | true | true |
| /api/v1/price-lists/[id]/items/[itemId] | PUT, DELETE | auth_only | false | false | true | true |
| /api/v1/pricing/calculate | POST | auth_only | false | false | true | true |
| /api/v1/pricing/export | GET | auth_only | false | false | true | true |
| /api/v1/pricing/history | GET | none | false | false | false | true |
| /api/v1/pricing/import | POST | auth_only | false | false | true | true |
| /api/v1/pricing/import-all-products | POST | auth_only | false | false | true | true |
| /api/v1/pricing/template | GET | auth_only | false | false | true | true |
| /api/v1/processing-steps/[category] | GET | auth_only | false | false | true | true |
| /api/v1/products | GET, POST | auth_only | false | false | true | true |
| /api/v1/products/[id] | GET, PATCH, DELETE | auth_only | false | false | true | true |
| /api/v1/products/[id]/image | POST, DELETE | auth_only | false | false | true | true |
| /api/v1/products/export | GET | auth_only | false | false | true | true |
| /api/v1/products/import | POST | auth_only | false | false | true | true |
| /api/v1/public/customer/addresses | POST | none | false | false | false | true |
| /api/v1/public/customer/auth-options | GET | none | false | false | false | true |
| /api/v1/public/customer/auth/refresh | POST | none | false | false | false | true |
| /api/v1/public/customer/booking | GET, POST | none | false | false | false | true |
| /api/v1/public/customer/login | POST | none | false | false | false | true |
| /api/v1/public/customer/orders | GET | none | false | false | false | true |
| /api/v1/public/customer/password | POST | none | false | false | false | true |
| /api/v1/public/customer/session | POST | none | false | false | false | true |
| /api/v1/public/customer/tenants | GET | none | false | false | false | true |
| /api/v1/public/orders/[tenantId]/[orderNo] | GET | none | false | false | false | true |
| /api/v1/public/orders/[tenantId]/[orderNo]/confirm-received | POST | auth_only | false | false | false | true |
| /api/v1/public/tenant/resolve | GET | none | false | false | false | true |
| /api/v1/receipts/[id]/resend | POST | auth_only | false | false | true | true |
| /api/v1/receipts/orders/[orderId] | GET, POST | auth_only | false | false | true | true |
| /api/v1/receipts/webhooks/whatsapp | GET, POST | auth_only | false | false | false | true |
| /api/v1/settings/branding | GET, PUT | permission | true | false | false | false |
| /api/v1/settings/branding/logo | POST | permission | true | false | false | false |
| /api/v1/settings/general | GET, PUT | permission | true | false | false | false |
| /api/v1/settings/payments/card-brands | GET | permission | true | false | false | false |
| /api/v1/settings/payments/card-brands/[brandId] | PATCH | permission | true | false | false | false |
| /api/v1/settings/payments/methods | GET | permission | true | false | false | false |
| /api/v1/settings/payments/methods/[methodId] | PATCH | permission | true | false | false | false |
| /api/v1/settings/payments/terminals | GET, POST | permission | true | false | false | false |
| /api/v1/settings/tax/exemptions | GET, POST | permission | true | false | false | false |
| /api/v1/settings/tax/profiles | GET, POST | permission | true | false | false | false |
| /api/v1/settings/tax/profiles/[profileId] | PATCH | permission | true | false | false | false |
| /api/v1/subscriptions/cancel | POST | none | false | false | false | true |
| /api/v1/subscriptions/plans | GET | auth_only | false | false | false | true |
| /api/v1/subscriptions/upgrade | POST | auth_only | false | false | false | true |
| /api/v1/subscriptions/usage | GET | auth_only | false | false | false | true |
| /api/v1/tenant-settings/default-guest-customer | GET | auth_only | false | false | true | true |
| /api/v1/tenants/check-slug | GET | none | false | false | false | true |
| /api/v1/tenants/me | GET, PATCH | none | false | false | false | true |
| /api/v1/tenants/me/logo | POST, DELETE | auth_only | false | false | false | true |
| /api/v1/tenants/register | POST | none | false | false | false | true |
| /api/v1/workflows/config | GET, PATCH | auth_only | false | false | true | true |
| /api/v1/workflows/screens/[screen]/contract | GET | auth_only | false | false | false | true |
| /api/workflow-roles | GET, POST | auth_only | false | false | false | true |
| /api/workflow-roles/[id] | DELETE | auth_only | false | false | false | true |
| /api/workflow-roles/users | GET | auth_only | false | false | false | true |

## Legend
- **permission**: Uses requirePermission middleware
- **tenant_auth**: Uses requireTenantAuth
- **auth_only**: Uses getAuthContext only (no explicit permission check)
- **none**: No obvious auth check
- **Needs Review**: Route may need permission checks added