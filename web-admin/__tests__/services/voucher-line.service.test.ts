/**
 * Tests: voucher-line.service
 *
 * Covers order-target wiring invariants required by BVM submit-order.
 */

const mockLineFindFirst = jest.fn();
const mockLineCreate = jest.fn();
const mockVoucherFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_fin_voucher_trx_lines_dtl: {
      findFirst: (...args: unknown[]) => mockLineFindFirst(...args),
      create: (...args: unknown[]) => mockLineCreate(...args),
    },
    org_fin_vouchers_mst: {
      findFirst: (...args: unknown[]) => mockVoucherFindFirst(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { LINE_ROLE, LINE_TYPE, TARGET_TYPE, VOUCHER_STATUS } from '@/lib/constants/voucher';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-001';

describe('voucher-line.service -> addVoucherLine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLineFindFirst.mockResolvedValue(null);
    mockVoucherFindFirst.mockResolvedValue({ voucher_status: VOUCHER_STATUS.DRAFT });
    mockLineCreate.mockResolvedValue({ id: 'line-001', line_no: 1 });
  });

  it('derives target_id from order_id for ORDER_PAYMENT lines targeted at ORDER', async () => {
    await addVoucherLine(TENANT, VOUCHER_ID, {
      line_type: LINE_TYPE.RECEIPT,
      line_role: LINE_ROLE.ORDER_PAYMENT,
      target_type: TARGET_TYPE.ORDER,
      order_id: ORDER_ID,
      payment_method_code: 'CASH',
      amount: 25,
      currency_code: 'OMR',
      direction: 'IN',
    }, USER_ID);

    expect(mockLineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          target_type: TARGET_TYPE.ORDER,
          target_id: ORDER_ID,
          order_id: ORDER_ID,
        }),
      }),
    );
  });

  it('persists explicit payment_status on voucher lines for wiring', async () => {
    await addVoucherLine(TENANT, VOUCHER_ID, {
      line_type: LINE_TYPE.RECEIPT,
      line_role: LINE_ROLE.ORDER_PAYMENT,
      target_type: TARGET_TYPE.ORDER,
      order_id: ORDER_ID,
      payment_method_code: 'CARD',
      payment_status: 'PENDING',
      amount: 25,
      currency_code: 'OMR',
      direction: 'IN',
    }, USER_ID);

    expect(mockLineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_method_code: 'CARD',
          payment_status: 'PENDING',
        }),
      }),
    );
  });
});
