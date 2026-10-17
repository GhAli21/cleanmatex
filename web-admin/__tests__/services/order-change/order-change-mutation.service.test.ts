import { readFileSync } from 'fs';
import { join } from 'path';

import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { OUTBOX_HANDLERS } from '@/lib/services/outbox-processor.service';
import { confirmOrderChangeApplied } from '@/lib/services/order-change/order-change-applied.handler';
import {
  collectionRequiredForPaymentType,
  mapPersistedFinancialOutcome,
  OrderChangeMutationError,
  persistOrderChangeTx,
  type OrderChangeWriteTx,
  type PersistOrderChangeInput,
} from '@/lib/services/order-change/order-change-mutation.service';
import { hashPayload } from '@/lib/utils/idempotency';

const request = { note: 'shorter hem' };

function input(overrides: Partial<PersistOrderChangeInput> = {}): PersistOrderChangeInput {
  return {
    tenantId: 'tenant-1',
    orderId: 'order-1',
    expectedEditStateVersion: 3,
    expectedWfStateVersion: 4,
    sourceContext: 'order-edit',
    actorUserId: 'user-1',
    currencyCode: 'OMR',
    financialBefore: { total: '10.0000' },
    financialAfter: { total: '12.0000' },
    commercialDelta: '2.0000',
    financialOutcome: 'OUTSTANDING_OPTIONAL',
    idempotencyKey: 'key-1',
    request,
    applyResponse: { status: 'APPLIED' },
    operations: [{
      seq: 1,
      code: 'ADD_ITEM',
      targetType: 'ITEM',
      orderItemId: 'item-new',
      clientRef: 'client-1',
    }],
    itemInserts: [{ id: 'item-new', data: { product_name: 'Shirt' } }],
    removeItemIds: ['item-old'],
    appliedAt: new Date('2026-10-14T00:00:00.000Z'),
    ...overrides,
  };
}

function fakeTx(options: {
  claim?: Array<{ id: string }>;
  existingKey?: { response_cache: unknown; resource_id: string | null } | null;
  versionCount?: number;
  replay?: {
    id: string;
    change_no: number;
    edit_state_version_after: number;
    request_hash: string;
    apply_response: unknown;
  } | null;
  activeItemIds?: string[];
  workflowVersion?: number;
} = {}) {
  const calls: string[] = [];
  let change: Record<string, unknown> | null = null;
  let outbox: Record<string, unknown> | null = null;
  let itemInsert: Record<string, unknown> | null = null;
  const retired: string[] = [];
  const tx = {
    calls,
    change: () => change,
    outbox: () => outbox,
    itemInsert: () => itemInsert,
    retired: () => retired,
    $queryRaw: async (query: TemplateStringsArray | string) => {
      const text = typeof query === 'string' ? query : Array.from(query ?? []).join(' ');
      if (text.includes('state_version')) return [{ state_version: options.workflowVersion ?? 4 }];
      return options.claim ?? [{ id: 'claim' }];
    },
    $executeRaw: async () => {
      calls.push('sql');
      return 1;
    },
    org_idempotency_keys: {
      findFirst: async () => options.existingKey ?? null,
    },
    org_orders_mst: {
      updateMany: async () => {
        calls.push('version');
        return { count: options.versionCount ?? 1 };
      },
    },
    org_order_changes_mst: {
      aggregate: async () => ({ _max: { change_no: 2 } }),
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push('change');
        change = args.data;
        return { id: String(args.data.id) };
      },
      findFirst: async () => options.replay ?? null,
    },
    org_order_change_ops_dtl: {
      createMany: async () => {
        calls.push('ops');
        return { count: 1 };
      },
    },
    org_order_items_dtl: {
      create: async (args: { data: Record<string, unknown> }) => {
        itemInsert = args.data;
        calls.push('item-insert');
      },
      updateMany: async (args: { where: { id?: { in?: string[] } }; data: { deleted_order_change_id?: string } }) => {
        const ids = args.where.id?.in ?? [];
        retired.push(...ids);
        return { count: ids.length };
      },
      findMany: async (args: { where: { id?: { in?: string[] } } }) => (
        (options.activeItemIds ?? args.where.id?.in ?? []).map((id) => ({ id }))
      ),
    },
    org_order_item_pieces_dtl: {
      create: async () => undefined,
      updateMany: async (args: { where: { id?: { in?: string[] } } }) => {
        const ids = args.where.id?.in ?? [];
        retired.push(...ids);
        return { count: ids.length };
      },
      findMany: async (args: { where: { id?: { in?: string[] }; order_item_id?: unknown } }) => {
        if (args.where.order_item_id) return [{ id: 'piece-child' }];
        return (args.where.id?.in ?? []).map((id) => ({ id }));
      },
    },
    org_order_preferences_dtl: {
      create: async () => undefined,
      updateMany: async (args: { where: { id?: { in?: string[] } } }) => {
        const ids = args.where.id?.in ?? [];
        retired.push(...ids);
        return { count: ids.length };
      },
      findMany: async (args: { where: { id?: { in?: string[] }; OR?: unknown } }) => {
        if (args.where.OR) return [{ id: 'pref-child' }];
        return (args.where.id?.in ?? []).map((id) => ({ id }));
      },
    },
    org_domain_events_outbox: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push('outbox');
        outbox = args.data;
      },
    },
  };
  return tx;
}

describe('persistOrderChangeTx', () => {
  it('writes the change, forced tenant, descendant retirement, and outbox on the same transaction', async () => {
    const tx = fakeTx();
    const result = await persistOrderChangeTx(tx as unknown as OrderChangeWriteTx, input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replayed).toBe(false);
    expect(result.changeNo).toBe(3);
    expect(result.editStateVersionAfter).toBe(4);
    expect(result.clientRefs['client-1']).toBe('item-new');
    expect(result.retiredPieceIds).toEqual(['piece-child']);
    expect(result.retiredPreferenceIds).toEqual(['pref-child']);
    expect(tx.itemInsert()?.tenant_org_id).toBe('tenant-1');
    expect(tx.itemInsert()?.order_id).toBe('order-1');
    expect(tx.change()?.id).toBe(result.orderChangeId);
    expect(tx.change()?.tenant_org_id).toBe('tenant-1');
    expect(tx.outbox()?.aggregate_id).toBe(result.orderChangeId);
    expect(tx.outbox()?.event_type).toBe(OUTBOX_EVENT_TYPES.ORDER_CHANGE_APPLIED);
    expect(tx.calls).toEqual(['version', 'change', 'ops', 'item-insert', 'outbox', 'sql']);
    expect(tx.retired()).toEqual(['item-old', 'piece-child', 'pref-child']);
  });

  it('rejects a stale commercial revision after the claim and does not insert a change', async () => {
    const tx = fakeTx({ versionCount: 0 });
    await expect(persistOrderChangeTx(tx as unknown as OrderChangeWriteTx, input())).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    expect(tx.calls).toEqual(['version']);
  });

  it('rejects a workflow version that changed after Review and does not increment the edit revision', async () => {
    const tx = fakeTx({ workflowVersion: 9 });
    await expect(persistOrderChangeTx(tx as unknown as OrderChangeWriteTx, input())).rejects.toMatchObject({
      code: 'WORKFLOW_VERSION_CONFLICT',
    });
    expect(tx.calls).toEqual([]);
  });

  it('replays a completed key without incrementing the revision', async () => {
    const tx = fakeTx({
      claim: [],
      existingKey: {
        response_cache: { payload_hash: hashPayload(request) },
        resource_id: 'change-1',
      },
      replay: {
        id: 'change-1',
        change_no: 2,
        edit_state_version_after: 3,
        request_hash: hashPayload(request),
        apply_response: { status: 'APPLIED' },
      },
    });
    const result = await persistOrderChangeTx(tx as unknown as OrderChangeWriteTx, input());
    expect(result).toMatchObject({ ok: true, replayed: true, orderChangeId: 'change-1', changeNo: 2 });
    expect(tx.calls).toEqual([]);
  });

  it('reports an in-flight key and a different payload without writing a change', async () => {
    const inFlight = fakeTx({ claim: [], existingKey: null });
    await expect(persistOrderChangeTx(inFlight as unknown as OrderChangeWriteTx, input())).resolves.toEqual({
      ok: false,
      code: 'IDEMPOTENCY_IN_FLIGHT',
    });
    const conflict = fakeTx({
      claim: [],
      existingKey: { response_cache: { payload_hash: 'other' }, resource_id: null },
    });
    await expect(persistOrderChangeTx(conflict as unknown as OrderChangeWriteTx, input())).resolves.toEqual({
      ok: false,
      code: 'IDEMPOTENCY_CONFLICT',
    });
    expect(inFlight.change()).toBeNull();
    expect(conflict.change()).toBeNull();
  });

  it('rejects a protected identity field and an empty snapshot', async () => {
    const tx = fakeTx();
    await expect(persistOrderChangeTx(tx as unknown as OrderChangeWriteTx, input({
      itemInserts: [{ id: 'item-new', data: { deleted_order_change_id: 'forged' } }],
    }))).rejects.toBeInstanceOf(OrderChangeMutationError);
    await expect(persistOrderChangeTx(tx as unknown as OrderChangeWriteTx, input({
      financialBefore: {},
    }))).rejects.toMatchObject({ code: 'SNAPSHOT_EMPTY' });
  });

  it('does not import the global Prisma client', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/services/order-change/order-change-mutation.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/@\/lib\/db\/prisma|server-only/);
  });
});

describe('financial outcome and applied handler', () => {
  it('maps preview classification without guessing a collection policy', () => {
    expect(mapPersistedFinancialOutcome('SETTLED', null)).toBe('NONE');
    expect(mapPersistedFinancialOutcome('OVERPAYMENT', null)).toBe('OVERPAYMENT');
    expect(mapPersistedFinancialOutcome('DENIED', false)).toBeNull();
    expect(mapPersistedFinancialOutcome('OUTSTANDING', null)).toBeNull();
    expect(mapPersistedFinancialOutcome('OUTSTANDING', true)).toBe('OUTSTANDING_REQUIRED');
    expect(collectionRequiredForPaymentType('PAY_ON_COLLECTION')).toBe(true);
    expect(collectionRequiredForPaymentType('CREDIT_INVOICE')).toBe(false);
    expect(collectionRequiredForPaymentType('PAY_ON_DELIVERY')).toBe(false);
    expect(collectionRequiredForPaymentType(null)).toBeNull();
  });

  it('retries when the applied change row is missing and is a registered consumer', async () => {
    await expect(confirmOrderChangeApplied(
      { tenant_org_id: 'tenant-1', aggregate_id: 'change-1', payload: { orderId: 'order-1' } },
      async () => null,
    )).rejects.toThrow('ORDER_CHANGE_APPLIED_ROW_MISSING');
    await expect(confirmOrderChangeApplied(
      { tenant_org_id: 'tenant-1', aggregate_id: 'change-1', payload: { orderId: 'order-1' } },
      async () => ({ id: 'change-1' }),
    )).resolves.toBeUndefined();
    expect(OUTBOX_HANDLERS.some((handler) => handler.eventTypes.has(OUTBOX_EVENT_TYPES.ORDER_CHANGE_APPLIED))).toBe(true);
  });
});
