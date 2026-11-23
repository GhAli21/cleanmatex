/**
 * Tests: outbox.service (Background Jobs step 4)
 *
 * - emitEventTx writes the event row and publishes it on the same transaction, with the row id.
 * - manualRetry / manualRetryMany reset retryable rows in one tenant-scoped UPDATE and publish
 *   again only the rows that went back to PENDING (redeliver = new job ids).
 */

const mockOutboxCreate = jest.fn();
const mockTxQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a) })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

import { mockJobProducer } from '@cmx/jobs';
import { emitEventTx, manualRetry, manualRetryMany } from '@/lib/services/outbox.service';

const TENANT = 'tenant-outbox-001';
const makeTx = () => ({ org_domain_events_outbox: { create: mockOutboxCreate } }) as unknown as Parameters<typeof emitEventTx>[0];

/** Flattens a tagged-template call into its SQL text and bound values. */
const sqlOf = (call: unknown[]) => ({ text: (call[0] as TemplateStringsArray).join('?'), values: call.slice(1) });

describe('outbox.service — emitEventTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a PENDING row and publishes it to its reactions on the same transaction', async () => {
    mockOutboxCreate.mockResolvedValue({ id: 'evt-1' });
    const tx = makeTx();

    const id = await emitEventTx(tx, TENANT, 'ORDER_SUBMITTED', 'order', 'order-1', { foo: 'bar' });

    expect(id).toBe('evt-1');
    expect(mockOutboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_org_id: TENANT,
        event_type: 'ORDER_SUBMITTED',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        status: 'PENDING',
        payload: { foo: 'bar' },
      }),
      select: { id: true },
    });
    expect(mockJobProducer.publish).toHaveBeenCalledWith(tx, 'ORDER_SUBMITTED', { tenantOrgId: TENANT, eventId: 'evt-1' });
  });

  it('does not publish when the row insert fails (the caller transaction rolls back)', async () => {
    mockOutboxCreate.mockRejectedValue(new Error('fk_odeo_event_type'));
    await expect(emitEventTx(makeTx(), TENANT, 'ORDER_SUBMITTED', 'order', 'o', {})).rejects.toThrow('fk_odeo_event_type');
    expect(mockJobProducer.publish).not.toHaveBeenCalled();
  });
});

describe('outbox.service — manualRetry / manualRetryMany', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resets retryable rows for the tenant in one UPDATE and republishes only rows that went back to PENDING', async () => {
    mockTxQueryRaw.mockResolvedValue([
      { id: 'evt-1', event_type: 'ORDER_SUBMITTED', status: 'PENDING' },
      { id: 'evt-2', event_type: 'PAYMENT_RECEIVED', status: 'PROCESSED' }, // no reaction any more
    ]);

    const retried = await manualRetryMany(['evt-1', 'evt-2', 'evt-1'], 'tenant-1');

    expect(retried).toBe(2);
    const { text, values } = sqlOf(mockTxQueryRaw.mock.calls[0]);
    expect(text).toContain('UPDATE public.org_domain_events_outbox');
    expect(text).toContain('o.tenant_org_id = ?::uuid');
    expect(values).toContain('tenant-1');
    expect(values).toContainEqual(['evt-1', 'evt-2']);
    expect(mockJobProducer.publish).toHaveBeenCalledTimes(1);
    expect(mockJobProducer.publish).toHaveBeenCalledWith(
      expect.anything(), 'ORDER_SUBMITTED', { tenantOrgId: 'tenant-1', eventId: 'evt-1' }, { redeliver: true });
  });

  it('manualRetry throws when no row was retryable (wrong tenant, or not FAILED/DEAD_LETTERED)', async () => {
    mockTxQueryRaw.mockResolvedValue([]);
    await expect(manualRetry('evt-x', 'tenant-1')).rejects.toThrow('EVENT_NOT_FOUND_OR_NOT_RETRYABLE');
    expect(mockJobProducer.publish).not.toHaveBeenCalled();
  });

  it('returns 0 without a transaction when the id list is empty', async () => {
    expect(await manualRetryMany([], 'tenant-1')).toBe(0);
    expect(mockTxQueryRaw).not.toHaveBeenCalled();
  });
});
