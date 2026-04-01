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
  let notice: string;
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

    notice =
      result.posting_status === 'executed' && result.posting_success === false
        ? 'expense-created-post-failed'
        : result.posting_status === 'skipped'
          ? 'expense-created-post-skipped'
          : 'expense-created';
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'expense-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses(notice);
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

  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cashbox-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('cashbox-created');
}

export async function createErpLiteCashTxnAction(formData: FormData) {
  let notice: string;
  try {
    const result = await ErpLiteExpensesService.createCashTransaction({
      cashbox_id: getRequiredString(formData, 'cashbox_id'),
      txn_type_code: getRequiredString(formData, 'txn_type_code') as 'TOPUP' | 'SPEND',
      txn_date: getRequiredString(formData, 'txn_date'),
      currency_code: getRequiredString(formData, 'currency_code'),
      amount_total: getRequiredNumber(formData, 'amount_total'),
      description: getOptionalString(formData, 'description'),
    });

    notice =
      result.posting_status === 'executed' && result.posting_success === false
        ? 'cash-txn-post-failed'
        : result.posting_status === 'skipped'
          ? 'cash-txn-post-skipped'
          : 'cash-txn-created';
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cash-txn-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses(notice);
}

export async function createErpLiteApprovalRequestAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.createApprovalRequest({
      source_doc_type: getRequiredString(formData, 'source_doc_type') as 'EXPENSE' | 'CASH_TXN',
      source_doc_id: getRequiredString(formData, 'source_doc_id'),
      action_note: getOptionalString(formData, 'action_note'),
    });
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'approval-request-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('approval-request-created');
}

export async function approveErpLiteApprovalAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.processApproval({
      approval_id: getRequiredString(formData, 'approval_id'),
      decision: 'APPROVED',
      action_note: getOptionalString(formData, 'action_note'),
    });
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'approval-process-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('approval-approved');
}

export async function rejectErpLiteApprovalAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.processApproval({
      approval_id: getRequiredString(formData, 'approval_id'),
      decision: 'REJECTED',
      action_note: getOptionalString(formData, 'action_note'),
    });
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'approval-process-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('approval-rejected');
}

export async function createErpLiteCashReconciliationAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.createCashReconciliation({
      cashbox_id: getRequiredString(formData, 'cashbox_id'),
      recon_date: getRequiredString(formData, 'recon_date'),
      counted_balance: getRequiredNumber(formData, 'counted_balance'),
      note: getOptionalString(formData, 'note'),
    });
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cash-recon-create-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('cash-recon-created');
}

export async function createErpLiteCashReconciliationExceptionAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.addCashReconciliationException({
      cash_recon_id: getRequiredString(formData, 'cash_recon_id'),
      reason_code: getRequiredString(formData, 'reason_code'),
      amount: getRequiredNumber(formData, 'amount'),
      note: getOptionalString(formData, 'note'),
    });
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cash-recon-exception-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('cash-recon-exception-created');
}

export async function closeErpLiteCashReconciliationAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.closeCashReconciliation(getRequiredString(formData, 'cash_recon_id'));
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cash-recon-close-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('cash-recon-closed');
}

export async function lockErpLiteCashReconciliationAction(formData: FormData) {
  try {
    await ErpLiteExpensesService.lockCashReconciliation(getRequiredString(formData, 'cash_recon_id'));
  } catch (error) {
    redirectExpenses(undefined, error instanceof Error ? error.message : 'cash-recon-lock-failed');
  }

  revalidatePath('/dashboard/erp-lite/expenses');
  redirectExpenses('cash-recon-locked');
}
