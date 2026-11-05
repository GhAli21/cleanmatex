/**
 * HFC P3: order line serials `<order_no>-<n>` (lib/services/order-item-code.service.ts).
 */
import {
  ORDER_ITEM_SRNO_LOCK_PREFIX,
  buildOrderItemSrno,
  lockOrderItemSerials,
  maxOrderItemSerial,
  parseOrderItemSerial,
  readOrderItemSerialMax,
  reserveOrderItemSerials,
} from '@/lib/services/order-item-code.service';

const ORDER_NO = 'ORD-20261101-0007';

function makeTx(serials: Array<string | null>) {
  const calls: string[] = [];
  const tx = {
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(`lock:${String(values[0])}`);
      return 1;
    }),
    org_order_items_dtl: {
      findMany: jest.fn(async () => {
        calls.push('read');
        return serials.map((order_item_srno) => ({ order_item_srno }));
      }),
    },
  };
  return { tx: tx as never, raw: tx, calls };
}

describe('order-item-code.service', () => {
  it('builds and parses canonical serials', () => {
    expect(buildOrderItemSrno(ORDER_NO, 3)).toBe(`${ORDER_NO}-3`);
    expect(parseOrderItemSerial(ORDER_NO, `${ORDER_NO}-12`)).toBe(12);
    expect(parseOrderItemSerial(ORDER_NO, `${ORDER_NO}-012`)).toBeNull();
    expect(parseOrderItemSerial(ORDER_NO, `${ORDER_NO}-0`)).toBeNull();
    expect(parseOrderItemSerial(ORDER_NO, `${ORDER_NO}-1-2`)).toBeNull();
    expect(parseOrderItemSerial(ORDER_NO, 'OTHER-1')).toBeNull();
    expect(parseOrderItemSerial(ORDER_NO, `${ORDER_NO}-1234567890`)).toBeNull();
    expect(parseOrderItemSerial(ORDER_NO, null)).toBeNull();
  });

  it('takes the max over canonical serials only', () => {
    expect(maxOrderItemSerial(ORDER_NO, [`${ORDER_NO}-2`, `${ORDER_NO}-10`, 'legacy-uuid', null])).toBe(10);
    expect(maxOrderItemSerial(ORDER_NO, [])).toBe(0);
  });

  it('locks with the same key as fn_next_order_item_srno before reading the max', async () => {
    const { tx, calls } = makeTx([`${ORDER_NO}-1`, `${ORDER_NO}-4`]);
    const out = await reserveOrderItemSerials(tx, { tenantOrgId: 't1', orderId: 'o1', orderNo: ORDER_NO, count: 2 });
    expect(out).toEqual([`${ORDER_NO}-5`, `${ORDER_NO}-6`]);
    expect(calls).toEqual([`lock:${ORDER_ITEM_SRNO_LOCK_PREFIX}o1`, 'read']);
  });

  it('reads all lines of the order, tenant-scoped (removed lines included)', async () => {
    const { tx, raw } = makeTx([]);
    await readOrderItemSerialMax(tx, { tenantOrgId: 't1', orderId: 'o1', orderNo: ORDER_NO });
    expect(raw.org_order_items_dtl.findMany).toHaveBeenCalledWith({
      where: { tenant_org_id: 't1', order_id: 'o1' },
      select: { order_item_srno: true },
    });
  });

  it('honours a floor and returns nothing for count 0', async () => {
    const { tx } = makeTx([`${ORDER_NO}-1`]);
    await expect(
      reserveOrderItemSerials(tx, { tenantOrgId: 't1', orderId: 'o1', orderNo: ORDER_NO, count: 1, floor: 7 }),
    ).resolves.toEqual([`${ORDER_NO}-8`]);
    await expect(
      reserveOrderItemSerials(tx, { tenantOrgId: 't1', orderId: 'o1', orderNo: ORDER_NO, count: 0 }),
    ).resolves.toEqual([]);
  });

  it('refuses an order without order_no', async () => {
    const { tx } = makeTx([]);
    await expect(
      reserveOrderItemSerials(tx, { tenantOrgId: 't1', orderId: 'o1', orderNo: '', count: 1 }),
    ).rejects.toThrow('ORD_ITEM_ORDER_NO_MISSING');
  });

  it('skips the lock on a client without raw SQL (unit-test mocks)', async () => {
    await expect(lockOrderItemSerials({} as never, 'o1')).resolves.toBeUndefined();
  });
});
