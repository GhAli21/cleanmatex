const mockOrderFindMany = jest.fn();
const mockInvoiceCreate = jest.fn();
const mockTransaction = jest.fn();
const mockIdempotencyFindFirst = jest.fn();
const mockIdempotencyUpsert = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/outbox.service', () => ({
  emitEventTx: jest.fn(),
}));

import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { createArInvoiceFromOrders } from '@/lib/services/ar-invoice.service';

describe('ar-invoice.service createArInvoiceFromOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        org_idempotency_keys: {
          findFirst: mockIdempotencyFindFirst,
          upsert: mockIdempotencyUpsert,
        },
        org_orders_mst: {
          findMany: mockOrderFindMany,
        },
        org_invoice_mst: {
          create: mockInvoiceCreate,
        },
      })
    );

    mockIdempotencyFindFirst.mockResolvedValue(null);
    mockIdempotencyUpsert.mockResolvedValue(null);
  });

  it('rejects PAY_ON_COLLECTION orders before AR invoice creation starts', async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        id: 'order-1',
        order_no: 'ORD-1001',
        customer_id: 'customer-1',
        branch_id: 'branch-1',
        total: 22,
        paid_amount: 0,
        outstanding_amount: 22,
        currency_code: 'OMR',
        currency_ex_rate: 1,
        payment_type_code: SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION,
        payment_due_date: new Date('2026-05-22T00:00:00.000Z'),
        payment_terms: 'Due on collection',
        b2b_contract_id: null,
        cost_center_code: null,
        po_number: null,
      },
    ]);

    await expect(
      createArInvoiceFromOrders(
        {
          order_ids: ['11111111-1111-1111-1111-111111111111'],
          idempotency_key: 'from-orders-1',
        },
        { tenantId: 'tenant-123', userId: 'user-123' }
      )
    ).rejects.toThrow('PAY_ON_COLLECTION orders cannot generate an AR invoice.');

    expect(mockInvoiceCreate).not.toHaveBeenCalled();
    expect(mockIdempotencyUpsert).not.toHaveBeenCalled();
  });
});
