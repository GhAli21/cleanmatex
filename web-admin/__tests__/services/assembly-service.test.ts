/**
 * Unit tests for AssemblyService — the assembly scan gate (T05).
 *
 * Covers the two real gates that guard assembly completion: the per-scan
 * task-status/barcode-match check in scanItem, and the completion gate in
 * completeAssemblyTask that blocks COMPLETE while items remain PENDING or an
 * exception is still OPEN.
 */

import { AssemblyService } from '@/lib/services/assembly-service';
import {
  AssemblyTaskNotFoundError,
  InvalidScanError,
} from '@/lib/errors/assembly-errors';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockResolve = jest.fn();
jest.mock('@/lib/services/scan-resolve/scan-resolve.service', () => ({
  ScanResolveService: { resolve: (...args: unknown[]) => mockResolve(...args) },
}));

/** Builds one chainable, thenable Supabase query-builder mock for one `.from()` call. */
function chain(resolved: { data?: unknown; error?: unknown }, singleResolved?: { data?: unknown; error?: unknown }) {
  const obj: Record<string, unknown> = {};
  ['select', 'eq', 'in', 'order', 'insert', 'update', 'upsert', 'delete'].forEach((m) => {
    obj[m] = jest.fn(() => obj);
  });
  obj.single = jest.fn(() => Promise.resolve(singleResolved ?? resolved));
  obj.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject);
  return obj;
}

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const TASK_ID = 'task-1';

describe('AssemblyService.scanItem — scan gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({ ok: false, code: 'SCAN_NOT_FOUND' });
  });

  it('rejects the scan when the task cannot be found', async () => {
    mockFrom.mockImplementationOnce(() => chain({}, { data: null, error: { message: 'not found' } }));

    const result = await AssemblyService.scanItem({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      barcode: 'BC-1',
      userId: USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(new AssemblyTaskNotFoundError(TASK_ID).message);
  });

  it('rejects the scan when the task is not IN_PROGRESS', async () => {
    mockFrom.mockImplementationOnce(() =>
      chain({}, { data: { id: TASK_ID, task_status: 'COMPLETE' }, error: null }),
    );

    const result = await AssemblyService.scanItem({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      barcode: 'BC-1',
      userId: USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      new InvalidScanError('Task is not in progress. Current status: COMPLETE').message,
    );
  });

  it('rejects a barcode that does not match any pending item, without mutating anything', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: { id: TASK_ID, task_status: 'IN_PROGRESS' }, error: null }))
      .mockImplementationOnce(() =>
        chain({
          data: [{ id: 'item-1', barcode: 'BC-EXPECTED', order_item: { barcode: null } }],
          error: null,
        }),
      );

    const result = await AssemblyService.scanItem({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      barcode: 'BC-WRONG',
      userId: USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.isMatch).toBe(false);
    expect(result.error).toBe('Barcode not found in expected items');
    // Only the task lookup + pending-items lookup ran — no update call was reached.
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('scans a matching item by its own barcode and syncs the task counters', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: { id: TASK_ID, task_status: 'IN_PROGRESS' }, error: null }))
      .mockImplementationOnce(() =>
        chain({
          data: [{ id: 'item-1', barcode: 'BC-1', order_item: { barcode: null } }],
          error: null,
        }),
      )
      .mockImplementationOnce(() => chain({ error: null })) // update item -> SCANNED
      .mockImplementationOnce(() => chain({ data: [{ item_status: 'SCANNED' }], error: null })) // counters read
      .mockImplementationOnce(() => chain({ error: null })); // counters write on task row

    const result = await AssemblyService.scanItem({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      barcode: 'BC-1',
      userId: USER_ID,
    });

    expect(result.success).toBe(true);
    expect(result.itemId).toBe('item-1');
    expect(result.isMatch).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it('matches on the linked order-item barcode when the assembly item has none of its own', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: { id: TASK_ID, task_status: 'IN_PROGRESS' }, error: null }))
      .mockImplementationOnce(() =>
        chain({
          data: [{ id: 'item-2', barcode: null, order_item: { barcode: 'ORD-BC-9' } }],
          error: null,
        }),
      )
      .mockImplementationOnce(() => chain({ error: null }))
      .mockImplementationOnce(() => chain({ data: [{ item_status: 'SCANNED' }], error: null }))
      .mockImplementationOnce(() => chain({ error: null }));

    const result = await AssemblyService.scanItem({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      barcode: 'ORD-BC-9',
      userId: USER_ID,
    });

    expect(result.success).toBe(true);
    expect(result.itemId).toBe('item-2');
    expect(mockResolve).not.toHaveBeenCalled();
  });
});

describe('AssemblyService.scanItem — shared resolver fallback (HFC A-42)', () => {
  const task = { id: TASK_ID, task_status: 'IN_PROGRESS', order_id: 'order-1' };
  const pending = [
    { id: 'asm-1', order_item_id: 'line-1', barcode: null, order_item: { barcode: null } },
    { id: 'asm-2', order_item_id: 'line-2', barcode: null, order_item: { barcode: null } },
  ];
  const pieceOutcome = (over: Record<string, unknown> = {}, orderId = 'order-1') => ({
    ok: true,
    result: {
      kind: 'PIECE',
      order: { id: orderId, orderNo: 'ORD-20261031-0007' },
      item: { id: 'line-2', srno: 'ORD-20261031-0007-2' },
      piece: { id: 'p-9', itemId: 'line-2', pieceSeq: 1, pieceCode: 'ORD-20261031-0007-2-1', removed: false, ...over },
    },
  });
  const scan = (code: string) =>
    AssemblyService.scanItem({ taskId: TASK_ID, tenantId: TENANT_ID, barcode: code, userId: USER_ID });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockTaskAndItems() {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: task, error: null }))
      .mockImplementationOnce(() => chain({ data: pending, error: null }));
  }

  it('scans the line a piece code (or tag) belongs to', async () => {
    mockTaskAndItems();
    mockFrom
      .mockImplementationOnce(() => chain({ error: null }))
      .mockImplementationOnce(() => chain({ data: [{ item_status: 'SCANNED' }], error: null }))
      .mockImplementationOnce(() => chain({ error: null }));
    mockResolve.mockResolvedValueOnce(pieceOutcome());

    const result = await scan('ORD-20261031-0007-2-1');

    expect(mockResolve).toHaveBeenCalledWith(expect.anything(), TENANT_ID, 'ORD-20261031-0007-2-1', 'assembly');
    expect(result.success).toBe(true);
    expect(result.itemId).toBe('asm-2');
  });

  it('scans the line a line code names', async () => {
    mockTaskAndItems();
    mockFrom
      .mockImplementationOnce(() => chain({ error: null }))
      .mockImplementationOnce(() => chain({ data: [{ item_status: 'SCANNED' }], error: null }))
      .mockImplementationOnce(() => chain({ error: null }));
    mockResolve.mockResolvedValueOnce({
      ok: true,
      result: { kind: 'ORDER_ITEM', order: { id: 'order-1' }, item: { id: 'line-1', srno: 'ORD-20261031-0007-1' } },
    });

    const result = await scan('ORD-20261031-0007-1');
    expect(result.success).toBe(true);
    expect(result.itemId).toBe('asm-1');
  });

  it.each([
    ['a removed piece', pieceOutcome({ removed: true })],
    ['a piece of another order', pieceOutcome({}, 'order-2')],
    ['the order number alone', { ok: true, result: { kind: 'ORDER', order: { id: 'order-1' } } }],
    ['an unknown code', { ok: false, code: 'SCAN_NOT_FOUND' }],
  ])('keeps the same "not found" answer for %s, without writing', async (_label, outcome) => {
    mockTaskAndItems();
    mockResolve.mockResolvedValueOnce(outcome);

    const result = await scan('X');

    expect(result).toEqual({ success: false, isMatch: false, error: 'Barcode not found in expected items' });
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('treats a resolver failure as no match', async () => {
    mockTaskAndItems();
    mockResolve.mockRejectedValueOnce(new Error('SCAN_LOOKUP_FAILED: boom'));

    const result = await scan('ORD-20261031-0007-2-1');
    expect(result).toEqual({ success: false, isMatch: false, error: 'Barcode not found in expected items' });
  });
});

describe('AssemblyService.completeAssemblyTask — completion gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const taskRow = {
    id: TASK_ID,
    order_id: 'order-1',
    task_status: 'IN_PROGRESS',
    order: { id: 'order-1', order_no: 'ORD-1' },
  };

  it('is idempotent when the task is already COMPLETE — no counter/exception queries run', async () => {
    mockFrom.mockImplementationOnce(() =>
      chain({}, { data: { ...taskRow, task_status: 'COMPLETE' }, error: null }),
    );

    const result = await AssemblyService.completeAssemblyTask({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('order-1');
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('blocks completion while an item remains PENDING', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: taskRow, error: null })) // task lookup
      .mockImplementationOnce(() => chain({ data: [{ id: 'oi-1' }, { id: 'oi-2' }], error: null })) // order items
      .mockImplementationOnce(() => chain({ data: [{ order_item_id: 'oi-1' }, { order_item_id: 'oi-2' }], error: null })) // existing asm items (none missing)
      .mockImplementationOnce(() =>
        chain({ data: [{ item_status: 'SCANNED' }, { item_status: 'PENDING' }], error: null }),
      ) // counters read: 1 scanned, 1 pending
      .mockImplementationOnce(() => chain({ error: null })); // counters write

    const result = await AssemblyService.completeAssemblyTask({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Assembly not complete for order order-1');
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it('blocks completion when an exception is still OPEN even after every item is scanned', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: taskRow, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'oi-1' }], error: null }))
      .mockImplementationOnce(() => chain({ data: [{ order_item_id: 'oi-1' }], error: null }))
      .mockImplementationOnce(() => chain({ data: [{ item_status: 'SCANNED' }], error: null })) // 0 pending
      .mockImplementationOnce(() => chain({ error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'exc-1' }], error: null })); // one OPEN exception

    const result = await AssemblyService.completeAssemblyTask({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be resolved before proceeding');
    expect(mockFrom).toHaveBeenCalledTimes(6);
  });

  it('completes the task once every item is scanned and no exception is open', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: taskRow, error: null }))
      .mockImplementationOnce(() => chain({ data: [{ id: 'oi-1' }], error: null }))
      .mockImplementationOnce(() => chain({ data: [{ order_item_id: 'oi-1' }], error: null }))
      .mockImplementationOnce(() => chain({ data: [{ item_status: 'SCANNED' }], error: null }))
      .mockImplementationOnce(() => chain({ error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null })) // no open exceptions
      .mockImplementationOnce(() => chain({ error: null })); // final task_status -> COMPLETE write

    const result = await AssemblyService.completeAssemblyTask({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('order-1');
    expect(result.orderNo).toBe('ORD-1');
    expect(mockFrom).toHaveBeenCalledTimes(7);
  });

  it('rejects completion when the task has no items at all', async () => {
    mockFrom
      .mockImplementationOnce(() => chain({}, { data: taskRow, error: null })) // task lookup
      .mockImplementationOnce(() => chain({ data: [], error: null })) // ensureAssemblyItemsForTask: no order items
      .mockImplementationOnce(() => chain({ data: [], error: null })) // ensureAssemblyItemsForTask: existing asm items
      .mockImplementationOnce(() => chain({ data: [], error: null })) // counters read: 0 total
      .mockImplementationOnce(() => chain({ error: null })); // counters write

    const result = await AssemblyService.completeAssemblyTask({
      taskId: TASK_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Assembly task has no items to complete');
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });
});
