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

const mockCanAccess = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/services/feature-flags.service', () => {
  const actual = jest.requireActual<typeof import('@/lib/services/feature-flags.service')>(
    '@/lib/services/feature-flags.service'
  );
  return {
    ...actual,
    canAccess: (...args: Parameters<typeof actual.canAccess>) => mockCanAccess(...args),
  };
});

import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { ERP_LITE_TXN_EVENT_CODES } from '@/lib/constants/erp-lite-posting';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';

describe('ErpLiteAutoPostService', () => {
  beforeEach(() => {
    mockCanAccess.mockResolvedValue(true);
  });

  it('skips invoice auto-post when erp_lite_enabled feature flag is false', async () => {
    mockCanAccess.mockResolvedValueOnce(false);

    const result = await ErpLiteAutoPostService.dispatchInvoiceCreated({
      tenant_org_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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
    });

    expect(result.status).toBe('skipped');
    expect(result.skip_reason).toBe('FEATURE_NOT_ENABLED');
    expect(result.policy).toBeUndefined();
  });

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

  // ── B6 — payment/refund/gift-card/wallet/advance dispatch wiring ────────

  it('maps an ORDER_CREDIT_APPLICATION wallet settlement to ORDER_SETTLED_WALLET', () => {
    expect(
      ErpLiteAutoPostService.resolvePaymentTxnEventCode({
        order_id: 'order-1',
        payment_method_code: 'WALLET',
      })
    ).toBe(ERP_LITE_TXN_EVENT_CODES.ORDER_SETTLED_WALLET);
  });

  it('skips a payment-received dispatch (in-transaction) when erp_lite_enabled is false', async () => {
    mockCanAccess.mockResolvedValueOnce(false);

    const result = await ErpLiteAutoPostService.dispatchPaymentReceivedInTransaction(
      {} as never,
      {
        tenant_org_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        payment_id: '11111111-1111-1111-1111-111111111111',
        order_id: '22222222-2222-2222-2222-222222222222',
        currency_code: 'OMR',
        payment_date: '2026-07-24',
        payment_method_code: PAYMENT_METHODS.CASH,
        paid_amount: 25,
      }
    );

    expect(result.status).toBe('skipped');
    expect(result.skip_reason).toBe('FEATURE_NOT_ENABLED');
  });

  it('skips a refund-issued dispatch (in-transaction) when erp_lite_enabled is false', async () => {
    mockCanAccess.mockResolvedValueOnce(false);

    const result = await ErpLiteAutoPostService.dispatchRefundIssuedInTransaction(
      {} as never,
      {
        tenant_org_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        refund_payment_id: '33333333-3333-3333-3333-333333333333',
        original_payment_id: '44444444-4444-4444-4444-444444444444',
        currency_code: 'OMR',
        refund_date: '2026-07-24',
        payment_method_code: 'WALLET',
        refund_amount: 25,
      }
    );

    expect(result.status).toBe('skipped');
    expect(result.skip_reason).toBe('FEATURE_NOT_ENABLED');
  });

  it('skips a gift-card-sold dispatch (in-transaction) when erp_lite_enabled is false', async () => {
    mockCanAccess.mockResolvedValueOnce(false);

    const result = await ErpLiteAutoPostService.dispatchGiftCardSoldInTransaction(
      {} as never,
      {
        tenant_org_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        gift_card_id: '55555555-5555-5555-5555-555555555555',
        gift_card_code: 'GC-0001',
        issue_type: 'SOLD',
        amount: 50,
        currency_code: 'OMR',
        sold_date: '2026-07-24',
      }
    );

    expect(result.status).toBe('skipped');
    expect(result.skip_reason).toBe('FEATURE_NOT_ENABLED');
  });

  it('skips gift-card redeemed/expired/refunded/voided in-transaction dispatches when erp_lite_enabled is false', async () => {
    mockCanAccess.mockResolvedValue(false);
    const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const redeemed = await ErpLiteAutoPostService.dispatchGiftCardRedeemedInTransaction({} as never, {
      tenant_org_id: tenantId,
      gift_card_id: 'gc-1',
      txn_id: 'txn-1',
      amount: 10,
      currency_code: 'OMR',
      redeem_date: '2026-07-24',
    });
    const expired = await ErpLiteAutoPostService.dispatchGiftCardExpiredInTransaction({} as never, {
      tenant_org_id: tenantId,
      gift_card_id: 'gc-1',
      txn_id: 'txn-2',
      amount: 10,
      currency_code: 'OMR',
      expire_date: '2026-07-24',
    });
    const refunded = await ErpLiteAutoPostService.dispatchGiftCardRefundedInTransaction({} as never, {
      tenant_org_id: tenantId,
      gift_card_id: 'gc-1',
      txn_id: 'txn-3',
      amount: 10,
      currency_code: 'OMR',
      refund_date: '2026-07-24',
    });
    const voided = await ErpLiteAutoPostService.dispatchGiftCardVoidedInTransaction({} as never, {
      tenant_org_id: tenantId,
      gift_card_id: 'gc-1',
      txn_id: 'txn-4',
      amount: 10,
      currency_code: 'OMR',
      void_date: '2026-07-24',
    });

    for (const result of [redeemed, expired, refunded, voided]) {
      expect(result.status).toBe('skipped');
      expect(result.skip_reason).toBe('FEATURE_NOT_ENABLED');
    }
  });

  it('builds WALLET_TOPPED_UP posting request with the wallet liability event code', () => {
    const request = ErpLiteAutoPostService.buildWalletToppedUpPostingRequest(
      {
        voucher_id: '11111111-1111-1111-1111-111111111111',
        customer_id: '22222222-2222-2222-2222-222222222222',
        amount: 40,
        currency_code: 'OMR',
        funded_date: '2026-07-24',
        payment_method_code: PAYMENT_METHODS.CASH,
      },
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );

    expect(request.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.WALLET_TOPPED_UP);
    expect(request.amounts.gross_amount).toBe(40);
    expect(request.meta?.source_context).toBe('wallet_topped_up');
    expect(request.meta?.payment_method_code).toBe(PAYMENT_METHODS.CASH);
  });

  it('builds CUSTOMER_ADVANCE_RECEIVED posting request with the advance liability event code', () => {
    const request = ErpLiteAutoPostService.buildCustomerAdvanceReceivedPostingRequest(
      {
        voucher_id: '33333333-3333-3333-3333-333333333333',
        customer_id: '44444444-4444-4444-4444-444444444444',
        amount: 100,
        currency_code: 'OMR',
        funded_date: '2026-07-24',
        payment_method_code: PAYMENT_METHODS.BANK_TRANSFER,
      },
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );

    expect(request.txn_event_code).toBe(ERP_LITE_TXN_EVENT_CODES.CUSTOMER_ADVANCE_RECEIVED);
    expect(request.amounts.gross_amount).toBe(100);
    expect(request.meta?.source_context).toBe('customer_advance_received');
  });

  it('skips wallet-topped-up / customer-advance-received in-transaction dispatches when erp_lite_enabled is false', async () => {
    mockCanAccess.mockResolvedValue(false);
    const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const wallet = await ErpLiteAutoPostService.dispatchWalletToppedUpInTransaction({} as never, {
      tenant_org_id: tenantId,
      voucher_id: 'v-1',
      customer_id: 'c-1',
      amount: 20,
      currency_code: 'OMR',
      funded_date: '2026-07-24',
      payment_method_code: PAYMENT_METHODS.CASH,
    });
    const advance = await ErpLiteAutoPostService.dispatchCustomerAdvanceReceivedInTransaction({} as never, {
      tenant_org_id: tenantId,
      voucher_id: 'v-2',
      customer_id: 'c-2',
      amount: 20,
      currency_code: 'OMR',
      funded_date: '2026-07-24',
      payment_method_code: PAYMENT_METHODS.CASH,
    });

    expect(wallet.status).toBe('skipped');
    expect(advance.status).toBe('skipped');
  });
});
