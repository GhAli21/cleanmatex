/**
 * In-memory preference projection for a future Preview or Apply.
 * Definition, kind, category, and extra price come from the supplied catalog.
 * A content edit keeps the persisted row id. A different kind is remove plus add.
 * ORDER extras are the only preference money addend. ITEM and PIECE extras are
 * embedded on the parent line once. Confirmation state is left unchanged.
 */

import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import { PREFS_LEVEL } from '@/lib/constants/order-preferences';
import { round4 } from '@/lib/services/order-financial-aggregation';
import {
  projectOrderChangeStructure,
  type OrderChangeProjectionBaseline,
  type OrderChangeProjectionIssue,
  type OrderChangeProjectionIssueCode,
  type OrderChangeStructuralOperation,
} from '@/lib/services/order-change/order-change-projection';
import {
  isContaminatingPreferenceCharge,
  sumMoneyAddendCharges,
  type ChargeMoneyRow,
} from '@/lib/utils/order-charge-money';

export type OrderChangePreferenceLevel = 'ORDER' | 'ITEM' | 'PIECE';

export type OrderChangePreferenceIssueCode =
  | OrderChangeProjectionIssueCode
  | 'UNKNOWN_PREFERENCE'
  | 'PREFERENCE_SOURCE_MISMATCH'
  | 'PREFERENCE_LEVEL_MISMATCH'
  | 'PREFERENCE_KIND_REPLACEMENT'
  | 'DUPLICATE_OPERATION';

export interface OrderChangePreferenceIssue {
  code: OrderChangePreferenceIssueCode;
  seq: number;
}

/** Catalog fact supplied by the caller. The browser does not own price or kind. */
export interface OrderChangePreferenceDefinition {
  id: string;
  code: string;
  kind: string;
  category: string;
  level: OrderChangePreferenceLevel;
  extraPrice: string;
}

export interface OrderChangePreferenceRow {
  id: string;
  level: OrderChangePreferenceLevel;
  orderItemId: string | null;
  orderItemPieceId: string | null;
  preferenceId: string;
  preferenceCode: string;
  preferenceKind: string;
  preferenceCategory: string;
  preferenceContent: string | null;
  extraPrice: string;
  processingConfirmed: boolean;
  active: boolean;
}

export type OrderChangePreferenceOperation =
  | {
      seq: number;
      code: 'ADD_PREFERENCE';
      target:
        | { kind: 'ORDER' }
        | { kind: 'PERSISTED_ITEM'; id: string }
        | { kind: 'LOCAL_ITEM'; clientRef: string }
        | { kind: 'PERSISTED_PIECE'; id: string }
        | { kind: 'LOCAL_PIECE'; clientRef: string };
      payload: { clientRef: string; preferenceId: string; preferenceCode: string; preferenceContent?: string };
    }
  | {
      seq: number;
      code: 'CHANGE_PREFERENCE';
      target: { kind: 'PERSISTED_PREFERENCE'; id: string } | { kind: 'LOCAL_PREFERENCE'; clientRef: string };
      payload: { preferenceContent?: string; preferenceId?: string };
    }
  | {
      seq: number;
      code: 'REMOVE_PREFERENCE';
      target: { kind: 'PERSISTED_PREFERENCE'; id: string } | { kind: 'LOCAL_PREFERENCE'; clientRef: string };
    };

export interface OrderChangePreferenceChargeCache {
  /** Active ORDER extras, each counted once. ITEM and PIECE extras are excluded. */
  orderAddend: string;
  /** Active ITEM extras plus PIECE extras for that item, each counted once. */
  lineEmbeddedByItemId: Record<string, string>;
}

export interface OrderChangePreferenceProjectionSuccess {
  ok: true;
  createsChange: boolean;
  preferences: OrderChangePreferenceRow[];
  charges: OrderChangePreferenceChargeCache;
}

export interface OrderChangePreferenceProjectionFailure {
  ok: false;
  issue: OrderChangePreferenceIssue | OrderChangeProjectionIssue;
}

interface WorkingPreference extends OrderChangePreferenceRow {
  local: boolean;
}

const PRICE_PATTERN = /^(\d+)(?:\.(\d{1,4}))?$/;

function toUnits(value: string): bigint | null {
  const match = PRICE_PATTERN.exec(value);
  if (!match) return null;
  const fraction = (match[2] ?? '').padEnd(4, '0');
  return BigInt(match[1]) * 10000n + BigInt(fraction);
}

function parentItemId(
  preference: Pick<OrderChangePreferenceRow, 'level' | 'orderItemId' | 'orderItemPieceId'>,
  pieceItemId: ReadonlyMap<string, string>,
): string | null {
  if (preference.level === 'ITEM') return preference.orderItemId;
  if (preference.level === 'PIECE' && preference.orderItemPieceId) {
    return pieceItemId.get(preference.orderItemPieceId) ?? null;
  }
  return null;
}

function preferenceSignature(row: OrderChangePreferenceRow): string {
  return [
    row.id,
    row.level,
    row.orderItemId ?? '',
    row.orderItemPieceId ?? '',
    row.preferenceId,
    row.preferenceKind,
    row.preferenceContent ?? '',
    row.extraPrice,
    row.active ? '1' : '0',
  ].join(':');
}

/**
 * Projects preference rows and the single-count charge cache.
 * Structural operations are applied first through the WP06 projection.
 * An explicit preference edit whose parent item or piece is removed conflicts.
 */
export function projectOrderChangePreferences(input: {
  baseline: OrderChangeProjectionBaseline;
  preferences: readonly OrderChangePreferenceRow[];
  catalog: readonly OrderChangePreferenceDefinition[];
  structuralOperations?: readonly OrderChangeStructuralOperation[];
  operations: readonly OrderChangePreferenceOperation[];
}): OrderChangePreferenceProjectionSuccess | OrderChangePreferenceProjectionFailure {
  const structure = projectOrderChangeStructure(input.baseline, input.structuralOperations ?? []);
  if (!structure.ok) return structure;

  const activeItems = new Set(structure.items.filter((item) => item.active).map((item) => item.id));
  const activePieces = new Map(structure.pieces.filter((piece) => piece.active).map((piece) => [piece.id, piece.itemId]));
  const pieceItemId = new Map(structure.pieces.map((piece) => [piece.id, piece.itemId]));
  const catalog = new Map(input.catalog.map((definition) => [definition.id, definition]));
  const preferences = new Map<string, WorkingPreference>();
  for (const row of input.preferences) {
    preferences.set(row.id, { ...row, local: false });
  }
  const removed = new Set<string>();
  const ordered = input.operations
    .map((operation, index) => ({ operation, index }))
    .sort((left, right) => left.operation.seq - right.operation.seq || left.index - right.index)
    .map((entry) => entry.operation);

  const resolveTarget = (operation: OrderChangePreferenceOperation): { itemId: string | null; pieceId: string | null; level: OrderChangePreferenceLevel } | OrderChangePreferenceIssue => {
    if (operation.code !== 'ADD_PREFERENCE') return { itemId: null, pieceId: null, level: 'ORDER' };
    if (operation.target.kind === 'ORDER') return { itemId: null, pieceId: null, level: 'ORDER' };
    if (operation.target.kind === 'PERSISTED_ITEM' || operation.target.kind === 'LOCAL_ITEM') {
      const itemId = operation.target.kind === 'PERSISTED_ITEM' ? operation.target.id : operation.target.clientRef;
      if (!activeItems.has(itemId)) return { code: 'PARENT_CHILD_CONFLICT', seq: operation.seq };
      return { itemId, pieceId: null, level: 'ITEM' };
    }
    const pieceId = operation.target.kind === 'PERSISTED_PIECE' ? operation.target.id : operation.target.clientRef;
    const itemId = activePieces.get(pieceId);
    if (!itemId) return { code: 'PARENT_CHILD_CONFLICT', seq: operation.seq };
    return { itemId, pieceId, level: 'PIECE' };
  };

  for (const operation of ordered) {
    if (operation.code === 'ADD_PREFERENCE') {
      const definition = catalog.get(operation.payload.preferenceId);
      if (!definition || definition.code !== operation.payload.preferenceCode || toUnits(definition.extraPrice) === null) {
        return { ok: false, issue: { code: 'PREFERENCE_SOURCE_MISMATCH', seq: operation.seq } };
      }
      const target = resolveTarget(operation);
      if ('code' in target) return { ok: false, issue: target };
      if (definition.level !== target.level) {
        return { ok: false, issue: { code: 'PREFERENCE_LEVEL_MISMATCH', seq: operation.seq } };
      }
      if (preferences.has(operation.payload.clientRef)) {
        return { ok: false, issue: { code: 'DUPLICATE_OPERATION', seq: operation.seq } };
      }
      preferences.set(operation.payload.clientRef, {
        id: operation.payload.clientRef,
        level: definition.level,
        orderItemId: target.itemId,
        orderItemPieceId: target.pieceId,
        preferenceId: definition.id,
        preferenceCode: definition.code,
        preferenceKind: definition.kind,
        preferenceCategory: definition.category,
        preferenceContent: operation.payload.preferenceContent ?? null,
        extraPrice: definition.extraPrice,
        processingConfirmed: false,
        active: true,
        local: true,
      });
      continue;
    }

    const id = operation.target.kind === 'PERSISTED_PREFERENCE' ? operation.target.id : operation.target.clientRef;
    const row = preferences.get(id);
    if (!row) return { ok: false, issue: { code: 'UNKNOWN_PREFERENCE', seq: operation.seq } };
    const ownerItemId = parentItemId(row, pieceItemId);
    const ownerPieceActive = row.orderItemPieceId === null || activePieces.has(row.orderItemPieceId);
    const ownerItemActive = ownerItemId === null || activeItems.has(ownerItemId);
    if (!ownerPieceActive || !ownerItemActive) {
      return { ok: false, issue: { code: 'PARENT_CHILD_CONFLICT', seq: operation.seq } };
    }
    if (!row.active || removed.has(row.id)) {
      return { ok: false, issue: { code: 'DUPLICATE_OPERATION', seq: operation.seq } };
    }
    if (operation.code === 'REMOVE_PREFERENCE') {
      row.active = false;
      removed.add(row.id);
      continue;
    }
    if (operation.payload.preferenceId !== undefined && operation.payload.preferenceId !== row.preferenceId) {
      return { ok: false, issue: { code: 'PREFERENCE_KIND_REPLACEMENT', seq: operation.seq } };
    }
    if (operation.payload.preferenceContent !== undefined) row.preferenceContent = operation.payload.preferenceContent;
  }

  for (const row of preferences.values()) {
    if (!row.active) continue;
    const ownerItemId = parentItemId(row, pieceItemId);
    const ownerPieceActive = row.orderItemPieceId === null || activePieces.has(row.orderItemPieceId);
    const ownerItemActive = ownerItemId === null || activeItems.has(ownerItemId);
    if (!ownerPieceActive || !ownerItemActive) row.active = false;
  }

  const projected = [...preferences.values()]
    .filter((row) => !(row.local && !row.active))
    .map(({ local: _local, ...row }) => row)
    .sort((left, right) => left.id.localeCompare(right.id));

  const baselineSignature = input.preferences.map(preferenceSignature).sort().join('|');
  const projectedSignature = projected.map(preferenceSignature).sort().join('|');
  const lineEmbedded = new Map<string, number>();
  const chargeRows: ChargeMoneyRow[] = [];
  const levels = new Map<string, string>();
  const counted = new Set<string>();
  for (const row of projected) {
    if (!row.active || counted.has(row.id)) continue;
    counted.add(row.id);
    if (toUnits(row.extraPrice) === null) return { ok: false, issue: { code: 'PREFERENCE_SOURCE_MISMATCH', seq: 0 } };
    chargeRows.push({ amount: row.extraPrice, charge_type: CHARGE_TYPES.PREFERENCE, charge_source_id: row.id });
    levels.set(row.id, row.level);
    if (row.level === PREFS_LEVEL.ORDER) continue;
    const itemId = parentItemId(row, pieceItemId);
    if (!itemId) continue;
    if (!isContaminatingPreferenceCharge({ amount: row.extraPrice, charge_type: CHARGE_TYPES.PREFERENCE, charge_source_id: row.id }, levels)) continue;
    lineEmbedded.set(itemId, round4((lineEmbedded.get(itemId) ?? 0) + Number(row.extraPrice)));
  }

  return {
    ok: true,
    createsChange: structure.createsChange || baselineSignature !== projectedSignature,
    preferences: projected,
    charges: {
      orderAddend: round4(sumMoneyAddendCharges(chargeRows, levels)).toFixed(4),
      lineEmbeddedByItemId: Object.fromEntries([...lineEmbedded.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([itemId, amount]) => [itemId, round4(amount).toFixed(4)])),
    },
  };
}
