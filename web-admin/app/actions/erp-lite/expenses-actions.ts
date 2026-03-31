'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErpLiteExpensesService } from '@/lib/services/erp-lite-expenses.service';

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

function redirectExpenses(notice?: string, error?: string) {
  const params = new URLSearchParams();
  if (notice) params.set('notice', notice);
  if (error) params.set('error', error);
  const suffix = params.toString();
  redirect(`/dashboard/erp-lite/expenses${suffix ? `?${suffix}` : ''}`);
}

export async function createErpLiteExpenseAction(formData: FormData) {
  try {
    const result = await ErpLiteExpensesService.createExpense({
      branch_id: getOptionalString(formData, 'branch_id'),
      expense_date: getRequiredString(formData, 'expense_date'),
      currency_code: getRequiredString(formData, 'currency_code'),
      subtotal_amount: getRequiredNumber(formData, 'subtotal_amount'),
      tax_amount: Number(getOptionalString(formData, 'tax_amount') ?? '0'),
      payee_name: getOptionalString(formData, 'payee_name'),
      description: getOptionalString(formData, 'description'),
      settlement_code: getRequiredString(formData, 'settlement_code') as 'CASH' | 'BANK',
    });

    revalidatePath('/dashboard/erp-lite/expenses');
    redirectExpenses(
      result.posting_status === 'executed' && result.posting_success === false
        ? 'expense-created-post-failed'
        : result.posting_status === 'skipped'
          ? 'expense-created-post-skipped'
          : 'expense-created'
    );
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'expense-create-failed');
  }
}

export async function createErpLiteCashboxAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.createCashbox({
      branch_id: getOptionalString(formData, 'branch_id'),
      account_id: getRequiredString(formData, 'account_id'),
      cashbox_code: getOptionalString(formData, 'cashbox_code'),
      name: getRequiredString(formData, 'name'),
      name2: getOptionalString(formData, 'name2'),
      currency_code: getRequiredString(formData, 'currency_code'),
      opening_balance: Number(getOptionalString(formData, 'opening_balance') ?? '0'),
    });

    revalidatePath('/dashboard/erp-lite/expenses');
    redirectExpenses('cashbox-created');
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cashbox-create-failed');
  }
}

export async function createErpLiteCashTxnAction(formData: FormData) {
  try {
    const result = await ErpLiteExpensesService.createCashTransaction({
      cashbox_id: getRequiredString(formData, 'cashbox_id'),
      txn_type_code: getRequiredString(formData, 'txn_type_code') as 'TOPUP' | 'SPEND',
      txn_date: getRequiredString(formData, 'txn_date'),
      currency_code: getRequiredString(formData, 'currency_code'),
      amount_total: getRequiredNumber(formData, 'amount_total'),
      description: getOptionalString(formData, 'description'),
    });

    revalidatePath('/dashboard/erp-lite/expenses');
    redirectExpenses(
      result.posting_status === 'executed' && result.posting_success === false
        ? 'cash-txn-post-failed'
        : result.posting_status === 'skipped'
          ? 'cash-txn-post-skipped'
          : 'cash-txn-created'
    );
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cash-txn-create-failed');
  }
}
