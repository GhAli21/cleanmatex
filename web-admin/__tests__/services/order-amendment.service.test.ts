/**
 * Tests: order-amendment.service (B12)
 *
 * Covers:
 * - computeAmendmentDelta — increase/decrease/tolerance/unpaid-order/flag-off
 * - assertGovernedAmendmentAllowed — reason + permission gate
 * - stakeAmendmentIdempotency — required key, conflict, concurrent in-flight, replay
 * - recordAmendmentSettlement — not-found, already-settled no-op, fresh write
 */

const mockHasPermissionServer = jest.fn();
const mockClaimIdempotencyKey = jest.fn();
const mockStoreIdempotencyHash = jest.fn();
const mockFindIdempotencyHash = jest.fn();
const mockEditHistoryFindFirst = jest.fn();
const mockEditHistoryUpdate = jest.fn();
const mockTaxDocumentFindFirst = jest.fn();

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));

jest.mock('@/lib/utils/idempotency', () => ({
  claimIdempotencyKey: (...a: unknown[]) => mockClaimIdempotencyKey(...a),
  storeIdempotencyHash: (...a: unknown[]) => mockStoreIdempotencyHash(...a),
  findIdempotencyHash: (...a: unknown[]) => mockFindIdempotencyHash(...a),
  hashPayload: (payload: unknown) => `hash:${JSON.stringify(payload)}`,
}));

const mockTxClient = {
  org_order_edit_history: {
    findFirst: (...a: unknown[]) => mockEditHistoryFindFirst(...a),
    update: (...a: unknown[]) => mockEditHistoryUpdate(...a),
  },
  // B14 — recordAmendmentSettlement issues a companion correction tax
  // document inside the same transaction; defaults to "no original document"
  // (null) so it no-ops without needing to mock the full issuance chain.
  org_tax_documents_mst: {
    findFirst: (...a: unknown[]) => mockTaxDocumentFindFirst(...a),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_edit_history: {
      findFirst: (...a: unknown[]) => mockEditHistoryFindFirst(...a),
      update: (...a: unknown[]) => mockEditHistoryUpdate(...a),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(mockTxClient),
  },
}));

import {
  computeAmendmentDelta,
  assertGovernedAmendmentAllowed,
  stakeAmendmentIdempotency,
  recordAmendmentSettlement,
} from '@/lib/services/order-amendment.service';

describe('order-amendment.service (B12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeAmendmentDelta', () => {
    it('is governed when the flag is on, there are prior payments, and the delta exceeds tolerance (increase)', () => {
      const result = computeAmendmentDelta({
        previousTotal: 10,
        newTotal: 15,
        totalPaidAmount: 10,
        governedFlagEnabled: true,
      });
      expect(result.deltaAmount).toBe(5);
      expect(result.isGoverned).toBe(true);
    });

    it('is governed on a decrease too (negative delta)', () => {
      const result = computeAmendmentDelta({
        previousTotal: 15,
        newTotal: 10,
        totalPaidAmount: 15,
        governedFlagEnabled: true,
      });
      expect(result.deltaAmount).toBe(-5);
      expect(result.isGoverned).toBe(true);
    });

    it('is NOT governed when the order has no prior payments — nothing to collect or resolve yet', () => {
      const result = computeAmendmentDelta({
        previousTotal: 10,
        newTotal: 15,
        totalPaidAmount: 0,
        governedFlagEnabled: true,
      });
      expect(result.isGoverned).toBe(false);
    });

    it('is NOT governed when the flag is off', () => {
      const result = computeAmendmentDelta({
        previousTotal: 10,
        newTotal: 15,
        totalPaidAmount: 10,
        governedFlagEnabled: false,
      });
      expect(result.isGoverned).toBe(false);
    });

    it('is NOT governed for a rounding-only delta within tolerance', () => {
      const result = computeAmendmentDelta({
        previousTotal: 10,
        newTotal: 10.0001,
        totalPaidAmount: 10,
        governedFlagEnabled: true,
      });
      expect(result.isGoverned).toBe(false);
    });
  });

  describe('assertGovernedAmendmentAllowed', () => {
    it('throws EDIT_REASON_REQUIRED when reason is missing', async () => {
      await expect(
        assertGovernedAmendmentAllowed({ tenantId: 't1', userId: 'u1', editReason: undefined })
      ).rejects.toMatchObject({ code: 'EDIT_REASON_REQUIRED' });
    });

    it('throws EDIT_REASON_REQUIRED when reason is whitespace-only', async () => {
      await expect(
        assertGovernedAmendmentAllowed({ tenantId: 't1', userId: 'u1', editReason: '   ' })
      ).rejects.toMatchObject({ code: 'EDIT_REASON_REQUIRED' });
    });

    it('throws PERMISSION_DENIED when the actor lacks orders:post_settlement_edit', async () => {
      mockHasPermissionServer.mockResolvedValue(false);
      await expect(
        assertGovernedAmendmentAllowed({ tenantId: 't1', userId: 'u1', editReason: 'customer changed mind' })
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      expect(mockHasPermissionServer).toHaveBeenCalledWith('orders:post_settlement_edit', {
        userId: 'u1',
        tenantId: 't1',
      });
    });

    it('resolves when both reason and permission are present', async () => {
      mockHasPermissionServer.mockResolvedValue(true);
      await expect(
        assertGovernedAmendmentAllowed({ tenantId: 't1', userId: 'u1', editReason: 'customer changed mind' })
      ).resolves.toBeUndefined();
    });

    it('fails closed when hasPermissionServer throws', async () => {
      mockHasPermissionServer.mockRejectedValue(new Error('rpc down'));
      await expect(
        assertGovernedAmendmentAllowed({ tenantId: 't1', userId: 'u1', editReason: 'x' })
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });
  });

  describe('stakeAmendmentIdempotency', () => {
    it('throws IDEMPOTENCY_KEY_REQUIRED when no key is supplied', async () => {
      await expect(
        stakeAmendmentIdempotency('t1', 'order1', undefined, { items: [] })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    });

    it('throws IDEMPOTENCY_CONFLICT when the key is held by a different payload', async () => {
      mockClaimIdempotencyKey.mockResolvedValue({ status: 'CONFLICT', existingHash: 'other-hash' });
      await expect(
        stakeAmendmentIdempotency('t1', 'order1', 'key-1', { items: [] })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    });

    it('throws IDEMPOTENCY_IN_PROGRESS when a concurrent call already staked the same key and has not finished', async () => {
      // The case the plain read-then-write stake could not detect: both racers
      // saw resourceId:null and both proceeded, double-applying the amendment.
      mockClaimIdempotencyKey.mockResolvedValue({ status: 'IN_FLIGHT' });
      await expect(
        stakeAmendmentIdempotency('t1', 'order1', 'key-1', { items: [] })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' });
    });

    it('returns editHistoryId: null when this call wins the claim (proceed with the edit)', async () => {
      mockClaimIdempotencyKey.mockResolvedValue({ status: 'CLAIMED' });
      const result = await stakeAmendmentIdempotency('t1', 'order1', 'key-1', { items: [] });
      expect(result.editHistoryId).toBeNull();
      expect(mockClaimIdempotencyKey).toHaveBeenCalledWith(
        't1',
        'key-1',
        'order_amendment',
        expect.any(String),
      );
    });

    it('returns the cached editHistoryId on replay (same key + same payload, already completed)', async () => {
      mockClaimIdempotencyKey.mockResolvedValue({ status: 'COMPLETED', resourceId: 'edit-history-123' });
      const result = await stakeAmendmentIdempotency('t1', 'order1', 'key-1', { items: [] });
      expect(result.editHistoryId).toBe('edit-history-123');
    });

    it('hashes the orderId together with the payload, so the same key on a different order conflicts', async () => {
      mockClaimIdempotencyKey.mockResolvedValue({ status: 'CLAIMED' });
      await stakeAmendmentIdempotency('t1', 'order1', 'key-1', { items: [] });
      await stakeAmendmentIdempotency('t1', 'order2', 'key-1', { items: [] });
      const hashForOrder1 = mockClaimIdempotencyKey.mock.calls[0][3];
      const hashForOrder2 = mockClaimIdempotencyKey.mock.calls[1][3];
      expect(hashForOrder1).not.toBe(hashForOrder2);
    });
  });

  describe('recordAmendmentSettlement', () => {
    it('throws when the edit-history row does not exist for this tenant/order', async () => {
      mockEditHistoryFindFirst.mockResolvedValue(null);
      await expect(
        recordAmendmentSettlement({
          tenantId: 't1',
          editHistoryId: 'missing',
          orderId: 'order1',
          paymentAdjustmentType: 'CHARGE',
          paymentAdjustmentAmount: 5,
          settlementLineage: { paymentId: 'p1' },
        })
      ).rejects.toThrow('Edit history row not found');
      expect(mockEditHistoryUpdate).not.toHaveBeenCalled();
    });

    it('is a no-op when the row is already settled (immutable once payment_adjusted)', async () => {
      mockEditHistoryFindFirst.mockResolvedValue({ payment_adjusted: true });
      const result = await recordAmendmentSettlement({
        tenantId: 't1',
        editHistoryId: 'eh1',
        orderId: 'order1',
        paymentAdjustmentType: 'CHARGE',
        paymentAdjustmentAmount: 5,
        settlementLineage: { paymentId: 'p1' },
      });
      expect(result.alreadySettled).toBe(true);
      expect(mockEditHistoryUpdate).not.toHaveBeenCalled();
    });

    it('writes payment_adjusted/amount/type/settlement_lineage on first settlement', async () => {
      mockEditHistoryFindFirst.mockResolvedValue({ payment_adjusted: false });
      mockEditHistoryUpdate.mockResolvedValue({});
      const result = await recordAmendmentSettlement({
        tenantId: 't1',
        editHistoryId: 'eh1',
        orderId: 'order1',
        paymentAdjustmentType: 'REFUND',
        paymentAdjustmentAmount: -7.5,
        settlementLineage: { dispositionIds: ['d1', 'd2'] },
      });
      expect(result.alreadySettled).toBe(false);
      expect(mockEditHistoryUpdate).toHaveBeenCalledWith({
        where: { id: 'eh1' },
        data: expect.objectContaining({
          payment_adjusted: true,
          payment_adjustment_amount: 7.5,
          payment_adjustment_type: 'REFUND',
          settlement_lineage: { dispositionIds: ['d1', 'd2'] },
        }),
      });
    });
  });
});
