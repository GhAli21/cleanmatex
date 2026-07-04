/**
 * FN-01 seam lock — `getOrderPaymentsCanonical` must read the canonical
 * `org_order_payments_dtl` ledger (tenant-scoped, active rows only) and map it
 * into the shared `OrderPaymentRow` display shape. This is the single source
 * for the order Payments tab and the order payment prints (ADR-002).
 *
 * Source: docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md §Phase 1.
 */

import { getOrderPaymentsCanonical } from '@/lib/services/order-financial-summary.service';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_payments_dtl: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, fn: () => unknown) => fn(),
}));

const findMany = prisma.org_order_payments_dtl.findMany as jest.Mock;

const dbRow = {
  id: 'pay-1',
  payment_method_code: 'CASH',
  payment_method_name_snapshot: 'Cash',
  payment_nature_snapshot: 'REAL_PAYMENT',
  amount: '12.5000',
  currency_code: 'OMR',
  tendered_amount: '15.0000',
  change_returned_amount: '2.5000',
  payment_status: 'COMPLETED',
  received_by: 'user-1',
  gateway_code: null,
  gateway_transaction_id: null,
  gateway_reference: null,
  card_brand_code: null,
  card_last4: null,
  check_no: null,
  bank_reference: null,
  branch_payment_method_id: null,
  paid_at: new Date('2026-07-01T10:00:00Z'),
  created_at: new Date('2026-07-01T10:00:01Z'),
  rec_notes: null,
  fin_voucher_id: 'vch-1',
};

describe('getOrderPaymentsCanonical (FN-01 canonical read model)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries only the canonical table, tenant-scoped and active-only', async () => {
    findMany.mockResolvedValue([]);

    await getOrderPaymentsCanonical('tenant-1', 'order-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_org_id: 'tenant-1', order_id: 'order-1', is_active: true },
        orderBy: { created_at: 'desc' },
      })
    );
  });

  it('maps DB rows to the OrderPaymentRow display shape (numbers + ISO dates)', async () => {
    findMany.mockResolvedValue([dbRow]);

    const rows = await getOrderPaymentsCanonical('tenant-1', 'order-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'pay-1',
      payment_method_code: 'CASH',
      payment_method_name_snapshot: 'Cash',
      amount: 12.5,
      currency_code: 'OMR',
      tendered_amount: 15,
      change_returned_amount: 2.5,
      payment_status: 'COMPLETED',
      paid_at: '2026-07-01T10:00:00.000Z',
      created_at: '2026-07-01T10:00:01.000Z',
      fin_voucher_id: 'vch-1',
    });
  });

  it('keeps null tendered/change/paid_at as null (not zero) so the UI can hide them', async () => {
    findMany.mockResolvedValue([
      { ...dbRow, tendered_amount: null, change_returned_amount: null, paid_at: null },
    ]);

    const rows = await getOrderPaymentsCanonical('tenant-1', 'order-1');

    expect(rows[0].tendered_amount).toBeNull();
    expect(rows[0].change_returned_amount).toBeNull();
    expect(rows[0].paid_at).toBeNull();
  });
});
