/**
 * BF-07 — an order's AR invoices include consolidated invoices linked through
 * org_invoice_orders_dtl, de-duplicated, with the order's own share.
 */
const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER = '33333333-3333-3333-3333-333333333333';

const linkFindMany = jest.fn();
const invoiceFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_invoice_orders_dtl: { findMany: (...a: unknown[]) => linkFindMany(...a) },
    org_invoice_mst: { findMany: (...a: unknown[]) => invoiceFindMany(...a) },
  },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: async () => TENANT,
  withTenantContext: (_t: string, fn: () => unknown) => fn(),
}));

// eslint-disable-next-line no-restricted-imports -- this suite tests the legacy adapter itself (BF-07)
import { getInvoicesForOrder } from '@/lib/services/invoice-service';
import {
  mapOrderTaxDocumentChain,
  selectOrderArInvoices,
} from '@/src/features/orders/lib/map-order-financial-summary-view';
import type { Invoice } from '@/lib/types/payment';

const invoiceRow = (id: string, orderId: string | null, total: number, outstanding: number) => ({
  id,
  tenant_org_id: TENANT,
  order_id: orderId,
  invoice_no: id.toUpperCase(),
  total,
  paid_amount: total - outstanding,
  outstanding_amount: outstanding,
  status: 'ISSUED',
});

describe('getInvoicesForOrder (BF-07)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns own and consolidated invoices, tenant-scoped, with the order share', async () => {
    linkFindMany.mockResolvedValue([
      { invoice_id: 'inv-cons', invoiced_amount: 4, outstanding_amount: 1.5 },
    ]);
    invoiceFindMany.mockResolvedValue([
      invoiceRow('inv-cons', null, 20, 9),
      invoiceRow('inv-own', ORDER, 3, 0),
    ]);

    const result = await getInvoicesForOrder(ORDER);

    expect(linkFindMany.mock.calls[0][0].where).toMatchObject({
      tenant_org_id: TENANT,
      order_id: ORDER,
      is_active: true,
    });
    expect(invoiceFindMany.mock.calls[0][0].where).toEqual({
      tenant_org_id: TENANT,
      OR: [{ order_id: ORDER }, { id: { in: ['inv-cons'] } }],
    });
    expect(result.map((i) => [i.id, i.order_invoiced_amount, i.order_outstanding_amount])).toEqual([
      ['inv-cons', 4, 1.5],
      ['inv-own', undefined, undefined],
    ]);
  });

  it('queries only the legacy order_id when no link exists', async () => {
    linkFindMany.mockResolvedValue([]);
    invoiceFindMany.mockResolvedValue([]);

    await getInvoicesForOrder(ORDER);

    expect(invoiceFindMany.mock.calls[0][0].where).toEqual({
      tenant_org_id: TENANT,
      OR: [{ order_id: ORDER }],
    });
  });
});

describe('selectOrderArInvoices (BF-07)', () => {
  const inv = (over: Partial<Invoice>): Invoice =>
    ({ id: 'x', invoice_no: 'X', status: 'ISSUED', total: 10, paid_amount: 0, ...over }) as Invoice;

  it('picks the newest invoice that still has a balance, using the order share', () => {
    const { primary, all } = selectOrderArInvoices([
      inv({ id: 'newest-paid', outstanding_amount: 0 }),
      inv({ id: 'cons', total: 20, outstanding_amount: 9, order_invoiced_amount: 4, order_outstanding_amount: 1.5 }),
    ]);

    expect(all).toHaveLength(2);
    expect(primary).toMatchObject({ id: 'cons', amount: 4, outstandingAmount: 1.5 });
  });

  it('falls back to the newest when nothing is outstanding, and null when empty', () => {
    expect(selectOrderArInvoices([inv({ id: 'a', outstanding_amount: 0 })]).primary?.id).toBe('a');
    expect(selectOrderArInvoices([]).primary).toBeNull();
  });
});

describe('mapOrderTaxDocumentChain (BF-13)', () => {
  it('carries every document, including the supersede link', () => {
    const chain = mapOrderTaxDocumentChain([
      { id: 'cn', document_type: 'CREDIT_NOTE', supersedes_id: 'inv', status: 'ISSUED' },
      { id: 'inv', document_type: 'TAX_INVOICE', supersedes_id: null, status: 'SUPERSEDED' },
    ] as never);

    expect(chain.map((d) => [d.id, d.documentType, d.supersedesId])).toEqual([
      ['cn', 'CREDIT_NOTE', 'inv'],
      ['inv', 'TAX_INVOICE', undefined],
    ]);
  });
});
