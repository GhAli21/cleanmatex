/**
 * Commits one reviewed Change inside the caller's transaction.
 * Preview, proof, and fingerprint are checked before any write.
 * Pricing, tax, settlement, and workflow status stay with their owners.
 */

import { isOrderChangeOperationWriterAvailable } from '@/lib/constants/order-change';
import {
  assertCommercialSnapshot,
  buildCommercialWritePlan,
  loadCommercialWriteFacts,
  OrderChangeApplyRejected,
  preferenceParentIsLocal,
  PREFERENCE_OPERATION_CODES,
  type CommercialWriteFacts,
  type CommercialWritePlan,
} from '@/lib/services/order-change/order-change-commercial-write';
import { editMoneyColumns, replaceEditChildRows, type EditChildRowsTx, type EditMoneyColumns } from '@/lib/services/commercial/commercial-edit.writer';
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
import type { OrderChangePreviewSuccess, OrderChangeSpeedAudit } from '@/lib/services/order-change/order-change-preview.service';
import { buildOrderChangeOperationAudit, digestOrderChangeOperationAudits } from '@/lib/services/order-change/order-change-review-audit';
import { lineDiscountAuditFields, manualLineDiscounts, manualPieceDiscounts, type StoredLineDiscountRow } from '@/lib/services/order-change/order-change-line-money';
import { DISCOUNT_SOURCE_TYPE } from '@/lib/constants/discount-source-type';
import { DISCOUNT_CHANGE_OUTCOMES } from '@/lib/services/commercial/edit-discount-reevaluation';
import { reversePromoUsageTx } from '@/lib/services/discount-service';
import { subMoney, toMoneyString } from '@/lib/utils/money';
import type { z } from 'zod';
import type { orderChangeApplyRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import { readSettlementFingerprint, type SettlementFingerprintDb } from './order-change-settlement-fingerprint';

const EMPTY_COMMERCIAL_FACTS: CommercialWriteFacts = {
  pieceItemIds: new Map(),
  catalogById: new Map(),
  nextPrefsNo: 0,
  branchId: null,
};

type ApplyRequest = z.infer<typeof orderChangeApplyRequestSchema>;

/** A stored line's cashier price or discount (P6-02c): priced by the calculator, written on the line. */
const LINE_MONEY_CODES: ReadonlySet<string> = new Set(['CHANGE_ITEM_PRICE', 'CHANGE_DISCOUNT']);

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
    } else if (operation.code === 'CHANGE_SERVICE_SPEED' && operation.target.kind === 'ORDER') {
      // A line speed (ITEM) is stored on its line by the calculated money columns.
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
      service_speed: item.serviceSpeed,
      quantity: item.quantity,
      price_per_unit: item.pricePerUnit,
      total_price: item.totalPrice,
    })),
  });
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
  service_speed: string | null;
  price_per_unit: string | null;
  total_price: string | null;
  price_override: string | null;
  override_reason: string | null;
  /** The line's cashier discount (`MANUAL` rows), read only when the request sets one (P6-02c). */
  line_disc_type?: string | null;
  line_disc_value?: string | null;
  line_disc_reason?: string | null;
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
  /** Set when a discount operation reads this piece (P9-01). */
  line_disc_type?: string | null;
  line_disc_value?: string | null;
  line_disc_reason?: string | null;
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
    line_disc_type: row.line_disc_type,
    line_disc_value: row.line_disc_value,
    line_disc_reason: row.line_disc_reason,
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
    line_disc_type: row.line_disc_type,
    line_disc_value: row.line_disc_value,
    line_disc_reason: row.line_disc_reason,
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
  if ((operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY' || LINE_MONEY_CODES.has(operation.code)) && operation.target.kind === 'PERSISTED_ITEM') {
    const item = facts.items.get(operation.target.id.toLowerCase());
    return item ? itemSnapshot(item) : {};
  }
  if ((operation.code === 'REMOVE_PIECE' || operation.code === 'CHANGE_DISCOUNT') && operation.target.kind === 'PERSISTED_PIECE') {
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
    (operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY' || operation.code === 'CHANGE_UNLISTED' || LINE_MONEY_CODES.has(operation.code))
    && operation.target.kind === 'PERSISTED_ITEM'
      ? [operation.target.id]
      : []
  ));
  const pieceIds = operations.flatMap((operation) => (
    (operation.code === 'REMOVE_PIECE' || operation.code === 'CHANGE_UNLISTED'
      || operation.code === 'CHANGE_SERVICE_SPEED' || operation.code === 'CHANGE_DISCOUNT')
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
             price_override::text AS price_override, service_pref_charge::text AS service_pref_charge, service_speed,
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
  // A discount's audit is the cashier discount rows of its line or piece, read the same way Review read them.
  const discountChanged = operations.some((operation) => operation.code === 'CHANGE_DISCOUNT'
    || (operation.code === 'ADD_ITEM' && operation.payload.lineDiscount));
  if (discountChanged && (items.size > 0 || pieces.size > 0)) {
    const discountRows = await query<StoredLineDiscountRow[]>`
      SELECT order_item_id::text AS order_item_id, order_item_piece_id::text AS order_item_piece_id, discount_level, source_type, discount_type,
             discount_rate::text AS discount_rate, discount_amount::text AS discount_amount, rec_notes
      FROM org_order_discounts_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
        AND is_voided = false
        AND source_type = ${DISCOUNT_SOURCE_TYPE.MANUAL}
      ORDER BY applied_seq`;
    const discounts = manualLineDiscounts(discountRows);
    for (const [id, row] of items) Object.assign(row, lineDiscountAuditFields(discounts.get(id) ?? null));
    const pieceDiscounts = manualPieceDiscounts(discountRows);
    for (const [id, row] of pieces) {
      if (operations.some((operation) => operation.code === 'CHANGE_DISCOUNT' && operation.target.kind === 'PERSISTED_PIECE' && operation.target.id.toLowerCase() === id)) {
        Object.assign(row, lineDiscountAuditFields(pieceDiscounts.get(id) ?? null));
      }
    }
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
      const missing = operation.target.kind === 'PERSISTED_ITEM' && (operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY' || operation.code === 'CHANGE_UNLISTED' || LINE_MONEY_CODES.has(operation.code)) ? !items.has(operation.target.id.toLowerCase())
        : operation.target.kind === 'PERSISTED_PIECE' && (operation.code === 'REMOVE_PIECE' || operation.code === 'CHANGE_UNLISTED' || operation.code === 'CHANGE_DISCOUNT' || operation.code === 'CHANGE_SERVICE_SPEED') ? !pieces.has(operation.target.id.toLowerCase())
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
  itemRows: CommercialWritePlan['itemUpdates'] | undefined,
): Record<string, unknown> {
  if (operation.code === 'ADD_ITEM') {
    const created = createdRow(operation.payload.clientRef, rowData(structural?.itemInserts, operation.payload.clientRef));
    return operation.payload.lineDiscount ? { ...created, ...lineDiscountAuditFields(operation.payload.lineDiscount) } : created;
  }
  if (operation.code === 'CHANGE_ITEM_PRICE') {
    return compact({ ...before, ...writtenFields(rowData(itemRows, operation.target.id)) });
  }
  if (operation.code === 'CHANGE_DISCOUNT') return { ...before, ...lineDiscountAuditFields(operation.payload.lineDiscount) };
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
      return row
        ? { id: row.id, service_speed: row.service_speed ?? facts.order?.service_speed ?? null, quantity: row.quantity, price_per_unit: row.price_per_unit, total_price: row.total_price }
        : { id: item.orderItemId };
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
  itemRows: CommercialWritePlan['itemUpdates'] | undefined,
  orderId: string,
  preview: OrderChangePreviewSuccess,
  storedAfter?: OperationBeforeFacts | null,
): OrderChangePersistedOperation[] {
  return request.operations.map((operation) => {
    const audit = auditBySeq.get(operation.seq);
    // A line speed, price or discount is recorded against its line.
    const lineTarget = (operation.code === 'CHANGE_SERVICE_SPEED' || LINE_MONEY_CODES.has(operation.code)) && operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : null;
    // A piece's own speed or discount (P9-01) is recorded against the piece, under its line.
    const pieceTarget = (operation.code === 'CHANGE_SERVICE_SPEED' || operation.code === 'CHANGE_DISCOUNT') && operation.target.kind === 'PERSISTED_PIECE' ? operation.target.id : null;
    const speedValues = operation.code === 'CHANGE_SERVICE_SPEED' && speedAudit;
    const beforeValues = speedValues ? storedSpeedSnapshot(speedAudit.before, beforeFacts) : beforeValuesFor(operation, beforeFacts);
    const afterSpeed = speedValues ? speedSnapshot(speedAudit.after, beforeFacts?.order ?? null) : null;
    if (afterSpeed) afterSpeed.express_charge_amount = '0.0000';
    const rawAfter = storedAfter
      ? beforeValuesFor(operation, storedAfter)
      : afterSpeed ?? afterValuesFor(operation, beforeValues, audit, plan, structural, itemRows);
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
      targetType: audit?.targetType ?? (pieceTarget ? 'PIECE' : lineTarget ? 'ITEM' : 'ORDER'),
      orderItemId: audit?.orderItemId ?? lineTarget ?? (pieceTarget ? beforeFacts?.pieces.get(pieceTarget.toLowerCase())?.order_item_id ?? null : null),
      orderItemPieceId: audit?.orderItemPieceId ?? pieceTarget,
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
  const lineMoney = input.request.operations.some((operation) => LINE_MONEY_CODES.has(operation.code));
  if (input.request.operations.some((operation) => (
    !ORDER_FIELD_CODES.has(operation.code)
    && operation.code !== 'CHANGE_UNLISTED'
    && !PREFERENCE_OPERATION_CODES.has(operation.code)
    && !STRUCTURAL_OPERATION_CODES.has(operation.code)
    && !LINE_MONEY_CODES.has(operation.code)
  ))) {
    return { ok: false, status: 422, code: 'COMMERCIAL_LINE_UNSUPPORTED' };
  }
  const speedChanged = input.request.operations.some((operation) => operation.code === 'CHANGE_SERVICE_SPEED');
  if (speedChanged && !input.preview.speedAudit) return { ok: false, status: 422, code: 'REVIEW_NOT_READY' };
  if (!hasPreference && !hasStructural && !speedChanged && !lineMoney && !sameMoney(input.preview.projectedTotal, input.preview.originalTotal)) {
    return { ok: false, status: 422, code: 'COMMERCIAL_TOTAL_CHANGED' };
  }
  // P6-01c: a priced edit stores the calculated order the review carried; nothing is priced here.
  const priced = Boolean(input.preview.commercial);
  if ((hasPreference || hasStructural || speedChanged || lineMoney) && !priced && !sameMoney(input.preview.projectedTotal, input.preview.originalTotal)) {
    return { ok: false, status: 422, code: 'REVIEW_NOT_READY' };
  }
  const money = input.preview.commercial ? editMoneyColumns(input.preview.commercial) : null;
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
  const fields = { ...orderFields(input.request), ...moneyHeaderFields(money, input.request) };
  try {
    return await input.runInTransaction(async (tx) => {
    if (typeof tx.$queryRaw === 'function') {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text AS id FROM public.org_orders_mst
        WHERE id = ${input.orderId}::uuid AND tenant_org_id = ${input.tenantId}::uuid
        FOR UPDATE`;
      if (!locked[0]) throw new OrderChangeMutationError('ORDER_NOT_FOUND');
      // OC-CON-005: a payment, credit, refund or disposition that landed after Review is never applied over silently.
      if (input.preview.reviewBinding
        && await readSettlementFingerprint(tx as unknown as SettlementFingerprintDb, input.tenantId, input.orderId)
          !== input.preview.reviewBinding.settlementSourceFingerprint) {
        throw new OrderChangeMutationError('REVIEW_CHANGED');
      }
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
    const overrideActor = await overrideActorOf(tx, input.tenantId, input.actorUserId, input.request);
    const rows = withLineMoney(money, plan, structural, input.actorUserId, linePriceUpdates(input.request, overrideActor));
    const auditBySeq = new Map([...plan.auditBySeq, ...(structural?.auditBySeq ?? [])]);
    const lockedOperations = persistedOperations(input.request, auditBySeq, input.preview.speedAudit, beforeFacts, plan, structural, rows.itemUpdates, input.orderId, input.preview);
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
      itemInserts: rows.itemInserts.length > 0 ? rows.itemInserts : undefined,
      pieceInserts: rows.pieceInserts.length > 0 ? rows.pieceInserts : undefined,
      itemUpdates: rows.itemUpdates,
      pieceUpdates: rows.pieceUpdates,
      removeItemIds: structural && structural.removeItemIds.length > 0 ? structural.removeItemIds : undefined,
      removePieceIds: structural && structural.removePieceIds.length > 0 ? structural.removePieceIds : undefined,
      finalizeOperations: async (orderChangeId) => {
      if (input.preview.commercial) {
        await replaceEditChildRows(tx as unknown as EditChildRowsTx, {
          tenantOrgId: input.tenantId,
          orderId: input.orderId,
          currencyCode: input.currencyCode as string,
          userId: input.actorUserId,
          at: input.appliedAt,
          edit: input.preview.commercial,
        });
        // D21: a promo the edit removed gives its use back (an order carries at most one promo).
        if (input.preview.commercial.discountChanges.some((change) => change.outcome === DISCOUNT_CHANGE_OUTCOMES.REMOVED
          && change.sourceType === DISCOUNT_SOURCE_TYPE.PROMO_CODE)) {
          await reversePromoUsageTx(tx as unknown as Parameters<typeof reversePromoUsageTx>[0], {
            orderId: input.orderId, tenantOrgId: input.tenantId, voidedBy: input.actorUserId,
          });
        }
        // The rollup rebuilds the header from the rows; it must equal the reviewed total (I3).
        await assertCommercialSnapshot(tx, {
          tenantId: input.tenantId,
          orderId: input.orderId,
          projectedTotal,
          orderChangeId,
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
        const storedOperations = persistedOperations(input.request, auditBySeq, input.preview.speedAudit, beforeFacts, plan, structural, rows.itemUpdates, input.orderId, input.preview, storedAfter);
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

/**
 * The order header facts that move with the calculated lines: the speed
 * premium, and the ready-by when a line's time was counted again and the
 * edit does not set the ready-by itself.
 */
function moneyHeaderFields(money: EditMoneyColumns | null, request: ApplyRequest): Record<string, unknown> {
  if (!money) return {};
  const readyBySet = request.operations.some((operation) => operation.code === 'CHANGE_READY_BY'
    || (operation.code === 'CHANGE_UNLISTED' && operation.payload.field === 'order.readyBy'));
  return {
    speed_premium_amount: money.speedPremiumAmount,
    ...(money.readyBy && !readyBySet ? { ready_by: money.readyBy } : {}),
  };
}

/**
 * Puts the calculated §6.1 columns on the rows the plans write: new items and
 * pieces get them in their insert, every other active row in an update
 * (an order discount re-split or a piece re-allocation moves untouched rows).
 */
function withLineMoney(
  money: EditMoneyColumns | null,
  plan: CommercialWritePlan,
  structural: StructuralWritePlan | null,
  actorUserId: string,
  priceUpdates: CommercialWritePlan['itemUpdates'] = [],
): {
  itemInserts: CommercialWritePlan['itemUpdates'];
  pieceInserts: CommercialWritePlan['itemUpdates'];
  itemUpdates: CommercialWritePlan['itemUpdates'] | undefined;
  pieceUpdates: CommercialWritePlan['itemUpdates'] | undefined;
} {
  const itemInserts = (structural?.itemInserts ?? []).map((row) => withColumns(row, money?.items.get(row.id)));
  const pieceInserts = (structural?.pieceInserts ?? []).map((row) => withColumns(row, money?.pieces.get(row.id)));
  const inserted = new Set([...itemInserts, ...pieceInserts].map((row) => row.id));
  const moneyUpdates = (columns: ReadonlyMap<string, object> | undefined) => [...(columns ?? new Map())]
    .filter(([id]) => !inserted.has(id))
    .map(([id, data]) => ({ id, data: { ...data, updated_by: actorUserId } }));
  return {
    itemInserts,
    pieceInserts,
    itemUpdates: mergedRows([...plan.itemUpdates, ...(structural?.itemUpdates ?? []), ...priceUpdates], moneyUpdates(money?.items)),
    pieceUpdates: mergedRows(plan.pieceUpdates, moneyUpdates(money?.pieces)),
  };
}

/**
 * The cashier price columns a line price operation writes (P6-02c); the price
 * itself (`price_per_unit`, `price_source`) comes with the calculated columns.
 */
function linePriceUpdates(request: ApplyRequest, overrideActor: string | null): CommercialWritePlan['itemUpdates'] {
  return request.operations.flatMap((operation) => {
    if (operation.code !== 'CHANGE_ITEM_PRICE') return [];
    const set = operation.payload.priceOverride !== null;
    return [{
      id: operation.target.id,
      data: {
        price_override: operation.payload.priceOverride,
        override_reason: set ? operation.payload.overrideReason ?? null : null,
        override_by: set ? overrideActor : null,
      },
    }];
  });
}

/**
 * The session user's `org_users_mst.id` for `override_by` (it is not the auth user id), when the edit sets a price.
 * @returns the id, or null when no price is set or the user has no active membership
 */
async function overrideActorOf(tx: OrderChangeApplyTx, tenantId: string, actorUserId: string, request: ApplyRequest): Promise<string | null> {
  const queryable = tx as { $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T> };
  const setsPrice = request.operations.some((operation) => operation.code === 'CHANGE_ITEM_PRICE' && operation.payload.priceOverride !== null);
  if (!setsPrice || typeof queryable.$queryRaw !== 'function') return null;
  const rows = await queryable.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id FROM org_users_mst
    WHERE tenant_org_id = ${tenantId}::uuid AND user_id = ${actorUserId}::uuid AND is_active = true
    LIMIT 1`;
  return rows[0]?.id ?? null;
}

function withColumns(row: CommercialWritePlan['itemUpdates'][number], columns: object | undefined) {
  return columns ? { id: row.id, data: { ...row.data, ...columns } } : row;
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
