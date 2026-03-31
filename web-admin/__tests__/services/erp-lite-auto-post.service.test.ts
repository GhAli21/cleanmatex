jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
  },
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) =>
    fn('tenant-123')
  ),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { ERP_LITE_TXN_EVENT_CODES } from '@/lib/constants/erp-lite-posting';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';

describe('ErpLiteAutoPostService', () => {
  it('builds invoice posting request from invoice totals', () => {
    const request = ErpLiteAutoPostService.buildInvoicePostingRequest(
      {
        invoice_id: '11111111-1111-1111-1111-111111111111',
        invoice_no: 'INV-202603-00001',
        order_id: '22222222-2222-2222-2222-222222222222',
        branch_id: '33333333-3333-3333-3333-333333333333',
        currency_code: 'OMR',
        exchange_rate: 1,
        invoice_date: '2026-03-29',
        subtotal: 10,
        discount_amount: 1,
        tax_amount: 0.4,
        vat_amount: 0.6,
        total_amount: 10,
        created_by: 'tester',
      },
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );

    expect(request.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.ORDER_INVOICED);
    expect(request.amounts.net_amount).toBe(9);
    expect(request.amounts.tax_amount).toBe(1);
    expect(request.amounts.gross_amount).toBe(10);
    expect(request.meta?.source_context).toBe('invoice_created');
  });

  it('maps order payment methods to settlement event codes', () => {
    expect(
      ErpLiteAutoPostService.resolvePaymentTxnEventCode({
        order_id: 'order-1',
        payment_method_code: PAYMENT_METHODS.CASH,
      })
    ).toBe(ERP_LITE_TXN_EVENT_CODES.ORDER_SETTLED_CASH);

    expect(
      ErpLiteAutoPostService.resolvePaymentTxnEventCode({
        order_id: 'order-1',
        payment_method_code: PAYMENT_METHODS.CARD,
      })
    ).toBe(ERP_LITE_TXN_EVENT_CODES.ORDER_SETTLED_CARD);

    expect(
      ErpLiteAutoPostService.resolvePaymentTxnEventCode({
        order_id: undefined,
        payment_method_code: PAYMENT_METHODS.CARD,
      })
    ).toBe(ERP_LITE_TXN_EVENT_CODES.PAYMENT_RECEIVED);
  });

  it('builds refund posting request using refund event and tax split', () => {
    const request = ErpLiteAutoPostService.buildRefundPostingRequest(
      {
        refund_payment_id: '44444444-4444-4444-4444-444444444444',
        original_payment_id: '55555555-5555-5555-5555-555555555555',
        invoice_id: '66666666-6666-6666-6666-666666666666',
        order_id: '77777777-7777-7777-7777-777777777777',
        branch_id: '88888888-8888-8888-8888-888888888888',
        currency_code: 'OMR',
        refund_date: '2026-03-29',
        payment_method_code: PAYMENT_METHODS.CARD,
        refund_amount: 12,
        tax_amount: 0.5,
        vat_amount: 1.5,
        created_by: 'tester',
      },
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );

    expect(request.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.REFUND_ISSUED);
    expect(request.amounts.net_amount).toBe(10);
    expect(request.amounts.tax_amount).toBe(2);
    expect(request.amounts.gross_amount).toBe(12);
    expect(request.meta?.source_context).toContain('refund_of:');
  });

  it('builds expense posting request using settlement-based payment context', () => {
    const cashRequest = ErpLiteAutoPostService.buildExpensePostingRequest(
      {
        expense_id: '11111111-1111-1111-1111-111111111111',
        expense_no: 'EXP-202603-00001',
        branch_id: '22222222-2222-2222-2222-222222222222',
        currency_code: 'OMR',
        exchange_rate: 1,
        expense_date: '2026-03-31',
        subtotal_amount: 5,
        tax_amount: 0.5,
        total_amount: 5.5,
        settlement_code: 'CASH',
        created_by: 'tester',
      },
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );

    const bankRequest = ErpLiteAutoPostService.buildExpensePostingRequest(
      {
        expense_id: '33333333-3333-3333-3333-333333333333',
        expense_no: 'EXP-202603-00002',
        branch_id: null,
        currency_code: 'OMR',
        expense_date: '2026-03-31',
        subtotal_amount: 12,
        tax_amount: 0,
        total_amount: 12,
        settlement_code: 'BANK',
      },
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );

    expect(cashRequest.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.EXPENSE_RECORDED);
    expect(cashRequest.amounts.gross_amount).toBe(5.5);
    expect(cashRequest.meta?.payment_method_code).toBe(PAYMENT_METHODS.CASH);
    expect(bankRequest.meta?.payment_method_code).toBe(PAYMENT_METHODS.BANK_TRANSFER);
  });

  it('builds petty cash posting request for top-up and spend events', () => {
    const topupRequest = ErpLiteAutoPostService.buildPettyCashPostingRequest(
      {
        cash_txn_id: '44444444-4444-4444-4444-444444444444',
        txn_no: 'PCT-202603-00001',
        cashbox_id: '55555555-5555-5555-5555-555555555555',
        branch_id: '66666666-6666-6666-6666-666666666666',
        currency_code: 'OMR',
        txn_date: '2026-03-31',
        amount_total: 9.75,
        txn_type_code: 'TOPUP',
      },
      'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );

    const spendRequest = ErpLiteAutoPostService.buildPettyCashPostingRequest(
      {
        cash_txn_id: '77777777-7777-7777-7777-777777777777',
        txn_no: 'PCT-202603-00002',
        cashbox_id: '88888888-8888-8888-8888-888888888888',
        branch_id: null,
        currency_code: 'OMR',
        txn_date: '2026-03-31',
        amount_total: 4.25,
        txn_type_code: 'SPEND',
      },
      'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );

    expect(topupRequest.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.PETTY_CASH_TOPUP);
    expect(spendRequest.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.PETTY_CASH_SPENT);
    expect(topupRequest.amounts.gross_amount).toBe(9.75);
    expect(spendRequest.amounts.gross_amount).toBe(4.25);
    expect(spendRequest.meta?.source_context).toContain('petty_cash:spend:');
  });
});
