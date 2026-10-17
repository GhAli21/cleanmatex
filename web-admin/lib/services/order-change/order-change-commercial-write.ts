/**
 * Maps reviewed preference and screen-field operations onto existing row writes.
 * Item and piece identity stays. The legacy editor deleted every piece and recreated it.
 */

import { randomUUID } from 'crypto';

import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import { PREFS_LEVEL, PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';
import { round4 } from '@/lib/services/order-financial-aggregation';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import type { OrderChangePersistedOperation, OrderChangeRowWrite } from '@/lib/services/order-change/order-change-mutation.service';
import type { z } from 'zod';
import type { orderChangeApplyRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

type ApplyRequest = z.infer<typeof orderChangeApplyRequestSchema>;
type ApplyOperation = ApplyRequest['operations'][number];

export const PREFERENCE_OPERATION_CODES = new Set(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE']);

const ITEM_FIELDS: Record<string, { column: string; kind: 'text' | 'bool' | 'money' }> = {
  'item.notes': { column: 'notes', kind: 'text' },
  'item.stainNotes': { column: 'stain_notes', kind: 'text' },
  'item.damageNotes': { column: 'damage_notes', kind: 'text' },
  'item.priceOverride': { column: 'price_override', kind: 'money' },
  'item.overrideReason': { column: 'override_reason', kind: 'text' },
  'item.packing': { column: 'packing_pref_code', kind: 'text' },
  'item.stain': { column: 'has_stain', kind: 'bool' },
  'item.damage': { column: 'has_damage', kind: 'bool' },
};

const PIECE_FIELDS: Record<string, { column: string; kind: 'text' | 'bool' | 'money' }> = {
  'piece.color': { column: 'color', kind: 'text' },
  'piece.brand': { column: 'brand', kind: 'text' },
  'piece.notes': { column: 'notes', kind: 'text' },
  'piece.packing': { column: 'packing_pref_code', kind: 'text' },
  'piece.stain': { column: 'has_stain', kind: 'bool' },
  'piece.damage': { column: 'has_damage', kind: 'bool' },
};

export class OrderChangeApplyRejected extends Error {
  constructor(readonly status: 422, readonly code: string) {
    super(code);
  }
}

export interface PreferenceCatalogFact {
  id: string;
  preferenceCode: string;
  extraPrice: string;
  preferenceSysKind: string;
}

export interface CommercialWriteFacts {
  pieceItemIds: ReadonlyMap<string, string>;
  catalogById: ReadonlyMap<string, PreferenceCatalogFact>;
  nextPrefsNo: number;
  branchId: string | null;
  orderLevelPreferenceIds: ReadonlySet<string>;
}

export interface CommercialWritePlan {
  preferenceInserts: OrderChangeRowWrite[];
  preferenceUpdates: OrderChangeRowWrite[];
  removePreferenceIds: string[];
  itemUpdates: OrderChangeRowWrite[];
  pieceUpdates: OrderChangeRowWrite[];
  orderCharges: Array<{ preferenceId: string; label: string; amount: string }>;
  voidChargeSourceIds: string[];
  auditBySeq: Map<number, Pick<OrderChangePersistedOperation, 'targetType' | 'orderItemId' | 'orderItemPieceId' | 'orderPreferenceId' | 'clientRef'>>;
}

interface CommercialQueryTx {
  $queryRaw?<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw?(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export function preferenceParentIsLocal(operations: readonly ApplyOperation[]): boolean {
  return operations.some((operation) => (
    operation.code === 'ADD_PREFERENCE'
    && (operation.target.kind === 'LOCAL_ITEM' || operation.target.kind === 'LOCAL_PIECE')
  ));
}

export function buildCommercialWritePlan(
  operations: readonly ApplyOperation[],
  actorUserId: string,
  facts: CommercialWriteFacts,
): CommercialWritePlan {
  const plan: CommercialWritePlan = {
    preferenceInserts: [],
    preferenceUpdates: [],
    removePreferenceIds: [],
    itemUpdates: [],
    pieceUpdates: [],
    orderCharges: [],
    voidChargeSourceIds: [],
    auditBySeq: new Map(),
  };
  const itemData = new Map<string, Record<string, unknown>>();
  const pieceData = new Map<string, Record<string, unknown>>();
  let prefsNo = facts.nextPrefsNo;

  for (const operation of operations) {
    if (operation.code === 'ADD_PREFERENCE') {
      const catalog = facts.catalogById.get(operation.payload.preferenceId.toLowerCase());
      if (!catalog || catalog.preferenceCode !== operation.payload.preferenceCode) {
        throw new OrderChangeApplyRejected(422, 'PREFERENCE_CATALOG_MISSING');
      }
      const id = randomUUID();
      const level = preferenceLevel(operation.target.kind);
      const itemId = operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : null;
      const pieceId = operation.target.kind === 'PERSISTED_PIECE' ? operation.target.id : null;
      const parentItemId = pieceId ? facts.pieceItemIds.get(pieceId.toLowerCase()) ?? null : itemId;
      if (pieceId && !parentItemId) throw new OrderChangeApplyRejected(422, 'PREFERENCE_PARENT_UNRESOLVED');
      prefsNo += 1;
      plan.preferenceInserts.push({
        id,
        data: {
          prefs_no: prefsNo,
          prefs_level: level,
          preference_code: catalog.preferenceCode,
          preference_content: operation.payload.preferenceContent ?? catalog.preferenceCode,
          preference_sys_kind: catalog.preferenceSysKind,
          preference_id: catalog.id,
          prefs_source: PREFS_SOURCE_STAGE.ORDER_EDIT,
          extra_price: catalog.extraPrice,
          branch_id: facts.branchId,
          created_by: actorUserId,
          ...(parentItemId ? { order_item_id: parentItemId } : {}),
          ...(pieceId ? { order_item_piece_id: pieceId } : {}),
        },
      });
      plan.auditBySeq.set(operation.seq, {
        targetType: 'PREFERENCE',
        orderPreferenceId: id,
        orderItemId: parentItemId,
        orderItemPieceId: pieceId,
        clientRef: operation.payload.clientRef,
      });
      if (level === PREFS_LEVEL.ORDER && Number(catalog.extraPrice) > 0) {
        plan.orderCharges.push({ preferenceId: id, label: catalog.preferenceCode, amount: catalog.extraPrice });
      }
    } else if (operation.code === 'CHANGE_PREFERENCE') {
      plan.preferenceUpdates.push({
        id: operation.target.id,
        data: {
          preference_content: operation.payload.preferenceContent ?? null,
          updated_by: actorUserId,
          updated_at: new Date(),
        },
      });
      plan.auditBySeq.set(operation.seq, {
        targetType: 'PREFERENCE',
        orderPreferenceId: operation.target.id,
        orderItemId: null,
        orderItemPieceId: null,
        clientRef: null,
      });
    } else if (operation.code === 'REMOVE_PREFERENCE') {
      plan.removePreferenceIds.push(operation.target.id);
      if (facts.orderLevelPreferenceIds.has(operation.target.id.toLowerCase())) plan.voidChargeSourceIds.push(operation.target.id);
      plan.auditBySeq.set(operation.seq, {
        targetType: 'PREFERENCE',
        orderPreferenceId: operation.target.id,
        orderItemId: null,
        orderItemPieceId: null,
        clientRef: null,
      });
    } else if (operation.code === 'CHANGE_UNLISTED' && 'id' in operation.target && operation.target.id) {
      const field = operation.target.kind === 'PERSISTED_ITEM'
        ? ITEM_FIELDS[operation.payload.field]
        : operation.target.kind === 'PERSISTED_PIECE'
          ? PIECE_FIELDS[operation.payload.field]
          : undefined;
      if (!field) continue;
      const bucket = operation.target.kind === 'PERSISTED_ITEM' ? itemData : pieceData;
      const data = bucket.get(operation.target.id) ?? {};
      data[field.column] = fieldValue(field.kind, operation.payload.value);
      data.updated_by = actorUserId;
      data.updated_at = new Date();
      bucket.set(operation.target.id, data);
    }
  }

  plan.itemUpdates = [...itemData].map(([id, data]) => ({ id, data }));
  plan.pieceUpdates = [...pieceData].map(([id, data]) => ({ id, data }));
  return plan;
}

export async function loadCommercialWriteFacts(
  tx: CommercialQueryTx,
  tenantId: string,
  orderId: string,
  operations: readonly ApplyOperation[],
): Promise<CommercialWriteFacts> {
  if (typeof tx.$queryRaw !== 'function') {
    throw new OrderChangeApplyRejected(422, 'PREFERENCE_CATALOG_MISSING');
  }
  const pieceIds = operations.flatMap((operation) => (
    operation.code === 'ADD_PREFERENCE' && operation.target.kind === 'PERSISTED_PIECE' ? [operation.target.id] : []
  ));
  const catalogIds = operations.flatMap((operation) => (
    operation.code === 'ADD_PREFERENCE' ? [operation.payload.preferenceId] : []
  ));
  const removeIds = operations.flatMap((operation) => (
    operation.code === 'REMOVE_PREFERENCE' ? [operation.target.id] : []
  ));

  const [orderRows, prefsRows] = await Promise.all([
    tx.$queryRaw<Array<{ branch_id: string | null }>>`
      SELECT branch_id::text AS branch_id
      FROM org_orders_mst
      WHERE id = ${orderId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
    `,
    tx.$queryRaw<Array<{ max_no: number }>>`
      SELECT COALESCE(MAX(prefs_no), 0)::int AS max_no
      FROM org_order_preferences_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND order_id = ${orderId}::uuid
    `,
  ]);
  const pieceRows = await rowsById<{ id: string; order_item_id: string }>(tx, pieceIds, (id) => tx.$queryRaw!<Array<{ id: string; order_item_id: string }>>`
    SELECT id::text AS id, order_item_id::text AS order_item_id
    FROM org_order_item_pieces_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND order_id = ${orderId}::uuid
      AND rec_status = 1
      AND id = ${id}::uuid
  `);
  const catalogRows = await rowsById<{ id: string; preference_code: string; extra_price: string; preference_sys_kind: string }>(tx, catalogIds, (id) => tx.$queryRaw!<Array<{ id: string; preference_code: string; extra_price: string; preference_sys_kind: string }>>`
    SELECT id::text AS id, preference_code, extra_price::text AS extra_price, preference_sys_kind
    FROM org_service_preference_cf
    WHERE tenant_org_id = ${tenantId}::uuid
      AND rec_status = 1
      AND is_active = true
      AND id = ${id}::uuid
  `);
  const orderPrefRows = await rowsById<{ id: string }>(tx, removeIds, (id) => tx.$queryRaw!<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM org_order_preferences_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND order_id = ${orderId}::uuid
      AND rec_status = 1
      AND prefs_level = ${PREFS_LEVEL.ORDER}
      AND id = ${id}::uuid
  `);

  return {
    branchId: orderRows[0]?.branch_id ?? null,
    nextPrefsNo: Number(prefsRows[0]?.max_no ?? 0),
    pieceItemIds: new Map(pieceRows.map((row) => [row.id.toLowerCase(), row.order_item_id])),
    catalogById: new Map(catalogRows.map((row) => [row.id.toLowerCase(), {
      id: row.id,
      preferenceCode: row.preference_code,
      extraPrice: Number(row.extra_price ?? 0).toFixed(4),
      preferenceSysKind: row.preference_sys_kind,
    }])),
    orderLevelPreferenceIds: new Set(orderPrefRows.map((row) => row.id.toLowerCase())),
  };
}

export async function writePreferenceCharges(
  tx: CommercialQueryTx,
  input: {
    tenantId: string;
    orderId: string;
    actorUserId: string;
    currencyCode: string;
    appliedAt: Date;
    plan: CommercialWritePlan;
  },
): Promise<void> {
  if (typeof tx.$executeRaw !== 'function') return;
  for (const sourceId of input.plan.voidChargeSourceIds) {
    await tx.$executeRaw`
      UPDATE org_order_charges_dtl
      SET is_voided = true,
          voided_at = ${input.appliedAt},
          voided_by = ${input.actorUserId}::uuid,
          updated_at = ${input.appliedAt},
          updated_by = ${input.actorUserId}::uuid
      WHERE tenant_org_id = ${input.tenantId}::uuid
        AND order_id = ${input.orderId}::uuid
        AND charge_type = ${CHARGE_TYPES.PREFERENCE}
        AND charge_source_id = ${sourceId}::uuid
        AND is_voided = false
    `;
  }
  for (const charge of input.plan.orderCharges) {
    await tx.$executeRaw`
      INSERT INTO org_order_charges_dtl (
        tenant_org_id, order_id, charge_type, charge_source_id, label, amount, currency_code, applied_seq, created_by
      )
      VALUES (
        ${input.tenantId}::uuid,
        ${input.orderId}::uuid,
        ${CHARGE_TYPES.PREFERENCE},
        ${charge.preferenceId}::uuid,
        ${charge.label},
        ${charge.amount}::numeric,
        ${input.currencyCode},
        (
          SELECT COALESCE(MAX(applied_seq), 0) + 1
          FROM org_order_charges_dtl
          WHERE tenant_org_id = ${input.tenantId}::uuid
            AND order_id = ${input.orderId}::uuid
        ),
        ${input.actorUserId}::uuid
      )
    `;
  }
}

/**
 * Splits the reviewed tax across the order's current tax lines.
 * The last line takes the remainder so the stored sum equals the reviewed tax.
 */
export function allocateReviewedTax(
  lines: readonly { id: string; taxAmount: string }[],
  projectedTax: string,
): { id: string; taxAmount: string }[] {
  if (lines.length === 0) return [];
  const target = round4(Number(projectedTax));
  if (lines.length === 1) return [{ id: lines[0].id, taxAmount: target.toFixed(4) }];
  const current = lines.map((line) => {
    const amount = Number(line.taxAmount);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  });
  const sum = current.reduce((total, amount) => total + amount, 0);
  const shares: number[] = [];
  if (sum <= 0) {
    shares.push(target);
    for (let index = 1; index < lines.length; index += 1) shares.push(0);
  } else {
    let used = 0;
    for (let index = 0; index < lines.length - 1; index += 1) {
      const share = round4(target * (current[index] / sum));
      shares.push(share);
      used = round4(used + share);
    }
    shares.push(round4(target - used));
  }
  return lines.map((line, index) => ({ id: line.id, taxAmount: shares[index].toFixed(4) }));
}

/**
 * The snapshot adds the stored tax lines. A new item changes the base, so those
 * lines must carry the reviewed tax before the snapshot is compared.
 */
export async function syncReviewedTaxLine(
  tx: CommercialQueryTx & { org_orders_mst?: { findFirstOrThrow?: unknown } },
  input: {
    tenantId: string;
    orderId: string;
    projectedTax: string;
    actorUserId: string;
    appliedAt: Date;
  },
): Promise<void> {
  if (typeof tx.org_orders_mst?.findFirstOrThrow !== 'function') return;
  if (typeof tx.$queryRaw !== 'function' || typeof tx.$executeRaw !== 'function') return;
  const query = tx.$queryRaw.bind(tx);
  const execute = tx.$executeRaw.bind(tx);
  const lines = await query<Array<{ id: string; tax_amount: string }>>`
    SELECT id::text AS id, tax_amount::text AS tax_amount
    FROM org_order_taxes_dtl
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND order_id = ${input.orderId}::uuid
      AND rec_status = 1
    ORDER BY applied_seq ASC, id ASC
  `;
  if (lines.length === 0) {
    if (round4(Number(input.projectedTax)) === 0) return;
    throw new OrderChangeApplyRejected(422, 'TAX_LINE_MISSING');
  }
  const allocated = allocateReviewedTax(
    lines.map((line) => ({ id: line.id, taxAmount: line.tax_amount })),
    input.projectedTax,
  );
  for (const line of allocated) {
    if (lines.length === 1) {
      await execute`
        UPDATE org_order_taxes_dtl AS tax
        SET tax_amount = ${line.taxAmount}::numeric,
            taxable_amount = (
              SELECT COALESCE(SUM(item.total_price), 0)
              FROM org_order_items_dtl AS item
              WHERE item.tenant_org_id = tax.tenant_org_id
                AND item.order_id = tax.order_id
                AND item.rec_status = 1
            ),
            updated_at = ${input.appliedAt},
            updated_by = ${input.actorUserId}::uuid
        WHERE tax.id = ${line.id}::uuid
          AND tax.tenant_org_id = ${input.tenantId}::uuid
          AND tax.order_id = ${input.orderId}::uuid
          AND tax.rec_status = 1
      `;
    } else {
      await execute`
        UPDATE org_order_taxes_dtl
        SET tax_amount = ${line.taxAmount}::numeric,
            updated_at = ${input.appliedAt},
            updated_by = ${input.actorUserId}::uuid
        WHERE id = ${line.id}::uuid
          AND tenant_org_id = ${input.tenantId}::uuid
          AND order_id = ${input.orderId}::uuid
          AND rec_status = 1
      `;
    }
  }
}

export async function assertCommercialSnapshot(
  tx: CommercialQueryTx & { org_orders_mst?: { findFirstOrThrow?: unknown } },
  input: { tenantId: string; orderId: string; projectedTotal: string },
): Promise<void> {
  if (typeof tx.org_orders_mst?.findFirstOrThrow !== 'function') return;
  await recalculateOrderFinancialSnapshotTx(tx as never, input.tenantId, input.orderId);
  const total = await readAppliedOrderTotal(tx, input.tenantId, input.orderId);
  if (total !== input.projectedTotal) throw new OrderChangeApplyRejected(422, 'FINANCIAL_SNAPSHOT_MISMATCH');
}

async function readAppliedOrderTotal(
  tx: CommercialQueryTx,
  tenantId: string,
  orderId: string,
): Promise<string | null> {
  if (typeof tx.$queryRaw !== 'function') return null;
  const rows = await tx.$queryRaw<Array<{ total_amount: string | null }>>`
    SELECT total_amount::text AS total_amount
    FROM org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
  `;
  const total = rows[0]?.total_amount;
  return total == null ? null : Number(total).toFixed(4);
}

async function rowsById<T>(
  tx: CommercialQueryTx,
  ids: readonly string[],
  query: (id: string) => Promise<T[]>,
): Promise<T[]> {
  if (typeof tx.$queryRaw !== 'function' || ids.length === 0) return [];
  const groups = await Promise.all(ids.map((id) => query(id)));
  return groups.flat();
}

function preferenceLevel(kind: string): string {
  if (kind === 'PERSISTED_ITEM') return PREFS_LEVEL.ITEM;
  if (kind === 'PERSISTED_PIECE') return PREFS_LEVEL.PIECE;
  return PREFS_LEVEL.ORDER;
}

function fieldValue(kind: 'text' | 'bool' | 'money', value: string): string | boolean | null {
  if (kind === 'bool') return value === 'true';
  if (kind === 'money') return value === '' ? null : value;
  return value;
}
