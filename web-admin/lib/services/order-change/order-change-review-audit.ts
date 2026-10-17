/**
 * Preview copies of the operation snapshots Apply will store.
 * The review dialog shows these facts before any row is written.
 */

import { PREFS_LEVEL, PREFS_OWNER_TYPE, PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import { ITEM_FIELDS, PIECE_FIELDS } from '@/lib/services/order-change/order-change-commercial-write';
import type { OrderChangePreferenceDefinition } from '@/lib/services/order-change/order-change-preference-projection';
import type { OrderChangeSpeedAudit } from '@/lib/services/order-change/order-change-preview.service';

type ChangeOperation = z.infer<typeof orderChangeRequestSchema>['operations'][number];

/** One operation's stored facts, in the same column shape as the change history row. */
export interface OrderChangeOperationAudit {
  seq: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/** Richer rows loaded for preview. Context fills any target that was not loaded. */
export interface OrderChangePreviewAuditFacts {
  order: Record<string, unknown> | null;
  items: Readonly<Record<string, Record<string, unknown>>>;
  pieces: Readonly<Record<string, Record<string, unknown>>>;
  preferences: Readonly<Record<string, Record<string, unknown>>>;
  products: Readonly<Record<string, { product_name: string | null; product_name2: string | null; service_category_code: string | null }>>;
}

interface ReviewLine {
  id: string;
  unitPrice: string;
  merchandiseAmount: string;
}

function compact(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function keyOf(id: string): string {
  return id.toLowerCase();
}

function orderFromContext(context: OrderChangeContext): Record<string, unknown> {
  return compact({
    current_status: context.workflow.currentStatus,
    priority: context.order.priority,
    service_speed: context.order.serviceSpeed,
    ready_by: context.order.readyBy,
    internal_notes: context.order.notes,
    customer_notes: context.order.customerNotes,
    customer_name: context.order.customerSnapshot.name,
    customer_mobile_number: context.order.customerSnapshot.mobile,
    customer_email: context.order.customerSnapshot.email,
    currency_code: context.order.currencyCode,
    payment_type_code: context.order.paymentTypeCode,
    total_amount: context.financial.totalAmount,
    total_paid_amount: context.financial.netCollectedAmount,
    outstanding_amount: context.financial.outstandingAmount,
  });
}

function itemFromContext(item: OrderChangeContext['items'][number]): Record<string, unknown> {
  return compact({
    id: item.id,
    product_id: item.productId,
    product_name: item.productName,
    product_name2: item.productName2,
    service_category_code: item.serviceCategoryCode,
    quantity: item.quantity,
    price_per_unit: item.pricePerUnit,
    total_price: item.totalPrice,
    price_override: item.priceOverride,
    service_pref_charge: item.preferenceCharge,
    packing_pref_code: item.packingPreferenceCode,
    rec_status: 1,
  });
}

function pieceFromContext(piece: OrderChangeContext['pieces'][number]): Record<string, unknown> {
  return compact({
    id: piece.id,
    order_item_id: piece.orderItemId,
    piece_seq: piece.pieceSeq,
    piece_status: piece.pieceStatus,
    piece_stage: piece.pieceStage,
    scan_state: piece.scanState,
    rec_status: 1,
  });
}

function preferenceFromContext(row: OrderChangeContext['preferences'][number]): Record<string, unknown> {
  return compact({
    id: row.id,
    prefs_level: row.level,
    order_item_id: row.orderItemId,
    order_item_piece_id: row.orderItemPieceId,
    preference_id: row.preferenceId,
    preference_code: row.preferenceCode,
    preference_content: row.preferenceContent,
    preference_sys_kind: row.preferenceKind,
    preference_category: row.preferenceCategory,
    extra_price: row.extraPrice,
    processing_confirmed: row.processingConfirmed,
    rec_status: 1,
  });
}

function preferenceLevel(kind: ChangeOperation['target']['kind']): string {
  if (kind === 'ORDER') return PREFS_LEVEL.ORDER;
  if (kind === 'PERSISTED_PIECE' || kind === 'LOCAL_PIECE') return PREFS_LEVEL.PIECE;
  return PREFS_LEVEL.ITEM;
}

function fieldValue(kind: 'text' | 'bool' | 'money', value: string): unknown {
  if (kind === 'bool') return value === 'true';
  if (value === '') return null;
  return value;
}

/**
 * Builds the before and after values the review screen shows.
 * Stored rows win when preview loaded them. Otherwise the open order context is used.
 */
export function buildPreviewOperationAudits(input: {
  context: OrderChangeContext;
  operations: readonly ChangeOperation[];
  lines: readonly ReviewLine[];
  catalog: readonly OrderChangePreferenceDefinition[];
  speedAudit?: OrderChangeSpeedAudit;
  auditFacts?: OrderChangePreviewAuditFacts;
}): OrderChangeOperationAudit[] {
  const facts = input.auditFacts;
  const order = facts?.order ?? orderFromContext(input.context);
  const itemById = (id: string) => facts?.items[keyOf(id)]
    ?? input.context.items.filter((item) => keyOf(item.id) === keyOf(id)).map(itemFromContext)[0];
  const pieceById = (id: string) => facts?.pieces[keyOf(id)]
    ?? input.context.pieces.filter((piece) => keyOf(piece.id) === keyOf(id)).map(pieceFromContext)[0];
  const preferenceById = (id: string) => facts?.preferences[keyOf(id)]
    ?? input.context.preferences.filter((row) => keyOf(row.id) === keyOf(id)).map(preferenceFromContext)[0];
  const lineFor = (id: string) => input.lines.find((line) => keyOf(line.id) === keyOf(id));

  return input.operations.map((operation) => {
    if (operation.code === 'CHANGE_SERVICE_SPEED' && input.speedAudit) {
      const items = (snapshot: OrderChangeSpeedAudit['before']) => snapshot.items.map((item) => compact({
        id: item.orderItemId,
        product_name: input.context.items.find((row) => keyOf(row.id) === keyOf(item.orderItemId))?.productName,
        quantity: item.quantity,
        price_per_unit: item.pricePerUnit,
        total_price: item.totalPrice,
      }));
      return {
        seq: operation.seq,
        before: compact({ ...order, service_speed: input.speedAudit.before.serviceSpeed, total_amount: input.speedAudit.before.totalAmount, total_tax_amount: input.speedAudit.before.taxAmount, commercial_delta: input.speedAudit.before.commercialDelta, items: items(input.speedAudit.before) }),
        after: compact({ ...order, service_speed: input.speedAudit.after.serviceSpeed, total_amount: input.speedAudit.after.totalAmount, total_tax_amount: input.speedAudit.after.taxAmount, commercial_delta: input.speedAudit.after.commercialDelta, express_charge_amount: '0.0000', items: items(input.speedAudit.after) }),
      };
    }
    if (operation.code === 'ADD_ITEM') {
      const product = facts?.products[keyOf(operation.payload.productId)];
      const line = lineFor(operation.payload.clientRef);
      return {
        seq: operation.seq,
        before: {},
        after: compact({
          id: operation.payload.clientRef,
          rec_status: 1,
          product_id: operation.payload.productId,
          product_name: product?.product_name,
          product_name2: product?.product_name2,
          service_category_code: product?.service_category_code,
          quantity: operation.payload.quantity,
          price_per_unit: line?.unitPrice,
          total_price: line?.merchandiseAmount,
        }),
      };
    }
    if (operation.code === 'ADD_PIECE') {
      const parentId = operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : operation.target.clientRef;
      const line = lineFor(parentId);
      return {
        seq: operation.seq,
        before: {},
        after: compact({
          id: operation.payload.clientRef,
          rec_status: 1,
          order_item_id: parentId,
          quantity: 1,
          price_per_unit: line?.unitPrice,
          total_price: line?.unitPrice,
          scan_state: 'expected',
          is_ready: false,
        }),
      };
    }
    if (operation.code === 'ADD_PREFERENCE') {
      const catalog = input.catalog.find((row) => keyOf(row.id) === keyOf(operation.payload.preferenceId));
      const pieceId = operation.target.kind === 'PERSISTED_PIECE' ? operation.target.id : null;
      const itemId = operation.target.kind === 'PERSISTED_ITEM'
        ? operation.target.id
        : pieceId
          ? input.context.pieces.find((piece) => keyOf(piece.id) === keyOf(pieceId))?.orderItemId ?? null
          : null;
      return {
        seq: operation.seq,
        before: {},
        after: compact({
          rec_status: 1,
          prefs_level: catalog?.level ?? preferenceLevel(operation.target.kind),
          preference_id: operation.payload.preferenceId,
          preference_code: catalog?.code ?? operation.payload.preferenceCode,
          preference_content: operation.payload.preferenceContent ?? catalog?.code ?? operation.payload.preferenceCode,
          preference_sys_kind: catalog?.kind,
          preference_category: catalog?.category || undefined,
          prefs_owner_type: PREFS_OWNER_TYPE.SYSTEM,
          prefs_source: PREFS_SOURCE_STAGE.ORDER_EDIT,
          processing_confirmed: false,
          extra_price: catalog?.extraPrice,
          order_item_id: itemId,
          order_item_piece_id: pieceId,
        }),
      };
    }
    if (operation.code === 'REMOVE_ITEM' && operation.target.kind === 'PERSISTED_ITEM') {
      const before = itemById(operation.target.id) ?? {};
      return { seq: operation.seq, before, after: compact({ ...before, rec_status: 0 }) };
    }
    if (operation.code === 'CHANGE_ITEM_QUANTITY') {
      const before = itemById(operation.target.id) ?? {};
      const line = lineFor(operation.target.id);
      return {
        seq: operation.seq,
        before,
        after: compact({ ...before, quantity: operation.payload.quantity, price_per_unit: line?.unitPrice ?? before.price_per_unit, total_price: line?.merchandiseAmount ?? before.total_price }),
      };
    }
    if (operation.code === 'REMOVE_PIECE' && operation.target.kind === 'PERSISTED_PIECE') {
      const before = pieceById(operation.target.id) ?? {};
      return { seq: operation.seq, before, after: compact({ ...before, rec_status: 0 }) };
    }
    if (operation.code === 'CHANGE_PREFERENCE' || operation.code === 'REMOVE_PREFERENCE') {
      const before = preferenceById(operation.target.id) ?? {};
      if (operation.code === 'REMOVE_PREFERENCE') return { seq: operation.seq, before, after: compact({ ...before, rec_status: 0 }) };
      return { seq: operation.seq, before, after: compact({ ...before, preference_content: operation.payload.preferenceContent ?? null }) };
    }
    if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'PERSISTED_ITEM') {
      const before = itemById(operation.target.id) ?? {};
      const field = ITEM_FIELDS[operation.payload.field];
      return { seq: operation.seq, before, after: field ? compact({ ...before, [field.column]: fieldValue(field.kind, operation.payload.value) }) : before };
    }
    if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'PERSISTED_PIECE') {
      const before = pieceById(operation.target.id) ?? {};
      const field = PIECE_FIELDS[operation.payload.field];
      return { seq: operation.seq, before, after: field ? compact({ ...before, [field.column]: fieldValue(field.kind, operation.payload.value) }) : before };
    }
    const before = order;
    if (operation.code === 'CHANGE_PRIORITY') return { seq: operation.seq, before, after: compact({ ...before, priority: operation.payload.priority }) };
    if (operation.code === 'CHANGE_READY_BY') return { seq: operation.seq, before, after: compact({ ...before, ready_by: operation.payload.readyBy }) };
    if (operation.code === 'CHANGE_ORDER_NOTES') {
      return {
        seq: operation.seq,
        before,
        after: compact({
          ...before,
          ...(operation.payload.notes !== undefined ? { internal_notes: operation.payload.notes } : {}),
          ...(operation.payload.customerNotes !== undefined ? { customer_notes: operation.payload.customerNotes } : {}),
        }),
      };
    }
    if (operation.code === 'CHANGE_CUSTOMER_SNAPSHOT') {
      return {
        seq: operation.seq,
        before,
        after: compact({
          ...before,
          ...(operation.payload.customerName !== undefined ? { customer_name: operation.payload.customerName } : {}),
          ...(operation.payload.customerMobile !== undefined ? { customer_mobile_number: operation.payload.customerMobile } : {}),
          ...(operation.payload.customerEmail !== undefined ? { customer_email: operation.payload.customerEmail } : {}),
        }),
      };
    }
    if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'ORDER' && operation.payload.field === 'order.readyBy') {
      return { seq: operation.seq, before, after: compact({ ...before, ready_by: operation.payload.value === '' ? null : operation.payload.value }) };
    }
    return { seq: operation.seq, before, after: before };
  });
}
