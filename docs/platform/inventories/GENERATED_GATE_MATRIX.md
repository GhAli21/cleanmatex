# GENERATED Gate Matrix
> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.

Generated: 2026-07-17T21:40:15.744Z
Git SHA: c95dc015
## Summary
| Domain | Count |
| --- | --- |
| Access contracts | 141 |
| Permission usages | 259 |
| Feature flag usages | 74 |
| Setting usages | 40 |
| Plan limit usages | 8 |
| Navigation entries | 96 |
| Flag catalog entries | 291 |
## Access contracts
| Route | Label | Page permissions | Page flags | Actions |
| --- | --- | --- | --- | --- |
| /dashboard | Dashboard | — | — | 0 |
| /dashboard/assembly | Assembly | — | — | 0 |
| /dashboard/assembly/[id] | Assembly Details | — | — | 0 |
| /dashboard/b2b/contracts | B2B Contracts | b2b_contracts:view | b2b_contracts | 0 |
| /dashboard/b2b/customers | B2B Customers | b2b_customers:view | b2b_contracts | 0 |
| /dashboard/b2b/customers/[id] | B2B Customer Details | b2b_customers:view | b2b_contracts | 0 |
| /dashboard/b2b/customers/[id]/edit | Edit B2B Customer | b2b_customers:view | b2b_contracts | 0 |
| /dashboard/b2b/customers/new | New B2B Customer | b2b_customers:view | b2b_contracts | 0 |
| /dashboard/b2b/statements | B2B Statements | b2b_statements:view | b2b_contracts | 0 |
| /dashboard/b2b/statements/[id] | B2B Statement Details | b2b_statements:view | b2b_contracts | 0 |
| /dashboard/catalog | Catalog & Pricing | admin:manage | — | 0 |
| /dashboard/catalog/addons | Catalog Add-ons | admin:manage | — | 0 |
| /dashboard/catalog/categories | Catalog Categories | admin:manage | — | 0 |
| /dashboard/catalog/customer-categories | Customer Categories | config:preferences_manage | — | 0 |
| /dashboard/catalog/order-sources | Order channels (sources) | config:preferences_manage | — | 0 |
| /dashboard/catalog/preferences | Preferences Catalog | orders:service_prefs_view, orders:read, config:preferences_manage | — | 0 |
| /dashboard/catalog/pricing | Catalog Pricing | admin:manage | — | 0 |
| /dashboard/catalog/pricing/[id] | Pricing Details | admin:manage | — | 0 |
| /dashboard/catalog/services | Catalog Services | admin:manage | — | 0 |
| /dashboard/catalog/services/[id] | Catalog Service Details | admin:manage | — | 0 |
| /dashboard/catalog/services/new | New Catalog Service | admin:manage | — | 0 |
| /dashboard/customers | Customers | — | — | 0 |
| /dashboard/customers/[id] | Customer Details | — | — | 0 |
| /dashboard/customers/account-receipt | Customer Account Receipt | customers:receipt_allocate | — | 0 |
| /dashboard/customers/stored-value | Stored Value | stored_value:view_balances | — | 0 |
| /dashboard/delivery | Delivery | — | — | 0 |
| /dashboard/drivers | Drivers | drivers:read | driver_app | 0 |
| /dashboard/drivers/routes | Driver Routes | drivers:read | driver_app | 0 |
| /dashboard/erp-lite | Finance & Accounting | erp_lite:view | erp_lite_enabled | 0 |
| /dashboard/erp-lite/ap | Accounts Payable | erp_lite_ap:view | erp_lite_enabled, erp_lite_ap_enabled | 0 |
| /dashboard/erp-lite/ar | AR Aging | erp_lite_ar:view | erp_lite_enabled, erp_lite_ar_enabled | 0 |
| /dashboard/erp-lite/bank-recon | Bank Reconciliation | erp_lite_bank_recon:view | erp_lite_enabled, erp_lite_bank_recon_enabled | 0 |
| /dashboard/erp-lite/branch-pl | Branch P&L | erp_lite_branch_pl:view | erp_lite_enabled, erp_lite_branch_pl_enabled | 0 |
| /dashboard/erp-lite/coa | Chart of Accounts | erp_lite_coa:view | erp_lite_enabled, erp_lite_gl_enabled | 0 |
| /dashboard/erp-lite/exceptions | Exception Workbench | erp_lite_exceptions:view | erp_lite_enabled, erp_lite_exceptions_enabled | 0 |
| /dashboard/erp-lite/expenses | Expenses | erp_lite_expenses:view | erp_lite_enabled, erp_lite_expenses_enabled | 0 |
| /dashboard/erp-lite/finance-actions | Finance control audit | erp_lite_periods:view | erp_lite_enabled, erp_lite_periods_enabled | 0 |
| /dashboard/erp-lite/gl | General Ledger | erp_lite_gl:view | erp_lite_enabled, erp_lite_gl_enabled | 0 |
| /dashboard/erp-lite/journals | Journal register | erp_lite_gl:view | erp_lite_enabled, erp_lite_gl_enabled | 0 |
| /dashboard/erp-lite/periods | Period Management | erp_lite_periods:view | erp_lite_enabled, erp_lite_periods_enabled | 0 |
| /dashboard/erp-lite/po | Purchase Orders | erp_lite_po:view | erp_lite_enabled, erp_lite_po_enabled | 0 |
| /dashboard/erp-lite/posting-audit | Posting Audit Viewer | erp_lite_post_audit:view | erp_lite_enabled, erp_lite_post_audit_enabled | 0 |
| /dashboard/erp-lite/readiness | Finance Readiness | erp_lite:view | erp_lite_enabled, erp_lite_readiness_enabled | 0 |
| /dashboard/erp-lite/reports | Financial Reports | erp_lite_reports:view | erp_lite_enabled, erp_lite_reports_enabled | 0 |
| /dashboard/erp-lite/setup | ERP-Lite setup guide | erp_lite:view | erp_lite_enabled | 0 |
| /dashboard/erp-lite/usage-maps | Usage Mapping Console | erp_lite_usage_map:view | erp_lite_enabled, erp_lite_usage_map_enabled | 0 |
| /dashboard/help | Help | — | — | 0 |
| /dashboard/help/platform-inventories | Platform Inventories | help:platform_inventories | — | 0 |
| /dashboard/internal_fin | Internal Finance And Operations | — | — | 0 |
| /dashboard/internal_fin/ar/aging | AR Aging | ar_aging:view | — | 0 |
| /dashboard/internal_fin/ar/credits | AR Credits | ar_credits:view | — | 0 |
| /dashboard/internal_fin/ar/customers | AR Customers | ar_ledger:view | — | 0 |
| /dashboard/internal_fin/ar/cycles | AR Statement Cycles | ar_stmt_cycles:view | — | 0 |
| /dashboard/internal_fin/ar/disputes | AR Disputes | ar_disputes:view | — | 0 |
| /dashboard/internal_fin/ar/dunning | AR Dunning | ar_dunning:view | — | 0 |
| /dashboard/internal_fin/ar/ledger | AR Ledger | ar_ledger:view | — | 0 |
| /dashboard/internal_fin/ar/statements | Customer Statements | customer_statements:view | — | 0 |
| /dashboard/internal_fin/ar/statements/print | Print Customer Statement | customer_statements:view | — | 0 |
| /dashboard/internal_fin/cash-drawers | Cash Drawers | cash_drawer:view | — | 0 |
| /dashboard/internal_fin/cash-drawers/[drawerId] | Cash Drawer Details | cash_drawer:view | — | 0 |
| /dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId] | Cash Drawer Session Details | cash_drawer:view | — | 0 |
| /dashboard/internal_fin/cash-drawers/[drawerId]/session/[sessionId]/print | Print Cash Drawer Session | cash_drawer:view | — | 0 |
| /dashboard/internal_fin/invoices | Invoices | invoices:read | — | 0 |
| /dashboard/internal_fin/invoices/[id] | Invoice Details | invoices:read | — | 0 |
| /dashboard/internal_fin/invoices/[id]/print | Print AR Invoice | invoices:print | — | 0 |
| /dashboard/internal_fin/invoices/new | New AR Invoice | invoices:create | — | 0 |
| /dashboard/internal_fin/pos-sessions | POS Sessions | pos_session:view | — | 7 |
| /dashboard/internal_fin/reconciliation | Finance Reconciliation | reconciliation:view | — | 0 |
| /dashboard/internal_fin/reconciliation/[runId] | Finance Reconciliation Details | reconciliation:view | — | 0 |
| /dashboard/internal_fin/refunds | Refunds | orders:process_refund | — | 0 |
| /dashboard/internal_fin/vouchers | Business Vouchers | fin_vouchers:view | — | 4 |
| /dashboard/internal_fin/vouchers/[voucherId] | Voucher Detail | fin_vouchers:view | — | 4 |
| /dashboard/internal_fin/vouchers/new | New Business Voucher | fin_vouchers:create | — | 0 |
| /dashboard/internal_fin/vouchers/reports | Voucher Reports | fin_vouchers:reports | — | 0 |
| /dashboard/inventory | Inventory | — | — | 0 |
| /dashboard/inventory/machines | Inventory Machines | inventory:read | — | 0 |
| /dashboard/inventory/stock | Inventory Stock | — | — | 0 |
| /dashboard/jhtestui | JWT Test | — | — | 0 |
| /dashboard/marketing | Marketing | promotions:read | — | 0 |
| /dashboard/marketing/campaigns | Campaigns | notifications:manage | campaigns_enabled | 0 |
| /dashboard/marketing/campaigns/[id] | Campaigns | notifications:manage | campaigns_enabled | 0 |
| /dashboard/marketing/discount-rules | Discount Rules | discount_rules:read | — | 0 |
| /dashboard/marketing/gift-cards | Gift Cards | gift_cards:read | — | 0 |
| /dashboard/marketing/gift-cards/liability | Liability | gift_cards:read | — | 0 |
| /dashboard/marketing/loyalty | Loyalty | loyalty:view_config | — | 0 |
| /dashboard/marketing/promos | Promos | promotions:read | — | 0 |
| /dashboard/marketing/promotions | Promotions (redirect → /promos) | promotions:read | — | 0 |
| /dashboard/notifications | Notification Center | notifications:read | — | 0 |
| /dashboard/notifications/delivery-log | Delivery Log | notifications:view_log | — | 0 |
| /dashboard/notifications/settings | Channel Settings | notifications:configure | — | 0 |
| /dashboard/orders | Orders | — | — | 0 |
| /dashboard/orders/[id] | Order Details | orders:view_financial_breakdown | — | 0 |
| /dashboard/orders/[id]/edit | Edit Order | — | — | 0 |
| /dashboard/orders/[id]/full | Full Order Details | — | — | 0 |
| /dashboard/orders/[id]/prepare | Prepare Order | — | — | 0 |
| /dashboard/orders/new | New Order | — | — | 0 |
| /dashboard/packing | Packing | — | — | 0 |
| /dashboard/packing/[id] | Packing Details | — | — | 0 |
| /dashboard/preparation | Preparation | — | — | 0 |
| /dashboard/preparation/[orderId] | Preparation Details | — | — | 0 |
| /dashboard/processing | Processing | — | — | 0 |
| /dashboard/processing/[id] | Processing Details | — | — | 0 |
| /dashboard/qa | Quality Check | — | — | 0 |
| /dashboard/qa/[id] | Quality Check Details | — | — | 0 |
| /dashboard/ready | Ready | — | — | 0 |
| /dashboard/ready/[id] | Ready Details | — | — | 0 |
| /dashboard/ready/[id]/print/[type] | Print Ready Document | — | — | 0 |
| /dashboard/receipts/[orderId] | Receipt Details | — | — | 0 |
| /dashboard/reports | Reports | — | advanced_analytics | 0 |
| /dashboard/reports/customers | Customers Report | — | advanced_analytics | 0 |
| /dashboard/reports/financial | Financial Report | — | advanced_analytics | 0 |
| /dashboard/reports/invoices | Invoices Report | — | advanced_analytics | 0 |
| /dashboard/reports/orders | Orders Report | — | advanced_analytics | 0 |
| /dashboard/reports/payments | Payments Report | — | advanced_analytics | 0 |
| /dashboard/reports/print | Print Reports | — | advanced_analytics | 0 |
| /dashboard/reports/reconciliation | Reconciliation Reports | finance_reports:view | advanced_analytics | 0 |
| /dashboard/reports/revenue | Revenue Report | — | advanced_analytics | 0 |
| /dashboard/setting | Settings Redirect | — | — | 0 |
| /dashboard/settings | Settings | — | — | 0 |
| /dashboard/settings/allsettings | All Settings | — | — | 0 |
| /dashboard/settings/branches | Branches List | — | — | 0 |
| /dashboard/settings/branches/[id] | Branch Settings | — | — | 0 |
| /dashboard/settings/branding | Branding Settings | — | — | 0 |
| /dashboard/settings/finance | Finance Settings | — | — | 0 |
| /dashboard/settings/general | General Settings | — | — | 0 |
| /dashboard/settings/navigation | Navigation Settings | — | — | 0 |
| /dashboard/settings/payments | Payment Setup | payment_config:view | — | 0 |
| /dashboard/settings/permissions | Permissions Management | *:*, settings:* | — | 0 |
| /dashboard/settings/preferences | Settings Preferences | — | — | 0 |
| /dashboard/settings/roles | Roles Management | *:*, settings:* | — | 0 |
| /dashboard/settings/tax | Tax Setup | tax:view_config | — | 0 |
| /dashboard/settings/tenant | Tenant Settings | — | — | 0 |
| /dashboard/settings/users | Settings Users | — | — | 0 |
| /dashboard/settings/workflow-roles | Workflow Roles | settings:workflow_roles:view | — | 0 |
| /dashboard/settings/workflows | Workflows | — | — | 0 |
| /dashboard/settings/workflows/[id]/edit | Edit Workflow | — | — | 0 |
| /dashboard/settings/workflows/new | New Workflow | — | — | 0 |
| /dashboard/tenant-admin/subscription | Subscription | — | — | 0 |
| /dashboard/users | Users | — | — | 0 |
| /dashboard/users/[userId] | User Details | — | — | 0 |
| /dashboard/users/new | New User | — | — | 0 |