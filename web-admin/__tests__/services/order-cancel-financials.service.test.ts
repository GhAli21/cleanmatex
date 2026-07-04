/**
 * FN-02 — cancellation financial unwind invariants:
 * applied credit returns to its source ledger exactly once (CAS-guarded),
 * collected money always flows through an explicit disposition, promo usage
 * reverses, the snapshot recalculates, and the audit event is emitted.
 */

import {
  unwindOrderFinancialsOnCancel,
  CANCEL_DISPOSITIONS,
} from '@/lib/services/order-cancel-financials.service';
import { prisma } from '@/lib/db/prisma';
import {
  topUpWalletTx,
  issueAdvanceTx,
  issueCreditNoteTx,
} from '@/lib/services/stored-value.service';
import { refundGiftCardTx } from '@/lib/services/gift-card-service';
import { initiateRefund } from '@/lib/services/order-refund.service';
import { reversePromoUsageTx } from '@/lib/services/discount-service';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import { emitEventTx } from '@/lib/services/outbox.service';

jest.mock('server-only', () => ({}), { virtual: true });

const tx = {
  org_orders_mst: { findFirstOrThrow: jest.fn() },
  org_order_credit_apps_dtl: { findMany: jest.fn(), updateMany: jest.fn() },
  org_order_payments_dtl: { findMany: jest.fn() },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: jest.fn().mockResolvedValue({}),
  issueAdvanceTx: jest.fn().mockResolvedValue({}),
  issueCreditNoteTx: jest.fn().mockResolvedValue({ id: 'cn-1' }),
}));

jest.mock('@/lib/services/gift-card-service', () => ({
  refundGiftCardTx: jest.fn().mockResolvedValue({ newBalance: 10, actualRefundAmount: 5 }),
}));

jest.mock('@/lib/services/order-refund.service', () => ({
  initiateRefund: jest.fn().mockResolvedValue({ id: 'refund-1' }),
}));

jest.mock('@/lib/services/discount-service', () => ({
  reversePromoUsageTx: jest.fn().mockResolvedValue({ reversedCount: 0 }),
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/outbox.service', () => ({
  emitEventTx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const baseInput = {
  tenantId: 'tenant-1',
  orderId: 'order-1',
  userId: 'user-1',
  reason: 'Customer requested cancellation',
};

function creditApp(overrides: Record<string, unknown>) {
  return {
    id: 'ca-1',
    credit_type: 'WALLET',
    credit_source_id: null,
    applied_amount: '5.0000',
    currency_code: 'OMR',
    ...overrides,
  };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    amount: '10.0000',
    change_returned_amount: null,
    payment_method_code: 'CASH',
    currency_code: 'OMR',
    ...overrides,
  };
}

describe('unwindOrderFinancialsOnCancel (FN-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    tx.org_orders_mst.findFirstOrThrow.mockResolvedValue({
      customer_id: 'cust-1',
      currency_code: 'OMR',
    });
    tx.org_order_credit_apps_dtl.findMany.mockResolvedValue([]);
    tx.org_order_credit_apps_dtl.updateMany.mockResolvedValue({ count: 1 });
    tx.org_order_payments_dtl.findMany.mockResolvedValue([]);
  });

  it('reverses each APPLIED credit type back to its source ledger', async () => {
    tx.org_order_credit_apps_dtl.findMany.mockResolvedValue([
      creditApp({ id: 'ca-w', credit_type: 'WALLET', applied_amount: '5.0000' }),
      creditApp({ id: 'ca-a', credit_type: 'ADVANCE', applied_amount: '3.0000' }),
      creditApp({ id: 'ca-c', credit_type: 'CREDIT_NOTE', applied_amount: '2.0000' }),
      creditApp({ id: 'ca-g', credit_type: 'GIFT_CARD', credit_source_id: 'gc-1', applied_amount: '5.0000' }),
    ]);
    (refundGiftCardTx as jest.Mock).mockResolvedValue({ actualRefundAmount: 5 });

    const result = await unwindOrderFinancialsOnCancel(baseInput);

    expect(topUpWalletTx).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: 5, customerId: 'cust-1' }));
    expect(issueAdvanceTx).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: 3 }));
    expect(issueCreditNoteTx).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: 2, idempotencyKey: 'cancel-order-1-ca-ca-c' }));
    expect(refundGiftCardTx).toHaveBeenCalledWith(tx, expect.objectContaining({ giftCardId: 'gc-1', amount: 5 }));
    expect(result.reversedCreditApplications).toBe(4);
    expect(result.restoredStoredValueAmount).toBe(15);
    expect(recalculateOrderFinancialSnapshotTx).toHaveBeenCalledWith(tx, 'tenant-1', 'order-1', {});
    expect(emitEventTx).toHaveBeenCalled();
  });

  it('never double-restores: CAS miss (already REVERSED) skips the ledger restore', async () => {
    tx.org_order_credit_apps_dtl.findMany.mockResolvedValue([creditApp({})]);
    tx.org_order_credit_apps_dtl.updateMany.mockResolvedValue({ count: 0 });

    const result = await unwindOrderFinancialsOnCancel(baseInput);

    expect(topUpWalletTx).not.toHaveBeenCalled();
    expect(result.restoredStoredValueAmount).toBe(0);
  });

  it('flags unsupported credit types for manual restore instead of silently dropping them', async () => {
    tx.org_order_credit_apps_dtl.findMany.mockResolvedValue([
      creditApp({ credit_type: 'LOYALTY_POINTS' }),
    ]);

    const result = await unwindOrderFinancialsOnCancel(baseInput);

    expect(result.warnings.some((w) => w.includes('LOYALTY_POINTS'))).toBe(true);
    expect(result.restoredStoredValueAmount).toBe(0);
  });

  it('hard-fails when money was collected but no disposition was chosen', async () => {
    tx.org_order_payments_dtl.findMany.mockResolvedValue([payment()]);

    await expect(unwindOrderFinancialsOnCancel(baseInput)).rejects.toThrow(
      'CANCEL_DISPOSITION_REQUIRED'
    );
  });

  it('STORE_CREDIT issues one credit note for the net collected amount (change excluded)', async () => {
    tx.org_order_payments_dtl.findMany.mockResolvedValue([
      payment({ amount: '10.0000', change_returned_amount: '2.0000' }),
      payment({ id: 'pay-2', amount: '5.0000' }),
    ]);

    const result = await unwindOrderFinancialsOnCancel({
      ...baseInput,
      disposition: CANCEL_DISPOSITIONS.STORE_CREDIT,
    });

    expect(issueCreditNoteTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: 13, idempotencyKey: 'cancel-order-1-store-credit' })
    );
    expect(result.creditNoteId).toBe('cn-1');
    expect(result.paidAmountDisposed).toBe(13);
    expect(initiateRefund).not.toHaveBeenCalled();
  });

  it('REFUND initiates one keyed refund per payment via the maker-checker flow', async () => {
    tx.org_order_payments_dtl.findMany.mockResolvedValue([
      payment({ id: 'pay-1', amount: '10.0000' }),
      payment({ id: 'pay-2', amount: '4.0000', payment_method_code: 'CARD' }),
    ]);

    const result = await unwindOrderFinancialsOnCancel({
      ...baseInput,
      disposition: CANCEL_DISPOSITIONS.REFUND,
    });

    expect(initiateRefund).toHaveBeenCalledTimes(2);
    expect(initiateRefund).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        originalPaymentId: 'pay-1',
        amount: 10,
        idempotencyKey: 'cancel-order-1-refund-pay-1',
      })
    );
    expect(result.refundIds).toEqual(['refund-1', 'refund-1']);
    expect(issueCreditNoteTx).not.toHaveBeenCalled();
  });

  it('KEEP_ON_ACCOUNT leaves payments untouched but still audits the decision', async () => {
    tx.org_order_payments_dtl.findMany.mockResolvedValue([payment()]);

    const result = await unwindOrderFinancialsOnCancel({
      ...baseInput,
      disposition: CANCEL_DISPOSITIONS.KEEP_ON_ACCOUNT,
    });

    expect(initiateRefund).not.toHaveBeenCalled();
    expect(issueCreditNoteTx).not.toHaveBeenCalled();
    expect(emitEventTx).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1',
      'ORDER_CANCEL_FINANCIAL_UNWIND',
      'ORDER',
      'order-1',
      expect.objectContaining({ disposition: 'KEEP_ON_ACCOUNT', paidAmountDisposed: 10 })
    );
    expect(result.paidAmountDisposed).toBe(10);
  });

  it('reverses promo usage on every unwind', async () => {
    await unwindOrderFinancialsOnCancel(baseInput);

    expect(reversePromoUsageTx).toHaveBeenCalledWith(tx, {
      orderId: 'order-1',
      tenantOrgId: 'tenant-1',
      voidedBy: 'user-1',
    });
  });

  it('captures refund-initiation failures as warnings without failing the unwind', async () => {
    tx.org_order_payments_dtl.findMany.mockResolvedValue([payment()]);
    (initiateRefund as jest.Mock).mockRejectedValue(new Error('refundable balance exceeded'));

    const result = await unwindOrderFinancialsOnCancel({
      ...baseInput,
      disposition: CANCEL_DISPOSITIONS.REFUND,
    });

    expect(result.refundIds).toEqual([]);
    expect(result.warnings.some((w) => w.includes('pay-1'))).toBe(true);
  });
});
