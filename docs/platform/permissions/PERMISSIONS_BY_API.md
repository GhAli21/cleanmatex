---
version: v2.0.0
last_updated: 2026-04-01
author: CleanMateX Team
---

# Permissions by API Route

This document tracks explicit backend permission enforcement for `web-admin` API routes and server actions.

## Source Of Truth

Backend/API authorization is defined in:

- `web-admin/app/api/**`
- `web-admin/app/actions/**`

Frontend page contracts may link to these APIs through `PageAccessContract.apiDependencies`, but backend enforcement remains authoritative.

## Documentation Rules

- Page-scoped rebuilds update only the APIs linked to the selected dashboard route
- Full rebuilds refresh the complete explicit API permissions inventory
- Routes with auth but no explicit permission gate belong in [API_AUTH_GAPS.md](./API_AUTH_GAPS.md)

## Explicit Permission-Gated APIs

| Kind | Method | Route / Action | Permission(s) | Notes |
|---|---|---|---|---|
| API | GET | `/api/admin/jwt-health` | `admin:read` | Admin health/debug |
| API | GET | `/api/v1/tenant-settings/default-guest-customer` | `customers:read` | Tenant setting helper |
| API | GET | `/api/v1/b2b-contracts` | `b2b_contracts:view` | Linked to B2B Contracts page |
| API | POST | `/api/v1/b2b-contracts` | `b2b_contracts:create` | Linked to B2B Contracts create dialog |
| API | GET | `/api/v1/b2b-contracts/[id]` | `b2b_contracts:view` | Contract details |
| API | PATCH | `/api/v1/b2b-contracts/[id]` | `b2b_contracts:create` | Update contract |
| API | DELETE | `/api/v1/b2b-contracts/[id]` | `b2b_contracts:create` | Delete contract |
| API | GET | `/api/v1/b2b-statements` | `b2b_statements:view` | Statements list |
| API | POST | `/api/v1/b2b-statements/generate` | `b2b_statements:create` | Generate statements |
| API | GET | `/api/v1/b2b-statements/[id]` | `b2b_statements:view` | Statement details |
| API | PATCH | `/api/v1/b2b-statements/[id]` | `b2b_statements:create` | Statement update actions |
| API | GET | `/api/v1/b2b-statements/[id]/print` | `b2b_statements:view` | Statement print |
| API | GET | `/api/v1/b2b/overdue-statements` | `b2b_statements:view` | Dunning overview |
| API | POST | `/api/v1/b2b/run-dunning-actions` | `b2b_statements:create` | Dunning action execution |
| API | GET | `/api/v1/ar/invoices` | `invoices:view` | AR invoice hub list |
| API | POST | `/api/v1/ar/invoices` | `invoices:create` | Manual AR invoice creation |
| API | POST | `/api/v1/ar/invoices/from-orders` | `invoices:create` | Create AR invoice from eligible orders |
| API | GET | `/api/v1/ar/invoices/[id]` | `invoices:view` | AR invoice detail |
| API | PATCH | `/api/v1/ar/invoices/[id]` | `invoices:update` | Update editable AR invoice fields |
| API | GET | `/api/v1/ar/invoices/export` | `invoices:export` | Export canonical AR invoice hub results |
| API | POST | `/api/v1/ar/invoices/[id]/issue` | `invoices:issue` | Issue draft AR invoice |
| API | POST | `/api/v1/ar/invoices/[id]/approve-sensitive` | `invoices:approve_sensitive` | Approve sensitive AR document action |
| API | POST | `/api/v1/ar/invoices/[id]/void` | `invoices:void` | Void AR invoice after approval |
| API | POST | `/api/v1/ar/invoices/[id]/allocations` | `invoices:allocate_payment` | Allocate payment or overpayment credit |
| API | POST | `/api/v1/ar/invoices/[id]/allocations/[allocationId]/reverse` | `invoices:allocate_payment` | Reverse AR payment allocation with audit trail |
| API | POST | `/api/v1/ar/invoices/[id]/credit-note` | `invoices:credit_note` | Create AR credit note adjustment |
| API | POST | `/api/v1/ar/invoices/[id]/debit-note` | `invoices:debit_note` | Create AR debit note adjustment |
| API | POST | `/api/v1/ar/invoices/[id]/write-off` | `invoices:write_off` | Create AR write-off adjustment |
| API | GET | `/api/v1/ar/invoices/[id]/print` | `invoices:print` | AR invoice printable payload |
| API | GET | `/api/v1/ar/customers/[customerId]/balance` | `ar_ledger:view` | Customer AR balance snapshot |
| API | GET | `/api/v1/ar/customers/[customerId]/ledger` | `ar_ledger:view` | Customer AR ledger entries |
| API | GET | `/api/v1/ar/customers/[customerId]/statements` | `customer_statements:view` | Customer AR statement lines |
| API | GET | `/api/v1/ar/customers/[customerId]/statements/print` | `customer_statements:view` | Customer statement printable payload |
| API | GET | `/api/v1/ar/reports/aging` | `ar_aging:view` | AR aging report |
| API | GET | `/api/v1/ar/credits` | `ar_credits:view` | Customer unapplied AR credit sources |
| API | POST | `/api/v1/ar/credits/applications` | `ar_credits:apply` | Apply AR credit against an open invoice |
| API | POST | `/api/v1/ar/credits/applications/[id]/reverse` | `ar_credits:reverse` | Reverse a prior AR credit application |
| API | GET | `/api/v1/ar/disputes` | `ar_disputes:view` | Dispute register for AR invoices |
| API | POST | `/api/v1/ar/disputes` | `ar_disputes:create` | Open a new AR dispute and mark invoice disputed |
| API | POST | `/api/v1/ar/disputes/[id]/resolve` | `ar_disputes:resolve` | Resolve, reject, or cancel an AR dispute |
| API | GET | `/api/v1/ar/dunning` | `ar_dunning:view` | Dunning activity register |
| API | POST | `/api/v1/ar/dunning/run` | `ar_dunning:run` | Run a reminder, SMS, note, or hold action |
| API | GET | `/api/v1/ar/statement-cycles` | `ar_stmt_cycles:view` | List B2B AR statement cycles |
| API | POST | `/api/v1/ar/statement-cycles` | `ar_stmt_cycles:manage` | Create a B2B AR statement cycle |
| API | GET | `/api/v1/ar/statement-cycles/[id]/preview` | `ar_stmt_cycles:view` | Preview customers included in a statement cycle |
| API | GET | `/api/v1/b2b-contacts` | `b2b_contacts:view` | Contacts list |
| API | POST | `/api/v1/b2b-contacts` | `b2b_contacts:create` | Create contact |
| API | GET | `/api/v1/b2b-contacts/[id]` | `b2b_contacts:view` | Contact details |
| API | PATCH | `/api/v1/b2b-contacts/[id]` | `b2b_contacts:create` | Update contact |
| API | DELETE | `/api/v1/b2b-contacts/[id]` | `b2b_contacts:create` | Delete contact |
| API | GET | `/api/v1/catalog/service-preferences` | `orders:read` | Preferences viewer access |
| API | GET | `/api/v1/catalog/packing-preferences` | `orders:read` | Preferences viewer access |
| API | GET | `/api/v1/catalog/preference-bundles` | `orders:read` | Preferences viewer access |
| API | GET | `/api/v1/catalog/preference-kinds` | `orders:read` | Preferences viewer access |
| API | POST | `/api/v1/catalog/preference-bundles` | `config:preferences_manage` | Manage bundles |
| API | GET | `/api/v1/catalog/preference-bundles/[id]` | `config:preferences_manage` | Bundle admin detail |
| API | PATCH | `/api/v1/catalog/preference-bundles/[id]` | `config:preferences_manage` | Bundle admin update |
| API | DELETE | `/api/v1/catalog/preference-bundles/[id]` | `config:preferences_manage` | Bundle admin delete |
| API | POST | `/api/v1/catalog/service-preferences/admin` | `config:preferences_manage` | Service preference admin create/update |
| API | PUT | `/api/v1/catalog/service-preferences/[code]` | `config:preferences_manage` | Service preference admin upsert |
| API | DELETE | `/api/v1/catalog/service-preferences/[code]` | `config:preferences_manage` | Service preference admin delete |
| API | POST | `/api/v1/catalog/packing-preferences/admin` | `config:preferences_manage` | Packing preference admin create/update |
| API | PUT | `/api/v1/catalog/packing-preferences/[code]` | `config:preferences_manage` | Packing preference admin upsert |
| API | DELETE | `/api/v1/catalog/packing-preferences/[code]` | `config:preferences_manage` | Packing preference admin delete |
| API | POST | `/api/v1/catalog/preference-kinds/admin` | `config:preferences_manage` | Preference kind admin create/update |
| API | DELETE | `/api/v1/catalog/preference-kinds/admin` | `config:preferences_manage` | Preference kind admin delete |
| API | GET | `/api/v1/preferences/suggest` | `orders:read` | 403 when smart suggestions disabled |
| API | POST | `/api/v1/preferences/resolve` | `orders:read` | Preference resolution |
| API | GET | `/api/v1/preferences/last-order` | `orders:read` | 403 when repeat-last-order disabled; DB fn returns `packing_pref_cf_id` + `service_prefs_catalog` after migration **0260** (`preferences-architecture-reference.md` §8.4) |
| API | GET | `/api/v1/customer-categories` | `customers:read` | Customer categories read path |
| API | POST | `/api/v1/customer-categories` | `config:preferences_manage` | Customer category create |
| API | GET | `/api/v1/customer-categories/[code]` | `customers:read` | Customer category detail |
| API | PATCH | `/api/v1/customer-categories/[code]` | `config:preferences_manage` | Customer category update |
| API | DELETE | `/api/v1/customer-categories/[code]` | `config:preferences_manage` | Customer category delete |
| API | GET | `/api/v1/customer-categories/check-code` | `config:preferences_manage` | Admin code check |
| API | POST | `/api/v1/orders` | `orders:create` | Order create |
| API | GET | `/api/v1/orders` | `orders:read` | Orders list |
| API | POST | `/api/v1/orders/create-with-payment` | `orders:create` | Create order with payment |
| API | POST | `/api/v1/orders/preview-payment` | `orders:create` | Payment preview |
| API | PATCH | `/api/v1/orders/[id]/update` | `orders:update` | Order update |
| API | PATCH | `/api/v1/orders/[id]/batch-update` | `orders:update` | Bulk update |
| API | POST | `/api/v1/orders/[id]/transition` | `orders:transition` | Workflow transition |
| API | GET | `/api/v1/orders/[id]/workflow-context` | `orders:read` | Workflow context |
| API | GET | `/api/v1/orders/[id]/pieces` | `orders:read` | Pieces read |
| API | POST | `/api/v1/orders/[id]/items/[itemId]/pieces` | `orders:create` | Piece create |
| API | PATCH | `/api/v1/orders/[id]/items/[itemId]/pieces` | `orders:update` | Piece update |
| API | GET | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]` | `orders:read` | Piece detail |
| API | PATCH | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]` | `orders:update` | Piece update; `packing_pref_code` syncs **PIECE** `org_order_preferences_dtl` (`packing_prefs`) |
| API | DELETE | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]` | `orders:delete` | Piece delete |
| API | GET | `/api/v1/orders/pieces/[pieceId]/history` | `orders:read` | Piece audit history |
| API | GET | `/api/v1/orders/[id]/items/[itemId]/service-prefs` | `orders:read` | Item preferences read |
| API | POST | `/api/v1/orders/[id]/items/[itemId]/service-prefs` | `orders:update` | Item preferences mutate |
| API | PATCH | `/api/v1/orders/[id]/items/[itemId]/service-prefs` | `orders:update` | Item preferences mutate |
| API | PATCH | `/api/v1/orders/[id]/items/[itemId]/packing-pref` | `orders:update` | Packing preference mutate |
| API | POST | `/api/v1/orders/[id]/items/[itemId]/apply-bundle/[bundleCode]` | `orders:update` | 403 when bundles disabled |
| API | GET | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs` | `orders:read` | Piece preferences read |
| API | POST | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs` | `orders:update` | Piece preferences mutate |
| API | PATCH | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs` | `orders:update` | Piece preferences mutate |
| API | POST | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs/confirm` | `orders:update` | Piece preference confirmation |
| API | POST | `/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/conditions` | `orders:update` | Piece condition/stain prefs replace |
| API | POST | `/api/v1/preparation/[id]/complete` | `orders:update` | Also requires tenant auth |
| API | GET | `/api/v1/preparation/[id]/items/[itemId]` | `orders:update` | Also requires tenant auth |
| API | PATCH | `/api/v1/preparation/[id]/items/[itemId]` | `orders:update` | Also requires tenant auth |
| API | POST | `/api/v1/customers` | `customers:create` | Customer create |
| API | GET | `/api/v1/customers` | `customers:read` | Customer list |
| API | GET | `/api/v1/customers/[id]` | `customers:read` | Customer detail |
| API | PATCH | `/api/v1/customers/[id]` | `customers:update` | Customer update |
| API | DELETE | `/api/v1/customers/[id]` | `customers:delete` | Customer delete |
| API | GET | `/api/v1/customers/[id]/service-prefs` | `customers:read` | Customer preferences read |
| API | POST | `/api/v1/customers/[id]/service-prefs` | `customers:update` | Customer preferences mutate |
| API | PATCH | `/api/v1/customers/[id]/service-prefs` | `customers:update` | Customer preferences mutate |
| ACTION | POST | `app/actions/payments/payment-crud-actions.cancelPaymentAction` | `payments:cancel` | Permission checked with `hasPermissionServer(...)` |
| ACTION | POST | `app/actions/payments/payment-crud-actions.refundPaymentAction` | `payments:refund` | Permission checked with `hasPermissionServer(...)` |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteSupplierAction` | `erp_lite_ap:view` | ERP-Lite supplier master create action |
| ACTION | POST | `app/actions/erp-lite/coa-actions.createErpLiteAccountAction` | `erp_lite_coa:view` | ERP-Lite tenant chart-of-accounts create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteApInvoiceAction` | `erp_lite_ap:view` | ERP-Lite AP invoice create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteApPaymentAction` | `erp_lite_ap:view` | ERP-Lite AP payment create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLitePurchaseOrderAction` | `erp_lite_po:view` | ERP-Lite PO create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteBankAccountAction` | `erp_lite_bank_recon:view` | ERP-Lite bank account create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteBankStatementAction` | `erp_lite_bank_recon:view` | ERP-Lite bank statement batch create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteBankStatementLineAction` | `erp_lite_bank_recon:view` | ERP-Lite manual bank statement line action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.importErpLiteBankStatementLinesAction` | `erp_lite_bank_recon:view` | ERP-Lite bulk bank statement line import action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteBankReconAction` | `erp_lite_bank_recon:view` | ERP-Lite reconciliation header create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.createErpLiteBankMatchAction` | `erp_lite_bank_recon:view` | ERP-Lite bank match create action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.reverseErpLiteBankMatchAction` | `erp_lite_bank_recon:view` | ERP-Lite bank match reversal action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.closeErpLiteBankReconAction` | `erp_lite_bank_recon:view` | ERP-Lite reconciliation close action |
| ACTION | POST | `app/actions/erp-lite/v2-actions.lockErpLiteBankReconAction` | `erp_lite_bank_recon:view` | ERP-Lite reconciliation lock action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.createErpLiteAllocationRuleAction` | `erp_lite_branch_pl:view` | ERP-Lite branch profitability allocation rule create action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.createErpLiteAllocationRunAction` | `erp_lite_branch_pl:view` | ERP-Lite branch profitability allocation run create action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.addErpLiteAllocationRunLineAction` | `erp_lite_branch_pl:view` | ERP-Lite branch profitability allocation line action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.postErpLiteAllocationRunAction` | `erp_lite_branch_pl:view` | ERP-Lite branch profitability allocation run post action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.createErpLiteCostComponentAction` | `erp_lite_branch_pl:view` | ERP-Lite laundry cost component create action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.createErpLiteCostRunAction` | `erp_lite_branch_pl:view` | ERP-Lite laundry cost run create action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.addErpLiteCostRunDetailAction` | `erp_lite_branch_pl:view` | ERP-Lite laundry cost detail action |
| ACTION | POST | `app/actions/erp-lite/branch-pl-actions.postErpLiteCostRunAction` | `erp_lite_branch_pl:view` | ERP-Lite laundry cost run post action |

## Auth-Only Or Mixed-Guard APIs

Routes that use auth context or other custom guards without explicit permission codes should be documented in [API_AUTH_GAPS.md](./API_AUTH_GAPS.md), not mixed into the table above.

## See Also

- [PERMISSIONS_BY_SCREEN.md](./PERMISSIONS_BY_SCREEN.md)
- [all_contract-aligned_UI_Permissions.md](./all_contract-aligned_UI_Permissions.md)
- [API_AUTH_GAPS.md](./API_AUTH_GAPS.md)
