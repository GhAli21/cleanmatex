jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

jest.mock('@/lib/services/erp-lite-expenses.service', () => ({
  ErpLiteExpensesService: {
    createExpense: jest.fn(),
    createCashbox: jest.fn(),
    createCashTransaction: jest.fn(),
  },
}));

import { revalidatePath } from 'next/cache';
import {
  createErpLiteCashTxnAction,
  createErpLiteCashboxAction,
  createErpLiteExpenseAction,
} from '@/app/actions/erp-lite/expenses-actions';
import { ErpLiteExpensesService } from '@/lib/services/erp-lite-expenses.service';

const mockCreateExpense = ErpLiteExpensesService.createExpense as jest.Mock;
const mockCreateCashbox = ErpLiteExpensesService.createCashbox as jest.Mock;
const mockCreateCashTransaction = ErpLiteExpensesService.createCashTransaction as jest.Mock;
const mockRevalidatePath = revalidatePath as jest.Mock;

function buildFormData(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe('ERP-Lite expenses actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects expense creation success with the created notice', async () => {
    mockCreateExpense.mockResolvedValue({
      posting_status: 'executed',
      posting_success: true,
    });

    await expect(
      createErpLiteExpenseAction(
        buildFormData({
          expense_date: '2026-03-31',
          currency_code: 'OMR',
          subtotal_amount: '12',
          settlement_code: 'CASH',
        })
      )
    ).rejects.toThrow('REDIRECT:/dashboard/erp-lite/expenses?notice=expense-created');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/erp-lite/expenses');
  });

  it('redirects cashbox creation errors to the expense screen', async () => {
    mockCreateCashbox.mockRejectedValue(new Error('Selected account is not an active petty cash account for this tenant'));

    await expect(
      createErpLiteCashboxAction(
        buildFormData({
          account_id: 'acct-1',
          name: 'Main cashbox',
          currency_code: 'OMR',
        })
      )
    ).rejects.toThrow(
      'REDIRECT:/dashboard/erp-lite/expenses?error=Selected+account+is+not+an+active+petty+cash+account+for+this+tenant'
    );

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('redirects petty cash posting skips with the skipped notice', async () => {
    mockCreateCashTransaction.mockResolvedValue({
      posting_status: 'skipped',
      skip_reason: 'POLICY_DISABLED',
    });

    await expect(
      createErpLiteCashTxnAction(
        buildFormData({
          cashbox_id: 'cashbox-1',
          txn_type_code: 'TOPUP',
          txn_date: '2026-03-31',
          currency_code: 'OMR',
          amount_total: '8',
        })
      )
    ).rejects.toThrow('REDIRECT:/dashboard/erp-lite/expenses?notice=cash-txn-post-skipped');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/erp-lite/expenses');
  });
});
