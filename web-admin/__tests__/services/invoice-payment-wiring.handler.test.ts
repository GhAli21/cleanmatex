/**
 * Tests: invoice-payment-wiring.handler (D-12 / F-T2, rule 7).
 *
 * Locks the AR INVOICE_PAYMENT wiring handler, including the D-12 linkage fix:
 * `allocateArPaymentTx` previously returned the invoice detail (no usable row
 * id), so `wire` read `allocation.id` → undefined at runtime, silently breaking
 * the wired-effect / target_ref linkage. It now returns
 * `{ allocationPaymentId, invoice }` and `wire` returns the
 * org_invoice_payments_dtl row id (throwing if it is missing). This test pins
 * that contract so it can't regress to returning the invoice id.
 */

import { invoicePaymentWiringHandler } from '@/lib/services/wiring/invoice-payment-wiring.handler';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

jest.mock('@/lib/services/ar-invoice.service', () => ({
  allocateArPaymentTx: jest
    .fn()
    .mockResolvedValue({ allocationPaymentId: 'pay-001', invoice: { invoiceId: 'inv-001' } }),
}));
import { allocateArPaymentTx } from '@/lib/services/ar-invoice.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const INVOICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-001';

function makeInvoicePaymentLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-001',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: LINE_ROLE.INVOICE_PAYMENT,
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CARD',
    payment_status: 'POSTED',
    amount: 40 as never,
    currency_code: 'OMR',
    target_type: TARGET_TYPE.INVOICE,
    target_id: INVOICE_ID,
    order_id: null,
    customer_id: null,
    cash_drawer_session_id: null,
    tendered_amount: null,
    change_returned_amount: null,
    credit_application_type: null,
    order_payment_id: null,
    cash_drawer_mvt_id: null,
    card_brand_code: null,
    card_last4: null,
    gateway_code: null,
    gateway_reference: null,
    bank_reference: null,
    check_number: null,
    org_payment_method_id: null,
    payment_terminal_id: null,
    branch_id: 'branch-1',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (allocateArPaymentTx as jest.Mock).mockResolvedValue({
    allocationPaymentId: 'pay-001',
    invoice: { invoiceId: 'inv-001' },
  });
});

describe('invoicePaymentWiringHandler.canHandle', () => {
  it('matches only INVOICE_PAYMENT / IN / INVOICE lines', () => {
    expect(invoicePaymentWiringHandler.canHandle(makeInvoicePaymentLine())).toBe(true);
    expect(invoicePaymentWiringHandler.canHandle(makeInvoicePaymentLine({ direction: 'OUT' }))).toBe(false);
    expect(invoicePaymentWiringHandler.canHandle(makeInvoicePaymentLine({ target_type: TARGET_TYPE.ORDER }))).toBe(false);
    expect(invoicePaymentWiringHandler.canHandle(makeInvoicePaymentLine({ line_role: LINE_ROLE.ORDER_PAYMENT }))).toBe(false);
  });
});

describe('invoicePaymentWiringHandler.validate', () => {
  it('throws when target_id is missing', async () => {
    await expect(invoicePaymentWiringHandler.validate(makeInvoicePaymentLine({ target_id: null }))).rejects.toThrow(/target_id/);
  });
  it('passes when target_id is present', async () => {
    await expect(invoicePaymentWiringHandler.validate(makeInvoicePaymentLine())).resolves.toBeUndefined();
  });
});

describe('invoicePaymentWiringHandler.wire', () => {
  it('allocates with a per-line idempotency key and returns the allocation-payment row id', async () => {
    const id = await invoicePaymentWiringHandler.wire(
      makeInvoicePaymentLine(),
      VOUCHER_ID,
      TENANT,
      USER_ID,
      {} as never,
    );

    // Must be the org_invoice_payments_dtl row id — NOT the invoice id.
    expect(id).toBe('pay-001');
    expect(allocateArPaymentTx).toHaveBeenCalledWith(
      expect.anything(),
      INVOICE_ID,
      expect.objectContaining({
        voucher_id: VOUCHER_ID,
        allocated_amount: 40,
        idempotency_key: `${VOUCHER_ID}_inv_line-001`,
      }),
      { tenantId: TENANT, userId: USER_ID },
    );
  });

  it('throws when no allocation-payment row id is returned (linkage regression lock)', async () => {
    (allocateArPaymentTx as jest.Mock).mockResolvedValueOnce({ allocationPaymentId: null, invoice: {} });
    await expect(
      invoicePaymentWiringHandler.wire(makeInvoicePaymentLine(), VOUCHER_ID, TENANT, USER_ID, {} as never),
    ).rejects.toThrow(/allocation payment row/);
  });
});

describe('invoicePaymentWiringHandler.getLinkedEffect', () => {
  it('builds a LinkedEffect from the latest org_invoice_payments_dtl row', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'pay-001', allocated_amount: 40 });
    const tx = { org_invoice_payments_dtl: { findFirst } };

    const effect = await invoicePaymentWiringHandler.getLinkedEffect(makeInvoicePaymentLine(), TENANT, tx as never);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(effect).toEqual({
      effectType: 'INVOICE_PAYMENT',
      effectId: 'pay-001',
      tableRef: 'org_invoice_payments_dtl',
      amount: 40,
      currency_code: 'OMR',
    });
  });

  it('returns null when no allocation row is found', async () => {
    const tx = { org_invoice_payments_dtl: { findFirst: jest.fn().mockResolvedValue(null) } };
    expect(await invoicePaymentWiringHandler.getLinkedEffect(makeInvoicePaymentLine(), TENANT, tx as never)).toBeNull();
  });
});
