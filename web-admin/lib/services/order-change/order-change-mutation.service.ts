/**
 * Persists one applied Change inside the caller's transaction.
 * Pricing, tax, settlement, and workflow transitions stay with their owners.
 * This module does not import the global Prisma client.
 */

import { randomUUID } from 'crypto';

import { OUTBOX_EVENT_TYPES, OUTBOX_STATUSES, SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import {
  claimIdempotencyKeyTx,
  completeIdempotencyKeyTx,
  hashPayload,
  ORDER_CHANGE_IDEMPOTENCY_TYPE,
  type IdempotencyWriteTx,
} from '@/lib/utils/idempotency';

const PROTECTED_WRITE_FIELDS = new Set([
  'id',
  'tenant_org_id',
  'order_id',
  'deleted_at',
  'deleted_by',
  'deleted_order_change_id',
]);

const ITEM_CODES = new Set(['ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY']);
const PIECE_CODES = new Set(['ADD_PIECE', 'REMOVE_PIECE']);
const PREFERENCE_CODES = new Set(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE']);
const ORDER_CODES = new Set([
  'CHANGE_PRIORITY',
  'CHANGE_SERVICE_SPEED',
  'CHANGE_READY_BY',
  'CHANGE_ORDER_NOTES',
  'CHANGE_CUSTOMER_SNAPSHOT',
  'CHANGE_UNLISTED',
]);

export type PersistedFinancialOutcome =
  | 'NONE'
  | 'OUTSTANDING_OPTIONAL'
  | 'OUTSTANDING_REQUIRED'
  | 'OVERPAYMENT';

export type OrderChangeClassification = 'SETTLED' | 'OUTSTANDING' | 'OVERPAYMENT' | 'DENIED';

/**
 * Collection policy already stored on the order. Pay-on-collection is the only
 * type the existing collection route accepts, so that balance is required.
 * The other known settlement types keep the balance and do not invent a
 * collection this change cannot perform. An unknown type stays unresolved.
 */
export function collectionRequiredForPaymentType(paymentTypeCode: string | null | undefined): boolean | null {
  if (paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION) return true;
  if (
    paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_IN_ADVANCE
    || paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_DELIVERY
    || paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE
  ) return false;
  return null;
}

/**
 * Translate a preview classification into the stored follow-up vocabulary.
 * OUTSTANDING without an explicit collection policy returns null so the caller
 * cannot guess whether collection is required.
 */
export function mapPersistedFinancialOutcome(
  classification: OrderChangeClassification,
  collectionRequired: boolean | null,
): PersistedFinancialOutcome | null {
  if (classification === 'DENIED') return null;
  if (classification === 'SETTLED') return 'NONE';
  if (classification === 'OVERPAYMENT') return 'OVERPAYMENT';
  if (collectionRequired === null) return null;
  return collectionRequired ? 'OUTSTANDING_REQUIRED' : 'OUTSTANDING_OPTIONAL';
}

export class OrderChangeMutationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OrderChangeMutationError';
  }
}

export interface OrderChangePersistedOperation {
  seq: number;
  code: string;
  targetType: 'ORDER' | 'ITEM' | 'PIECE' | 'PREFERENCE';
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  orderPreferenceId?: string | null;
  clientRef?: string | null;
  beforeValues?: Record<string, unknown>;
  afterValues?: Record<string, unknown>;
  auditSummary?: string | null;
}

export interface OrderChangeRowWrite {
  id: string;
  data: Record<string, unknown>;
}

export interface PersistOrderChangeInput {
  tenantId: string;
  orderId: string;
  expectedEditStateVersion: number;
  expectedWfStateVersion: number;
  sourceContext: string;
  actorUserId: string;
  actorName?: string | null;
  changeReason?: string | null;
  currencyCode: string;
  financialBefore: Record<string, unknown>;
  financialAfter: Record<string, unknown>;
  commercialDelta: string;
  financialOutcome: PersistedFinancialOutcome;
  idempotencyKey: string;
  request: unknown;
  applyResponse: Record<string, unknown>;
  operations: readonly OrderChangePersistedOperation[];
  itemInserts?: readonly OrderChangeRowWrite[];
  pieceInserts?: readonly OrderChangeRowWrite[];
  preferenceInserts?: readonly OrderChangeRowWrite[];
  itemUpdates?: readonly OrderChangeRowWrite[];
  pieceUpdates?: readonly OrderChangeRowWrite[];
  preferenceUpdates?: readonly OrderChangeRowWrite[];
  removeItemIds?: readonly string[];
  removePieceIds?: readonly string[];
  removePreferenceIds?: readonly string[];
  appliedAt: Date;
}

export interface PersistOrderChangeSuccess {
  ok: true;
  replayed: boolean;
  orderChangeId: string;
  changeNo: number;
  editStateVersionAfter: number;
  requestHash: string;
  clientRefs: Record<string, string>;
  retiredPieceIds: string[];
  retiredPreferenceIds: string[];
  applyResponse: Record<string, unknown>;
}

export interface PersistOrderChangeRejection {
  ok: false;
  code: 'IDEMPOTENCY_IN_FLIGHT' | 'IDEMPOTENCY_CONFLICT';
}

export type PersistOrderChangeResult = PersistOrderChangeSuccess | PersistOrderChangeRejection;

interface IdentityRow { id: string }

export interface OrderChangeWriteTx extends IdempotencyWriteTx {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  org_orders_mst: {
    updateMany(args: {
      where: { id: string; tenant_org_id: string; edit_state_version: number };
      data: { edit_state_version: number };
    }): Promise<{ count: number }>;
  };
  org_order_changes_mst: {
    aggregate(args: {
      where: { tenant_org_id: string; order_id: string };
      _max: { change_no: true };
    }): Promise<{ _max: { change_no: number | null } }>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findFirst(args: {
      where: { id: string; tenant_org_id: string };
      select: { id: true; change_no: true; edit_state_version_after: true; request_hash: true; apply_response: true };
    }): Promise<{
      id: string;
      change_no: number;
      edit_state_version_after: number;
      request_hash: string;
      apply_response: unknown;
    } | null>;
  };
  org_order_change_ops_dtl: {
    createMany(args: { data: Array<Record<string, unknown>> }): Promise<{ count: number }>;
  };
  org_order_items_dtl: RowDelegate;
  org_order_item_pieces_dtl: RowDelegate;
  org_order_preferences_dtl: RowDelegate;
  org_domain_events_outbox: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

interface RowDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  findMany(args: { where: Record<string, unknown>; select: { id: true } }): Promise<IdentityRow[]>;
}

function nonemptyObject(value: Record<string, unknown>, code: string): void {
  if (Object.keys(value).length === 0) throw new OrderChangeMutationError(code);
}

function assertOperation(operation: OrderChangePersistedOperation): void {
  const itemId = operation.orderItemId ?? null;
  const pieceId = operation.orderItemPieceId ?? null;
  const preferenceId = operation.orderPreferenceId ?? null;
  const valid = operation.seq > 0 && (
    (ITEM_CODES.has(operation.code) && operation.targetType === 'ITEM' && itemId && !pieceId && !preferenceId)
    || (PIECE_CODES.has(operation.code) && operation.targetType === 'PIECE' && itemId && pieceId && !preferenceId)
    || (PREFERENCE_CODES.has(operation.code) && operation.targetType === 'PREFERENCE' && preferenceId && (!pieceId || itemId))
    || (ORDER_CODES.has(operation.code) && operation.targetType === 'ORDER' && !itemId && !pieceId && !preferenceId)
  );
  if (!valid) throw new OrderChangeMutationError('OPERATION_INVALID');
}

function guardedData(row: OrderChangeRowWrite): Record<string, unknown> {
  for (const field of Object.keys(row.data)) {
    if (PROTECTED_WRITE_FIELDS.has(field)) throw new OrderChangeMutationError('PROTECTED_FIELD');
  }
  return row.data;
}

async function activeIds(
  delegate: { findMany(args: { where: Record<string, unknown>; select: { id: true } }): Promise<IdentityRow[]> },
  tenantId: string,
  orderId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await delegate.findMany({
    where: { tenant_org_id: tenantId, order_id: orderId, id: { in: [...ids] }, rec_status: 1 },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/**
 * Insert the Change, its operations, caller-supplied row writes, and logical removals.
 * A non-ok result writes nothing. A thrown error happens after a claim and must roll the caller transaction back.
 */
export async function persistOrderChangeTx(
  tx: OrderChangeWriteTx,
  input: PersistOrderChangeInput,
): Promise<PersistOrderChangeResult> {
  if (input.expectedEditStateVersion < 1 || input.expectedWfStateVersion < 1) {
    throw new OrderChangeMutationError('VERSION_INVALID');
  }
  if (!input.sourceContext.trim() || !input.idempotencyKey.trim() || !input.actorUserId.trim()) {
    throw new OrderChangeMutationError('COMMAND_INVALID');
  }
  nonemptyObject(input.financialBefore, 'SNAPSHOT_EMPTY');
  nonemptyObject(input.financialAfter, 'SNAPSHOT_EMPTY');
  nonemptyObject(input.applyResponse, 'RESPONSE_EMPTY');
  const sequences = new Set<number>();
  const clientRefs: Record<string, string> = {};
  for (const operation of input.operations) {
    assertOperation(operation);
    if (sequences.has(operation.seq)) throw new OrderChangeMutationError('DUPLICATE_SEQUENCE');
    sequences.add(operation.seq);
    if (!operation.clientRef) continue;
    const targetId = operation.orderPreferenceId ?? operation.orderItemPieceId ?? operation.orderItemId;
    if (!targetId || clientRefs[operation.clientRef]) throw new OrderChangeMutationError('CLIENT_REF_INVALID');
    clientRefs[operation.clientRef] = targetId;
  }

  const requestHash = hashPayload(input.request);
  const claim = await claimIdempotencyKeyTx(
    tx,
    input.tenantId,
    input.idempotencyKey,
    ORDER_CHANGE_IDEMPOTENCY_TYPE,
    requestHash,
  );
  if (claim.status === 'IN_FLIGHT') return { ok: false, code: 'IDEMPOTENCY_IN_FLIGHT' };
  if (claim.status === 'CONFLICT') return { ok: false, code: 'IDEMPOTENCY_CONFLICT' };
  if (claim.status === 'COMPLETED') {
    const existing = await tx.org_order_changes_mst.findFirst({
      where: { id: claim.resourceId, tenant_org_id: input.tenantId },
      select: {
        id: true,
        change_no: true,
        edit_state_version_after: true,
        request_hash: true,
        apply_response: true,
      },
    });
    if (!existing) throw new OrderChangeMutationError('IDEMPOTENCY_TARGET_MISSING');
    return {
      ok: true,
      replayed: true,
      orderChangeId: existing.id,
      changeNo: existing.change_no,
      editStateVersionAfter: existing.edit_state_version_after,
      requestHash: existing.request_hash,
      clientRefs: {},
      retiredPieceIds: [],
      retiredPreferenceIds: [],
      applyResponse: existing.apply_response as Record<string, unknown>,
    };
  }

  await tx.$executeRaw`
    SELECT id
    FROM public.org_orders_mst
    WHERE id = ${input.orderId}::uuid
      AND tenant_org_id = ${input.tenantId}::uuid
    FOR UPDATE`;
  const version = await tx.org_orders_mst.updateMany({
    where: {
      id: input.orderId,
      tenant_org_id: input.tenantId,
      edit_state_version: input.expectedEditStateVersion,
    },
    data: { edit_state_version: input.expectedEditStateVersion + 1 },
  });
  if (version.count !== 1) throw new OrderChangeMutationError('VERSION_CONFLICT');

  const current = await tx.org_order_changes_mst.aggregate({
    where: { tenant_org_id: input.tenantId, order_id: input.orderId },
    _max: { change_no: true },
  });
  const changeNo = (current._max.change_no ?? 0) + 1;
  const orderChangeId = randomUUID();
  await tx.org_order_changes_mst.create({
    data: {
      id: orderChangeId,
      tenant_org_id: input.tenantId,
      order_id: input.orderId,
      change_no: changeNo,
      edit_state_version_before: input.expectedEditStateVersion,
      edit_state_version_after: input.expectedEditStateVersion + 1,
      wf_state_version_expected: input.expectedWfStateVersion,
      source_context: input.sourceContext,
      actor_user_id: input.actorUserId,
      actor_name: input.actorName ?? null,
      change_reason: input.changeReason ?? null,
      currency_code: input.currencyCode,
      financial_before: input.financialBefore,
      financial_after: input.financialAfter,
      commercial_delta: input.commercialDelta,
      financial_outcome: input.financialOutcome,
      idempotency_key: input.idempotencyKey,
      request_hash: requestHash,
      apply_response: input.applyResponse,
      applied_at: input.appliedAt,
      created_by: input.actorUserId,
    },
  });

  if (input.operations.length > 0) {
    await tx.org_order_change_ops_dtl.createMany({
      data: input.operations.map((operation) => ({
        tenant_org_id: input.tenantId,
        order_id: input.orderId,
        order_change_id: orderChangeId,
        operation_seq: operation.seq,
        operation_code: operation.code,
        target_type: operation.targetType,
        order_item_id: operation.orderItemId ?? null,
        order_item_piece_id: operation.orderItemPieceId ?? null,
        order_preference_id: operation.orderPreferenceId ?? null,
        client_ref: operation.clientRef ?? null,
        before_values: operation.beforeValues ?? {},
        after_values: operation.afterValues ?? {},
        audit_summary: operation.auditSummary ?? null,
        created_by: input.actorUserId,
      })),
    });
  }

  for (const row of input.itemInserts ?? []) {
    await tx.org_order_items_dtl.create({
      data: { ...guardedData(row), id: row.id, tenant_org_id: input.tenantId, order_id: input.orderId },
    });
  }
  for (const row of input.pieceInserts ?? []) {
    await tx.org_order_item_pieces_dtl.create({
      data: { ...guardedData(row), id: row.id, tenant_org_id: input.tenantId, order_id: input.orderId },
    });
  }
  for (const row of input.preferenceInserts ?? []) {
    await tx.org_order_preferences_dtl.create({
      data: { ...guardedData(row), id: row.id, tenant_org_id: input.tenantId, order_id: input.orderId },
    });
  }
  for (const row of [...(input.itemUpdates ?? [])]) {
    const updated = await tx.org_order_items_dtl.updateMany({
      where: { id: row.id, tenant_org_id: input.tenantId, order_id: input.orderId, rec_status: 1 },
      data: guardedData(row),
    });
    if (updated.count !== 1) throw new OrderChangeMutationError('UPDATE_NOT_ACTIVE');
  }
  for (const row of input.pieceUpdates ?? []) {
    const updated = await tx.org_order_item_pieces_dtl.updateMany({
      where: { id: row.id, tenant_org_id: input.tenantId, order_id: input.orderId, rec_status: 1 },
      data: guardedData(row),
    });
    if (updated.count !== 1) throw new OrderChangeMutationError('UPDATE_NOT_ACTIVE');
  }
  for (const row of input.preferenceUpdates ?? []) {
    const updated = await tx.org_order_preferences_dtl.updateMany({
      where: { id: row.id, tenant_org_id: input.tenantId, order_id: input.orderId, rec_status: 1 },
      data: guardedData(row),
    });
    if (updated.count !== 1) throw new OrderChangeMutationError('UPDATE_NOT_ACTIVE');
  }

  const removeItems = [...(input.removeItemIds ?? [])];
  const removePieces = [...(input.removePieceIds ?? [])];
  const removePreferences = [...(input.removePreferenceIds ?? [])];
  const activeItems = await activeIds(tx.org_order_items_dtl, input.tenantId, input.orderId, removeItems);
  if (activeItems.size !== removeItems.length) throw new OrderChangeMutationError('REMOVAL_NOT_ACTIVE');
  const descendantPieces = removeItems.length === 0
    ? []
    : await tx.org_order_item_pieces_dtl.findMany({
      where: {
        tenant_org_id: input.tenantId,
        order_id: input.orderId,
        order_item_id: { in: removeItems },
        rec_status: 1,
      },
      select: { id: true },
    });
  const pieceIds = [...new Set([...removePieces, ...descendantPieces.map((row) => row.id)])];
  const activePieces = await activeIds(tx.org_order_item_pieces_dtl, input.tenantId, input.orderId, pieceIds);
  if ([...removePieces].some((id) => !activePieces.has(id))) throw new OrderChangeMutationError('REMOVAL_NOT_ACTIVE');
  const preferenceOr: Array<Record<string, unknown>> = [];
  if (removeItems.length > 0) preferenceOr.push({ order_item_id: { in: removeItems } });
  if (pieceIds.length > 0) preferenceOr.push({ order_item_piece_id: { in: pieceIds } });
  const descendantPreferences = preferenceOr.length === 0
    ? []
    : await tx.org_order_preferences_dtl.findMany({
      where: { tenant_org_id: input.tenantId, order_id: input.orderId, rec_status: 1, OR: preferenceOr },
      select: { id: true },
    });
  const preferenceIds = [...new Set([...removePreferences, ...descendantPreferences.map((row) => row.id)])];
  const activePreferences = await activeIds(tx.org_order_preferences_dtl, input.tenantId, input.orderId, preferenceIds);
  if (removePreferences.some((id) => !activePreferences.has(id))) throw new OrderChangeMutationError('REMOVAL_NOT_ACTIVE');

  const removal = {
    rec_status: 0,
    deleted_at: input.appliedAt,
    deleted_by: input.actorUserId,
    deleted_order_change_id: orderChangeId,
  };
  if (removeItems.length > 0) {
    const retired = await tx.org_order_items_dtl.updateMany({
      where: { tenant_org_id: input.tenantId, order_id: input.orderId, id: { in: removeItems }, rec_status: 1 },
      data: removal,
    });
    if (retired.count !== removeItems.length) throw new OrderChangeMutationError('REMOVAL_NOT_ACTIVE');
  }
  if (pieceIds.length > 0) {
    const retired = await tx.org_order_item_pieces_dtl.updateMany({
      where: { tenant_org_id: input.tenantId, order_id: input.orderId, id: { in: pieceIds }, rec_status: 1 },
      data: removal,
    });
    if (retired.count !== pieceIds.length) throw new OrderChangeMutationError('REMOVAL_NOT_ACTIVE');
  }
  if (preferenceIds.length > 0) {
    const retired = await tx.org_order_preferences_dtl.updateMany({
      where: { tenant_org_id: input.tenantId, order_id: input.orderId, id: { in: preferenceIds }, rec_status: 1 },
      data: removal,
    });
    if (retired.count !== preferenceIds.length) throw new OrderChangeMutationError('REMOVAL_NOT_ACTIVE');
  }

  await tx.org_domain_events_outbox.create({
    data: {
      tenant_org_id: input.tenantId,
      event_type: OUTBOX_EVENT_TYPES.ORDER_CHANGE_APPLIED,
      aggregate_type: 'order_change',
      aggregate_id: orderChangeId,
      payload: { orderId: input.orderId, changeNo, requestHash },
      status: OUTBOX_STATUSES.PENDING,
      attempts: 0,
      max_attempts: 6,
      next_retry_at: input.appliedAt,
    },
  });
  await completeIdempotencyKeyTx(
    tx,
    input.tenantId,
    input.idempotencyKey,
    ORDER_CHANGE_IDEMPOTENCY_TYPE,
    requestHash,
    orderChangeId,
    input.applyResponse,
  );

  return {
    ok: true,
    replayed: false,
    orderChangeId,
    changeNo,
    editStateVersionAfter: input.expectedEditStateVersion + 1,
    requestHash,
    clientRefs,
    retiredPieceIds: pieceIds,
    retiredPreferenceIds: preferenceIds,
    applyResponse: input.applyResponse,
  };
}
