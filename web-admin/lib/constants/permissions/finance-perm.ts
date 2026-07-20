/**
 * Finance-domain RBAC permission codes (mirror DB `sys_auth_permissions.code`
 * exactly — CLAUDE.md DB-mirror rule; format `resource:action`).
 *
 * Usage rule: API route guards and `*-access.ts` contracts keep STRING
 * LITERALS (the platform-inventory extractor resolves literals only — see
 * orders-perm.ts header). Import this registry for typed programmatic use
 * and as the single reference list for finance-role migrations.
 */
export const FINANCE_PERMISSIONS = {
  // Reports
  FINANCE_REPORTS_VIEW: 'finance_reports:view',
  // Business vouchers
  FIN_VOUCHERS_VIEW: 'fin_vouchers:view',
  FIN_VOUCHERS_VIEW_EFFECTS: 'fin_vouchers:view_effects',
  FIN_VOUCHERS_CREATE: 'fin_vouchers:create',
  FIN_VOUCHERS_POST: 'fin_vouchers:post',
  FIN_VOUCHERS_CANCEL: 'fin_vouchers:cancel',
  FIN_VOUCHERS_REVERSE: 'fin_vouchers:reverse',
  FIN_VOUCHER_LINES_CREATE: 'fin_voucher_lines:create',
  // AR invoices
  INVOICES_READ: 'invoices:read',
  INVOICES_CREATE: 'invoices:create',
  INVOICES_UPDATE: 'invoices:update',
  INVOICES_ISSUE: 'invoices:issue',
  INVOICES_ALLOCATE_PAYMENT: 'invoices:allocate_payment',
  INVOICES_APPROVE_SENSITIVE: 'invoices:approve_sensitive',
  INVOICES_CREDIT_NOTE: 'invoices:credit_note',
  INVOICES_DEBIT_NOTE: 'invoices:debit_note',
  INVOICES_WRITE_OFF: 'invoices:write_off',
  INVOICES_VOID: 'invoices:void',
  INVOICES_PRINT: 'invoices:print',
  INVOICES_EXPORT: 'invoices:export',
  // AR ledger / statements
  AR_LEDGER_VIEW: 'ar_ledger:view',
  AR_STMT_CYCLES_VIEW: 'ar_stmt_cycles:view',
  AR_DUNNING_VIEW: 'ar_dunning:view',
  CUSTOMER_STATEMENTS_VIEW: 'customer_statements:view',
  // B2B
  B2B_STATEMENTS_VIEW: 'b2b_statements:view',
  B2B_STATEMENTS_CREATE: 'b2b_statements:create',
  // Stored value / receipts
  STORED_VALUE_VIEW_BALANCES: 'stored_value:view_balances',
  STORED_VALUE_ISSUE_ADVANCE: 'stored_value:issue_advance',
  STORED_VALUE_ISSUE_CREDIT_NOTE: 'stored_value:issue_credit_note',
  CUSTOMERS_RECEIPT_ALLOCATE: 'customers:receipt_allocate',
  // Cash
  CASH_DRAWER_VIEW: 'cash_drawer:view',
  RECONCILIATION_VIEW: 'reconciliation:view',
  /** B27 — new; was checked in code (B16 approveSessionVariance) but never seeded until this package. */
  CASH_DRAWER_APPROVE_VARIANCE: 'cash_drawer:approve_variance',
  // Payment configuration
  PAYMENT_CONFIG_VIEW: 'payment_config:view',
  PAYMENT_CONFIG_MANAGE: 'payment_config:manage',
  // Financial outbox processor (B7) — ops visibility + manual retry
  FINANCE_OUTBOX_VIEW: 'finance_outbox:view',
  FINANCE_OUTBOX_RETRY: 'finance_outbox:retry',
  // B27 — wallet admin adjustment sibling to the already-existing STORED_VALUE_ISSUE_ADVANCE
  STORED_VALUE_ISSUE_WALLET_CREDIT: 'stored_value:issue_wallet_credit',
} as const

export type FinancePermissionCode =
  (typeof FINANCE_PERMISSIONS)[keyof typeof FINANCE_PERMISSIONS]
