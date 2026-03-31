export interface ErpLiteOptionItem {
  id: string;
  label: string;
}

export interface ErpLiteExpenseListItem {
  id: string;
  expense_no: string;
  expense_date: string;
  branch_name: string | null;
  settlement_code: 'CASH' | 'BANK' | 'PAYABLE';
  total_amount: number;
  currency_code: string;
  status_code: string;
  payee_name: string | null;
}

export interface ErpLiteCashboxListItem {
  id: string;
  cashbox_code: string;
  cashbox_name: string;
  branch_name: string | null;
  currency_code: string;
  opening_balance: number;
  current_balance: number;
  account_code: string;
  account_name: string;
}

export interface ErpLiteCashTxnListItem {
  id: string;
  txn_no: string;
  txn_date: string;
  txn_type_code: 'TOPUP' | 'SPEND';
  cashbox_name: string;
  branch_name: string | null;
  amount_total: number;
  currency_code: string;
  status_code: string;
  description: string | null;
}

export interface ErpLiteExpensesDashboardSnapshot {
  expense_list: ErpLiteExpenseListItem[];
  cashbox_list: ErpLiteCashboxListItem[];
  cash_txn_list: ErpLiteCashTxnListItem[];
  branch_options: ErpLiteOptionItem[];
  cashbox_account_options: ErpLiteOptionItem[];
  cashbox_options: ErpLiteOptionItem[];
}

export interface CreateErpLiteExpenseInput {
  branch_id?: string | null;
  expense_date: string;
  currency_code: string;
  subtotal_amount: number;
  tax_amount?: number;
  payee_name?: string | null;
  description?: string | null;
  settlement_code: 'CASH' | 'BANK';
  created_by?: string | null;
}

export interface CreateErpLiteCashboxInput {
  branch_id?: string | null;
  account_id: string;
  cashbox_code?: string | null;
  name: string;
  name2?: string | null;
  currency_code: string;
  opening_balance?: number;
  created_by?: string | null;
}

export interface CreateErpLiteCashTxnInput {
  cashbox_id: string;
  txn_type_code: 'TOPUP' | 'SPEND';
  txn_date: string;
  currency_code: string;
  amount_total: number;
  description?: string | null;
  created_by?: string | null;
}

export interface ErpLiteExpenseMutationResult {
  posting_status: 'executed' | 'skipped';
  posting_success?: boolean;
  skip_reason?: 'POLICY_NOT_FOUND' | 'POLICY_DISABLED';
}
