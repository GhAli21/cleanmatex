const mockOrderFindUnique = jest.fn();
const mockInvoiceCreate = jest.fn();
const mockInvoiceCount = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
    org_invoice_mst: {
      create: (...args: unknown[]) => mockInvoiceCreate(...args),
      count: (...args: unknown[]) => mockInvoiceCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) =>
    fn('tenant-123')
  ),
}));

jest.mock('@/lib/services/erp-lite-auto-post.service', () => ({
  ErpLiteAutoPostService: {
    dispatchInvoiceCreated: jest.fn(),
    dispatchInvoiceCreatedInTransaction: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { createInvoice } from '@/lib/services/invoice-service';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';

const mockDispatchInvoiceCreatedInTransaction =
  ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction as jest.Mock;

describe('invoice-service createInvoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        org_orders_mst: {
          findUnique: mockOrderFindUnique,
        },
        org_invoice_mst: {
          create: mockInvoiceCreate,
          count: mockInvoiceCount,
        },
      })
    );
    mockInvoiceCount.mockResolvedValue(0);
    mockOrderFindUnique.mockResolvedValue({
      id: 'order-1',
      tenant_org_id: 'tenant-123',
      branch_id: 'branch-1',
      customer_id: 'customer-1',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      payment_terms: null,
      service_charge: null,
      service_charge_type: null,
      gift_card_id: null,
      gift_card_discount_amount: null,
      tax_rate: null,
      vat_rate: null,
      vat_amount: 0,
      b2b_contract_id: null,
      cost_center_code: null,
      po_number: null,
      org_order_items_dtl: [],
      org_customers_mst: null,
    });
    mockInvoiceCreate.mockResolvedValue({
      id: 'invoice-1',
      order_id: 'order-1',
      customer_id: 'customer-1',
      tenant_org_id: 'tenant-123',
      branch_id: 'branch-1',
      invoice_no: 'INV-202603-00001',
      invoice_date: new Date('2026-03-29T00:00:00.000Z'),
      subtotal: 10,
      discount: 1,
      tax: 0.5,
      vat_amount: 0.5,
      total: 10,
      status: 'pending',
      due_date: null,
      payment_terms: null,
      payment_method_code: null,
      paid_amount: 0,
      paid_at: null,
      paid_by: null,
      metadata: null,
      rec_notes: null,
      currency_code: 'OMR',
      currency_ex_rate: 1,
      created_at: new Date('2026-03-29T00:00:00.000Z'),
      created_by: null,
      updated_at: null,
      updated_by: null,
      tax_rate: null,
      vat_rate: null,
      discount_rate: null,
      service_charge: null,
      service_charge_type: null,
      promo_discount_amount: null,
      gift_card_discount_amount: null,
      paid_by_name: null,
      handed_to_name: null,
      handed_to_mobile_no: null,
      handed_to_date: null,
      handed_to_by_user: null,
      trans_desc: null,
      customer_reference: null,
      rec_status: 1,
      is_active: true,
    });
  });

  it('creates an invoice and keeps it when blocking auto-post succeeds', async () => {
    mockDispatchInvoiceCreatedInTransaction.mockResolvedValue({
      status: 'executed',
      txn_event_code: 'ORDER_INVOICED',
      request: {},
      policy: {
        blocking_mode: 'BLOCKING',
        required_success: true,
      },
      execute_result: {
        success: true,
      },
    });

    const result = await createInvoice({
      order_id: 'order-1',
      subtotal: 10,
      discount: 1,
      tax: 0.5,
      vatAmount: 0.5,
    });

    expect(result.id).toBe('invoice-1');
    expect(mockDispatchInvoiceCreatedInTransaction).toHaveBeenCalledTimes(1);
  });

  it('fails invoice creation when blocking auto-post fails', async () => {
    mockDispatchInvoiceCreatedInTransaction.mockResolvedValue({
      status: 'executed',
      txn_event_code: 'ORDER_INVOICED',
      request: {},
      policy: {
        blocking_mode: 'BLOCKING',
        required_success: true,
      },
      execute_result: {
        success: false,
        error_message: 'Posting failed',
      },
    });

    await expect(
      createInvoice({
        order_id: 'order-1',
        subtotal: 10,
        discount: 1,
        tax: 0.5,
        vatAmount: 0.5,
      })
    ).rejects.toThrow('Posting failed');
  });
});
