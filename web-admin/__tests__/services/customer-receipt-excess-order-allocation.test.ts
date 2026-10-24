/**
 * BF-22 — allocating an overpayment to another order must update that order
 * through the one snapshot writer, never by hand-writing paid/outstanding.
 */
const recalcMock = jest.fn();
const getAllocationPreviewMock = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...a: unknown[]) => recalcMock(...a),
}));
jest.mock('@/lib/services/customer-receipt-allocation-preview.service', () => ({
  getAllocationPreview: (...a: unknown[]) => getAllocationPreviewMock(...a),
  markAllocationPreviewPosted: jest.fn(),
}));
jest.mock('@/lib/services/customer-receipt-allocation-validator.service', () => ({
  validateAllocationPreview: jest.fn(),
}));
jest.mock('@/lib/services/customer-receipt-allocation-policy.service', () => ({
  resolveReceiptAllocationPolicy: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/lib/services/ar-invoice.service', () => ({ allocateArPaymentTx: jest.fn() }));
jest.mock('@/lib/services/b2b-statement-payment.service', () => ({
  allocateB2bStatementPaymentTx: jest.fn(),
}));
jest.mock('@/lib/services/stored-value.service', () => ({
  issueAdvanceTx: jest.fn(),
  issueCreditNoteTx: jest.fn(),
  topUpWalletTx: jest.fn(),
}));

import { executeAllocationPreviewTx } from '@/lib/services/customer-receipt-excess-executor.service';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
} from '@/lib/types/customer-receipt-allocation';

const TENANT = '11111111-1111-1111-1111-111111111111';
const TARGET = '44444444-4444-4444-4444-444444444444';

describe('executeAllocationPreviewTx — order target (BF-22)', () => {
  it('records the payment, then recalculates the target snapshot (no hand-written money columns)', async () => {
    getAllocationPreviewMock.mockResolvedValue({
      previewStatus: CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED,
      remainingUnallocatedAmount: 0,
      allocations: [
        {
          lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.ORDER_PAYMENT,
          targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER,
          targetId: TARGET,
          allocationAmount: 2,
        },
      ],
    });
    const calls: string[] = [];
    const orderUpdate = jest.fn(async () => {
      calls.push('order.update');
    });
    const tx = {
      org_orders_mst: {
        findFirst: jest.fn().mockResolvedValue({ id: TARGET, outstanding_amount: 5 }),
        update: orderUpdate,
      },
      org_payment_methods_cf: { findFirst: jest.fn().mockResolvedValue({ id: 'pm-1' }) },
      org_order_payments_dtl: {
        create: jest.fn(async () => {
          calls.push('payment.create');
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    recalcMock.mockImplementation(async () => {
      calls.push('recalc');
    });

    await executeAllocationPreviewTx({
      tx: tx as never,
      tenantId: TENANT,
      userId: 'user-1',
      customerId: 'cust-1',
      sourceOrderId: 'source-1',
      currencyCode: 'OMR',
      previewId: 'preview-1',
      idempotencyKey: 'idem-1',
    });

    expect(calls).toEqual(['payment.create', 'recalc', 'order.update']);
    expect(recalcMock).toHaveBeenCalledWith(tx, TENANT, TARGET);
    const updateData = (orderUpdate.mock.calls[0] as unknown as [{ data: Record<string, unknown>; where: Record<string, unknown> }])[0];
    expect(Object.keys(updateData.data).sort()).toEqual(['updated_at', 'updated_by']);
    expect(updateData.where).toEqual({ id: TARGET, tenant_org_id: TENANT });
  });
});
