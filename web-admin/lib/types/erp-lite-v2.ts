export interface ErpLiteV2OptionItem {
  id: string;
  label: string;
}

export interface ErpLiteSupplierListItem {
  id: string;
  supplier_code: string;
  supplier_name: string;
  branch_name: string | null;
  payable_account_name: string | null;
  currency_code: string;
  payment_terms_days: number;
  status_code: string;
}

export interface ErpLitePoListItem {
  id: string;
  po_no: string;
  po_date: string;
  supplier_name: string;
  branch_name: string | null;
  total_amount: number;
  currency_code: string;
  status_code: string;
}

export interface ErpLiteApInvoiceListItem {
  id: string;
  ap_inv_no: string;
  invoice_date: string;
  due_date: string | null;
  supplier_name: string;
  branch_name: string | null;
  total_amount: number;
  open_amount: number;
  currency_code: string;
  status_code: string;
}

export interface ErpLiteApPaymentListItem {
  id: string;
  ap_pmt_no: string;
  payment_date: string;
  supplier_name: string;
  branch_name: string | null;
  amount_total: number;
  currency_code: string;
  settlement_code: 'BANK' | 'CASH';
  status_code: string;
}

export interface ErpLiteApAgingListItem {
  id: string;
  ap_inv_no: string;
  supplier_name: string;
  due_date: string | null;
  days_overdue: number;
  open_amount: number;
  currency_code: string;
  aging_bucket: 'CURRENT' | 'DUE_1_30' | 'DUE_31_60' | 'DUE_61_90' | 'DUE_91_PLUS';
}

export interface ErpLiteBankAccountListItem {
  id: string;
  bank_code: string;
  bank_name: string | null;
  account_name: string;
  branch_name: string | null;
  currency_code: string;
  status_code: string;
  stmt_import_mode: string;
}

export interface ErpLiteBankStatementListItem {
  id: string;
  import_batch_no: string;
  bank_name: string;
  stmt_date_from: string;
  stmt_date_to: string;
  line_count: number;
  status_code: string;
}

export interface ErpLiteBankStatementLineListItem {
  id: string;
  bank_stmt_id: string;
  line_no: number;
  txn_date: string;
  ext_ref_no: string | null;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  match_status: string;
}

export interface ErpLiteBankMatchListItem {
  id: string;
  bank_stmt_line_id: string;
  bank_recon_id: string | null;
  source_doc_id: string;
  source_doc_label: string;
  statement_line_label: string;
  match_amount: number;
  status_code: string;
}

export interface ErpLiteBankReconciliationListItem {
  id: string;
  recon_code: string;
  bank_name: string;
  recon_date: string;
  stmt_date_from: string;
  stmt_date_to: string;
  status_code: string;
  unmatched_amount: number | null;
}

export interface ErpLiteApDashboardSnapshot {
  supplier_list: ErpLiteSupplierListItem[];
  ap_invoice_list: ErpLiteApInvoiceListItem[];
  ap_payment_list: ErpLiteApPaymentListItem[];
  ap_aging_list: ErpLiteApAgingListItem[];
  branch_options: ErpLiteV2OptionItem[];
  supplier_options: ErpLiteV2OptionItem[];
  payable_account_options: ErpLiteV2OptionItem[];
  invoice_options: ErpLiteV2OptionItem[];
  bank_account_options: ErpLiteV2OptionItem[];
  cashbox_options: ErpLiteV2OptionItem[];
}

export interface ErpLitePoDashboardSnapshot {
  po_list: ErpLitePoListItem[];
  branch_options: ErpLiteV2OptionItem[];
  supplier_options: ErpLiteV2OptionItem[];
  usage_code_options: ErpLiteV2OptionItem[];
}

export interface ErpLiteBankDashboardSnapshot {
  bank_account_list: ErpLiteBankAccountListItem[];
  bank_statement_list: ErpLiteBankStatementListItem[];
  bank_statement_line_list: ErpLiteBankStatementLineListItem[];
  bank_match_list: ErpLiteBankMatchListItem[];
  bank_recon_list: ErpLiteBankReconciliationListItem[];
  branch_options: ErpLiteV2OptionItem[];
  bank_gl_account_options: ErpLiteV2OptionItem[];
  bank_account_options: ErpLiteV2OptionItem[];
  bank_stmt_options: ErpLiteV2OptionItem[];
  bank_stmt_line_options: ErpLiteV2OptionItem[];
  ap_payment_options: ErpLiteV2OptionItem[];
  bank_recon_open_options: ErpLiteV2OptionItem[];
  period_options: ErpLiteV2OptionItem[];
}

export interface CreateErpLiteSupplierInput {
  branch_id?: string | null;
  payable_acct_id?: string | null;
  supplier_code?: string | null;
  name: string;
  name2?: string | null;
  email?: string | null;
  phone?: string | null;
  payment_terms_days?: number;
  currency_code: string;
  created_by?: string | null;
}

export interface CreateErpLitePurchaseOrderInput {
  supplier_id: string;
  branch_id?: string | null;
  po_date: string;
  expected_date?: string | null;
  currency_code: string;
  subtotal_amount: number;
  tax_amount?: number;
  description: string;
  description2?: string | null;
  usage_code_id?: string | null;
  created_by?: string | null;
}

export interface CreateErpLiteApInvoiceInput {
  supplier_id: string;
  branch_id?: string | null;
  po_id?: string | null;
  invoice_date: string;
  due_date?: string | null;
  currency_code: string;
  subtotal_amount: number;
  tax_amount?: number;
  description: string;
  description2?: string | null;
  usage_code_id?: string | null;
  supplier_inv_no?: string | null;
  created_by?: string | null;
}

export interface CreateErpLiteApPaymentInput {
  supplier_id: string;
  ap_invoice_id: string;
  branch_id?: string | null;
  bank_account_id?: string | null;
  cashbox_id?: string | null;
  payment_date: string;
  currency_code: string;
  amount_total: number;
  settlement_code: 'BANK' | 'CASH';
  payment_method_code?: string | null;
  ext_ref_no?: string | null;
  created_by?: string | null;
}

export interface CreateErpLiteBankAccountInput {
  branch_id?: string | null;
  account_id: string;
  bank_code?: string | null;
  name: string;
  name2?: string | null;
  bank_name?: string | null;
  bank_name2?: string | null;
  bank_account_no: string;
  iban_no?: string | null;
  currency_code: string;
  stmt_import_mode?: 'CSV' | 'MANUAL' | 'API';
  match_mode?: 'STRICT' | 'ASSISTED';
  created_by?: string | null;
}

export interface CreateErpLiteBankStatementInput {
  bank_account_id: string;
  stmt_date_from: string;
  stmt_date_to: string;
  source_file_name?: string | null;
  opening_balance?: number | null;
  closing_balance?: number | null;
  created_by?: string | null;
}

export interface CreateErpLiteBankStatementLineInput {
  bank_stmt_id: string;
  bank_account_id: string;
  txn_date: string;
  value_date?: string | null;
  ext_ref_no?: string | null;
  description?: string | null;
  debit_amount?: number | null;
  credit_amount?: number | null;
  balance_amount?: number | null;
  created_by?: string | null;
}

export interface ImportErpLiteBankStatementLineInput {
  bank_stmt_id: string;
  bank_account_id: string;
  txn_date: string;
  value_date?: string | null;
  ext_ref_no?: string | null;
  description?: string | null;
  debit_amount?: number | null;
  credit_amount?: number | null;
  balance_amount?: number | null;
}

export interface ImportErpLiteBankStatementLinesInput {
  bank_stmt_id: string;
  rows: ImportErpLiteBankStatementLineInput[];
  created_by?: string | null;
}

export interface CreateErpLiteBankReconInput {
  bank_account_id: string;
  period_id?: string | null;
  recon_date: string;
  stmt_date_from: string;
  stmt_date_to: string;
  gl_balance?: number | null;
  stmt_balance?: number | null;
  unmatched_amount?: number | null;
  created_by?: string | null;
}

export interface CreateErpLiteBankMatchInput {
  bank_stmt_line_id: string;
  bank_recon_id?: string | null;
  ap_payment_id: string;
  match_amount: number;
  created_by?: string | null;
}
