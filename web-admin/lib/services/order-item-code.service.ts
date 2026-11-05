/**
 * Order line serial numbers (Human-Friendly Codes P3, migration 0682_ord_item_srno_barcode).
 *
 * A line serial is `<order_no>-<n>` (n = 1, 2, 3 ...). It is unique per tenant (uq_ord_item_srno) and never changes
 * after insert (trg_ord_item_srno_guard). The DB trigger fills an empty serial with the same rule
 * (fn_next_order_item_srno). App code that writes the serial itself must:
 *   1. take the same per-order lock as the DB function (transaction advisory lock), then
 *   2. continue from the highest number the order already has (removed lines included), never restart at 1.
 * Both steps run inside the caller's Prisma transaction so the lock is held until the lines are committed.
 */

import type { Prisma } from '@prisma/client';

/** Same key as public.fn_next_order_item_srno: hashtextextended('ord_item_srno:' || order_id, 0). */
export const ORDER_ITEM_SRNO_LOCK_PREFIX = 'ord_item_srno:';

/** Canonical number part: 1..999999999, no leading zero (same regex as 0682). */
const CANONICAL_SERIAL_NUMBER = /^[1-9][0-9]{0,8}$/;

/** The part of a Prisma transaction client this service uses. */
export type OrderItemSerialTx = Pick<Prisma.TransactionClient, '$executeRaw' | 'org_order_items_dtl'>;

/** `<order_no>-<n>` */
export function buildOrderItemSrno(orderNo: string, serial: number): string {
  return `${orderNo}-${serial}`;
}

/** The n of a canonical serial of this order, or null when the value is not `<order_no>-<n>`. */
export function parseOrderItemSerial(orderNo: string, srno: string | null | undefined): number | null {
  if (!orderNo || !srno) return null;
  const prefix = `${orderNo}-`;
  if (!srno.startsWith(prefix)) return null;
  const rest = srno.slice(prefix.length);
  return CANONICAL_SERIAL_NUMBER.test(rest) ? Number(rest) : null;
}

/** Highest canonical n among the given serials (0 when none). */
export function maxOrderItemSerial(orderNo: string, serials: Array<string | null | undefined>): number {
  let max = 0;
  for (const s of serials) {
    const n = parseOrderItemSerial(orderNo, s);
    if (n !== null && n > max) max = n;
  }
  return max;
}

/** Per-order transaction lock shared with the DB trigger. Released at commit or rollback. */
export async function lockOrderItemSerials(tx: OrderItemSerialTx, orderId: string): Promise<void> {
  // Unit-test mocks without raw SQL skip the lock; a real Prisma client always has $executeRaw.
  if (typeof (tx as { $executeRaw?: unknown }).$executeRaw !== 'function') return;
  const key = `${ORDER_ITEM_SRNO_LOCK_PREFIX}${orderId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
}

/** Highest serial number the order already has (all its lines, removed ones included). */
export async function readOrderItemSerialMax(
  tx: OrderItemSerialTx,
  params: { tenantOrgId: string; orderId: string; orderNo: string },
): Promise<number> {
  const rows = await tx.org_order_items_dtl.findMany({
    where: { tenant_org_id: params.tenantOrgId, order_id: params.orderId },
    select: { order_item_srno: true },
  });
  return maxOrderItemSerial(params.orderNo, (rows ?? []).map((r) => r.order_item_srno));
}

/**
 * Lock the order's serials and return the next `count` serials (`<order_no>-<max+1>` ...).
 * Call inside the same transaction that inserts the lines.
 */
export async function reserveOrderItemSerials(
  tx: OrderItemSerialTx,
  params: { tenantOrgId: string; orderId: string; orderNo: string; count: number; floor?: number },
): Promise<string[]> {
  if (!params.orderNo) throw new Error('ORD_ITEM_ORDER_NO_MISSING: order has no order_no');
  await lockOrderItemSerials(tx, params.orderId);
  const max = Math.max(await readOrderItemSerialMax(tx, params), params.floor ?? 0);
  return Array.from({ length: Math.max(0, params.count) }, (_, i) => buildOrderItemSrno(params.orderNo, max + i + 1));
}
