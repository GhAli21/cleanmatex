/**
 * @jest-environment node
 *
 * Tests: MANUAL_VOUCHER POS-session policy applied when a draft finance voucher is posted (D62).
 */
jest.mock('server-only', () => ({}), { virtual: true });

const mockResolve = jest.fn();
const mockPostAndWire = jest.fn();
jest.mock('@/lib/services/pos-session.service', () => ({
  resolvePosSessionForFinanceTx: (...a: unknown[]) => mockResolve(...a),
}));
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...a: unknown[]) => mockPostAndWire(...a),
}));

const mockVoucherFindFirst = jest.fn();
const mockLinesFindMany = jest.fn();
const mockLinesUpdateMany = jest.fn();
const tx = {
  org_fin_vouchers_mst: { findFirst: (...a: unknown[]) => mockVoucherFindFirst(...a) },
  org_fin_voucher_trx_lines_dtl: {
    findMany: (...a: unknown[]) => mockLinesFindMany(...a),
    updateMany: (...a: unknown[]) => mockLinesUpdateMany(...a),
  },
};
jest.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: (fn: (t: unknown) => unknown) => fn(tx) },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, fn: () => unknown) => fn(),
}));

import {
  applyManualVoucherPosSessionTx,
  postManualVoucherWithPosPolicy,
} from '@/lib/services/voucher-pos-session.service';

const input = { tenantId: 't-1', userId: 'u-1', voucherId: 'v-1' };

beforeEach(() => {
  jest.resetAllMocks();
  mockVoucherFindFirst.mockResolvedValue({ branch_id: 'b-1' });
  mockLinesFindMany.mockResolvedValue([{ payment_method_code: 'CASH' }]);
  mockResolve.mockResolvedValue(null);
});

describe('applyManualVoucherPosSessionTx', () => {
  it('resolves under the MANUAL_VOUCHER surface with the tender scope of the voucher lines', async () => {
    await applyManualVoucherPosSessionTx(tx as never, input);
    expect(mockResolve).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId: 't-1',
        userId: 'u-1',
        branchId: 'b-1',
        surface: 'MANUAL_VOUCHER',
        tenderScope: 'CASH',
      })
    );
  });

  it('treats a voucher without any payment line as an accounting document (no tender)', async () => {
    mockLinesFindMany.mockResolvedValue([{ payment_method_code: null }]);
    await applyManualVoucherPosSessionTx(tx as never, input);
    expect(mockResolve.mock.calls[0][1].tenderScope).toBe('NONE');
  });

  it('links the resolved session to draft lines that have none, scoped by tenant', async () => {
    mockResolve.mockResolvedValue({ id: 'pos-1' });
    await expect(applyManualVoucherPosSessionTx(tx as never, input)).resolves.toBe('pos-1');
    expect(mockLinesUpdateMany).toHaveBeenCalledWith({
      where: { tenant_org_id: 't-1', voucher_id: 'v-1', line_status: 'DRAFT', pos_session_id: null },
      data: { pos_session_id: 'pos-1', updated_by: 'u-1' },
    });
  });

  it('writes nothing when no session applies', async () => {
    await expect(applyManualVoucherPosSessionTx(tx as never, input)).resolves.toBeNull();
    expect(mockLinesUpdateMany).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown voucher (the post reports it)', async () => {
    mockVoucherFindFirst.mockResolvedValue(null);
    await expect(applyManualVoucherPosSessionTx(tx as never, input)).resolves.toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('scopes both reads by tenant', async () => {
    await applyManualVoucherPosSessionTx(tx as never, input);
    expect(mockVoucherFindFirst.mock.calls[0][0].where).toEqual({ id: 'v-1', tenant_org_id: 't-1' });
    expect(mockLinesFindMany.mock.calls[0][0].where).toEqual({ tenant_org_id: 't-1', voucher_id: 'v-1' });
  });
});

describe('postManualVoucherWithPosPolicy', () => {
  it('applies the policy and posts in one transaction, in that order', async () => {
    const order: string[] = [];
    mockResolve.mockImplementation(async () => {
      order.push('policy');
      return null;
    });
    mockPostAndWire.mockImplementation(async () => {
      order.push('post');
      return { ok: true };
    });
    await expect(postManualVoucherWithPosPolicy('t-1', 'u-1', 'v-1', 'key-1')).resolves.toEqual({ ok: true });
    expect(order).toEqual(['policy', 'post']);
    expect(mockPostAndWire).toHaveBeenCalledWith('t-1', 'v-1', 'u-1', 'DEFERRED', 'key-1', tx);
  });

  it('never posts when the policy refuses', async () => {
    const refusal = new Error('POS_SESSION_REQUIRED');
    mockResolve.mockRejectedValue(refusal);
    await expect(postManualVoucherWithPosPolicy('t-1', 'u-1', 'v-1')).rejects.toBe(refusal);
    expect(mockPostAndWire).not.toHaveBeenCalled();
  });
});
