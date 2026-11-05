/**
 * Writes reviewed item and piece structure inside the Change transaction.
 * Existing piece ids stay. A new piece receives only its own new id.
 * Prices come from the reviewed calculation lines.
 */

import { reviewedItemTotal } from '@/lib/services/order-change/order-change-edit-pricing';
import type { OrderChangePersistedOperation, OrderChangeRowWrite } from '@/lib/services/order-change/order-change-mutation.service';
import { OrderChangeApplyRejected } from '@/lib/services/order-change/order-change-commercial-write';
import { ORDER_ITEM_SRNO_LOCK_PREFIX } from '@/lib/services/order-item-code.service';
import type { z } from 'zod';
import type { orderChangeApplyRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

type ApplyRequest = z.infer<typeof orderChangeApplyRequestSchema>;
type ApplyOperation = ApplyRequest['operations'][number];

export const STRUCTURAL_OPERATION_CODES = new Set([
  'ADD_ITEM',
  'REMOVE_ITEM',
  'CHANGE_ITEM_QUANTITY',
  'ADD_PIECE',
  'REMOVE_PIECE',
]);

export interface StructuralLinePrice {
  id: string;
  active: boolean;
  unitPrice: string;
  merchandiseAmount: string;
  embeddedExtra?: string;
}

export interface StructuralProductFact {
  id: string;
  productName: string | null;
  productName2: string | null;
  serviceCategoryCode: string | null;
}

export interface StructuralWriteFacts {
  products: ReadonlyMap<string, StructuralProductFact>;
  pieceItemIds: ReadonlyMap<string, string>;
  branchId: string | null;
  orderNo: string;
  itemStatus: string;
  nextItemSerial: number;
  nextPieceSeqByItemId: ReadonlyMap<string, number>;
}

export interface StructuralWritePlan {
  itemInserts: OrderChangeRowWrite[];
  pieceInserts: OrderChangeRowWrite[];
  itemUpdates: OrderChangeRowWrite[];
  removeItemIds: string[];
  removePieceIds: string[];
  auditBySeq: Map<number, Pick<OrderChangePersistedOperation, 'targetType' | 'orderItemId' | 'orderItemPieceId' | 'orderPreferenceId' | 'clientRef'>>;
}

interface StructuralQueryTx {
  $queryRaw?<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

const EMPTY_FACTS: StructuralWriteFacts = {
  products: new Map(),
  pieceItemIds: new Map(),
  branchId: null,
  orderNo: '',
  itemStatus: 'processing',
  nextItemSerial: 1,
  nextPieceSeqByItemId: new Map(),
};

function keyOf(id: string): string {
  return id.toLowerCase();
}

function lineFor(lines: readonly StructuralLinePrice[], id: string): StructuralLinePrice {
  const line = lines.find((entry) => keyOf(entry.id) === keyOf(id));
  if (!line || !line.active) throw new OrderChangeApplyRejected(422, 'STRUCTURE_PRICE_MISSING');
  return line;
}

export async function loadStructuralWriteFacts(
  tx: StructuralQueryTx,
  tenantId: string,
  orderId: string,
  operations: readonly ApplyOperation[],
): Promise<StructuralWriteFacts> {
  if (!tx.$queryRaw) throw new OrderChangeApplyRejected(422, 'STRUCTURE_CATALOG_MISSING');
  const query = tx.$queryRaw.bind(tx);
  // HFC P3: new lines continue from the order's highest `<order_no>-<n>`. Take the same per-order lock as the DB
  // trigger (fn_next_order_item_srno) in its own statement first, so the read below sees every committed line.
  if (operations.some((operation) => operation.code === 'ADD_ITEM')) {
    const lockKey = `${ORDER_ITEM_SRNO_LOCK_PREFIX}${orderId}`;
    await query<Array<{ locked: number }>>`
      SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}::text, 0))) AS srno_lock
    `;
  }
  const orderRows = await query<Array<{ order_no: string; branch_id: string | null; current_status: string | null; item_count: number; item_serial_max?: number | null }>>`
    SELECT o.order_no,
           o.branch_id,
           o.current_status,
           (
             SELECT COUNT(*)::int
             FROM public.org_order_items_dtl item
             WHERE item.tenant_org_id = o.tenant_org_id
               AND item.order_id = o.id
           ) AS item_count,
           (
             SELECT COALESCE(MAX(substring(item.order_item_srno FROM length(o.order_no) + 2)::int), 0)::int
             FROM public.org_order_items_dtl item
             WHERE item.tenant_org_id = o.tenant_org_id
               AND item.order_id = o.id
               AND left(item.order_item_srno, length(o.order_no) + 1) = o.order_no || '-'
               AND substring(item.order_item_srno FROM length(o.order_no) + 2) ~ '^[1-9][0-9]{0,8}$'
           ) AS item_serial_max
    FROM public.org_orders_mst o
    WHERE o.id = ${orderId}::uuid
      AND o.tenant_org_id = ${tenantId}::uuid
  `;
  const order = orderRows[0];
  if (!order) throw new OrderChangeApplyRejected(422, 'STRUCTURE_CATALOG_MISSING');

  const products = new Map<string, StructuralProductFact>();
  for (const operation of operations) {
    if (operation.code !== 'ADD_ITEM') continue;
    const productId = operation.payload.productId;
    // A custom item (P6-02d) names itself; there is no catalog row to read.
    if (!productId) continue;
    const rows = await query<Array<{ id: string; product_name: string | null; product_name2: string | null; service_category_code: string | null }>>`
      SELECT id, product_name, product_name2, service_category_code
      FROM public.org_product_data_mst
      WHERE id = ${productId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND rec_status = 1
    `;
    const product = rows[0];
    if (!product) throw new OrderChangeApplyRejected(422, 'STRUCTURE_CATALOG_MISSING');
    products.set(keyOf(product.id), {
      id: product.id,
      productName: product.product_name,
      productName2: product.product_name2,
      serviceCategoryCode: product.service_category_code,
    });
  }

  const pieceItemIds = new Map<string, string>();
  const nextPieceSeqByItemId = new Map<string, number>();
  const pieceIds = operations.flatMap((operation) => (
    operation.code === 'REMOVE_PIECE' && operation.target.kind === 'PERSISTED_PIECE' ? [operation.target.id] : []
  ));
  for (const pieceId of pieceIds) {
    const rows = await query<Array<{ order_item_id: string }>>`
      SELECT order_item_id
      FROM public.org_order_item_pieces_dtl
      WHERE id = ${pieceId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
        AND rec_status = 1
    `;
    const parent = rows[0];
    if (!parent) throw new OrderChangeApplyRejected(422, 'STRUCTURE_TARGET_UNRESOLVED');
    pieceItemIds.set(keyOf(pieceId), parent.order_item_id);
  }

  const parentIds = new Set<string>();
  for (const operation of operations) {
    if (operation.code !== 'ADD_PIECE') continue;
    if (operation.target.kind === 'PERSISTED_ITEM') parentIds.add(operation.target.id);
  }
  for (const itemId of parentIds) {
    const rows = await query<Array<{ next_seq: number }>>`
      SELECT COALESCE(MAX(piece_seq), 0)::int + 1 AS next_seq
      FROM public.org_order_item_pieces_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
        AND order_item_id = ${itemId}::uuid
        AND rec_status = 1
    `;
    nextPieceSeqByItemId.set(keyOf(itemId), rows[0]?.next_seq ?? 1);
  }

  return {
    products,
    pieceItemIds,
    branchId: order.branch_id,
    orderNo: order.order_no,
    itemStatus: order.current_status || 'processing',
    nextItemSerial: Math.max(Number(order.item_count) || 0, Number(order.item_serial_max ?? 0) || 0) + 1,
    nextPieceSeqByItemId,
  };
}

export function buildStructuralWritePlan(
  operations: readonly ApplyOperation[],
  lines: readonly StructuralLinePrice[],
  facts: StructuralWriteFacts,
  actorUserId: string,
): StructuralWritePlan {
  const plan: StructuralWritePlan = {
    itemInserts: [],
    pieceInserts: [],
    itemUpdates: [],
    removeItemIds: [],
    removePieceIds: [],
    auditBySeq: new Map(),
  };
  const quantityPieceIds = new Set<string>();
  let serial = facts.nextItemSerial;
  const pieceSeq = new Map(facts.nextPieceSeqByItemId);

  for (const operation of operations) {
    if (operation.code === 'ADD_ITEM') {
      const line = lineFor(lines, operation.payload.clientRef);
      const custom = operation.payload.customItem;
      const product: StructuralProductFact | undefined = custom
        ? { id: '', productName: custom.name, productName2: custom.name2 ?? null, serviceCategoryCode: custom.serviceCategoryCode ?? null }
        : facts.products.get(keyOf(operation.payload.productId ?? ''));
      if (!product) throw new OrderChangeApplyRejected(422, 'STRUCTURE_CATALOG_MISSING');
      plan.itemInserts.push({
        id: operation.payload.clientRef,
        data: {
          branch_id: facts.branchId,
          service_category_code: product.serviceCategoryCode,
          order_item_srno: `${facts.orderNo}-${serial}`,
          // HFC P3: the line barcode is the plain serial (labels draw the image at print time).
          barcode: `${facts.orderNo}-${serial}`,
          // A custom item is stored like Create's (P5-03e): no product, its own name.
          product_id: custom ? null : product.id,
          product_name: product.productName,
          product_name2: product.productName2,
          quantity: operation.payload.quantity,
          price_per_unit: line.unitPrice,
          total_price: reviewedItemTotal(line),
          price_override: operation.payload.priceOverride ?? null,
          override_reason: operation.payload.overrideReason ?? null,
          status: facts.itemStatus,
          item_status: facts.itemStatus,
          created_by: actorUserId,
        },
      });
      serial += 1;
      plan.auditBySeq.set(operation.seq, {
        targetType: 'ITEM',
        orderItemId: operation.payload.clientRef,
        orderItemPieceId: null,
        orderPreferenceId: null,
        clientRef: operation.payload.clientRef,
      });
    }

    if (operation.code === 'REMOVE_ITEM' && operation.target.kind === 'PERSISTED_ITEM') {
      plan.removeItemIds.push(operation.target.id);
      plan.auditBySeq.set(operation.seq, {
        targetType: 'ITEM',
        orderItemId: operation.target.id,
        orderItemPieceId: null,
        orderPreferenceId: null,
        clientRef: null,
      });
    }

    if (operation.code === 'CHANGE_ITEM_QUANTITY') {
      const line = lineFor(lines, operation.target.id);
      plan.itemUpdates.push({
        id: operation.target.id,
        data: {
          quantity: operation.payload.quantity,
          price_per_unit: line.unitPrice,
          total_price: reviewedItemTotal(line),
          updated_by: actorUserId,
        },
      });
      for (const pieceId of operation.payload.selectedPieceIds ?? []) {
        quantityPieceIds.add(keyOf(pieceId));
        plan.removePieceIds.push(pieceId);
      }
      plan.auditBySeq.set(operation.seq, {
        targetType: 'ITEM',
        orderItemId: operation.target.id,
        orderItemPieceId: null,
        orderPreferenceId: null,
        clientRef: null,
      });
    }

    if (operation.code === 'ADD_PIECE') {
      const parentId = operation.target.kind === 'PERSISTED_ITEM'
        ? operation.target.id
        : operation.target.clientRef;
      const seqKey = keyOf(parentId);
      const seq = pieceSeq.get(seqKey) ?? 1;
      pieceSeq.set(seqKey, seq + 1);
      const parentLine = lineFor(lines, parentId);
      plan.pieceInserts.push({
        id: operation.payload.clientRef,
        data: {
          order_item_id: parentId,
          branch_id: facts.branchId,
          piece_seq: seq,
          scan_state: 'expected',
          quantity: 1,
          price_per_unit: parentLine.unitPrice,
          total_price: parentLine.unitPrice,
          piece_status: facts.itemStatus,
          is_ready: false,
          created_by: actorUserId,
        },
      });
      plan.auditBySeq.set(operation.seq, {
        targetType: 'PIECE',
        orderItemId: parentId,
        orderItemPieceId: operation.payload.clientRef,
        orderPreferenceId: null,
        clientRef: operation.payload.clientRef,
      });
    }

    if (operation.code === 'REMOVE_PIECE' && operation.target.kind === 'PERSISTED_PIECE') {
      if (quantityPieceIds.has(keyOf(operation.target.id))) {
        throw new OrderChangeApplyRejected(422, 'QUANTITY_DOUBLE_COUNT');
      }
      const itemId = facts.pieceItemIds.get(keyOf(operation.target.id));
      if (!itemId) throw new OrderChangeApplyRejected(422, 'STRUCTURE_TARGET_UNRESOLVED');
      plan.removePieceIds.push(operation.target.id);
      plan.auditBySeq.set(operation.seq, {
        targetType: 'PIECE',
        orderItemId: itemId,
        orderItemPieceId: operation.target.id,
        orderPreferenceId: null,
        clientRef: null,
      });
    }
  }

  return plan;
}

export function emptyStructuralFacts(): StructuralWriteFacts {
  return EMPTY_FACTS;
}
