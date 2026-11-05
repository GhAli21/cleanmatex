/**
 * Document numbering (Human-Friendly Codes) — shared constants.
 *
 * Every value mirrors a DB code exactly (CRITICAL RULE #12). Sources (P1 migrations, numbers
 * assigned at creation time): scope_modules (sys_saas_scope_cd), doc_seq_type_config
 * (sys_doc_seq_category_cd, sys_doc_seq_manage_level_cd, sys_doc_seq_type_cd).
 * Derive union types from these objects; never retype the strings.
 *
 * Plan: docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md
 * Guide: docs/features/Human_Friendly_Codes/DEV_GUIDE_DOC_SEQ_ENGINE.md
 */

/** Who owns the numbered data — sys_saas_scope_cd. */
export const SAAS_SCOPES = {
  TENANT_ORG: 'TENANT_ORG',
  SYS: 'SYS',
  HQ: 'HQ',
} as const;
export type SaasScope = (typeof SAAS_SCOPES)[keyof typeof SAAS_SCOPES];

/** Who generates a code — sys_doc_seq_manage_level_cd. Only GENERAL uses the shared engine. */
export const DOC_SEQ_MANAGE_LEVELS = {
  GENERAL: 'GENERAL',
  DOMAIN: 'DOMAIN',
  MANUAL: 'MANUAL',
  NONE: 'NONE',
} as const;
export type DocSeqManageLevel = (typeof DOC_SEQ_MANAGE_LEVELS)[keyof typeof DOC_SEQ_MANAGE_LEVELS];

/** Groups of numbered data — sys_doc_seq_category_cd. */
export const DOC_SEQ_CATEGORIES = {
  CATALOG: 'CATALOG',
  MASTER_DATA: 'MASTER_DATA',
  TRANSACTION: 'TRANSACTION',
} as const;
export type DocSeqCategory = (typeof DOC_SEQ_CATEGORIES)[keyof typeof DOC_SEQ_CATEGORIES];

/** When a counter restarts — sys_doc_seq_type_cd.reset_policy. */
export const DOC_SEQ_RESET_POLICIES = {
  NEVER: 'NEVER',
  YEARLY: 'YEARLY',
  MONTHLY: 'MONTHLY',
  DAILY: 'DAILY',
  FISCAL_YEAR: 'FISCAL_YEAR',
  PER_PARENT: 'PER_PARENT',
} as const;
export type DocSeqResetPolicy = (typeof DOC_SEQ_RESET_POLICIES)[keyof typeof DOC_SEQ_RESET_POLICIES];

/** Every numbered document or record — sys_doc_seq_type_cd.doc_type_code. */
export const DOC_SEQ_TYPES = {
  ORDER: 'ORDER',
  ORDER_ITEM: 'ORDER_ITEM',
  ORDER_PIECE: 'ORDER_PIECE',
  STORE_CREDIT_NOTE: 'STORE_CREDIT_NOTE',
  FIN_JOURNAL: 'FIN_JOURNAL',
  AR_INVOICE: 'AR_INVOICE',
  REFUND: 'REFUND',
  TAX_INVOICE: 'TAX_INVOICE',
  TAX_SIMPLIFIED: 'TAX_SIMPLIFIED',
  TAX_CREDIT_NOTE: 'TAX_CREDIT_NOTE',
  TAX_DEBIT_NOTE: 'TAX_DEBIT_NOTE',
  RECEIPT_VOUCHER: 'RECEIPT_VOUCHER',
  PAYMENT_VOUCHER: 'PAYMENT_VOUCHER',
  REFUND_VOUCHER: 'REFUND_VOUCHER',
  ADJUSTMENT_VOUCHER: 'ADJUSTMENT_VOUCHER',
  TRANSFER_VOUCHER: 'TRANSFER_VOUCHER',
  VOUCHER_OTHER: 'VOUCHER_OTHER',
  LEGACY_VOUCHER: 'LEGACY_VOUCHER',
  POS_SESSION: 'POS_SESSION',
  POS_Z_REPORT: 'POS_Z_REPORT',
  CASH_DRAWER_SESSION: 'CASH_DRAWER_SESSION',
  CASH_DRAWER_TRX: 'CASH_DRAWER_TRX',
  CUSTOMER: 'CUSTOMER',
  USER: 'USER',
  PRODUCT: 'PRODUCT',
  STOCK_ITEM: 'STOCK_ITEM',
  GIFT_CARD: 'GIFT_CARD',
  DELIVERY_ROUTE: 'DELIVERY_ROUTE',
  B2B_CONTRACT: 'B2B_CONTRACT',
  B2B_STATEMENT: 'B2B_STATEMENT',
  AR_DISPUTE: 'AR_DISPUTE',
  AR_DUNNING_RUN: 'AR_DUNNING_RUN',
  AR_RECON_RUN: 'AR_RECON_RUN',
  ERP_EXPENSE: 'ERP_EXPENSE',
  ERP_PETTY_CASHBOX: 'ERP_PETTY_CASHBOX',
  ERP_PETTY_CASH_TXN: 'ERP_PETTY_CASH_TXN',
  ERP_PETTY_CASH_RECON: 'ERP_PETTY_CASH_RECON',
  ERP_SUPPLIER: 'ERP_SUPPLIER',
  ERP_PO: 'ERP_PO',
  ERP_AP_INVOICE: 'ERP_AP_INVOICE',
  ERP_AP_PAYMENT: 'ERP_AP_PAYMENT',
  ERP_BANK_ACCOUNT: 'ERP_BANK_ACCOUNT',
  ERP_BANK_STATEMENT: 'ERP_BANK_STATEMENT',
  ERP_BANK_RECON: 'ERP_BANK_RECON',
  ERP_ALLOC_RULE: 'ERP_ALLOC_RULE',
  ERP_ALLOC_RUN: 'ERP_ALLOC_RUN',
  ERP_COST_COMPONENT: 'ERP_COST_COMPONENT',
  ERP_COST_RUN: 'ERP_COST_RUN',
  HQ_SAAS_INVOICE: 'HQ_SAAS_INVOICE',
  HQ_MARKETING_LEAD: 'HQ_MARKETING_LEAD',
  STOCK_TRANSACTION: 'STOCK_TRANSACTION',
} as const;
export type DocSeqType = (typeof DOC_SEQ_TYPES)[keyof typeof DOC_SEQ_TYPES];

/**
 * Reserved unique 3-5 letter key per doc type — sys_doc_seq_type_cd.type_prefix.
 * Used to tell types apart in scan payloads; it is NOT always the printed prefix
 * (DOMAIN types keep their own format until they move to the engine).
 */
export const DOC_SEQ_TYPE_PREFIXES: Readonly<Record<DocSeqType, string>> = {
  ORDER: 'ORD',
  ORDER_ITEM: 'ITM',
  ORDER_PIECE: 'PEC',
  STORE_CREDIT_NOTE: 'SCN',
  FIN_JOURNAL: 'JRL',
  AR_INVOICE: 'ARI',
  REFUND: 'REF',
  TAX_INVOICE: 'INV',
  TAX_SIMPLIFIED: 'SIM',
  TAX_CREDIT_NOTE: 'TCN',
  TAX_DEBIT_NOTE: 'TDN',
  RECEIPT_VOUCHER: 'RCV',
  PAYMENT_VOUCHER: 'PMV',
  REFUND_VOUCHER: 'RFV',
  ADJUSTMENT_VOUCHER: 'ADJ',
  TRANSFER_VOUCHER: 'TRV',
  VOUCHER_OTHER: 'VCH',
  LEGACY_VOUCHER: 'VCR',
  POS_SESSION: 'POS',
  POS_Z_REPORT: 'ZRP',
  CASH_DRAWER_SESSION: 'SES',
  CASH_DRAWER_TRX: 'CDT',
  CUSTOMER: 'CUST',
  USER: 'USR',
  PRODUCT: 'PROD',
  STOCK_ITEM: 'SKU',
  GIFT_CARD: 'GFT',
  DELIVERY_ROUTE: 'RTE',
  B2B_CONTRACT: 'CON',
  B2B_STATEMENT: 'STMT',
  AR_DISPUTE: 'ARD',
  AR_DUNNING_RUN: 'DUN',
  AR_RECON_RUN: 'RECON',
  ERP_EXPENSE: 'EXP',
  ERP_PETTY_CASHBOX: 'PCB',
  ERP_PETTY_CASH_TXN: 'PCT',
  ERP_PETTY_CASH_RECON: 'PCR',
  ERP_SUPPLIER: 'SUP',
  ERP_PO: 'PUR',
  ERP_AP_INVOICE: 'API',
  ERP_AP_PAYMENT: 'APP',
  ERP_BANK_ACCOUNT: 'BNK',
  ERP_BANK_STATEMENT: 'BST',
  ERP_BANK_RECON: 'BRC',
  ERP_ALLOC_RULE: 'ALR',
  ERP_ALLOC_RUN: 'APR',
  ERP_COST_COMPONENT: 'CMP',
  ERP_COST_RUN: 'CRN',
  HQ_SAAS_INVOICE: 'HQI',
  HQ_MARKETING_LEAD: 'MLD',
  STOCK_TRANSACTION: 'STK',
};

/** Error codes raised by the engine functions (message starts with the code). */
export const DOC_SEQ_ERRORS = {
  TENANT_REQUIRED: 'DOC_SEQ_TENANT_REQUIRED',
  TENANT_MISMATCH: 'DOC_SEQ_TENANT_MISMATCH',
  TENANT_NOT_FOUND: 'DOC_SEQ_TENANT_NOT_FOUND',
  TYPE_NOT_FOUND: 'DOC_SEQ_TYPE_NOT_FOUND',
  TYPE_INACTIVE: 'DOC_SEQ_TYPE_INACTIVE',
  NOT_GENERAL: 'DOC_SEQ_NOT_GENERAL',
  SCOPE_MISMATCH: 'DOC_SEQ_SCOPE_MISMATCH',
  TOKEN_NOT_ENABLED: 'DOC_SEQ_TOKEN_NOT_ENABLED',
  TRIGGER_MISCONFIG: 'DOC_SEQ_TRIGGER_MISCONFIG',
  CODE_IMMUTABLE: 'DOC_SEQ_CODE_IMMUTABLE',
  BAD_ARGS: 'DOC_SEQ_BAD_ARGS',
} as const;
export type DocSeqError = (typeof DOC_SEQ_ERRORS)[keyof typeof DOC_SEQ_ERRORS];

/**
 * Store credit note numbering (P5, migration 0687_fin_store_credit_note_scn).
 * ENGINE: insert with credit_note_no = '' and read back SCN-YYYY-NNNNNN set by trg_fin_cn_no_assign.
 * LEGACY: the pre-P5 CN-<tenant8>-<count+1> generator, kept for one release as the rollback path
 * (plan T5.2, A-50). Remove LEGACY in P9.
 */
export const STORE_CREDIT_NOTE_NUMBERING_MODES = {
  ENGINE: 'ENGINE',
  LEGACY: 'LEGACY',
} as const;
/** One of STORE_CREDIT_NOTE_NUMBERING_MODES. */
export type StoreCreditNoteNumberingMode =
  (typeof STORE_CREDIT_NOTE_NUMBERING_MODES)[keyof typeof STORE_CREDIT_NOTE_NUMBERING_MODES];

/** Active mode. Switch to LEGACY only together with the documented DB rollback (DEV_GUIDE section 20). */
export const STORE_CREDIT_NOTE_NUMBERING: StoreCreditNoteNumberingMode = STORE_CREDIT_NOTE_NUMBERING_MODES.ENGINE;

/** Error raised when the DB did not assign a credit note number (migration 0687 not applied). */
export const STORE_CREDIT_NOTE_NO_NOT_ASSIGNED = 'STORE_CREDIT_NOTE_NO_NOT_ASSIGNED';

/** Severities in vw_doc_seq_consistency. */
export const DOC_SEQ_CHECK_SEVERITIES = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
} as const;
export type DocSeqCheckSeverity = (typeof DOC_SEQ_CHECK_SEVERITIES)[keyof typeof DOC_SEQ_CHECK_SEVERITIES];

/**
 * Reads the engine error code from a DB error message.
 * @param message error message from Postgres / Prisma
 * @returns the DOC_SEQ_* code, or null when the error is not from the engine
 */
export function parseDocSeqError(message: string | null | undefined): DocSeqError | null {
  if (!message) return null;
  const match = /DOC_SEQ_[A-Z_]+/.exec(message);
  if (!match) return null;
  const code = match[0];
  return (Object.values(DOC_SEQ_ERRORS) as string[]).includes(code) ? (code as DocSeqError) : null;
}
