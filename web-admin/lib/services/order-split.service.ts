/**
 * Order split service (PRD-010, Human-Friendly Codes P2).
 *
 * Creates a sub-order (<root>-S<n>) that carries selected units of the parent
 * order for separate processing. Everything runs in ONE Prisma transaction:
 * lock parent -> validate -> take the sub-order number (last DB lock) ->
 * insert header + lines -> record split bookkeeping -> history -> snapshot.
 *
 * Money rule (decision A-29): the split is operational. The parent keeps all
 * commercial facts (line quantity, prices, totals, payments). Sub-order lines
 * carry zero price and point back to the parent line through metadata.
 * Parent lines and pieces only get split bookkeeping in `metadata`:
 *   line.metadata.split_out_qty           units already moved out
 *   line.metadata.split_out_piece_seqs    piece numbers already moved out
 *   piece.metadata.split_to_order_id/no   sub-order that took the piece
 * No money is changed, so no payment or invoice is touched.
 *
 * Family root (decision A-28, migration 0677): every sub-order stores
 * root_order_id = the root order of the family (also for a split of a
 * sub-order). The DB trigger trg_ord_root_guard fills and guards it; this
 * service reads the expected root under the parent lock and checks the new
 * row got it (consistency check before COMMIT).
 */

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { nextSubOrderNoWithTx, parseOrderNumberError } from '@/lib/services/order-numbering';
import { findOpenPosSessionIdForOrder, stampCreatedPosSession } from '@/lib/services/order-created-pos-session';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import { buildOrderItemSrno } from '@/lib/services/order-item-code.service';

/** order_subtype values written by the split (mirror org_orders_mst.order_subtype, 0020). */
export const ORDER_SPLIT_SUBTYPES = {
  CHILD: 'split_child',
} as const;

/** org_order_history.action_type for the split (chk_history_action_type). */
export const ORDER_SPLIT_HISTORY_ACTION = 'SPLIT';

/** Error codes returned by the split service. */
export const ORDER_SPLIT_ERRORS = {
  NOTHING_SELECTED: 'ORD_SPLIT_NOTHING_SELECTED',
  BAD_PIECE_ID: 'ORD_SPLIT_BAD_PIECE_ID',
  ORDER_NOT_FOUND: 'ORD_SPLIT_ORDER_NOT_FOUND',
  ORDER_CLOSED: 'ORD_SPLIT_ORDER_CLOSED',
  ITEM_NOT_FOUND: 'ORD_SPLIT_ITEM_NOT_FOUND',
  UNITS_NOT_AVAILABLE: 'ORD_SPLIT_UNITS_NOT_AVAILABLE',
  WHOLE_ORDER: 'ORD_SPLIT_WHOLE_ORDER',
  NUMBERING_FAILED: 'ORD_SPLIT_NUMBERING_FAILED',
  BUSY: 'ORD_SPLIT_BUSY',
  FAILED: 'ORD_SPLIT_FAILED',
} as const;
/** Error code returned by splitOrderUnits (see ORDER_SPLIT_ERRORS). */
export type OrderSplitError = (typeof ORDER_SPLIT_ERRORS)[keyof typeof ORDER_SPLIT_ERRORS];

/** Parent statuses that can no longer be split. */
const CLOSED_STATUSES = new Set(['delivered', 'closed', 'cancelled', 'canceled', 'returned']);

/** Max units / pieces in one request (defensive bound). */
const MAX_UNITS_PER_SPLIT = 5000;

/** One parent line to split. */
export interface OrderSplitLineInput {
  itemId: string;
  /** Piece numbers (1-based) to move. When omitted, all remaining units of the line move. */
  pieceSeqs?: number[];
}

/** Split request. */
export interface OrderSplitInput {
  tenantId: string;
  orderId: string;
  userId: string;
  userName?: string | null;
  reason: string;
  lines: OrderSplitLineInput[];
}

/** Split result. */
export type OrderSplitResult =
  | {
      success: true;
      suborder: { id: string; order_no: string };
      /** Family root order id (the parent itself when the parent is a root). */
      rootOrderId: string;
      movedUnits: number;
    }
  | {
      success: false;
      errorCode: OrderSplitError;
      error: string;
    };

class SplitFailure extends Error {
  constructor(
    readonly code: OrderSplitError,
    message: string
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turns UI piece ids ("{itemId}-piece-{n}") into split lines.
 * @param pieceIds piece ids from the processing modal
 * @returns lines grouped by item
 */
export function piecesToSplitLines(pieceIds: string[]): OrderSplitLineInput[] {
  const map = new Map<string, Set<number>>();
  for (const raw of pieceIds) {
    const match = /^(.+)-piece-(\d+)$/.exec(String(raw ?? '').trim());
    if (!match || !UUID_RE.test(match[1])) {
      throw new SplitFailure(ORDER_SPLIT_ERRORS.BAD_PIECE_ID, `Invalid piece id: ${String(raw)}`);
    }
    const seq = Number(match[2]);
    if (!Number.isSafeInteger(seq) || seq < 1) {
      throw new SplitFailure(ORDER_SPLIT_ERRORS.BAD_PIECE_ID, `Invalid piece number: ${String(raw)}`);
    }
    const set = map.get(match[1]) ?? new Set<number>();
    set.add(seq);
    map.set(match[1], set);
  }
  return [...map.entries()].map(([itemId, seqs]) => ({ itemId, pieceSeqs: [...seqs].sort((a, b) => a - b) }));
}

function readMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readSplitOutQty(meta: Record<string, unknown>): number {
  const n = Number(meta.split_out_qty ?? 0);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function readSplitOutSeqs(meta: Record<string, unknown>): number[] {
  const raw = meta.split_out_piece_seqs;
  return Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : [];
}

function normalizeLines(lines: OrderSplitLineInput[]): OrderSplitLineInput[] {
  const merged = new Map<string, { all: boolean; seqs: Set<number> }>();
  for (const line of lines) {
    if (!line || !UUID_RE.test(String(line.itemId ?? ''))) {
      throw new SplitFailure(ORDER_SPLIT_ERRORS.ITEM_NOT_FOUND, 'Invalid item id');
    }
    const entry = merged.get(line.itemId) ?? { all: false, seqs: new Set<number>() };
    if (!line.pieceSeqs || line.pieceSeqs.length === 0) {
      entry.all = true;
    } else {
      for (const seq of line.pieceSeqs) {
        if (!Number.isSafeInteger(seq) || seq < 1) {
          throw new SplitFailure(ORDER_SPLIT_ERRORS.BAD_PIECE_ID, `Invalid piece number: ${seq}`);
        }
        entry.seqs.add(seq);
      }
    }
    merged.set(line.itemId, entry);
  }
  return [...merged.entries()].map(([itemId, e]) =>
    e.all ? { itemId } : { itemId, pieceSeqs: [...e.seqs].sort((a, b) => a - b) }
  );
}

type ParentItemRow = {
  id: string;
  quantity: number | null;
  metadata: unknown;
  service_category_code: string | null;
  order_item_srno: string | null;
  product_id: string | null;
  product_name: string | null;
  product_name2: string | null;
  barcode: string | null;
  status: string | null;
  item_status: string | null;
  item_stage: string | null;
  notes: string | null;
  color: string | null;
  brand: string | null;
  has_stain: boolean | null;
  has_damage: boolean | null;
  stain_notes: string | null;
  damage_notes: string | null;
  service_speed: string | null;
  ready_by_at: Date | null;
  price_source: string | null;
  price_list_id: string | null;
  speed_rule_id: string | null;
  tax_pricing_mode: string | null;
  tax_category_code: string | null;
};

type PlannedLine = { item: ParentItemRow; units: number; pieceSeqs: number[] | null };

/**
 * Family root of a split: the parent's root_order_id, or the parent itself when it is a root (A-28).
 * A parent that has a parent_order_id but no root_order_id is broken data: refuse (fail closed).
 * @param parent locked parent row
 * @param parent.id parent order id
 * @param parent.parent_order_id parent's own parent (null for a root)
 * @param parent.root_order_id parent's family root (null for a root)
 * @returns the root order id for the new sub-order
 */
export function expectedRootOrderId(parent: {
  id: string;
  parent_order_id: string | null;
  root_order_id: string | null;
}): string {
  if (parent.root_order_id) return parent.root_order_id;
  if (parent.parent_order_id) {
    throw new Error(`ORD_ROOT_INCONSISTENT: order ${parent.id} has a parent but no root_order_id`);
  }
  return parent.id;
}

/**
 * Splits selected units of an order into a new sub-order, atomically.
 * @param input split request
 * @returns the new sub-order, or an error code
 */
export async function splitOrderUnits(input: OrderSplitInput): Promise<OrderSplitResult> {
  const { tenantId, orderId, userId } = input;
  const reason = String(input.reason ?? '').trim();
  try {
    if (!UUID_RE.test(tenantId) || !UUID_RE.test(orderId)) {
      throw new SplitFailure(ORDER_SPLIT_ERRORS.ORDER_NOT_FOUND, 'Order not found');
    }
    const lines = normalizeLines(input.lines ?? []);
    if (lines.length === 0) {
      throw new SplitFailure(ORDER_SPLIT_ERRORS.NOTHING_SELECTED, 'Select at least one item or piece to split');
    }

    // Read-only lookup outside the transaction (keeps the transaction short).
    const branchRow = await prisma.org_orders_mst.findFirst({
      where: { tenant_org_id: tenantId, id: orderId },
      select: { branch_id: true },
    });
    if (!branchRow) {
      throw new SplitFailure(ORDER_SPLIT_ERRORS.ORDER_NOT_FOUND, 'Order not found');
    }
    const posSessionId =
      branchRow.branch_id && UUID_RE.test(userId)
        ? await findOpenPosSessionIdForOrder(prisma, { tenantId, userId, branchId: branchRow.branch_id })
        : null;

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '5s'`);

        // 1. Lock the parent order (serializes concurrent splits of the same order).
        //    root_order_id is read raw (column from 0677) so this works before the Prisma client knows it.
        const locked = await tx.$queryRaw<
          Array<{ id: string; parent_order_id: string | null; root_order_id: string | null }>
        >(Prisma.sql`
          SELECT id, parent_order_id, root_order_id FROM public.org_orders_mst
          WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid
          FOR UPDATE
        `);
        if (locked.length === 0) {
          throw new SplitFailure(ORDER_SPLIT_ERRORS.ORDER_NOT_FOUND, 'Order not found');
        }
        const rootOrderId = expectedRootOrderId(locked[0]);
        const parent = await tx.org_orders_mst.findFirstOrThrow({
          where: { tenant_org_id: tenantId, id: orderId },
        });
        if ((parent.rec_status ?? 1) !== 1 || CLOSED_STATUSES.has(String(parent.status ?? '').toLowerCase())) {
          throw new SplitFailure(ORDER_SPLIT_ERRORS.ORDER_CLOSED, 'This order can no longer be split');
        }

        // 2. Lock and validate the selected lines.
        const itemIds = lines.map((l) => l.itemId);
        await tx.$queryRaw(Prisma.sql`
          SELECT id FROM public.org_order_items_dtl
          WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid
            AND id IN (${Prisma.join(itemIds.map((id) => Prisma.sql`${id}::uuid`))})
          FOR UPDATE
        `);
        const items = (await tx.org_order_items_dtl.findMany({
          where: {
            tenant_org_id: tenantId,
            order_id: orderId,
            id: { in: itemIds },
            rec_status: 1,
            deleted_order_change_id: null,
          },
        })) as unknown as ParentItemRow[];
        const byId = new Map(items.map((i) => [i.id, i]));

        const planned: PlannedLine[] = [];
        for (const line of lines) {
          const item = byId.get(line.itemId);
          if (!item) {
            throw new SplitFailure(ORDER_SPLIT_ERRORS.ITEM_NOT_FOUND, 'An item does not belong to this order');
          }
          const qty = Math.max(0, Number(item.quantity ?? 0));
          const meta = readMeta(item.metadata);
          const outQty = readSplitOutQty(meta);
          const outSeqs = new Set(readSplitOutSeqs(meta));
          const available = qty - outQty;
          if (line.pieceSeqs) {
            const bad = line.pieceSeqs.find((s) => s > qty || outSeqs.has(s));
            if (bad !== undefined || line.pieceSeqs.length > available) {
              throw new SplitFailure(
                ORDER_SPLIT_ERRORS.UNITS_NOT_AVAILABLE,
                bad !== undefined
                  ? `Piece ${bad} of ${item.product_name ?? 'item'} is not available to split`
                  : `Only ${Math.max(0, available)} unit(s) of ${item.product_name ?? 'item'} are available to split`
              );
            }
            planned.push({ item, units: line.pieceSeqs.length, pieceSeqs: line.pieceSeqs });
          } else {
            if (available <= 0) {
              throw new SplitFailure(
                ORDER_SPLIT_ERRORS.UNITS_NOT_AVAILABLE,
                `${item.product_name ?? 'Item'} has no units left to split`
              );
            }
            const freeSeqs: number[] = [];
            for (let s = 1; s <= qty && freeSeqs.length < available; s += 1) {
              if (!outSeqs.has(s)) freeSeqs.push(s);
            }
            planned.push({ item, units: available, pieceSeqs: freeSeqs.length === available ? freeSeqs : null });
          }
        }
        const movedUnits = planned.reduce((sum, p) => sum + p.units, 0);
        if (movedUnits <= 0) {
          throw new SplitFailure(ORDER_SPLIT_ERRORS.NOTHING_SELECTED, 'Select at least one item or piece to split');
        }
        if (movedUnits > MAX_UNITS_PER_SPLIT) {
          throw new SplitFailure(ORDER_SPLIT_ERRORS.UNITS_NOT_AVAILABLE, 'Too many units in one split');
        }

        // The parent must keep at least one unit (otherwise this is not a split).
        const allLines = await tx.org_order_items_dtl.findMany({
          where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1, deleted_order_change_id: null },
          select: { id: true, quantity: true, metadata: true },
        });
        const remainingUnits = allLines.reduce((sum, l) => {
          const left = Math.max(0, Number(l.quantity ?? 0) - readSplitOutQty(readMeta(l.metadata)));
          return sum + left;
        }, 0) - movedUnits;
        if (remainingUnits <= 0) {
          throw new SplitFailure(ORDER_SPLIT_ERRORS.WHOLE_ORDER, 'A split must leave at least one unit on the order');
        }

        // 3. Sub-order number LAST among the locks (locks the root order until COMMIT).
        const subOrderNo = await nextSubOrderNoWithTx(tx, tenantId, orderId);

        // 4. Sub-order header: operational copy, zero money (A-29).
        const now = new Date();
        const sub = await tx.org_orders_mst.create({
          data: {
            tenant_org_id: tenantId,
            order_no: subOrderNo,
            parent_order_id: orderId,
            order_subtype: ORDER_SPLIT_SUBTYPES.CHILD,
            branch_id: parent.branch_id,
            customer_id: parent.customer_id,
            order_type_id: parent.order_type_id,
            status: parent.status,
            current_status: parent.current_status,
            current_stage: parent.current_stage,
            priority: parent.priority,
            priority_multiplier: parent.priority_multiplier,
            service_category_code: parent.service_category_code,
            workflow_template_id: parent.workflow_template_id,
            wf_profile_id: parent.wf_profile_id,
            wf_version_no: parent.wf_version_no,
            wf_profile_version_id: parent.wf_profile_version_id,
            wf_profile_artifact_id: parent.wf_profile_artifact_id,
            wf_profile_revision: parent.wf_profile_revision,
            wf_profile_checksum: parent.wf_profile_checksum,
            wf_profile_schema_version: parent.wf_profile_schema_version,
            received_at: parent.received_at,
            ready_by: parent.ready_by,
            ready_by_at_new: parent.ready_by_at_new,
            physical_intake_status: parent.physical_intake_status,
            order_source_code: parent.order_source_code,
            currency_code: parent.currency_code,
            currency_ex_rate: parent.currency_ex_rate,
            is_retail: parent.is_retail,
            is_default_customer: parent.is_default_customer,
            customer_name: parent.customer_name,
            customer_mobile_number: parent.customer_mobile_number,
            customer_email: parent.customer_email,
            customer_details: parent.customer_details ?? undefined,
            service_speed: parent.service_speed,
            // Same commercial settings as the parent. commercial_calc_version stays empty: Edit refuses money on a sub-order.
            commercial_level: parent.commercial_level,
            tax_pricing_mode: parent.tax_pricing_mode,
            extra_price_pricing_mode: parent.extra_price_pricing_mode,
            disc_alloc_mode: parent.disc_alloc_mode,
            disc_alloc_basis: parent.disc_alloc_basis,
            total_items: planned.length,
            customer_notes: `Split from ${parent.order_no}: ${reason}`,
            internal_notes: `Split order created - reason: ${reason}`,
            created_at: now,
            created_by: userId,
            created_info: 'order-split.service',
            rec_status: 1,
          },
          select: { id: true, order_no: true },
        });

        // 4b. Consistency check: the DB trigger must have set the family root we expect.
        const subRoot = await tx.$queryRaw<Array<{ root_order_id: string | null }>>(Prisma.sql`
          SELECT root_order_id FROM public.org_orders_mst
          WHERE tenant_org_id = ${tenantId}::uuid AND id = ${sub.id}::uuid
        `);
        if (subRoot[0]?.root_order_id !== rootOrderId) {
          throw new Error(
            `ORD_ROOT_MISMATCH: sub-order ${sub.order_no} has root ${String(subRoot[0]?.root_order_id)}, expected ${rootOrderId}`
          );
        }

        // 5. Sub-order lines: zero price, linked to the parent line.
        // HFC P3: a line serial is unique per tenant, so a sub-order line gets its own `<sub order_no>-<n>`
        // (the sub-order is new, so n starts at 1); the parent line's serial is kept in metadata.
        for (const [lineIndex, p] of planned.entries()) {
          const subLineSrno = buildOrderItemSrno(sub.order_no, lineIndex + 1);
          await tx.org_order_items_dtl.create({
            data: {
              tenant_org_id: tenantId,
              order_id: sub.id,
              branch_id: parent.branch_id,
              service_category_code: p.item.service_category_code,
              order_item_srno: subLineSrno,
              product_id: p.item.product_id,
              product_name: p.item.product_name,
              product_name2: p.item.product_name2,
              barcode: subLineSrno,
              quantity: p.units,
              quantity_ready: 0,
              price_per_unit: 0,
              total_price: 0,
              status: p.item.status,
              item_status: p.item.item_status,
              item_stage: p.item.item_stage,
              notes: p.item.notes,
              color: p.item.color,
              brand: p.item.brand,
              has_stain: p.item.has_stain,
              has_damage: p.item.has_damage,
              stain_notes: p.item.stain_notes,
              damage_notes: p.item.damage_notes,
              service_speed: p.item.service_speed,
              ready_by_at: p.item.ready_by_at,
              // Zero line figures (I5 holds): the money stays on the parent line.
              money_basis: 'ALLOCATED',
              price_source: p.item.price_source,
              // Same source facts as the parent line (0699 pairs a list source with its list).
              price_list_id: p.item.price_list_id,
              speed_rule_id: p.item.speed_rule_id,
              list_unit_price: 0,
              speed_premium_amount: 0,
              line_disc_amount: 0,
              order_disc_alloc_amount: 0,
              net_amount: 0,
              tax_pricing_mode: p.item.tax_pricing_mode,
              tax_category_code: p.item.tax_category_code,
              tax_rate: 0,
              taxable_amount: 0,
              tax_amount: 0,
              line_total_amount: 0,
              metadata: {
                split_from_order_id: orderId,
                split_from_order_no: parent.order_no,
                split_from_item_id: p.item.id,
                split_from_item_srno: p.item.order_item_srno,
                split_root_order_id: rootOrderId,
                split_piece_seqs: p.pieceSeqs,
                money_on_parent: true,
              },
              created_at: now,
              created_by: userId,
              created_info: 'order-split.service',
              rec_status: 1,
            },
          });

          // 6. Parent line bookkeeping (metadata only; commercial facts untouched).
          const meta = readMeta(p.item.metadata);
          const nextSeqs = [...new Set([...readSplitOutSeqs(meta), ...(p.pieceSeqs ?? [])])].sort((a, b) => a - b);
          const splitLog = Array.isArray(meta.split_log) ? (meta.split_log as unknown[]) : [];
          await tx.org_order_items_dtl.updateMany({
            where: { tenant_org_id: tenantId, order_id: orderId, id: p.item.id },
            data: {
              metadata: {
                ...meta,
                split_out_qty: readSplitOutQty(meta) + p.units,
                split_out_piece_seqs: nextSeqs,
                split_log: [
                  ...splitLog,
                  { sub_order_id: sub.id, sub_order_no: sub.order_no, units: p.units, piece_seqs: p.pieceSeqs, at: now.toISOString() },
                ],
              } as Prisma.InputJsonValue,
              updated_at: now,
              updated_by: userId,
              updated_info: 'order-split.service',
            },
          });

          if (p.pieceSeqs && p.pieceSeqs.length > 0) {
            await tx.$executeRaw(Prisma.sql`
              UPDATE public.org_order_item_pieces_dtl
              SET metadata = COALESCE(metadata, '{}'::jsonb)
                    || jsonb_build_object('split_to_order_id', ${sub.id}::text, 'split_to_order_no', ${sub.order_no}::text),
                  updated_at = now(),
                  updated_by = ${userId},
                  updated_info = 'order-split.service'
              WHERE tenant_org_id = ${tenantId}::uuid
                AND order_id = ${orderId}::uuid
                AND order_item_id = ${p.item.id}::uuid
                AND piece_seq IN (${Prisma.join(p.pieceSeqs)})
                AND deleted_order_change_id IS NULL
            `);
          }
        }

        // 7. Parent header flag.
        await tx.org_orders_mst.updateMany({
          where: { tenant_org_id: tenantId, id: orderId },
          data: { has_split: true, updated_at: now, updated_by: userId, updated_info: 'order-split.service' },
        });

        // 8. History on the parent.
        await tx.org_order_history.create({
          data: {
            tenant_org_id: tenantId,
            order_id: orderId,
            action_type: ORDER_SPLIT_HISTORY_ACTION,
            from_value: parent.order_no,
            to_value: sub.order_no,
            payload: {
              reason,
              suborder_id: sub.id,
              suborder_no: sub.order_no,
              root_order_id: rootOrderId,
              units_moved: movedUnits,
              lines: planned.map((p) => ({ item_id: p.item.id, units: p.units, piece_seqs: p.pieceSeqs })),
              done_by_name: input.userName ?? null,
            },
            done_by: UUID_RE.test(userId) ? userId : null,
            done_at: now,
            created_by: userId,
            created_info: 'order-split.service',
          },
        });

        // 9. POS session stamp + zero financial snapshot for the sub-order.
        if (posSessionId) {
          await stampCreatedPosSession(tx, { tenantId, orderId: sub.id, posSessionId });
        }
        await recalculateOrderFinancialSnapshotTx(tx, tenantId, sub.id);

        return { suborder: { id: sub.id, order_no: sub.order_no }, rootOrderId, movedUnits };
      },
      { timeout: 15000, maxWait: 5000 }
    );

    logger.info('Order split', {
      feature: 'order-split',
      action: 'split',
      tenantId,
      userId,
      orderId,
      suborderId: result.suborder.id,
      suborderNo: result.suborder.order_no,
      rootOrderId: result.rootOrderId,
      movedUnits: result.movedUnits,
    });
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof SplitFailure) {
      return { success: false, errorCode: error.code, error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    const ordCode = parseOrderNumberError(message);
    const busy = /lock timeout|could not obtain lock|55P03|deadlock/i.test(message);
    logger.error('Order split failed', error instanceof Error ? error : new Error(message), {
      feature: 'order-split',
      action: 'split',
      tenantId,
      userId,
      orderId,
      ordCode,
    });
    if (busy) {
      return { success: false, errorCode: ORDER_SPLIT_ERRORS.BUSY, error: 'The order is busy. Please try again.' };
    }
    if (ordCode) {
      return { success: false, errorCode: ORDER_SPLIT_ERRORS.NUMBERING_FAILED, error: `Sub-order numbering failed (${ordCode})` };
    }
    return { success: false, errorCode: ORDER_SPLIT_ERRORS.FAILED, error: 'Failed to split the order' };
  }
}

/**
 * Builds split lines from a request, throwing a typed failure for bad piece ids.
 * @param input item ids (whole remaining lines) and/or piece ids
 * @param input.itemIds
 * @param input.pieceIds
 * @returns lines, or a failure result
 */
export function buildSplitLines(input: {
  itemIds?: string[] | null;
  pieceIds?: string[] | null;
}): { ok: true; lines: OrderSplitLineInput[] } | { ok: false; errorCode: OrderSplitError; error: string } {
  try {
    const lines: OrderSplitLineInput[] = [];
    if (input.pieceIds && input.pieceIds.length > 0) lines.push(...piecesToSplitLines(input.pieceIds));
    if (input.itemIds && input.itemIds.length > 0) lines.push(...input.itemIds.map((itemId) => ({ itemId })));
    return { ok: true, lines };
  } catch (error) {
    if (error instanceof SplitFailure) return { ok: false, errorCode: error.code, error: error.message };
    throw error;
  }
}
