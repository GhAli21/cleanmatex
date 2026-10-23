/**
 * Commits one reviewed Change inside the caller's transaction.
 * Preview, proof, and fingerprint are checked before any write.
 * Pricing, tax, settlement, and workflow status stay with their owners.
 */

import { isOrderChangeOperationWriterAvailable } from '@/lib/constants/order-change';
import {
  assertCommercialSnapshot,
  syncReviewedTaxLine,
  buildCommercialWritePlan,
  loadCommercialWriteFacts,
  OrderChangeApplyRejected,
  preferenceParentIsLocal,
  PREFERENCE_OPERATION_CODES,
  writeOrderSpeedCharge,
  writePreferenceCharges,
  type CommercialWriteFacts,
  type CommercialWritePlan,
} from '@/lib/services/order-change/order-change-commercial-write';
import {
  buildStructuralWritePlan,
  loadStructuralWriteFacts,
  STRUCTURAL_OPERATION_CODES,
  type StructuralWritePlan,
} from '@/lib/services/order-change/order-change-structural-write';
import {
  OrderChangeReviewProofError,
  verifyOrderChangeReviewProof,
  type OrderChangeReviewProofKey,
} from '@/lib/services/order-change/order-change-capability.service';
import { collectionRequiredForPaymentType, mapPersistedFinancialOutcome, OrderChangeMutationError, persistOrderChangeTx, type OrderChangePersistedOperation, type OrderChangeWriteTx } from '@/lib/services/order-change/order-change-mutation.service';
import { reviewedItemTotal } from '@/lib/services/order-change/order-change-calculation.service';
import type { OrderChangePreviewSuccess, OrderChangeSpeedAudit } from '@/lib/services/order-change/order-change-preview.service';
import { buildOrderChangeOperationAudit, digestOrderChangeOperationAudits } from '@/lib/services/order-change/order-change-review-audit';
import { subMoney, toMoneyString } from '@/lib/utils/money';
import type { z } from 'zod';
import type { orderChangeApplyRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

const EMPTY_COMMERCIAL_FACTS: CommercialWriteFacts = {
  pieceItemIds: new Map(),
  catalogById: new Map(),
  nextPrefsNo: 0,
  branchId: null,
  orderLevelPreferenceIds: new Set(),
};

type ApplyRequest = z.infer<typeof orderChangeApplyRequestSchema>;

function finiteMoney(value: string | null | undefined): value is string {
  return value != null && value.trim() !== '' && Number.isFinite(Number(value));
}

function money4(value: string): string {
  return toMoneyString(value);
}

function sameMoney(left: string, right: string): boolean {
  return finiteMoney(left) && finiteMoney(right) && money4(left) === money4(right);
}

const MUTATION_CONFLICTS = new Set([
  'POLICY_CHANGED_REVIEW_REQUIRED',
  'REVIEW_CHANGED',
  'VERSION_CONFLICT',
  'WORKFLOW_VERSION_CONFLICT',
  'ORDER_FIELD_UPDATE_LOST',
  'UPDATE_NOT_ACTIVE',
  'REMOVAL_NOT_ACTIVE',
  'IDEMPOTENCY_TARGET_MISSING',
]);

const ORDER_FIELD_CODES = new Set([
  'CHANGE_ORDER_NOTES',
  'CHANGE_PRIORITY',
  'CHANGE_SERVICE_SPEED',
  'CHANGE_READY_BY',
  'CHANGE_CUSTOMER_SNAPSHOT',
]);

export interface OrderChangeApplyTx extends OrderChangeWriteTx {
  org_orders_mst: OrderChangeWriteTx['org_orders_mst'] & {
    updateMany(args: {
      where: { id: string; tenant_org_id: string; edit_state_version: number };
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
}

export interface ApplyOrderChangeInput {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string | null;
  currencyCode: string | null;
  /** Existing order settlement type. It decides collection; Apply does not collect. */
  paymentTypeCode: string | null;
  idempotencyKey: string;
  request: ApplyRequest;
  preview: OrderChangePreviewSuccess;
  /** Present on the live route. Unit fixtures that omit it keep an exact proof-string check. */
  proofKey?: OrderChangeReviewProofKey | null;
  appliedAt: Date;
  /** Production callers re-resolve policy under the same lock immediately before any mutation. */
  validateLockedPolicy?: (tx: OrderChangeApplyTx) => Promise<void>;
  runInTransaction<T>(fn: (tx: OrderChangeApplyTx) => Promise<T>): Promise<T>;
}

export type ApplyOrderChangeResult =
  | {
    ok: true;
    replayed: boolean;
    orderChangeId: string;
    changeNo: number;
    editStateVersionAfter: number;
    requestHash: string;
  }
  | { ok: false; status: 409 | 422; code: string };

function orderFields(request: ApplyRequest): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const operation of request.operations) {
    if (operation.code === 'CHANGE_ORDER_NOTES') {
      if (operation.payload.notes !== undefined) data.internal_notes = operation.payload.notes;
      if (operation.payload.customerNotes !== undefined) data.customer_notes = operation.payload.customerNotes;
    } else if (operation.code === 'CHANGE_PRIORITY') {
      data.priority = operation.payload.priority;
    } else if (operation.code === 'CHANGE_SERVICE_SPEED') {
      data.service_speed = operation.payload.serviceSpeed;
    } else if (operation.code === 'CHANGE_READY_BY') {
      data.ready_by = operation.payload.readyBy == null ? null : new Date(operation.payload.readyBy);
    } else if (operation.code === 'CHANGE_CUSTOMER_SNAPSHOT') {
      if (operation.payload.customerName !== undefined) data.customer_name = operation.payload.customerName;
      if (operation.payload.customerMobile !== undefined) data.customer_mobile_number = operation.payload.customerMobile;
      if (operation.payload.customerEmail !== undefined) data.customer_email = operation.payload.customerEmail;
    } else if (operation.code === 'CHANGE_UNLISTED' && operation.payload.field === 'order.readyBy' && operation.target.kind === 'ORDER' && operation.payload.value === '') {
      data.ready_by = null;
    }
  }
  return data;
}

/**
 * The re-preview mints a new proof, so its expiry differs from Review.
 * Verify the original proof against the fresh binding. Expiry and every other binding still apply.
 */
function reviewedProofStillMatches(input: ApplyOrderChangeInput): { ok: true } | { ok: false; status: 409 | 422; code: string } {
  if (input.preview.calculationFingerprint !== input.request.calculationFingerprint) {
    return { ok: false, status: 409, code: 'REVIEW_CHANGED' };
  }
  if (input.proofKey && input.preview.reviewBinding) {
    try {
      verifyOrderChangeReviewProof({
        proof: input.request.reviewProof,
        keys: [input.proofKey],
        expected: input.preview.reviewBinding,
        now: input.appliedAt,
      });
      return { ok: true };
    } catch (error) {
      if (!(error instanceof OrderChangeReviewProofError)) throw error;
      if (error.code === 'ORDER_CHANGE_REVIEW_PROOF_SIGNER_UNAVAILABLE') {
        return { ok: false, status: 422, code: 'REVIEW_NOT_READY' };
      }
      return { ok: false, status: 409, code: 'REVIEW_CHANGED' };
    }
  }
  if (input.preview.reviewProof !== input.request.reviewProof) {
    return { ok: false, status: 409, code: 'REVIEW_CHANGED' };
  }
  return { ok: true };
}

function speedSnapshot(
  snapshot: OrderChangeSpeedAudit['before'],
  order: OrderBeforeRow | null,
): Record<string, unknown> {
  return compact({
    ...(order ? orderSnapshot(order) : {}),
    service_speed: snapshot.serviceSpeed,
    total_amount: snapshot.totalAmount,
    total_tax_amount: snapshot.taxAmount,
    commercial_delta: snapshot.commercialDelta,
    items: snapshot.items.map((item) => ({
      id: item.orderItemId,
      quantity: item.quantity,
      price_per_unit: item.pricePerUnit,
      total_price: item.totalPrice,
    })),
  });
}

/**
 * Reviewed Express or Standard prices for items that already exist.
 * The speed audit lists those items. New items keep the structural insert price.
 */
function speedPriceUpdates(
  lines: readonly { id: string; active: boolean; unitPrice: string; merchandiseAmount: string; embeddedExtra?: string }[],
  actorUserId: string,
  insertedIds: ReadonlySet<string>,
  speedAudit: OrderChangeSpeedAudit,
): CommercialWritePlan['itemUpdates'] {
  const auditedIds = new Set(speedAudit.after.items.map((item) => item.orderItemId));
  return lines.filter((line) => line.active && auditedIds.has(line.id) && !insertedIds.has(line.id)).map((line) => ({
    id: line.id,
    data: {
      price_per_unit: line.unitPrice,
      total_price: reviewedItemTotal(line),
      updated_by: actorUserId,
    },
  }));
}

interface OperationBeforeFacts {
  order: OrderBeforeRow | null;
  items: ReadonlyMap<string, ItemBeforeRow>;
  pieces: ReadonlyMap<string, PieceBeforeRow>;
  preferences: ReadonlyMap<string, PreferenceBeforeRow>;
}

interface OrderBeforeRow {
  is_default_customer?: boolean | null;
  customer_details?: unknown;
  status: string | null;
  current_status: string | null;
  current_stage: string | null;
  priority: string | null;
  service_speed: string | null;
  ready_by: Date | string | null;
  total_items: number | null;
  internal_notes: string | null;
  customer_notes: string | null;
  customer_name: string | null;
  customer_mobile_number: string | null;
  customer_email: string | null;
  currency_code: string | null;
  tax_rate: string | null;
  vat_rate: string | null;
  payment_status: string | null;
  payment_type_code: string | null;
  subtotal_amount: string | null;
  items_base_amount: string | null;
  total_charges_amount: string | null;
  total_discount_amount: string | null;
  piece_extra_price_amount: string | null;
  preference_extra_price_amount: string | null;
  service_charge_amount: string | null;
  delivery_charge_amount: string | null;
  express_charge_amount: string | null;
  other_charges_amount: string | null;
  taxable_amount: string | null;
  total_tax_amount: string | null;
  total_amount: string | null;
  total_paid_amount: string | null;
  outstanding_amount: string | null;
}

interface ItemBeforeRow {
  id: string;
  branch_id: string | null;
  order_item_srno: string | null;
  product_id: string | null;
  product_name: string | null;
  product_name2: string | null;
  barcode: string | null;
  service_category_code: string | null;
  quantity: number | null;
  quantity_ready: number | null;
  price_per_unit: string | null;
  total_price: string | null;
  price_override: string | null;
  override_reason: string | null;
  service_pref_charge: string | null;
  status: string | null;
  item_status: string | null;
  item_stage: string | null;
  item_is_rejected: boolean | null;
  notes: string | null;
  stain_notes: string | null;
  damage_notes: string | null;
  packing_pref_code: string | null;
  packing_pref_is_override: boolean | null;
  packing_pref_source: string | null;
  has_stain: boolean | null;
  has_damage: boolean | null;
  color: string | null;
  brand: string | null;
  rec_status: number | null;
}

interface PieceBeforeRow {
  id: string;
  order_item_id: string | null;
  branch_id: string | null;
  piece_seq: number | null;
  piece_code: string | null;
  service_category_code: string | null;
  product_id: string | null;
  barcode: string | null;
  color: unknown;
  brand: string | null;
  notes: string | null;
  packing_pref_code: string | null;
  has_stain: boolean | null;
  has_damage: boolean | null;
  is_rejected: boolean | null;
  is_ready: boolean | null;
  quantity: number | null;
  price_per_unit: string | null;
  total_price: string | null;
  service_pref_charge: string | null;
  piece_status: string | null;
  piece_stage: string | null;
  scan_state: string | null;
  rec_status: number | null;
}

interface PreferenceBeforeRow {
  id: string;
  branch_id: string | null;
  prefs_no: number | null;
  prefs_level: string | null;
  order_item_id: string | null;
  order_item_piece_id: string | null;
  preference_id: string | null;
  preference_code: string | null;
  preference_content: string | null;
  preference_sys_kind: string | null;
  preference_category: string | null;
  prefs_owner_type: string | null;
  prefs_source: string | null;
  extra_price: string | null;
  processing_confirmed: boolean | null;
  confirmed_by: string | null;
  confirmed_at: Date | string | null;
  notes_followup: unknown;
  rec_status: number | null;
}

function compact(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function storedMoney(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return toMoneyString(value);
}

function storedTime(value: Date | string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return value;
}

const WRITE_ACTOR_KEYS = new Set(['created_by', 'updated_by', 'updated_at', 'created_at']);

function itemSnapshot(row: ItemBeforeRow): Record<string, unknown> {
  return compact({
    id: row.id,
    branch_id: row.branch_id,
    order_item_srno: row.order_item_srno,
    product_id: row.product_id,
    product_name: row.product_name,
    product_name2: row.product_name2,
    barcode: row.barcode,
    service_category_code: row.service_category_code,
    quantity: row.quantity,
    quantity_ready: row.quantity_ready,
    price_per_unit: storedMoney(row.price_per_unit),
    total_price: storedMoney(row.total_price),
    price_override: storedMoney(row.price_override),
    override_reason: row.override_reason,
    service_pref_charge: storedMoney(row.service_pref_charge),
    status: row.status,
    item_status: row.item_status,
    item_stage: row.item_stage,
    item_is_rejected: row.item_is_rejected,
    notes: row.notes,
    stain_notes: row.stain_notes,
    damage_notes: row.damage_notes,
    packing_pref_code: row.packing_pref_code,
    packing_pref_is_override: row.packing_pref_is_override,
    packing_pref_source: row.packing_pref_source,
    has_stain: row.has_stain,
    has_damage: row.has_damage,
    color: row.color,
    brand: row.brand,
    rec_status: row.rec_status,
  });
}

function pieceSnapshot(row: PieceBeforeRow): Record<string, unknown> {
  return compact({
    id: row.id,
    order_item_id: row.order_item_id,
    branch_id: row.branch_id,
    piece_seq: row.piece_seq,
    piece_code: row.piece_code,
    service_category_code: row.service_category_code,
    product_id: row.product_id,
    barcode: row.barcode,
    color: row.color,
    brand: row.brand,
    notes: row.notes,
    packing_pref_code: row.packing_pref_code,
    has_stain: row.has_stain,
    has_damage: row.has_damage,
    is_rejected: row.is_rejected,
    is_ready: row.is_ready,
    quantity: row.quantity,
    price_per_unit: storedMoney(row.price_per_unit),
    total_price: storedMoney(row.total_price),
    service_pref_charge: storedMoney(row.service_pref_charge),
    piece_status: row.piece_status,
    piece_stage: row.piece_stage,
    scan_state: row.scan_state,
    rec_status: row.rec_status,
  });
}

function preferenceSnapshot(row: PreferenceBeforeRow): Record<string, unknown> {
  return compact({
    id: row.id,
    branch_id: row.branch_id,
    prefs_no: row.prefs_no,
    prefs_level: row.prefs_level,
    order_item_id: row.order_item_id,
    order_item_piece_id: row.order_item_piece_id,
    preference_id: row.preference_id,
    preference_code: row.preference_code,
    preference_content: row.preference_content,
    preference_sys_kind: row.preference_sys_kind,
    preference_category: row.preference_category,
    prefs_owner_type: row.prefs_owner_type,
    prefs_source: row.prefs_source,
    extra_price: storedMoney(row.extra_price),
    processing_confirmed: row.processing_confirmed,
    confirmed_by: row.confirmed_by,
    confirmed_at: storedTime(row.confirmed_at),
    notes_followup: row.notes_followup,
    rec_status: row.rec_status,
  });
}

/** Commercial header stored with every order-level decision, not only the edited column. */
function orderSnapshot(order: OrderBeforeRow): Record<string, unknown> {
  return compact({
    status: order.status,
    current_status: order.current_status,
    current_stage: order.current_stage,
    priority: order.priority,
    service_speed: order.service_speed,
    ready_by: storedTime(order.ready_by),
    total_items: order.total_items,
    internal_notes: order.internal_notes,
    customer_notes: order.customer_notes,
    customer_name: order.customer_name,
    customer_mobile_number: order.customer_mobile_number,
    customer_email: order.customer_email,
    is_default_customer: order.is_default_customer,
    customer_details: order.customer_details,
    currency_code: order.currency_code,
    tax_rate: storedMoney(order.tax_rate),
    vat_rate: storedMoney(order.vat_rate),
    payment_status: order.payment_status,
    payment_type_code: order.payment_type_code,
    subtotal_amount: storedMoney(order.subtotal_amount),
    items_base_amount: storedMoney(order.items_base_amount),
    total_charges_amount: storedMoney(order.total_charges_amount),
    total_discount_amount: storedMoney(order.total_discount_amount),
    piece_extra_price_amount: storedMoney(order.piece_extra_price_amount),
    preference_extra_price_amount: storedMoney(order.preference_extra_price_amount),
    service_charge_amount: storedMoney(order.service_charge_amount),
    delivery_charge_amount: storedMoney(order.delivery_charge_amount),
    express_charge_amount: storedMoney(order.express_charge_amount),
    other_charges_amount: storedMoney(order.other_charges_amount),
    taxable_amount: storedMoney(order.taxable_amount),
    total_tax_amount: storedMoney(order.total_tax_amount),
    total_amount: storedMoney(order.total_amount),
    total_paid_amount: storedMoney(order.total_paid_amount),
    outstanding_amount: storedMoney(order.outstanding_amount),
  });
}

function writtenFields(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {};
  return compact(Object.fromEntries(Object.entries(data).filter(([key]) => !WRITE_ACTOR_KEYS.has(key))));
}

/** A new row's audit is the inserted commercial columns plus the active record flag. */
function createdRow(id: string | null | undefined, data: Record<string, unknown> | undefined): Record<string, unknown> {
  return compact({ id, rec_status: 1, ...writtenFields(data) });
}

/**
 * A create has no prior row. Every other decision stores the target facts
 * that were readable for this tenant and order at Apply time.
 */
function beforeValuesFor(
  operation: ApplyRequest['operations'][number],
  facts: OperationBeforeFacts | null,
): Record<string, unknown> {
  if (!facts) return {};
  const order = facts.order;
  if (
    order
    && (
      operation.code === 'CHANGE_PRIORITY'
      || operation.code === 'CHANGE_READY_BY'
      || operation.code === 'CHANGE_ORDER_NOTES'
      || operation.code === 'CHANGE_CUSTOMER_SNAPSHOT'
      || (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'ORDER')
    )
  ) {
    return orderSnapshot(order);
  }
  if ((operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY') && operation.target.kind === 'PERSISTED_ITEM') {
    const item = facts.items.get(operation.target.id.toLowerCase());
    return item ? itemSnapshot(item) : {};
  }
  if (operation.code === 'REMOVE_PIECE' && operation.target.kind === 'PERSISTED_PIECE') {
    const piece = facts.pieces.get(operation.target.id.toLowerCase());
    return piece ? pieceSnapshot(piece) : {};
  }
  if ((operation.code === 'CHANGE_PREFERENCE' || operation.code === 'REMOVE_PREFERENCE') && operation.target.kind === 'PERSISTED_PREFERENCE') {
    const preference = facts.preferences.get(operation.target.id.toLowerCase());
    return preference ? preferenceSnapshot(preference) : {};
  }
  if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'PERSISTED_ITEM') {
    const item = facts.items.get(operation.target.id.toLowerCase());
    return item ? itemSnapshot(item) : {};
  }
  if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'PERSISTED_PIECE') {
    const piece = facts.pieces.get(operation.target.id.toLowerCase());
    return piece ? pieceSnapshot(piece) : {};
  }
  return {};
}

async function loadOperationBeforeFacts(
  tx: OrderChangeApplyTx,
  tenantId: string,
  orderId: string,
  operations: ApplyRequest['operations'],
  includeRetiredAndCreated = false,
): Promise<OperationBeforeFacts | null> {
  const queryable = tx as { $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T> };
  if (typeof queryable.$queryRaw !== 'function') return null;
  const query = queryable.$queryRaw.bind(queryable);
  const needsOrder = true;
  const itemIds = operations.flatMap((operation) => (
    (operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY' || operation.code === 'CHANGE_UNLISTED')
    && operation.target.kind === 'PERSISTED_ITEM'
      ? [operation.target.id]
      : []
  ));
  const pieceIds = operations.flatMap((operation) => (
    (operation.code === 'REMOVE_PIECE' || operation.code === 'CHANGE_UNLISTED')
    && operation.target.kind === 'PERSISTED_PIECE'
      ? [operation.target.id]
      : []
  ));
  const preferenceIds = operations.flatMap((operation) => (
    (operation.code === 'CHANGE_PREFERENCE' || operation.code === 'REMOVE_PREFERENCE')
      ? [operation.target.id]
      : []
  ));
  if (operations.some((operation) => operation.code === 'CHANGE_SERVICE_SPEED')) {
    const speedItems = await query<Array<{ id: string }>>`
      SELECT id::text AS id FROM org_order_items_dtl
      WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND rec_status = 1`;
    itemIds.push(...speedItems.map((row) => row.id));
  }
  if (includeRetiredAndCreated) {
    for (const operation of operations) {
      if (operation.code === 'ADD_ITEM') itemIds.push(operation.payload.clientRef);
      if (operation.code === 'ADD_PIECE') pieceIds.push(operation.payload.clientRef);
      if (operation.code === 'ADD_PREFERENCE') preferenceIds.push(operation.payload.clientRef);
    }
  }
  const orderRows = needsOrder
    ? await query<OrderBeforeRow[]>`
      SELECT status, current_status, current_stage, priority, service_speed, ready_by, total_items,
             internal_notes, customer_notes, customer_name, customer_mobile_number, customer_email, is_default_customer, customer_details,
             currency_code, tax_rate::text AS tax_rate, vat_rate::text AS vat_rate,
             payment_status, payment_type_code,
             subtotal_amount::text AS subtotal_amount, items_base_amount::text AS items_base_amount,
             total_charges_amount::text AS total_charges_amount, total_discount_amount::text AS total_discount_amount,
             piece_extra_price_amount::text AS piece_extra_price_amount,
             preference_extra_price_amount::text AS preference_extra_price_amount,
             service_charge_amount::text AS service_charge_amount, delivery_charge_amount::text AS delivery_charge_amount,
             express_charge_amount::text AS express_charge_amount, other_charges_amount::text AS other_charges_amount,
             taxable_amount::text AS taxable_amount, total_tax_amount::text AS total_tax_amount,
             total_amount::text AS total_amount, total_paid_amount::text AS total_paid_amount,
             outstanding_amount::text AS outstanding_amount
      FROM org_orders_mst
      WHERE id = ${orderId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
    `
    : [];
  const items = new Map<string, ItemBeforeRow>();
  for (const itemId of itemIds) {
    const rows = await query<ItemBeforeRow[]>`
      SELECT id::text AS id, branch_id::text AS branch_id, order_item_srno,
             product_id::text AS product_id, product_name, product_name2, barcode, service_category_code,
             quantity, quantity_ready, color, brand, override_reason,
             price_per_unit::text AS price_per_unit, total_price::text AS total_price,
             price_override::text AS price_override, service_pref_charge::text AS service_pref_charge,
             status, item_status, item_stage, item_is_rejected,
             notes, stain_notes, damage_notes, packing_pref_code, packing_pref_is_override, packing_pref_source,
             has_stain, has_damage, rec_status
      FROM org_order_items_dtl
      WHERE id = ${itemId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
        AND (rec_status = 1 OR ${includeRetiredAndCreated})
    `;
    if (rows[0]) items.set(itemId.toLowerCase(), rows[0]);
  }
  const pieces = new Map<string, PieceBeforeRow>();
  for (const pieceId of pieceIds) {
    const rows = await query<PieceBeforeRow[]>`
      SELECT id::text AS id, order_item_id::text AS order_item_id, branch_id::text AS branch_id,
             piece_seq, piece_code, service_category_code, product_id::text AS product_id, barcode,
             color, brand, notes, packing_pref_code, has_stain, has_damage, is_rejected, is_ready, quantity,
             price_per_unit::text AS price_per_unit, total_price::text AS total_price,
             service_pref_charge::text AS service_pref_charge,
             piece_status, piece_stage, scan_state, rec_status
      FROM org_order_item_pieces_dtl
      WHERE id = ${pieceId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
        AND (rec_status = 1 OR ${includeRetiredAndCreated})
    `;
    if (rows[0]) pieces.set(pieceId.toLowerCase(), rows[0]);
  }
  const preferences = new Map<string, PreferenceBeforeRow>();
  for (const preferenceId of preferenceIds) {
    const rows = await query<PreferenceBeforeRow[]>`
      SELECT id::text AS id, branch_id::text AS branch_id, prefs_no, prefs_level,
             order_item_id::text AS order_item_id, order_item_piece_id::text AS order_item_piece_id,
             preference_id::text AS preference_id, preference_code, preference_content, preference_sys_kind,
             preference_category, prefs_owner_type, prefs_source, extra_price::text AS extra_price,
             processing_confirmed, confirmed_by, confirmed_at, notes_followup, rec_status
      FROM org_order_preferences_dtl
      WHERE id = ${preferenceId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
        AND (rec_status = 1 OR ${includeRetiredAndCreated})
    `;
    if (rows[0]) preferences.set(preferenceId.toLowerCase(), rows[0]);
  }
  if (!includeRetiredAndCreated) {
    for (const operation of operations) {
      const missing = operation.target.kind === 'PERSISTED_ITEM' && (operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY' || operation.code === 'CHANGE_UNLISTED') ? !items.has(operation.target.id.toLowerCase())
        : operation.target.kind === 'PERSISTED_PIECE' && (operation.code === 'REMOVE_PIECE' || operation.code === 'CHANGE_UNLISTED') ? !pieces.has(operation.target.id.toLowerCase())
          : operation.target.kind === 'PERSISTED_PREFERENCE' ? !preferences.has(operation.target.id.toLowerCase()) : false;
      if (missing) throw new OrderChangeMutationError(operation.code.startsWith('REMOVE_') ? 'REMOVAL_NOT_ACTIVE' : 'UPDATE_NOT_ACTIVE');
    }
  }
  return { order: orderRows[0] ?? null, items, pieces, preferences };
}

function rowData(
  rows: readonly { id: string; data: Record<string, unknown> }[] | undefined,
  id: string | null | undefined,
): Record<string, unknown> | undefined {
  if (!id || !rows) return undefined;
  return rows.find((row) => row.id.toLowerCase() === id.toLowerCase())?.data;
}

/**
 * after_values uses the same columns as before_values.
 * The overlay is the row Apply writes, so the audit shows the resulting fact.
 */
function afterValuesFor(
  operation: ApplyRequest['operations'][number],
  before: Record<string, unknown>,
  audit: CommercialWritePlan['auditBySeq'] extends Map<number, infer V> ? V | undefined : never,
  plan: CommercialWritePlan,
  structural: StructuralWritePlan | null,
): Record<string, unknown> {
  if (operation.code === 'ADD_ITEM') return createdRow(operation.payload.clientRef, rowData(structural?.itemInserts, operation.payload.clientRef));
  if (operation.code === 'ADD_PIECE') return createdRow(operation.payload.clientRef, rowData(structural?.pieceInserts, operation.payload.clientRef));
  if (operation.code === 'ADD_PREFERENCE') return createdRow(audit?.orderPreferenceId, rowData(plan.preferenceInserts, audit?.orderPreferenceId));
  if (operation.code === 'REMOVE_ITEM' || operation.code === 'REMOVE_PIECE' || operation.code === 'REMOVE_PREFERENCE') {
    return compact({ ...before, rec_status: 0 });
  }
  if (operation.code === 'CHANGE_ITEM_QUANTITY') {
    return compact({ ...before, ...writtenFields(rowData(structural?.itemUpdates, operation.target.id)) });
  }
  if (operation.code === 'CHANGE_PREFERENCE') {
    return compact({ ...before, ...writtenFields(rowData(plan.preferenceUpdates, operation.target.id)) });
  }
  if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'PERSISTED_ITEM') {
    return compact({ ...before, ...writtenFields(rowData(plan.itemUpdates, operation.target.id)) });
  }
  if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'PERSISTED_PIECE') {
    return compact({ ...before, ...writtenFields(rowData(plan.pieceUpdates, operation.target.id)) });
  }
  if (operation.code === 'CHANGE_PRIORITY') return compact({ ...before, priority: operation.payload.priority });
  if (operation.code === 'CHANGE_READY_BY') return compact({ ...before, ready_by: operation.payload.readyBy });
  if (operation.code === 'CHANGE_ORDER_NOTES') {
    return compact({
      ...before,
      ...(operation.payload.notes !== undefined ? { internal_notes: operation.payload.notes } : {}),
      ...(operation.payload.customerNotes !== undefined ? { customer_notes: operation.payload.customerNotes } : {}),
    });
  }
  if (operation.code === 'CHANGE_CUSTOMER_SNAPSHOT') {
    return compact({
      ...before,
      ...(operation.payload.customerName !== undefined ? { customer_name: operation.payload.customerName } : {}),
      ...(operation.payload.customerMobile !== undefined ? { customer_mobile_number: operation.payload.customerMobile } : {}),
      ...(operation.payload.customerEmail !== undefined ? { customer_email: operation.payload.customerEmail } : {}),
    });
  }
  if (operation.code === 'CHANGE_UNLISTED' && operation.target.kind === 'ORDER') {
    if (operation.payload.field === 'order.readyBy') {
      return compact({ ...before, ready_by: operation.payload.value === '' ? null : operation.payload.value });
    }
    return compact({ ...before, requested_field: operation.payload.field, requested_value: operation.payload.value });
  }
  return operation.payload;
}

/** Read speed facts from the locked/stored rows; only the reviewed delta is derived metadata. */
function storedSpeedSnapshot(snapshot: OrderChangeSpeedAudit['before'], facts: OperationBeforeFacts | null): Record<string, unknown> {
  if (!facts?.order) return speedSnapshot(snapshot, null);
  return {
    ...orderSnapshot(facts.order),
    commercial_delta: snapshot.commercialDelta,
    items: snapshot.items.map((item) => {
      const row = facts.items.get(item.orderItemId.toLowerCase());
      return row ? { id: row.id, quantity: row.quantity, price_per_unit: row.price_per_unit, total_price: row.total_price } : { id: item.orderItemId };
    }),
  };
}

function persistedOperations(
  request: ApplyRequest,
  auditBySeq: CommercialWritePlan['auditBySeq'],
  speedAudit: OrderChangeSpeedAudit | undefined,
  beforeFacts: OperationBeforeFacts | null,
  plan: CommercialWritePlan,
  structural: StructuralWritePlan | null,
  orderId: string,
  preview: OrderChangePreviewSuccess,
  storedAfter?: OperationBeforeFacts | null,
): OrderChangePersistedOperation[] {
  return request.operations.map((operation) => {
    const audit = auditBySeq.get(operation.seq);
    const speedValues = operation.code === 'CHANGE_SERVICE_SPEED' && speedAudit;
    const beforeValues = speedValues ? storedSpeedSnapshot(speedAudit.before, beforeFacts) : beforeValuesFor(operation, beforeFacts);
    const afterSpeed = speedValues ? speedSnapshot(speedAudit.after, beforeFacts?.order ?? null) : null;
    if (afterSpeed) afterSpeed.express_charge_amount = '0.0000';
    const rawAfter = storedAfter
      ? beforeValuesFor(operation, storedAfter)
      : afterSpeed ?? afterValuesFor(operation, beforeValues, audit, plan, structural);
    const afterRow = storedAfter && operation.code === 'ADD_ITEM'
      ? storedAfter.items.get(operation.payload.clientRef.toLowerCase())
      : storedAfter && operation.code === 'ADD_PIECE'
        ? storedAfter.pieces.get(operation.payload.clientRef.toLowerCase())
        : storedAfter && operation.code === 'ADD_PREFERENCE'
          ? storedAfter.preferences.get(operation.payload.clientRef.toLowerCase())
          : rawAfter;
    const orderBefore = beforeFacts?.order ? orderSnapshot(beforeFacts.order) : { total_amount: preview.originalTotal };
    const orderAfter = storedAfter?.order ? orderSnapshot(storedAfter.order) : { ...orderBefore, total_amount: preview.projectedTotal, total_tax_amount: preview.projectedTax };
    const canonical = buildOrderChangeOperationAudit({
      operation,
      orderId,
      before: beforeValues,
      after: operation.code === 'CHANGE_SERVICE_SPEED' ? (storedAfter && speedAudit ? storedSpeedSnapshot(speedAudit.after, storedAfter) : afterSpeed ?? {}) : afterRow ? { ...afterRow } : {},
      orderBefore,
      orderAfter,
    });
    return {
      seq: operation.seq,
      code: operation.code,
      targetType: audit?.targetType ?? 'ORDER',
      orderItemId: audit?.orderItemId ?? null,
      orderItemPieceId: audit?.orderItemPieceId ?? null,
      orderPreferenceId: audit?.orderPreferenceId ?? null,
      clientRef: audit?.clientRef ?? null,
      beforeValues: canonical.beforeValues,
      afterValues: canonical.afterValues,
      auditSummary: null,
    };
  });
}

/**
 * Apply a preview that is ready, current, and free of a commercial line rewrite.
 * A thrown error inside the transaction rolls every Change write back.
 */
export async function applyOrderChange(input: ApplyOrderChangeInput): Promise<ApplyOrderChangeResult> {
  if (input.request.operations.some((operation) => !isOrderChangeOperationWriterAvailable(operation.code) || operation.code === 'CHANGE_UNLISTED')) {
    return { ok: false, status: 422, code: 'OPERATION_NOT_AVAILABLE' };
  }
  if (
    input.preview.status !== 'READY'
    || !input.preview.createsChange
    || !input.preview.reviewProof
    || !input.preview.calculationFingerprint
    || !input.preview.financial
    || input.preview.financial.outcome === 'DENIED'
    || !finiteMoney(input.preview.originalTotal)
    || !finiteMoney(input.preview.projectedTotal)
    || !finiteMoney(input.preview.projectedTax)
  ) {
    return { ok: false, status: 422, code: 'REVIEW_NOT_READY' };
  }
  const proofCheck = reviewedProofStillMatches(input);
  if (proofCheck.ok === false) return proofCheck;
  if (!input.currencyCode) return { ok: false, status: 422, code: 'CURRENCY_UNRESOLVED' };
  const hasPreference = input.request.operations.some((operation) => PREFERENCE_OPERATION_CODES.has(operation.code));
  const hasStructural = input.request.operations.some((operation) => STRUCTURAL_OPERATION_CODES.has(operation.code));
  if (input.request.operations.some((operation) => (
    !ORDER_FIELD_CODES.has(operation.code)
    && operation.code !== 'CHANGE_UNLISTED'
    && !PREFERENCE_OPERATION_CODES.has(operation.code)
    && !STRUCTURAL_OPERATION_CODES.has(operation.code)
  ))) {
    return { ok: false, status: 422, code: 'COMMERCIAL_LINE_UNSUPPORTED' };
  }
  const speedChanged = input.request.operations.some((operation) => operation.code === 'CHANGE_SERVICE_SPEED');
  if (speedChanged && !input.preview.speedAudit) return { ok: false, status: 422, code: 'REVIEW_NOT_READY' };
  if (!hasPreference && !hasStructural && !speedChanged && !sameMoney(input.preview.projectedTotal, input.preview.originalTotal)) {
    return { ok: false, status: 422, code: 'COMMERCIAL_TOTAL_CHANGED' };
  }
  const speedPrices = input.preview.speedAudit
    ? speedPriceUpdates(input.preview.lines ?? [], input.actorUserId, new Set(), input.preview.speedAudit)
    : [];
  if (speedChanged && !hasStructural && !sameMoney(input.preview.projectedTotal, input.preview.originalTotal) && speedPrices.length === 0) {
    return { ok: false, status: 422, code: 'STRUCTURE_PRICE_MISSING' };
  }
  if (preferenceParentIsLocal(input.request.operations)) {
    return { ok: false, status: 422, code: 'PREFERENCE_PARENT_NOT_PERSISTED' };
  }
  if (structuralPriceMissing(input.request, input.preview.lines ?? [])) {
    return { ok: false, status: 422, code: 'STRUCTURE_PRICE_MISSING' };
  }
  const financialOutcome = mapPersistedFinancialOutcome(
    input.preview.financial.outcome,
    collectionRequiredForPaymentType(input.paymentTypeCode),
  );
  if (!financialOutcome) return { ok: false, status: 422, code: 'COLLECTION_POLICY_UNRESOLVED' };

  const originalTotal = money4(input.preview.originalTotal);
  const projectedTotal = money4(input.preview.projectedTotal);
  const delta = toMoneyString(subMoney(projectedTotal, originalTotal));
  const fields = orderFields(input.request);
  try {
    return await input.runInTransaction(async (tx) => {
    if (typeof tx.$queryRaw === 'function') {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text AS id FROM public.org_orders_mst
        WHERE id = ${input.orderId}::uuid AND tenant_org_id = ${input.tenantId}::uuid
        FOR UPDATE`;
      if (!locked[0]) throw new OrderChangeMutationError('ORDER_NOT_FOUND');
    }
    const facts = hasPreference
      ? await loadCommercialWriteFacts(tx, input.tenantId, input.orderId, input.request.operations)
      : EMPTY_COMMERCIAL_FACTS;
    const plan = buildCommercialWritePlan(input.request.operations, input.actorUserId, facts);
    const structuralFacts = hasStructural
      ? await loadStructuralWriteFacts(tx, input.tenantId, input.orderId, input.request.operations)
      : null;
    const structural = structuralFacts
      ? buildStructuralWritePlan(input.request.operations, input.preview.lines ?? [], structuralFacts, input.actorUserId)
      : null;
    const beforeFacts = await loadOperationBeforeFacts(tx, input.tenantId, input.orderId, input.request.operations);
    const insertedIds = new Set((structural?.itemInserts ?? []).map((row) => row.id));
    const speedPricesInTx = input.preview.speedAudit
      ? speedPriceUpdates(input.preview.lines ?? [], input.actorUserId, insertedIds, input.preview.speedAudit)
      : [];
    const auditBySeq = new Map([...plan.auditBySeq, ...(structural?.auditBySeq ?? [])]);
    const lockedOperations = persistedOperations(input.request, auditBySeq, input.preview.speedAudit, beforeFacts, plan, structural, input.orderId, input.preview);
    const digest = (operations: readonly OrderChangePersistedOperation[]) => digestOrderChangeOperationAudits(operations.map((operation) => ({
      seq: operation.seq, code: operation.code, beforeValues: operation.beforeValues ?? {}, afterValues: operation.afterValues ?? {},
    })));
    if (input.preview.reviewBinding && digest(lockedOperations) !== input.preview.reviewBinding.operationSnapshotDigest) {
      throw new OrderChangeMutationError('REVIEW_CHANGED');
    }
    await input.validateLockedPolicy?.(tx);
    const persisted = await persistOrderChangeTx(tx, {
      tenantId: input.tenantId,
      orderId: input.orderId,
      expectedEditStateVersion: input.request.expectedEditStateVersion,
      expectedWfStateVersion: input.request.expectedWfStateVersion,
      sourceContext: input.request.sourceContext,
      actorUserId: input.actorUserId,
      actorName: input.actorName ?? null,
      changeReason: input.request.changeReason ?? null,
      currencyCode: input.currencyCode as string,
      financialBefore: { totalAmount: originalTotal },
      financialAfter: {
        totalAmount: projectedTotal,
        taxAmount: money4(input.preview.projectedTax),
      },
      commercialDelta: delta,
      financialOutcome,
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      applyResponse: { status: 'APPLIED' },
      operations: lockedOperations,
      preferenceInserts: plan.preferenceInserts.length > 0 ? plan.preferenceInserts : undefined,
      preferenceUpdates: plan.preferenceUpdates.length > 0 ? plan.preferenceUpdates : undefined,
      removePreferenceIds: plan.removePreferenceIds.length > 0 ? plan.removePreferenceIds : undefined,
      itemInserts: structural && structural.itemInserts.length > 0 ? structural.itemInserts : undefined,
      pieceInserts: structural && structural.pieceInserts.length > 0 ? structural.pieceInserts : undefined,
      itemUpdates: mergedRows(plan.itemUpdates, [...(structural?.itemUpdates ?? []), ...speedPricesInTx]),
      pieceUpdates: plan.pieceUpdates.length > 0 ? plan.pieceUpdates : undefined,
      removeItemIds: structural && structural.removeItemIds.length > 0 ? structural.removeItemIds : undefined,
      removePieceIds: structural && structural.removePieceIds.length > 0 ? structural.removePieceIds : undefined,
      finalizeOperations: async () => {
      await writePreferenceCharges(tx, {
        tenantId: input.tenantId,
        orderId: input.orderId,
        actorUserId: input.actorUserId,
        currencyCode: input.currencyCode as string,
        appliedAt: input.appliedAt,
        plan,
      });
      if (speedChanged) {
        await writeOrderSpeedCharge(tx, {
          tenantId: input.tenantId,
          orderId: input.orderId,
          actorUserId: input.actorUserId,
          currencyCode: input.currencyCode as string,
          appliedAt: input.appliedAt,
          amount: '0.0000',
        });
      }
      if (commercialMoneyChanged(plan) || structuralMoneyChanged(structural) || (speedChanged && !sameMoney(originalTotal, projectedTotal))) {
        await syncReviewedTaxLine(tx, {
          tenantId: input.tenantId,
          orderId: input.orderId,
          projectedTax: money4(input.preview.projectedTax),
          actorUserId: input.actorUserId,
          appliedAt: input.appliedAt,
        });
        await assertCommercialSnapshot(tx, {
          tenantId: input.tenantId,
          orderId: input.orderId,
          projectedTotal,
        });
      }
    if (Object.keys(fields).length > 0) {
      const updated = await tx.org_orders_mst.updateMany({
        where: {
          id: input.orderId,
          tenant_org_id: input.tenantId,
          edit_state_version: input.request.expectedEditStateVersion + 1,
        },
        data: {
          ...fields,
          updated_by: input.actorUserId,
          updated_at: input.appliedAt,
        },
      });
      if (updated.count !== 1) throw new OrderChangeMutationError('ORDER_FIELD_UPDATE_LOST');
    }
        if (!beforeFacts) return lockedOperations;
        const storedAfter = await loadOperationBeforeFacts(tx, input.tenantId, input.orderId, input.request.operations, true);
        const storedOperations = persistedOperations(input.request, auditBySeq, input.preview.speedAudit, beforeFacts, plan, structural, input.orderId, input.preview, storedAfter);
        if (input.preview.reviewBinding && digest(storedOperations) !== input.preview.reviewBinding.operationSnapshotDigest) {
          throw new OrderChangeMutationError('REVIEW_CHANGED');
        }
        return storedOperations;
      },
      appliedAt: input.appliedAt,
    });
    if (persisted.ok === false) return { ok: false as const, status: 409 as const, code: persisted.code };
    return {
      ok: true as const,
      replayed: persisted.replayed,
      orderChangeId: persisted.orderChangeId,
      changeNo: persisted.changeNo,
      editStateVersionAfter: persisted.editStateVersionAfter,
      requestHash: persisted.requestHash,
    };
    });
  } catch (error) {
    if (error instanceof OrderChangeApplyRejected) return { ok: false, status: error.status, code: error.code };
    if (error instanceof OrderChangeMutationError) {
      return { ok: false, status: MUTATION_CONFLICTS.has(error.code) ? 409 : 422, code: error.code };
    }
    throw error;
  }
}

function structuralPriceMissing(
  request: ApplyRequest,
  lines: readonly { id: string; active: boolean }[],
): boolean {
  const priced = new Set(lines.filter((line) => line.active).map((line) => line.id.toLowerCase()));
  return request.operations.some((operation) => {
    if (operation.code === 'ADD_ITEM') return !priced.has(operation.payload.clientRef.toLowerCase());
    if (operation.code === 'CHANGE_ITEM_QUANTITY') return !priced.has(operation.target.id.toLowerCase());
    if (operation.code === 'ADD_PIECE') {
      const parentId = operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : operation.target.clientRef;
      return !priced.has(parentId.toLowerCase());
    }
    return false;
  });
}

function mergedRows(
  first: CommercialWritePlan['itemUpdates'],
  second: StructuralWritePlan['itemUpdates'],
): CommercialWritePlan['itemUpdates'] | undefined {
  const byId = new Map<string, Record<string, unknown>>();
  const ids: string[] = [];
  for (const row of [...first, ...second]) {
    if (!byId.has(row.id)) ids.push(row.id);
    byId.set(row.id, { ...(byId.get(row.id) ?? {}), ...row.data });
  }
  if (ids.length === 0) return undefined;
  return ids.map((id) => ({ id, data: byId.get(id) ?? {} }));
}

function structuralMoneyChanged(plan: StructuralWritePlan | null): boolean {
  if (!plan) return false;
  return plan.itemInserts.length > 0
    || plan.pieceInserts.length > 0
    || plan.itemUpdates.length > 0
    || plan.removeItemIds.length > 0
    || plan.removePieceIds.length > 0;
}

function commercialMoneyChanged(plan: CommercialWritePlan): boolean {
  return plan.preferenceInserts.length > 0
    || plan.preferenceUpdates.length > 0
    || plan.removePreferenceIds.length > 0
    || plan.orderCharges.length > 0
    || plan.voidChargeSourceIds.length > 0
    || plan.itemUpdates.some((row) => Object.prototype.hasOwnProperty.call(row.data, 'price_override'));
}
