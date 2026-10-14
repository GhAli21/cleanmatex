/**
 * In-memory item and piece projection for a future Preview or Apply.
 * Quantity is owned once: ADD_ITEM quantity is the line quantity, and ADD_PIECE
 * materializes that count instead of adding to it. A tracked decrease removes
 * each selected piece once even when REMOVE_PIECE repeats those ids.
 * Persisted identities stay on the same ids. Local add/remove pairs leave no line.
 * This module does not read the database, change workflow state, or price a line.
 */

export type OrderChangeProjectionIssueCode =
  | 'QUANTITY_INVALID'
  | 'UNKNOWN_ITEM'
  | 'UNKNOWN_PIECE'
  | 'UNRESOLVED_LOCAL_REF'
  | 'DUPLICATE_LOCAL_REF'
  | 'DUPLICATE_OPERATION'
  | 'CHANGE_AFTER_REMOVE'
  | 'PARENT_CHILD_CONFLICT'
  | 'PIECE_OPERATIONALLY_PROTECTED'
  | 'PIECE_NOT_ELIGIBLE'
  | 'QUANTITY_DOUBLE_COUNT'
  | 'PIECE_QUANTITY_MISMATCH';

export interface OrderChangeProjectionIssue {
  code: OrderChangeProjectionIssueCode;
  seq: number;
}

export interface OrderChangeProjectionItem {
  id: string;
  productId: string;
  quantity: number;
  pieceTracked: boolean;
  /** False when the line is logically removed. The persisted id remains. */
  active: boolean;
}

export interface OrderChangeProjectionPiece {
  id: string;
  itemId: string;
  /** False when the piece is logically removed. The persisted id remains. */
  active: boolean;
  operationallyProtected: boolean;
}

export interface OrderChangeProjectionBaseline {
  items: OrderChangeProjectionItem[];
  pieces: OrderChangeProjectionPiece[];
}

export type OrderChangeStructuralOperation =
  | { seq: number; code: 'ADD_ITEM'; target: { kind: 'ORDER' }; payload: { clientRef: string; productId: string; quantity: number } }
  | { seq: number; code: 'REMOVE_ITEM'; target: { kind: 'PERSISTED_ITEM'; id: string } | { kind: 'LOCAL_ITEM'; clientRef: string } }
  | { seq: number; code: 'CHANGE_ITEM_QUANTITY'; target: { kind: 'PERSISTED_ITEM'; id: string }; payload: { quantity: number; selectedPieceIds?: readonly string[] } }
  | { seq: number; code: 'ADD_PIECE'; target: { kind: 'PERSISTED_ITEM'; id: string } | { kind: 'LOCAL_ITEM'; clientRef: string }; payload: { clientRef: string } }
  | { seq: number; code: 'REMOVE_PIECE'; target: { kind: 'PERSISTED_PIECE'; id: string } | { kind: 'LOCAL_PIECE'; clientRef: string } };

export interface OrderChangeProjectionEffect {
  seq: number;
  code: OrderChangeStructuralOperation['code'];
  effect: 'ADD_ITEM' | 'REMOVE_ITEM' | 'SET_QUANTITY' | 'ADD_PIECE' | 'REMOVE_PIECE' | 'CANCELLED_LOCAL' | 'ABSORBED';
  itemId: string;
}

export interface OrderChangeProjectionSuccess {
  ok: true;
  /** False when normalization leaves the active structure identical to the baseline. */
  createsChange: boolean;
  items: OrderChangeProjectionItem[];
  pieces: OrderChangeProjectionPiece[];
  effects: OrderChangeProjectionEffect[];
}

export interface OrderChangeProjectionFailure {
  ok: false;
  issue: OrderChangeProjectionIssue;
}

interface WorkingItem extends OrderChangeProjectionItem {
  local: boolean;
  piecesNeeded: number;
  quantityOwnerSeq: number | null;
  selectedPieceIds: string[];
}

interface WorkingPiece extends OrderChangeProjectionPiece {
  local: boolean;
}

function issue(code: OrderChangeProjectionIssueCode, seq: number): OrderChangeProjectionFailure {
  return { ok: false, issue: { code, seq } };
}

function itemKey(target: { kind: string; id?: string; clientRef?: string }): string | null {
  if (target.kind === 'PERSISTED_ITEM' && target.id) return target.id;
  if (target.kind === 'LOCAL_ITEM' && target.clientRef) return target.clientRef;
  return null;
}

function activePieces(pieces: readonly WorkingPiece[], itemId: string): WorkingPiece[] {
  return pieces.filter((piece) => piece.itemId === itemId && piece.active);
}

function sameStructure(baseline: OrderChangeProjectionBaseline, items: OrderChangeProjectionItem[], pieces: OrderChangeProjectionPiece[]): boolean {
  const activeItems = items.filter((item) => item.active).map((item) => `${item.id}:${item.productId}:${item.quantity}:${item.pieceTracked}`).sort();
  const baseItems = baseline.items.filter((item) => item.active).map((item) => `${item.id}:${item.productId}:${item.quantity}:${item.pieceTracked}`).sort();
  const activePieceIds = pieces.filter((piece) => piece.active).map((piece) => `${piece.id}:${piece.itemId}`).sort();
  const basePieceIds = baseline.pieces.filter((piece) => piece.active).map((piece) => `${piece.id}:${piece.itemId}`).sort();
  return activeItems.join('|') === baseItems.join('|') && activePieceIds.join('|') === basePieceIds.join('|');
}

/**
 * Projects item and piece structure in sequence order.
 * Local lines cancelled inside the batch are omitted. Persisted removals stay
 * inactive so historical ids are not reused or deleted.
 */
export function projectOrderChangeStructure(
  baseline: OrderChangeProjectionBaseline,
  operations: readonly OrderChangeStructuralOperation[],
): OrderChangeProjectionSuccess | OrderChangeProjectionFailure {
  const ordered = operations.map((operation, index) => ({ operation, index }))
    .sort((left, right) => left.operation.seq - right.operation.seq || left.index - right.index)
    .map((entry) => entry.operation);

  const items = new Map<string, WorkingItem>();
  for (const item of baseline.items) {
    items.set(item.id, { ...item, local: false, piecesNeeded: 0, quantityOwnerSeq: null, selectedPieceIds: [] });
  }
  const pieces: WorkingPiece[] = baseline.pieces.map((piece) => ({ ...piece, local: false }));
  const effects: OrderChangeProjectionEffect[] = [];
  const seenPieceRemovals = new Set<string>();
  const seenItemRemovals = new Set<string>();

  for (const operation of ordered) {
    if (operation.code === 'ADD_ITEM') {
      if (!Number.isInteger(operation.payload.quantity) || operation.payload.quantity < 1) {
        return issue('QUANTITY_INVALID', operation.seq);
      }
      if (items.has(operation.payload.clientRef)) return issue('DUPLICATE_LOCAL_REF', operation.seq);
      items.set(operation.payload.clientRef, {
        id: operation.payload.clientRef,
        productId: operation.payload.productId,
        quantity: operation.payload.quantity,
        pieceTracked: false,
        active: true,
        local: true,
        piecesNeeded: 0,
        quantityOwnerSeq: operation.seq,
        selectedPieceIds: [],
      });
      effects.push({ seq: operation.seq, code: operation.code, effect: 'ADD_ITEM', itemId: operation.payload.clientRef });
      continue;
    }

    if (operation.code === 'REMOVE_ITEM') {
      const id = itemKey(operation.target);
      const item = id ? items.get(id) : undefined;
      if (!item) return issue('UNKNOWN_ITEM', operation.seq);
      if (!item.active || seenItemRemovals.has(item.id)) return issue('DUPLICATE_OPERATION', operation.seq);
      item.active = false;
      seenItemRemovals.add(item.id);
      for (const piece of activePieces(pieces, item.id)) piece.active = false;
      effects.push({
        seq: operation.seq,
        code: operation.code,
        effect: item.local ? 'CANCELLED_LOCAL' : 'REMOVE_ITEM',
        itemId: item.id,
      });
      continue;
    }

    if (operation.code === 'CHANGE_ITEM_QUANTITY') {
      const item = items.get(operation.target.id);
      if (!item || item.local) return issue('UNKNOWN_ITEM', operation.seq);
      if (!item.active) return issue('CHANGE_AFTER_REMOVE', operation.seq);
      if (!Number.isInteger(operation.payload.quantity) || operation.payload.quantity < 1) {
        return issue('QUANTITY_INVALID', operation.seq);
      }
      if (item.quantityOwnerSeq !== null) return issue('DUPLICATE_OPERATION', operation.seq);
      const selected = [...(operation.payload.selectedPieceIds ?? [])];
      const delta = operation.payload.quantity - item.quantity;
      if (item.pieceTracked) {
        if (delta < 0) {
          if (selected.length !== Math.abs(delta)) return issue('PIECE_NOT_ELIGIBLE', operation.seq);
          for (const pieceId of selected) {
            const piece = pieces.find((candidate) => candidate.id === pieceId && candidate.itemId === item.id && candidate.active);
            if (!piece) return issue('PIECE_NOT_ELIGIBLE', operation.seq);
            if (piece.operationallyProtected) return issue('PIECE_OPERATIONALLY_PROTECTED', operation.seq);
            piece.active = false;
            seenPieceRemovals.add(piece.id);
          }
        } else if (selected.length > 0) {
          return issue('PIECE_NOT_ELIGIBLE', operation.seq);
        }
        item.piecesNeeded = Math.max(delta, 0);
      } else if (selected.length > 0 || pieces.some((piece) => piece.itemId === item.id)) {
        return issue('PIECE_NOT_ELIGIBLE', operation.seq);
      }
      item.quantity = operation.payload.quantity;
      item.quantityOwnerSeq = operation.seq;
      item.selectedPieceIds = selected;
      effects.push({ seq: operation.seq, code: operation.code, effect: 'SET_QUANTITY', itemId: item.id });
      continue;
    }

    if (operation.code === 'ADD_PIECE') {
      const id = itemKey(operation.target);
      const item = id ? items.get(id) : undefined;
      if (!item) return issue('UNRESOLVED_LOCAL_REF', operation.seq);
      if (!item.active) return issue('PARENT_CHILD_CONFLICT', operation.seq);
      if (pieces.some((piece) => piece.id === operation.payload.clientRef) || items.has(operation.payload.clientRef)) {
        return issue('DUPLICATE_LOCAL_REF', operation.seq);
      }
      item.pieceTracked = true;
      if (item.local) {
        const materialized = activePieces(pieces, item.id).length;
        if (materialized + 1 > item.quantity) return issue('PIECE_QUANTITY_MISMATCH', operation.seq);
      } else if (item.quantityOwnerSeq !== null) {
        if (item.piecesNeeded < 1) return issue('QUANTITY_DOUBLE_COUNT', operation.seq);
        item.piecesNeeded -= 1;
      } else {
        item.quantity += 1;
      }
      pieces.push({
        id: operation.payload.clientRef,
        itemId: item.id,
        active: true,
        operationallyProtected: false,
        local: true,
      });
      effects.push({ seq: operation.seq, code: operation.code, effect: 'ADD_PIECE', itemId: item.id });
      continue;
    }

    const pieceId = operation.target.kind === 'PERSISTED_PIECE' ? operation.target.id : operation.target.clientRef;
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    if (!piece) return issue('UNKNOWN_PIECE', operation.seq);
    const parent = items.get(piece.itemId);
    if (!parent || seenItemRemovals.has(parent.id) || !parent.active) return issue('PARENT_CHILD_CONFLICT', operation.seq);
    if (!piece.active || seenPieceRemovals.has(piece.id)) {
      if (parent.selectedPieceIds.includes(piece.id)) {
        effects.push({ seq: operation.seq, code: operation.code, effect: 'ABSORBED', itemId: parent.id });
        continue;
      }
      return issue('DUPLICATE_OPERATION', operation.seq);
    }
    if (piece.operationallyProtected) return issue('PIECE_OPERATIONALLY_PROTECTED', operation.seq);
    if (parent.quantityOwnerSeq !== null) return issue('QUANTITY_DOUBLE_COUNT', operation.seq);
    piece.active = false;
    seenPieceRemovals.add(piece.id);
    parent.quantity = Math.max(0, parent.quantity - 1);
    if (parent.pieceTracked && activePieces(pieces, parent.id).length === 0) parent.active = false;
    effects.push({
      seq: operation.seq,
      code: operation.code,
      effect: piece.local ? 'CANCELLED_LOCAL' : 'REMOVE_PIECE',
      itemId: parent.id,
    });
  }

  for (const item of items.values()) {
    if (!item.active) continue;
    const count = activePieces(pieces, item.id).length;
    if (item.pieceTracked && count !== item.quantity) return issue('PIECE_QUANTITY_MISMATCH', item.quantityOwnerSeq ?? 0);
    if (item.piecesNeeded !== 0) return issue('PIECE_QUANTITY_MISMATCH', item.quantityOwnerSeq ?? 0);
  }

  const projectedItems = [...items.values()]
    .filter((item) => !(item.local && !item.active))
    .map(({ local: _local, piecesNeeded: _needed, quantityOwnerSeq: _owner, selectedPieceIds: _selected, ...item }) => item)
    .sort((left, right) => left.id.localeCompare(right.id));
  const projectedPieces = pieces
    .filter((piece) => {
      const parent = items.get(piece.itemId);
      return !(piece.local && (!piece.active || !parent?.active));
    })
    .map(({ local: _local, ...piece }) => piece)
    .sort((left, right) => left.id.localeCompare(right.id));
  const cancelledLocalIds = new Set(
    [...items.values()].filter((item) => item.local && !item.active).map((item) => item.id),
  );
  const createsChange = !sameStructure(baseline, projectedItems, projectedPieces);
  const visibleEffects = createsChange
    ? effects.filter((effect) => effect.effect !== 'CANCELLED_LOCAL' && effect.effect !== 'ABSORBED' && !cancelledLocalIds.has(effect.itemId))
    : [];

  return {
    ok: true,
    createsChange,
    items: projectedItems,
    pieces: projectedPieces,
    effects: visibleEffects,
  };
}
