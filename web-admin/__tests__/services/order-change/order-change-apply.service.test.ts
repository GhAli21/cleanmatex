import { readFileSync } from 'fs';
import { join } from 'path';

import { applyOrderChange, type ApplyOrderChangeInput, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import { persistOrderChangeTx } from '@/lib/services/order-change/order-change-mutation.service';
import type { OrderChangeFinancialResult } from '@/lib/services/order-change/order-change-financial-result.service';
import type { OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';

jest.mock('@/lib/services/order-change/order-change-mutation.service', () => {
  const actual = jest.requireActual('@/lib/services/order-change/order-change-mutation.service');
  return { ...actual, persistOrderChangeTx: jest.fn() };
});

const persistMock = persistOrderChangeTx as jest.MockedFunction<typeof persistOrderChangeTx>;

const financial: OrderChangeFinancialResult = {
  outcome: 'SETTLED',
  outstandingAmount: '0.0000',
  overpaidAmount: '0.0000',
  unresolvedOverpayment: '0.0000',
  effectivePayments: '10.0000',
  effectiveCredits: '0.0000',
  fiscalObligation: '10.0000',
  settlementMutated: false,
  warnings: [],
};

function preview(overrides: Partial<OrderChangePreviewSuccess> = {}): OrderChangePreviewSuccess {
  return {
    ok: true,
    status: 'READY',
    createsChange: true,
    decisions: [],
    calculationFingerprint: 'fingerprint-1',
    reviewProof: 'proof-1',
    financial,
    originalTotal: '10.0000',
    projectedTotal: '10.0000',
    projectedTax: '0.0000',
    displayTotal: '10.000',
    projectedItemIds: [],
    followUp: [],
    ...overrides,
  };
}

function request(): ApplyOrderChangeInput['request'] {
  return {
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 5,
    sourceContext: 'order-edit',
    reviewProof: 'proof-1',
    calculationFingerprint: 'fingerprint-1',
    operations: [{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Leave at desk' } }],
  };
}

function harness(overrides: Partial<ApplyOrderChangeInput> = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = { org_orders_mst: { updateMany } } as unknown as OrderChangeApplyTx;
  let opened = false;
  let committed = false;
  const input: ApplyOrderChangeInput = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    orderId: '22222222-2222-4222-8222-222222222222',
    actorUserId: '33333333-3333-4333-8333-333333333333',
    currencyCode: 'OMR',
    idempotencyKey: 'key-1',
    request: request(),
    preview: preview(),
    appliedAt: new Date('2026-10-14T12:00:00.000Z'),
    runInTransaction: async (fn) => {
      opened = true;
      try {
        const result = await fn(tx);
        committed = true;
        return result;
      } catch (error) {
        committed = false;
        throw error;
      }
    },
    ...overrides,
  };
  return { input, updateMany, opened: () => opened, committed: () => committed };
}

describe('applyOrderChange', () => {
  beforeEach(() => {
    persistMock.mockReset();
    persistMock.mockResolvedValue({
      ok: true,
      replayed: false,
      orderChangeId: 'change-1',
      changeNo: 2,
      editStateVersionAfter: 4,
      requestHash: 'hash-1',
      clientRefs: {},
      retiredPieceIds: [],
      retiredPreferenceIds: [],
      applyResponse: { status: 'APPLIED' },
    });
  });

  it('commits one Change and the order note inside the same transaction', async () => {
    const { input, updateMany, committed } = harness();
    const result = await applyOrderChange(input);
    expect(result).toMatchObject({ ok: true, replayed: false, orderChangeId: 'change-1', editStateVersionAfter: 4 });
    expect(committed()).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: input.orderId,
        tenant_org_id: input.tenantId,
        edit_state_version: 4,
      },
      data: { internal_notes: 'Leave at desk' },
    });
    const persisted = persistMock.mock.calls[0][1];
    expect(persisted.financialOutcome).toBe('NONE');
    expect(persisted.commercialDelta).toBe('0.0000');
    expect(persisted.itemInserts).toBeUndefined();
  });

  it('does not write when the review proof no longer matches the current preview', async () => {
    const { input, opened } = harness({
      request: { ...request(), reviewProof: 'stale-proof' },
    });
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 409, code: 'REVIEW_CHANGED' });
    expect(opened()).toBe(false);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('does not write a commercial line or a changed total', async () => {
    const line = harness({
      request: {
        ...request(),
        operations: [{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', quantity: 1 } }],
      },
    });
    await expect(applyOrderChange(line.input)).resolves.toEqual({ ok: false, status: 422, code: 'COMMERCIAL_LINE_UNSUPPORTED' });
    expect(line.opened()).toBe(false);

    const priced = harness({ preview: preview({ projectedTotal: '12.0000' }) });
    await expect(applyOrderChange(priced.input)).resolves.toEqual({ ok: false, status: 422, code: 'COMMERCIAL_TOTAL_CHANGED' });
    expect(priced.opened()).toBe(false);
  });

  it('does not guess whether an outstanding balance must be collected', async () => {
    const { input, opened } = harness({
      preview: preview({ financial: { ...financial, outcome: 'OUTSTANDING', outstandingAmount: '10.0000' } }),
    });
    await expect(applyOrderChange(input)).resolves.toEqual({ ok: false, status: 422, code: 'COLLECTION_POLICY_UNRESOLVED' });
    expect(opened()).toBe(false);
  });

  it('returns a replay without writing the order fields again', async () => {
    persistMock.mockResolvedValueOnce({
      ok: true,
      replayed: true,
      orderChangeId: 'change-1',
      changeNo: 2,
      editStateVersionAfter: 4,
      requestHash: 'hash-1',
      clientRefs: {},
      retiredPieceIds: [],
      retiredPreferenceIds: [],
      applyResponse: { status: 'APPLIED' },
    });
    const { input, updateMany } = harness();
    await expect(applyOrderChange(input)).resolves.toMatchObject({ ok: true, replayed: true });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rolls the transaction back when the version update is lost', async () => {
    const { input, committed } = harness();
    persistMock.mockRejectedValueOnce(new Error('VERSION_CONFLICT'));
    await expect(applyOrderChange(input)).rejects.toThrow('VERSION_CONFLICT');
    expect(committed()).toBe(false);
  });

  it('keeps pricing and payment clients out of the apply module', () => {
    const source = readFileSync(join(process.cwd(), 'lib/services/order-change/order-change-apply.service.ts'), 'utf8');
    expect(source).not.toMatch(/prisma|supabase|server-only|pricingService|order-financial-write|ar-invoice|tax-document/);
  });
});
