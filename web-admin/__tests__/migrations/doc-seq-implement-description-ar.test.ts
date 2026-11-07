/**
 * Source-contract checks for the unapplied Arabic document-code support guide.
 * The registry must retain operationally specific help for every code type;
 * generic per-level copy would hide generator and diagnostic differences.
 */
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.join(__dirname, '..', '..', '..');
const migration = fs.readFileSync(
  path.join(repositoryRoot, 'supabase/migrations/0705_doc_seq_type_implement_desc_ar.sql'),
  'utf8',
);

const EXPECTED_CODE_TYPES = [
  'ORDER', 'ORDER_ITEM', 'ORDER_PIECE', 'STORE_CREDIT_NOTE', 'FIN_JOURNAL', 'AR_INVOICE', 'REFUND',
  'TAX_INVOICE', 'TAX_SIMPLIFIED', 'TAX_CREDIT_NOTE', 'TAX_DEBIT_NOTE', 'RECEIPT_VOUCHER',
  'PAYMENT_VOUCHER', 'REFUND_VOUCHER', 'ADJUSTMENT_VOUCHER', 'TRANSFER_VOUCHER', 'VOUCHER_OTHER',
  'LEGACY_VOUCHER', 'POS_SESSION', 'POS_Z_REPORT', 'CASH_DRAWER_SESSION', 'CASH_DRAWER_TRX',
  'CUSTOMER', 'USER', 'PRODUCT', 'STOCK_ITEM', 'GIFT_CARD', 'DELIVERY_ROUTE', 'B2B_CONTRACT',
  'B2B_STATEMENT', 'AR_DISPUTE', 'AR_DUNNING_RUN', 'AR_RECON_RUN', 'ERP_EXPENSE',
  'ERP_PETTY_CASHBOX', 'ERP_PETTY_CASH_TXN', 'ERP_PETTY_CASH_RECON', 'ERP_SUPPLIER', 'ERP_PO',
  'ERP_AP_INVOICE', 'ERP_AP_PAYMENT', 'ERP_BANK_ACCOUNT', 'ERP_BANK_STATEMENT', 'ERP_BANK_RECON',
  'ERP_ALLOC_RULE', 'ERP_ALLOC_RUN', 'ERP_COST_COMPONENT', 'ERP_COST_RUN', 'HQ_SAAS_INVOICE',
  'HQ_MARKETING_LEAD', 'STOCK_TRANSACTION',
] as const;

describe('Arabic document-code implementation-description migration', () => {
  it('provides one explicit Arabic guide for each registered code type', () => {
    const translatedCodes = [...migration.matchAll(/\('([A-Z0-9_]+)', \$ar\$/g)].map((match) => match[1]);

    expect(translatedCodes).toHaveLength(EXPECTED_CODE_TYPES.length);
    expect(new Set(translatedCodes)).toEqual(new Set(EXPECTED_CODE_TYPES));
    expect(migration).not.toMatch(/WHEN manage_by_level =/);
  });

  it('keeps the current engine details for the code types migrated after the registry seed', () => {
    expect(migration).toContain('fn_doc_seq_next للمنشأة ORD');
    expect(migration).toContain('trg_fin_cn_no_assign');
    expect(migration).toContain('trg_inv_stock_no_assign');
    expect(migration).toContain('uq_inv_stock_tr_no');
  });

  it('requires a nonblank Arabic description after the complete backfill', () => {
    expect(migration).toMatch(/ALTER COLUMN implement_description2 SET NOT NULL/);
    expect(migration).toMatch(/CHECK \(btrim\(implement_description2\) <> ''\)/);
  });
});
