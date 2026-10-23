/**
 * Preview copies of the operation snapshots Apply will store.
 * The review dialog shows these facts before any row is written.
 */

import { createHash } from 'node:crypto';
import { toMoneyString } from '@/lib/utils/money';
import { reviewedItemTotal } from './order-change-calculation.service';
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
  code: string;
  titleKey: string;
  targetLabel: string | null;
  targetLabel2: string | null;
  preferenceKind: string | null;
  effect: 'add' | 'change' | 'remove';
  changedKeys: string[];
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  itemLabels: Array<{ orderItemId: string; label: string | null; label2: string | null }>;
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
  embeddedExtra?: string;
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
function projectPreviewOperationRows(input: {
  context: OrderChangeContext;
  operations: readonly ChangeOperation[];
  lines: readonly ReviewLine[];
  catalog: readonly OrderChangePreferenceDefinition[];
  speedAudit?: OrderChangeSpeedAudit;
  auditFacts?: OrderChangePreviewAuditFacts;
}): Array<{seq: number; before: Record<string, unknown>; after: Record<string, unknown>}> {
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
          total_price: line ? reviewedItemTotal(line) : undefined,
          price_override: operation.payload.priceOverride ?? null,
          override_reason: operation.payload.overrideReason ?? null,
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
        after: compact({ ...before, quantity: operation.payload.quantity, price_per_unit: line?.unitPrice ?? before.price_per_unit, total_price: line ? reviewedItemTotal(line) : before.total_price }),
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

type Values = Record<string, unknown>;

const IDENTITY_KEYS = new Set(['orderId', 'orderItemId', 'orderItemPieceId', 'orderPreferenceId', 'clientRef', 'productId', 'preferenceId', 'targetId', 'recStatus']);

function amount(value: unknown): string | null {
  return value == null ? null : toMoneyString(String(value));
}

function time(value: unknown): string | null {
  return value == null ? null : new Date(String(value)).toISOString();
}

function read(row: Values, key: string): unknown {
  return row[key] ?? null;
}

/**
 * One canonical key contract for the reviewed projection and the committed row.
 * Raw database columns stay outside this function's public result.
 * @param input Stored/projected rows already scoped to one organization and order.
 * @returns The immutable business facts signed by Review and stored by Apply.
 */
export function buildOrderChangeOperationAudit(input: {
  operation: ChangeOperation;
  orderId: string;
  before: Values;
  after: Values;
  orderBefore: Values;
  orderAfter: Values;
  targetLabel?: string | null;
  targetLabel2?: string | null;
  itemLabels?: OrderChangeOperationAudit['itemLabels'];
}): OrderChangeOperationAudit {
  const { operation } = input;
  const add = operation.code.startsWith('ADD_');
  const remove = operation.code.startsWith('REMOVE_');
  const snapshot = (row: Values, order: Values): Values => {
    const result: Values = { orderId: input.orderId };
    const itemId = row.order_item_id ?? (operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : operation.target.kind === 'LOCAL_ITEM' ? operation.target.clientRef : null);
    const pieceId = row.order_item_piece_id ?? (operation.target.kind === 'PERSISTED_PIECE' ? operation.target.id : operation.target.kind === 'LOCAL_PIECE' ? operation.target.clientRef : null);
    const money = () => Object.assign(result, { totalAmount: amount(order.total_amount), taxAmount: amount(order.total_tax_amount) });
    const item = operation.code === 'ADD_ITEM' || operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY';
    const piece = operation.code === 'ADD_PIECE' || operation.code === 'REMOVE_PIECE';
    const preference = operation.code === 'ADD_PREFERENCE' || operation.code === 'CHANGE_PREFERENCE' || operation.code === 'REMOVE_PREFERENCE';
    if (item) {
      result.orderItemId = row.id ?? (operation.code === 'ADD_ITEM' ? operation.payload.clientRef : itemId);
      result.productId = read(row, 'product_id');
      result.quantity = read(row, 'quantity');
      result.pricePerUnit = amount(row.price_per_unit);
      result.totalPrice = amount(row.total_price);
      if (operation.code !== 'CHANGE_ITEM_QUANTITY') {
        result.productName = read(row, 'product_name');
        result.productName2 = read(row, 'product_name2');
        result.priceOverride = amount(row.price_override);
        result.serviceCategoryCode = read(row, 'service_category_code');
        if (operation.code === 'ADD_ITEM') result.overrideReason = read(row, 'override_reason');
        else result.preferenceCharge = amount(row.service_pref_charge);
      }
      money();
    } else if (piece) {
      result.orderItemId = itemId;
      result.orderItemPieceId = row.id ?? (operation.code === 'ADD_PIECE' ? operation.payload.clientRef : pieceId);
      result.pieceSeq = read(row, 'piece_seq');
      result.quantity = read(row, 'quantity');
      result.pricePerUnit = amount(row.price_per_unit);
      result.totalPrice = amount(row.total_price);
      result.pieceStatus = read(row, 'piece_status');
      result.pieceStage = read(row, 'piece_stage');
      result.scanState = read(row, 'scan_state');
      if (operation.code === 'REMOVE_PIECE') result.brand = read(row, 'brand');
      money();
    } else if (preference) {
      result.orderPreferenceId = row.id ?? (operation.code === 'ADD_PREFERENCE' ? operation.payload.clientRef : operation.target.id);
      result.orderItemId = itemId;
      result.orderItemPieceId = pieceId;
      result.level = read(row, 'prefs_level');
      result.preferenceId = read(row, 'preference_id');
      result.preferenceCode = read(row, 'preference_code');
      result.preferenceKind = read(row, 'preference_sys_kind');
      result.preferenceContent = read(row, 'preference_content');
      result.extraPrice = amount(row.extra_price);
      money();
    } else if (operation.code === 'CHANGE_PRIORITY') {
      result.priority = read(row, 'priority');
      money();
    } else if (operation.code === 'CHANGE_READY_BY') {
      result.readyBy = time(row.ready_by);
    } else if (operation.code === 'CHANGE_ORDER_NOTES') {
      result.notes = read(row, 'internal_notes');
      result.customerNotes = read(row, 'customer_notes');
    } else if (operation.code === 'CHANGE_CUSTOMER_SNAPSHOT') {
      result.customerName = read(row, 'customer_name');
      result.customerMobile = read(row, 'customer_mobile_number');
      result.customerEmail = read(row, 'customer_email');
      result.isDefaultCustomer = read(row, 'is_default_customer');
      if (JSON.stringify(input.before.customer_details ?? null) !== JSON.stringify(input.after.customer_details ?? null)) {
        result.customerDetails = read(row, 'customer_details');
      }
    } else if (operation.code === 'CHANGE_SERVICE_SPEED') {
      result.serviceSpeed = read(row, 'service_speed');
      result.commercialDelta = amount(row.commercial_delta);
      result.items = Array.isArray(row.items) ? row.items.map((entry: Values) => ({
        orderItemId: entry.orderItemId ?? entry.id,
        quantity: entry.quantity,
        pricePerUnit: amount(entry.pricePerUnit ?? entry.price_per_unit),
        totalPrice: amount(entry.totalPrice ?? entry.total_price),
      })) : [];
      result.totalAmount = amount(row.total_amount ?? order.total_amount);
      result.taxAmount = amount(row.total_tax_amount ?? order.total_tax_amount);
    } else if (operation.code === 'CHANGE_UNLISTED') {
      const field = operation.target.kind === 'PERSISTED_ITEM' ? ITEM_FIELDS[operation.payload.field] : PIECE_FIELDS[operation.payload.field];
      result.field = operation.payload.field;
      result.value = field ? read(row, field.column) : null;
      result.targetKind = operation.target.kind;
      if ('id' in operation.target) result.targetId = operation.target.id;
      if (itemId) result.orderItemId = itemId;
      if (pieceId) result.orderItemPieceId = pieceId;
    }
    if (add && 'clientRef' in operation.payload) result.clientRef = operation.payload.clientRef;
    return result;
  };
  const before = add ? {} : snapshot(input.before, input.orderBefore);
  const after = snapshot(input.after, input.orderAfter);
  if (remove) after.recStatus = 0;
  const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) =>
    !IDENTITY_KEYS.has(key) && (add || JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)),
  );
  return {
    seq: operation.seq,
    code: operation.code,
    titleKey: `orders.edit.policyInfo.operations.${operation.code}`,
    targetLabel: input.targetLabel ?? null,
    targetLabel2: input.targetLabel2 ?? null,
    preferenceKind: typeof after.preferenceKind === 'string' ? after.preferenceKind : null,
    effect: add ? 'add' : remove ? 'remove' : 'change',
    changedKeys,
    beforeValues: before,
    afterValues: after,
    before,
    after,
    itemLabels: input.itemLabels ?? [],
  };
}

/** Stable ordering and sorted object keys bind the exact history facts without display metadata. */
export function digestOrderChangeOperationAudits(audits: readonly Pick<OrderChangeOperationAudit, 'seq' | 'code' | 'beforeValues' | 'afterValues'>[]): string {
  const canonical = (value: unknown): string => {
    if (value == null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    const row = value as Values;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  };
  return createHash('sha256').update(canonical([...audits].sort((a, b) => a.seq - b.seq).map(({ seq, code, beforeValues, afterValues }) => ({ seq, code, beforeValues, afterValues })))).digest('hex');
}

/** Preview projects the existing write facts, then passes them through Apply's canonical contract. */
export function buildPreviewOperationAudits(input: Parameters<typeof projectPreviewOperationRows>[0] & {
  projectedTotal?: string | null;
  projectedTax?: string | null;
}): OrderChangeOperationAudit[] {
  const rows = projectPreviewOperationRows(input);
  const orderBefore = input.auditFacts?.order ?? { ...orderFromContext(input.context), total_tax_amount: input.speedAudit?.before.taxAmount ?? null };
  const orderAfter = { ...orderBefore, total_amount: input.projectedTotal ?? orderBefore.total_amount, total_tax_amount: input.projectedTax ?? orderBefore.total_tax_amount };
  const nextPieceSeq = new Map<string, number>();
  return input.operations.map((operation) => {
    const values = rows.find((row) => row.seq === operation.seq)!;
    if (operation.code === 'ADD_PIECE') {
      const parent = operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : operation.target.clientRef;
      const seq = nextPieceSeq.get(parent) ?? Math.max(0, ...input.context.pieces.filter((piece) => piece.orderItemId === parent).map((piece) => piece.pieceSeq ?? 0)) + 1;
      nextPieceSeq.set(parent, seq + 1);
      values.after.piece_seq = seq;
      values.after.piece_status = input.context.workflow.currentStatus || 'processing';
    }
    const targetId = 'id' in operation.target ? operation.target.id : null;
    const contextItem = input.context.items.find((row) => row.id === targetId || row.id === values.before.order_item_id || row.id === values.after.order_item_id);
    const label = operation.code.includes('PREFERENCE') ? values.after.preference_code ?? values.before.preference_code : values.after.product_name ?? values.before.product_name ?? contextItem?.productName;
    return buildOrderChangeOperationAudit({
      operation,
      orderId: input.context.orderId,
      before: values.before,
      after: values.after,
      orderBefore,
      orderAfter,
      targetLabel: typeof label === 'string' ? label : null,
      targetLabel2: operation.code.includes('PREFERENCE') ? null : typeof values.after.product_name2 === 'string' ? values.after.product_name2 : contextItem?.productName2 ?? null,
      itemLabels: input.context.items.map((item) => ({ orderItemId: item.id, label: item.productName, label2: item.productName2 })),
    });
  });
}
