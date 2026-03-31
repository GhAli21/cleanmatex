jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) =>
    fn('tenant-123')
  ),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'user-1' },
        },
      }),
    },
  }),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: jest.fn().mockResolvedValue({
      currencyCode: 'OMR',
    }),
  })),
}));

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn().mockResolvedValue(
    (key: string, params?: Record<string, string>) => `${key}:${params ? JSON.stringify(params) : ''}`
  ),
}));

jest.mock('@/lib/services/payment-audit.service', () => ({
  recordPaymentAudit: jest.fn().mockResolvedValue(undefined),
  paymentSnapshot: jest.fn((value: unknown) => value),
}));

jest.mock('@/lib/services/voucher-service', () => ({
  createReceiptVoucherForPayment: jest.fn().mockResolvedValue({
    voucher_id: 'voucher-1',
  }),
}));

jest.mock('@/lib/services/refund-voucher-service', () => ({
  createRefundVoucherForPayment: jest.fn().mockResolvedValue({
    voucher_id: 'refund-voucher-1',
  }),
}));

jest.mock('@/lib/services/erp-lite-auto-post.service', () => ({
  ErpLiteAutoPostService: {
    dispatchPaymentReceived: jest.fn(),
    dispatchPaymentReceivedInTransaction: jest.fn(),
    dispatchRefundIssued: jest.fn(),
    dispatchRefundIssuedInTransaction: jest.fn(),
    dispatchInvoiceCreated: jest.fn(),
    dispatchInvoiceCreatedInTransaction: jest.fn(),
  },
}));

const mockPaymentMethodFindUnique = jest.fn();
const mockInvoiceFindUnique = jest.fn();
const mockOrderFindUnique = jest.fn();
const mockInvoiceUpdate = jest.fn();
const mockOrderUpdate = jest.fn();
const mockPaymentCreate = jest.fn();
const mockPaymentFindFirst = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockPaymentRefundCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_payment_method_cd: {
      findUnique: (...args: unknown[]) => mockPaymentMethodFindUnique(...args),
    },
    org_invoice_mst: {
      findUnique: (...args: unknown[]) => mockInvoiceFindUnique(...args),
      update: (...args: unknown[]) => mockInvoiceUpdate(...args),
    },
    org_orders_mst: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
    org_payments_dtl_tr: {
      findFirst: (...args: unknown[]) => mockPaymentFindFirst(...args),
      findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
      create: (...args: unknown[]) => mockPaymentRefundCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { processPayment, refundPayment } from '@/lib/services/payment-service';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';

const mockDispatchPaymentReceived =
  ErpLiteAutoPostService.dispatchPaymentReceived as jest.Mock;
const mockDispatchPaymentReceivedInTransaction =
  ErpLiteAutoPostService.dispatchPaymentReceivedInTransaction as jest.Mock;
const mockDispatchRefundIssued =
  ErpLiteAutoPostService.dispatchRefundIssued as jest.Mock;
const mockDispatchRefundIssuedInTransaction =
  ErpLiteAutoPostService.dispatchRefundIssuedInTransaction as jest.Mock;

describe('payment-service ERP-Lite auto-post integration', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockPaymentMethodFindUnique.mockResolvedValue({
      payment_method_code: PAYMENT_METHODS.CASH,
      is_enabled: true,
      is_active: true,
    });

    mockInvoiceFindUnique.mockResolvedValue({
      id: 'invoice-1',
      branch_id: 'branch-1',
      total: 20,
      paid_amount: 0,
      metadata: {},
      currency_code: 'OMR',
      currency_ex_rate: 1,
    });

    mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        org_orders_mst: {
          findUnique: mockOrderFindUnique,
          update: mockOrderUpdate,
        },
        org_invoice_mst: {
          update: mockInvoiceUpdate,
          findUnique: mockInvoiceFindUnique,
        },
        org_payments_dtl_tr: {
          create: mockPaymentCreate,
          findFirst: mockPaymentFindFirst,
          findMany: mockPaymentFindMany,
        },
      })
    );

    mockPaymentCreate.mockResolvedValue({
      id: 'payment-1',
      invoice_id: 'invoice-1',
      voucher_id: 'voucher-1',
      tenant_org_id: 'tenant-123',
      branch_id: 'branch-1',
      order_id: null,
      customer_id: 'customer-1',
      currency_code: 'OMR',
      paid_amount: 10,
      status: 'completed',
      payment_method_code: PAYMENT_METHODS.CASH,
      payment_type_code: null,
      tax_amount: 0,
      vat_amount: 0,
      paid_at: new Date('2026-03-29T00:00:00.000Z'),
      paid_by: 'user-1',
      gateway: null,
      transaction_id: null,
      metadata: {},
      rec_notes: null,
      trans_desc: 'payment',
      created_at: new Date('2026-03-29T00:00:00.000Z'),
      created_by: 'user-1',
      updated_at: null,
      updated_by: null,
    });

    mockPaymentFindFirst.mockResolvedValue({
      id: 'payment-1',
      tenant_org_id: 'tenant-123',
      branch_id: 'branch-1',
      invoice_id: 'invoice-1',
      order_id: null,
      customer_id: 'customer-1',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      paid_amount: 10,
      payment_method_code: PAYMENT_METHODS.CASH,
      payment_type_code: null,
      tax_amount: 0,
      vat_amount: 0,
      status: 'completed',
      gateway: null,
    });

    mockPaymentFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('keeps a direct payment when blocking auto-post succeeds', async () => {
    mockDispatchPaymentReceivedInTransaction.mockResolvedValue({
      status: 'executed',
      txn_event_code: 'PAYMENT_RECEIVED',
      request: {},
      policy: {
        blocking_mode: 'BLOCKING',
        required_success: true,
      },
      execute_result: {
        success: true,
      },
    });

    const result = await processPayment({
      invoice_id: 'invoice-1',
      customer_id: 'customer-1',
      payment_method_code: PAYMENT_METHODS.CASH,
      amount: 10,
      processed_by: 'user-1',
      currency_code: 'OMR',
    });

    expect(result.success).toBe(true);
    expect(result.transaction_id).toBe('payment-1');
    expect(mockDispatchPaymentReceivedInTransaction).toHaveBeenCalledTimes(1);
    expect(mockDispatchPaymentReceived).not.toHaveBeenCalled();
  });

  it('fails refund completion when blocking auto-post fails', async () => {
    mockDispatchRefundIssuedInTransaction.mockResolvedValue({
      status: 'executed',
      txn_event_code: 'REFUND_ISSUED',
      request: {},
      policy: {
        blocking_mode: 'BLOCKING',
        required_success: true,
      },
      execute_result: {
        success: false,
        error_message: 'Refund posting failed',
      },
    });

    mockPaymentRefundCreate.mockResolvedValue({
      id: 'refund-1',
      branch_id: 'branch-1',
      invoice_id: 'invoice-1',
      order_id: null,
      customer_id: 'customer-1',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      payment_method_code: PAYMENT_METHODS.CASH,
      payment_type_code: null,
      tax_amount: 0,
      vat_amount: 0,
    });

    const result = await refundPayment({
      transaction_id: 'payment-1',
      amount: 5,
      reason: 'customer request',
      processed_by: 'user-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Refund posting failed');
    expect(mockDispatchRefundIssuedInTransaction).toHaveBeenCalledTimes(1);
    expect(mockDispatchRefundIssued).not.toHaveBeenCalled();
  });
});
