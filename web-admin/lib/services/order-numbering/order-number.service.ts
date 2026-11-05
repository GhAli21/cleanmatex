/**
 * Order number service (DB-backed).
 *
 * - Root numbers come from public.generate_order_number(uuid), which calls the
 *   P1 engine fn_doc_seq_next(tenant, 'ORDER', now()). The counter row stays
 *   locked until COMMIT, so call this LAST in the create transaction (A-30).
 * - Sub-order numbers come from public.fn_ord_next_sub_order_no(tenant, parent):
 *   <root>-S<n>, numbered under the root order (A-19, A-28).
 * Rolled-back transactions do not burn a number (gapless).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { isValidOrderNumber } from './order-number-format';

/** Prisma transaction client for use inside $transaction. */
export type OrderNumberTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Error codes raised by the ORDER numbering DB functions (message starts with the code). */
export const ORDER_NUMBER_ERRORS = {
  PARENT_NOT_FOUND: 'ORD_PARENT_NOT_FOUND',
  SPLIT_DEPTH_EXCEEDED: 'ORD_SPLIT_DEPTH_EXCEEDED',
  SUB_ORDER_LIMIT: 'ORD_SUB_ORDER_LIMIT',
  /** 0677: the family of the parent is inconsistent (root is itself a sub-order, or a sub-order without root). */
  ROOT_INCONSISTENT: 'ORD_ROOT_INCONSISTENT',
  /** 0677 trg_ord_root_guard: root_order_id does not match the parent's family. */
  ROOT_MISMATCH: 'ORD_ROOT_MISMATCH',
  /** 0677 trg_ord_root_guard: the family root is not a root order. */
  ROOT_NOT_ROOT: 'ORD_ROOT_NOT_ROOT',
  /** 0677 trg_ord_root_guard: root_order_id cannot change. */
  ROOT_IMMUTABLE: 'ORD_ROOT_IMMUTABLE',
  ENGINE_CFG_MISSING: 'ORD_ENGINE_CFG_MISSING',
} as const;
/** Error code raised by the order numbering functions (see ORDER_NUMBER_ERRORS). */
export type OrderNumberError = (typeof ORDER_NUMBER_ERRORS)[keyof typeof ORDER_NUMBER_ERRORS];

/**
 * Reads an ORD_* error code from a DB error message.
 * @param message error message from Postgres / Prisma
 * @returns the ORD_* code, or null
 */
export function parseOrderNumberError(message: string | null | undefined): OrderNumberError | null {
  if (!message) return null;
  const match = /ORD_[A-Z_]+/.exec(message);
  if (!match) return null;
  return (Object.values(ORDER_NUMBER_ERRORS) as string[]).includes(match[0])
    ? (match[0] as OrderNumberError)
    : null;
}

function checkFormat(fn: string, tenantOrgId: string, value: string): void {
  if (!isValidOrderNumber(value)) {
    // The DB owns the format (GENERAL config). Do not fail a committed design
    // choice in the app; log it so the drift is visible.
    logger.warn('Order number has an unexpected format', {
      feature: 'order-numbering',
      action: fn,
      tenantId: tenantOrgId,
      orderNo: value,
    });
  }
}

async function runGenerate(client: OrderNumberTx | typeof prisma, tenantOrgId: string): Promise<string> {
  const rows = await client.$queryRaw<Array<{ order_no: string | null }>>(
    Prisma.sql`SELECT public.generate_order_number(${tenantOrgId}::uuid) AS order_no`
  );
  const orderNo = rows?.[0]?.order_no;
  if (!orderNo) {
    throw new Error('Failed to generate order number: no result from database');
  }
  checkFormat('generate', tenantOrgId, orderNo);
  return orderNo;
}

/**
 * Takes the next root order number inside the caller's transaction.
 * Call it just before the order INSERT: the tenant/day counter stays locked until COMMIT.
 * @param tx Prisma transaction client
 * @param tenantOrgId tenant id
 * @returns order number such as "ORD-20261030-0001"
 */
export async function generateOrderNumberWithTx(tx: OrderNumberTx, tenantOrgId: string): Promise<string> {
  return runGenerate(tx, tenantOrgId);
}

/**
 * Takes the next root order number in its own short transaction.
 * Prefer generateOrderNumberWithTx: a number taken outside the insert
 * transaction is consumed even when the insert later fails.
 * @param tenantOrgId tenant id
 * @returns order number
 */
export async function generateOrderNumber(tenantOrgId: string): Promise<string> {
  try {
    return await runGenerate(prisma, tenantOrgId);
  } catch (error) {
    logger.error('Failed to generate order number', error as Error, {
      feature: 'order-numbering',
      action: 'generate',
      tenantId: tenantOrgId,
    });
    throw new Error(
      `Failed to generate order number: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Takes the next sub-order number (<root>-S<n>) for a parent order, inside the caller's transaction.
 * The DB walks to the root order and locks it FOR UPDATE until COMMIT.
 * @param tx Prisma transaction client
 * @param tenantOrgId tenant id
 * @param parentOrderId parent order id (root or sub-order)
 * @returns sub-order number such as "ORD-20261030-0001-S2"
 */
export async function nextSubOrderNoWithTx(
  tx: OrderNumberTx,
  tenantOrgId: string,
  parentOrderId: string
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ order_no: string | null }>>(
    Prisma.sql`SELECT public.fn_ord_next_sub_order_no(${tenantOrgId}::uuid, ${parentOrderId}::uuid) AS order_no`
  );
  const orderNo = rows?.[0]?.order_no;
  if (!orderNo) {
    throw new Error('Failed to generate sub-order number: no result from database');
  }
  checkFormat('next_sub_order', tenantOrgId, orderNo);
  return orderNo;
}
