# DOMAIN Codes Registry (Human-Friendly Codes)

Status: written 2026-10-31 (Asia/Muscat, UTC+4), plan task T5.3 / T5.S. Source: `sys_doc_seq_type_cd` after migrations `0666`–`0674`, `0687` (box test chain), checked against [`INVENTORY.md`](./INVENTORY.md) §6–§8.

## What this list is

Every numbered document type is a row in `sys_doc_seq_type_cd`. **GENERAL** rows are numbered by the shared engine (`fn_doc_seq_next`, triggers `fn_doc_seq_assign_code`). **DOMAIN** rows keep their own generator (a DB function, a table default or app code); they are registered so HQ can see every code, its prefix and its owner, and so the consistency view can check them. Moving a DOMAIN row to GENERAL is a separate migration per type (pattern: `0674` for orders, `0687` for store credit notes).

## Totals (box chain 2026-10-31)

- 51 rows: **2 GENERAL** (`ORDER` since `0674`, `STORE_CREDIT_NOTE` since `0687`), **49 DOMAIN**.
- `vw_doc_seq_consistency`: **0 ERROR**. WARN: `SCOPE_MISMATCH` USER (users are SYS-scope codes on a tenant table, known), `NOT_NULL_MISSING` CASH_DRAWER_SESSION (column nullable, generator always fills it), `PREFIX_SHARED` STOCK_ITEM / TAX_INVOICE (`INV`; different tables, the `type_prefix` SKU / INV keeps the scan payload unique). The earlier `PREFIX_SHARED` CN warning (store credit vs tax credit note) is gone because store credit notes now use `SCN`.
- INFO `APP_OBJ_UNVERIFIED` for each `app:` owner: the DB cannot see app files. All 17 app files below were checked to exist in the tenant repo on 2026-10-31.
- Every DOMAIN row matches INVENTORY §6 (`type_prefix` and owner object), checked by script on 2026-10-31.

## DOMAIN rows

| # | doc_type_code | Name | Scope | Prefix | type_prefix | Format | Reset | Column | Generator (owner) | Consistency |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `ORDER_ITEM` | Order item serial | TENANT_ORG | — | `ITM` | `PARENT-SEQ` | PER_PARENT | `org_order_items_dtl.order_item_srno` | `public.fn_next_order_item_srno(uuid,uuid)` | OK |
| 2 | `ORDER_PIECE` | Order piece code | TENANT_ORG | — | `PEC` | `PARENT-SEQ` | PER_PARENT | `org_order_item_pieces_dtl.piece_code` | `public.org_order_item_pieces_dtl` | OK |
| 3 | `FIN_JOURNAL` | Journal number | TENANT_ORG | — | `JRL` | `SEQ` | NEVER | `org_fin_journal_mst.journal_no` | `public.fn_next_fin_doc_no(uuid,character varying)` | OK |
| 4 | `AR_INVOICE` | AR invoice number | TENANT_ORG | `ARI` | `ARI` | `SEQ` | NEVER | `org_invoice_mst.invoice_no` | `public.fn_next_fin_doc_no(uuid,character varying)` | OK |
| 5 | `REFUND` | Refund number | TENANT_ORG | `REF` | `REF` | `SEQ` | NEVER | `org_order_refunds_dtl.refund_no` | `public.fn_next_fin_doc_no(uuid,character varying)` | OK |
| 6 | `TAX_INVOICE` | Tax invoice number | TENANT_ORG | `INV` | `INV` | `YYYY-SEQ` | FISCAL_YEAR | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 7 | `TAX_SIMPLIFIED` | Simplified tax invoice number | TENANT_ORG | `SIM` | `SIM` | `YYYY-SEQ` | FISCAL_YEAR | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 8 | `TAX_CREDIT_NOTE` | Tax credit note number | TENANT_ORG | `CN` | `TCN` | `YYYY-SEQ` | FISCAL_YEAR | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 9 | `TAX_DEBIT_NOTE` | Tax debit note number | TENANT_ORG | `DN` | `TDN` | `YYYY-SEQ` | FISCAL_YEAR | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 10 | `RECEIPT_VOUCHER` | Receipt voucher number | TENANT_ORG | `RV` | `RCV` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 11 | `PAYMENT_VOUCHER` | Payment voucher number | TENANT_ORG | `PV` | `PMV` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 12 | `REFUND_VOUCHER` | Refund voucher number | TENANT_ORG | `RF` | `RFV` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 13 | `ADJUSTMENT_VOUCHER` | Adjustment voucher number | TENANT_ORG | `ADJ` | `ADJ` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 14 | `TRANSFER_VOUCHER` | Transfer voucher number | TENANT_ORG | `TR` | `TRV` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 15 | `VOUCHER_OTHER` | Other voucher number | TENANT_ORG | `VCH` | `VCH` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 16 | `LEGACY_VOUCHER` | Legacy voucher number | TENANT_ORG | — | `VCR` | `YYYY-SEQ` | YEARLY | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 17 | `POS_SESSION` | POS session number | TENANT_ORG | `POS` | `POS` | `YYYYMMDD-RAND` | NEVER | `org_pos_sessions_mst.session_no` | `app:web-admin/lib/services/pos-session.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 18 | `POS_Z_REPORT` | Z-report number | TENANT_ORG | `Z` | `ZRP` | `PARENT` | PER_PARENT | `org_pos_shift_z_rpt_tr.report_no` | `app:web-admin/lib/services/pos-shift-report.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 19 | `CASH_DRAWER_SESSION` | Cash drawer session number | TENANT_ORG | `SES` | `SES` | `YYYYMMDD-SEQ` | DAILY | `org_cash_drawer_sessions_mst.session_no` | `public.generate_cash_drawer_sess_no(uuid)` | NOT_NULL_MISSING/WARN |
| 20 | `CASH_DRAWER_TRX` | Cash drawer transaction number | TENANT_ORG | `CDT` | `CDT` | `YYYYMMDD-SEQ` | DAILY | `org_cash_drawer_trx_mst.trx_no` | `public.generate_cash_drawer_trx_no(uuid)` | OK |
| 21 | `CUSTOMER` | Customer number | SYS | `CUST` | `CUST` | `SEQ` | NEVER | `sys_customers_mst.customer_number` | `public.generate_customer_number(uuid)` | OK |
| 22 | `USER` | User code | SYS | `U` | `USR` | `SEQ` | NEVER | `org_users_mst.user_code` | `public.fn_org_user_code_next()` | SCOPE_MISMATCH/WARN |
| 23 | `PRODUCT` | Product code | TENANT_ORG | `PROD` | `PROD` | `SEQ` | NEVER | `org_product_data_mst.product_code` | `app:web-admin/lib/services/catalog.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 24 | `STOCK_ITEM` | Stock item code | TENANT_ORG | `INV` | `SKU` | `SEQ` | NEVER | `org_product_data_mst.product_code` | `app:web-admin/lib/services/inventory-service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 25 | `GIFT_CARD` | Gift card code | TENANT_ORG | `CMX` | `GFT` | `RAND-RAND-RAND` | NEVER | `org_gift_cards_mst.gift_card_code` | `app:web-admin/lib/services/gift-card-service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 26 | `DELIVERY_ROUTE` | Delivery route number | TENANT_ORG | `RT` | `RTE` | `YYYY-SEQ` | YEARLY | `org_dlv_routes_mst.route_number` | `app:web-admin/lib/services/delivery/delivery-route-command.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 27 | `B2B_CONTRACT` | B2B contract number | TENANT_ORG | `CON` | `CON` | `YYYYMM-SEQ` | MONTHLY | `org_b2b_contracts_mst.contract_no` | `app:web-admin/lib/services/b2b-contracts.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 28 | `B2B_STATEMENT` | B2B statement number | TENANT_ORG | `STMT` | `STMT` | `YYYYMM-SEQ` | MONTHLY | `org_b2b_statements_mst.statement_no` | `app:web-admin/lib/services/b2b-statements.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 29 | `AR_DISPUTE` | AR dispute number | TENANT_ORG | `ARD` | `ARD` | `RAND` | NEVER | `org_ar_disputes_mst.dispute_no` | `app:web-admin/lib/services/ar-dispute.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 30 | `AR_DUNNING_RUN` | AR dunning run number | TENANT_ORG | — | `DUN` | `SEQ` | PER_PARENT | `org_ar_dunning_runs_mst.run_no` | `app:web-admin/lib/services/ar-dunning-ops.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 31 | `AR_RECON_RUN` | AR reconciliation run number | TENANT_ORG | `RECON` | `RECON` | `YYYY-SEQ` | YEARLY | `org_fin_recon_runs_mst.run_no` | `app:web-admin/lib/services/reconciliation.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 32 | `ERP_EXPENSE` | Expense number | TENANT_ORG | `EXP` | `EXP` | `YYYYMM-SEQ` | MONTHLY | `org_fin_exp_mst.expense_no` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 33 | `ERP_PETTY_CASHBOX` | Petty cashbox code | TENANT_ORG | `PCB` | `PCB` | `YYYYMM-SEQ` | MONTHLY | `org_fin_cashbox_mst.cashbox_code` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 34 | `ERP_PETTY_CASH_TXN` | Petty cash transaction number | TENANT_ORG | `PCT` | `PCT` | `YYYYMM-SEQ` | MONTHLY | `org_fin_cash_txn_tr.txn_no` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 35 | `ERP_PETTY_CASH_RECON` | Petty cash reconciliation number | TENANT_ORG | `PCR` | `PCR` | `YYYYMM-SEQ` | MONTHLY | `org_fin_cash_rec_mst.recon_no` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 36 | `ERP_SUPPLIER` | Supplier code | TENANT_ORG | `SUP` | `SUP` | `YYYYMM-SEQ` | MONTHLY | `org_fin_supp_mst.supplier_code` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 37 | `ERP_PO` | Purchase order number | TENANT_ORG | `PO` | `PUR` | `YYYYMM-SEQ` | MONTHLY | `org_fin_po_mst.po_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 38 | `ERP_AP_INVOICE` | AP invoice number | TENANT_ORG | `API` | `API` | `YYYYMM-SEQ` | MONTHLY | `org_fin_ap_inv_mst.ap_inv_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 39 | `ERP_AP_PAYMENT` | AP payment number | TENANT_ORG | `APP` | `APP` | `YYYYMM-SEQ` | MONTHLY | `org_fin_ap_pmt_mst.ap_pmt_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 40 | `ERP_BANK_ACCOUNT` | Bank account code | TENANT_ORG | `BNK` | `BNK` | `YYYYMM-SEQ` | MONTHLY | `org_fin_bank_acct_mst.bank_code` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 41 | `ERP_BANK_STATEMENT` | Bank statement batch number | TENANT_ORG | `BST` | `BST` | `YYYYMM-SEQ` | MONTHLY | `org_fin_bank_stmt_mst.import_batch_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 42 | `ERP_BANK_RECON` | Bank reconciliation code | TENANT_ORG | `BRC` | `BRC` | `YYYYMM-SEQ` | MONTHLY | `org_fin_bank_recon_mst.recon_code` | `app:web-admin/lib/services/erp-lite-v2.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 43 | `ERP_ALLOC_RULE` | Allocation rule code | TENANT_ORG | `ALR` | `ALR` | `YYYYMM-SEQ` | MONTHLY | `org_fin_alloc_rule_mst.rule_code` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 44 | `ERP_ALLOC_RUN` | Allocation run number | TENANT_ORG | `APR` | `APR` | `YYYYMM-SEQ` | MONTHLY | `org_fin_alloc_run_mst.run_no` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 45 | `ERP_COST_COMPONENT` | Cost component code | TENANT_ORG | `CMP` | `CMP` | `YYYYMM-SEQ` | MONTHLY | `org_fin_cost_cmp_cd.comp_code` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 46 | `ERP_COST_RUN` | Cost run number | TENANT_ORG | `CRN` | `CRN` | `YYYYMM-SEQ` | MONTHLY | `org_fin_cost_run_mst.run_no` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` | APP_OBJ_UNVERIFIED/INFO |
| 47 | `HQ_SAAS_INVOICE` | SaaS invoice number | HQ | `INV` | `HQI` | `YYYY-SEQ` | NEVER | `sys_bill_invoices_mst.invoice_no` | `public.sys_bill_generate_invoice_number()` | OK |
| 48 | `HQ_MARKETING_LEAD` | Marketing lead code | HQ | `CMX` | `MLD` | `YYYYMMDD-SEQ` | DAILY | `hq_crm_marketing_leads.lead_code` | `public.hq_crm_marketing_lead_code_next()` | OK |
| 49 | `STOCK_TRANSACTION` | Stock transaction number | TENANT_ORG | `STK` | `STK` | `YYYYMMDD-SEQ` | DAILY | `org_inv_stock_tr.transaction_no` | `app:web-admin/lib/services/inventory-service.ts` | APP_OBJ_UNVERIFIED/INFO |

## GENERAL rows (shared engine)

| doc_type_code | Format | Column | Since | Notes |
|---|---|---|---|---|
| `ORDER` | `ORD-YYYYMMDD-NNNN` (tenant time zone, daily) | `org_orders_mst.order_no` | `0674` (P2) | Sub-orders `-S<n>` under the root order |
| `STORE_CREDIT_NOTE` | `SCN-YYYY-NNNNNN` (tenant time zone, yearly, grows past 6 digits) | `org_credit_notes_mst.credit_note_no` | `0687` (P5) | Old `CN-<tenant8>-NNNNN` rows are kept; a supplied value is kept (rollback path) |

## How to check it yourself (SELECT only)

```sql
SELECT manage_by_level, count(*) FROM sys_doc_seq_type_cd GROUP BY 1;
SELECT severity, check_code, doc_type_code, detail FROM vw_doc_seq_consistency ORDER BY severity, doc_type_code;
```

Related: [`DEV_GUIDE_DOC_SEQ_ENGINE.md`](./DEV_GUIDE_DOC_SEQ_ENGINE.md) §7 (adding a numbered table), §20 (store credit notes).
