/**
 * Tests: voucher-biz.service
 *
 * Covers:
 * - cancelBizVoucher -> marks a DRAFT voucher as CANCELLED
 * - cancelBizVoucher -> stores reversal_reason and audit fields
 * - cancelBizVoucher -> rejects non-DRAFT vouchers
 */

const mockFindFirst = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_fin_vouchers_mst: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

import { cancelBizVoucher } from '@/lib/services/voucher-biz.service';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-001';

describe('voucher-biz.service -> cancelBizVoucher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks a DRAFT voucher as CANCELLED and stores the reason', async () => {
    mockFindFirst.mockResolvedValue({ voucher_status: VOUCHER_STATUS.DRAFT });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await cancelBizVoucher(TENANT, VOUCHER_ID, 'Duplicate voucher', USER_ID);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VOUCHER_ID, tenant_org_id: TENANT },
        data: expect.objectContaining({
          voucher_status: VOUCHER_STATUS.CANCELLED,
          reversal_reason: 'Duplicate voucher',
          updated_by: USER_ID,
          updated_at: expect.any(Date),
        }),
      })
    );
  });

  it('throws when the voucher does not exist', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      cancelBizVoucher(TENANT, VOUCHER_ID, 'Missing row', USER_ID)
    ).rejects.toThrow(/not found/i);
  });

  it('throws when the voucher is already POSTED', async () => {
    mockFindFirst.mockResolvedValue({ voucher_status: VOUCHER_STATUS.POSTED });

    await expect(
      cancelBizVoucher(TENANT, VOUCHER_ID, 'Too late', USER_ID)
    ).rejects.toThrow(/Only DRAFT vouchers may be modified/i);
  });
});
