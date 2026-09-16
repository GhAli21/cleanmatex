/**
 * D006 shared credit-application reverse: CAS restore + loyalty pending state.
 */

import { reverseCreditApplicationTx } from '@/lib/services/credit-application-reversal.service';
import { topUpWalletTx } from '@/lib/services/stored-value.service';
import { adjustPointsTx } from '@/lib/services/loyalty.service';
import { CREDIT_APPLICATION_STATUSES } from '@/lib/constants/order-financial';

jest.mock('server-only', () => ({}), { virtual: true });

const tx = {
  org_order_credit_apps_dtl: { updateMany: jest.fn() },
  org_loyalty_txn_dtl: { findFirst: jest.fn() },
};

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: jest.fn().mockResolvedValue({}),
  issueAdvanceTx: jest.fn().mockResolvedValue({}),
  issueCreditNoteTx: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/gift-card-service', () => ({
  refundGiftCardTx: jest.fn().mockResolvedValue({ actualRefundAmount: 5 }),
}));

jest.mock('@/lib/services/loyalty.service', () => ({
  adjustPointsTx: jest.fn(),
}));

const input = {
  tenantId: 'tenant-1',
  orderId: 'order-1',
  userId: 'user-1',
  reason: 'Voucher reverse',
  idempotencyPrefix: 'voucher_unwind:rev-1',
  updatedInfo: 'Voucher reverse',
};

describe('reverseCreditApplicationTx (D006)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tx.org_order_credit_apps_dtl.updateMany.mockResolvedValue({ count: 1 });
    tx.org_loyalty_txn_dtl.findFirst.mockResolvedValue(null);
  });

  it('restores WALLET via topUpWalletTx after APPLIED→REVERSED', async () => {
    const warnings: string[] = [];
    const result = await reverseCreditApplicationTx(
      tx as never,
      input,
      {
        id: 'ca-w',
        credit_type: 'WALLET',
        credit_source_id: null,
        applied_amount: '4',
        currency_code: 'OMR',
      },
      'cust-1',
      warnings,
    );

    expect(result.status).toBe(CREDIT_APPLICATION_STATUSES.REVERSED);
    expect(result.restoredAmount).toBe(4);
    expect(topUpWalletTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amount: 4,
        idempotencyKey: 'voucher_unwind:rev-1-ca-ca-w',
      }),
    );
  });

  it('marks LOYALTY_RESTORE_PENDING when points cannot be restored', async () => {
    const warnings: string[] = [];
    (adjustPointsTx as jest.Mock).mockRejectedValue(new Error('Loyalty account not found'));

    const result = await reverseCreditApplicationTx(
      tx as never,
      input,
      {
        id: 'ca-l',
        credit_type: 'LOYALTY_POINTS',
        credit_source_id: null,
        applied_amount: '2',
        currency_code: 'OMR',
      },
      'cust-1',
      warnings,
    );

    expect(result.status).toBe(CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING);
    expect(result.restoredAmount).toBe(0);
    expect(warnings.some((w) => w.includes('LOYALTY_RESTORE_PENDING'))).toBe(true);
    expect(tx.org_order_credit_apps_dtl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          application_status: CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING,
        }),
      }),
    );
  });
});
