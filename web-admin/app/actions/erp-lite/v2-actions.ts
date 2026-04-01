'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErpLiteV2Service } from '@/lib/services/erp-lite-v2.service';

function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value.trim();
}

function getOptionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getRequiredNumber(formData: FormData, key: string): number {
  const raw = getRequiredString(formData, key);
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number field: ${key}`);
  }
  return value;
}

function parseOptionalNumber(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null;
  const value = Number(raw.trim());
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number value: ${raw}`);
  }
  return value;
}

function parseBankStatementImportRows(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Missing required field: import_rows');
  }

  return lines.map((line, index) => {
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length < 5 || parts.length > 7) {
      throw new Error(
        `Invalid bank statement import row ${index + 1}. Expected 5 to 7 pipe-separated columns`
      );
    }

    return {
      txn_date: parts[0],
      ext_ref_no: parts[1] || null,
      description: parts[2] || null,
      debit_amount: parseOptionalNumber(parts[3]),
      credit_amount: parseOptionalNumber(parts[4]),
      value_date: parts[5] || null,
      balance_amount: parseOptionalNumber(parts[6] ?? null),
    };
  });
}

function redirectWithParams(path: string, notice?: string, error?: string) {
  const params = new URLSearchParams();
  if (notice) params.set('notice', notice);
  if (error) params.set('error', error);
  const suffix = params.toString();
  redirect(`${path}${suffix ? `?${suffix}` : ''}`);
}

function isFrameworkRedirect(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export async function createErpLiteSupplierAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createSupplier({
      branch_id: getOptionalString(formData, 'branch_id'),
      payable_acct_id: getOptionalString(formData, 'payable_acct_id'),
      supplier_code: getOptionalString(formData, 'supplier_code'),
      name: getRequiredString(formData, 'name'),
      name2: getOptionalString(formData, 'name2'),
      email: getOptionalString(formData, 'email'),
      phone: getOptionalString(formData, 'phone'),
      payment_terms_days: Number(getOptionalString(formData, 'payment_terms_days') ?? '0'),
      currency_code: getRequiredString(formData, 'currency_code'),
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/ap', undefined, error instanceof Error ? error.message : 'supplier-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/ap');
  redirectWithParams('/dashboard/erp-lite/ap', 'supplier-created');
}

export async function createErpLiteApInvoiceAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createApInvoice({
      supplier_id: getRequiredString(formData, 'supplier_id'),
      branch_id: getOptionalString(formData, 'branch_id'),
      po_id: getOptionalString(formData, 'po_id'),
      invoice_date: getRequiredString(formData, 'invoice_date'),
      due_date: getOptionalString(formData, 'due_date'),
      currency_code: getRequiredString(formData, 'currency_code'),
      subtotal_amount: getRequiredNumber(formData, 'subtotal_amount'),
      tax_amount: Number(getOptionalString(formData, 'tax_amount') ?? '0'),
      description: getRequiredString(formData, 'description'),
      description2: getOptionalString(formData, 'description2'),
      usage_code_id: getOptionalString(formData, 'usage_code_id'),
      supplier_inv_no: getOptionalString(formData, 'supplier_inv_no'),
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/ap', undefined, error instanceof Error ? error.message : 'ap-invoice-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/ap');
  redirectWithParams('/dashboard/erp-lite/ap', 'ap-invoice-created');
}

export async function createErpLiteApPaymentAction(formData: FormData) {
  try {
    const settlementCode = getRequiredString(formData, 'settlement_code') as 'BANK' | 'CASH';
    await ErpLiteV2Service.createApPayment({
      supplier_id: getRequiredString(formData, 'supplier_id'),
      ap_invoice_id: getRequiredString(formData, 'ap_invoice_id'),
      branch_id: getOptionalString(formData, 'branch_id'),
      bank_account_id: getOptionalString(formData, 'bank_account_id'),
      cashbox_id: getOptionalString(formData, 'cashbox_id'),
      payment_date: getRequiredString(formData, 'payment_date'),
      currency_code: getRequiredString(formData, 'currency_code'),
      amount_total: getRequiredNumber(formData, 'amount_total'),
      settlement_code: settlementCode,
      payment_method_code: getOptionalString(formData, 'payment_method_code'),
      ext_ref_no: getOptionalString(formData, 'ext_ref_no'),
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/ap', undefined, error instanceof Error ? error.message : 'ap-payment-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/ap');
  redirectWithParams('/dashboard/erp-lite/ap', 'ap-payment-created');
}

export async function createErpLitePurchaseOrderAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createPurchaseOrder({
      supplier_id: getRequiredString(formData, 'supplier_id'),
      branch_id: getOptionalString(formData, 'branch_id'),
      po_date: getRequiredString(formData, 'po_date'),
      expected_date: getOptionalString(formData, 'expected_date'),
      currency_code: getRequiredString(formData, 'currency_code'),
      subtotal_amount: getRequiredNumber(formData, 'subtotal_amount'),
      tax_amount: Number(getOptionalString(formData, 'tax_amount') ?? '0'),
      description: getRequiredString(formData, 'description'),
      description2: getOptionalString(formData, 'description2'),
      usage_code_id: getOptionalString(formData, 'usage_code_id'),
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/po', undefined, error instanceof Error ? error.message : 'po-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/po');
  redirectWithParams('/dashboard/erp-lite/po', 'po-created');
}

export async function createErpLiteBankAccountAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createBankAccount({
      branch_id: getOptionalString(formData, 'branch_id'),
      account_id: getRequiredString(formData, 'account_id'),
      bank_code: getOptionalString(formData, 'bank_code'),
      name: getRequiredString(formData, 'name'),
      name2: getOptionalString(formData, 'name2'),
      bank_name: getOptionalString(formData, 'bank_name'),
      bank_name2: getOptionalString(formData, 'bank_name2'),
      bank_account_no: getRequiredString(formData, 'bank_account_no'),
      iban_no: getOptionalString(formData, 'iban_no'),
      currency_code: getRequiredString(formData, 'currency_code'),
      stmt_import_mode: (getOptionalString(formData, 'stmt_import_mode') ?? 'CSV') as 'CSV' | 'MANUAL' | 'API',
      match_mode: (getOptionalString(formData, 'match_mode') ?? 'STRICT') as 'STRICT' | 'ASSISTED',
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-account-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-account-created');
}

export async function createErpLiteBankStatementAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createBankStatement({
      bank_account_id: getRequiredString(formData, 'bank_account_id'),
      stmt_date_from: getRequiredString(formData, 'stmt_date_from'),
      stmt_date_to: getRequiredString(formData, 'stmt_date_to'),
      source_file_name: getOptionalString(formData, 'source_file_name'),
      opening_balance: getOptionalString(formData, 'opening_balance')
        ? getRequiredNumber(formData, 'opening_balance')
        : null,
      closing_balance: getOptionalString(formData, 'closing_balance')
        ? getRequiredNumber(formData, 'closing_balance')
        : null,
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-statement-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-statement-created');
}

export async function createErpLiteBankStatementLineAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createBankStatementLine({
      bank_stmt_id: getRequiredString(formData, 'bank_stmt_id'),
      bank_account_id: getRequiredString(formData, 'bank_account_id'),
      txn_date: getRequiredString(formData, 'txn_date'),
      value_date: getOptionalString(formData, 'value_date'),
      ext_ref_no: getOptionalString(formData, 'ext_ref_no'),
      description: getOptionalString(formData, 'description'),
      debit_amount: getOptionalString(formData, 'debit_amount')
        ? getRequiredNumber(formData, 'debit_amount')
        : null,
      credit_amount: getOptionalString(formData, 'credit_amount')
        ? getRequiredNumber(formData, 'credit_amount')
        : null,
      balance_amount: getOptionalString(formData, 'balance_amount')
        ? getRequiredNumber(formData, 'balance_amount')
        : null,
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-statement-line-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-statement-line-created');
}

export async function importErpLiteBankStatementLinesAction(formData: FormData) {
  try {
    await ErpLiteV2Service.importBankStatementLines({
      bank_stmt_id: getRequiredString(formData, 'bank_stmt_id'),
      rows: parseBankStatementImportRows(getRequiredString(formData, 'import_rows')),
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-statement-import-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-statement-imported');
}

export async function createErpLiteBankReconAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createBankRecon({
      bank_account_id: getRequiredString(formData, 'bank_account_id'),
      period_id: getOptionalString(formData, 'period_id'),
      recon_date: getRequiredString(formData, 'recon_date'),
      stmt_date_from: getRequiredString(formData, 'stmt_date_from'),
      stmt_date_to: getRequiredString(formData, 'stmt_date_to'),
      gl_balance: getOptionalString(formData, 'gl_balance')
        ? getRequiredNumber(formData, 'gl_balance')
        : null,
      stmt_balance: getOptionalString(formData, 'stmt_balance')
        ? getRequiredNumber(formData, 'stmt_balance')
        : null,
      unmatched_amount: getOptionalString(formData, 'unmatched_amount')
        ? getRequiredNumber(formData, 'unmatched_amount')
        : null,
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-recon-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-recon-created');
}

export async function createErpLiteBankMatchAction(formData: FormData) {
  try {
    await ErpLiteV2Service.createBankMatch({
      bank_stmt_line_id: getRequiredString(formData, 'bank_stmt_line_id'),
      bank_recon_id: getOptionalString(formData, 'bank_recon_id'),
      ap_payment_id: getRequiredString(formData, 'ap_payment_id'),
      match_amount: getRequiredNumber(formData, 'match_amount'),
    });
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-match-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-match-created');
}

export async function closeErpLiteBankReconAction(formData: FormData) {
  try {
    await ErpLiteV2Service.closeBankRecon(getRequiredString(formData, 'bank_recon_id'));
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-recon-close-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-recon-closed');
}

export async function lockErpLiteBankReconAction(formData: FormData) {
  try {
    await ErpLiteV2Service.lockBankRecon(getRequiredString(formData, 'bank_recon_id'));
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-recon-lock-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-recon-locked');
}

export async function reverseErpLiteBankMatchAction(formData: FormData) {
  try {
    await ErpLiteV2Service.reverseBankMatch(getRequiredString(formData, 'bank_match_id'));
  } catch (error) {
    if (isFrameworkRedirect(error)) throw error;
    redirectWithParams('/dashboard/erp-lite/bank-recon', undefined, error instanceof Error ? error.message : 'bank-match-reverse-failed');
  }

  revalidatePath('/dashboard/erp-lite/bank-recon');
  redirectWithParams('/dashboard/erp-lite/bank-recon', 'bank-match-reversed');
}
